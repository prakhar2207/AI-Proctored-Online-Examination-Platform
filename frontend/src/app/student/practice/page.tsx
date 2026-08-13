'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSession, apiFetch } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import ProfileDropdown from '@/components/ProfileDropdown';
import LanguageSelector from '@/components/LanguageSelector';
import ThemeSelector from '@/components/ThemeSelector';
import Link from 'next/link';

interface Exam {
  id: number;
  title: string;
  subject: string;
  duration_minutes: number;
  start_window: string;
  end_window: string;
  is_mock?: boolean;
  exam_type?: 'mass' | 'individual';
  cutoff_score?: number | null;
  student_session_status?: string;
}

interface Result {
  exam_id: number;
  exam_title: string;
  subject: string;
  total_score: string;
  percentile: string | null;
  submitted_at: string;
}

export default function StudentPracticeHub() {
  const router = useRouter();
  const { t, tQuestion } = useLanguage();
  const [user, setUser] = useState<{ username: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [mockSubjects, setMockSubjects] = useState<string[]>(['Physics', 'Chemistry', 'Mathematics', 'Aptitude', 'Verbal Ability', 'Computer Science']);
  const [selectedSubject, setSelectedSubject] = useState<string>('Aptitude');
  const [startingMock, setStartingMock] = useState(false);
  const [enteringId, setEnteringId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'attempted'>('available');

  useEffect(() => {
    const session = getAuthSession();
    if (!session) { router.replace('/login'); return; }
    if (session.role !== 'student') {
      router.replace(session.role === 'admin' ? '/admin/dashboard' : '/examiner/dashboard');
      return;
    }
    setUser({ username: session.username || 'Student', email: session.email || '', role: session.role });
    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      const [examRes, resultRes, subjRes] = await Promise.all([
        apiFetch('/exam-engine/exams/'),
        apiFetch('/results-portal/student/'),
        apiFetch('/exam-engine/exams/mock_subjects/')
      ]);
      if (examRes.status === 200) setExams(await examRes.json());
      if (resultRes.status === 200) setResults(await resultRes.json());
      if (subjRes.status === 200) {
        const data = await subjRes.json();
        if (data.subjects && data.subjects.length > 0) {
          setMockSubjects(data.subjects);
          setSelectedSubject(data.subjects[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnterExam = async (examId: number) => {
    setEnteringId(examId);
    try {
      const res = await apiFetch(`/exam-engine/exams/${examId}/enter/`, { method: 'POST' });
      if (res.status === 200) {
        router.push(`/student/exam/${examId}`);
      } else {
        const e = await res.json();
        alert(e.error || 'Failed to enter exam.');
      }
    } catch {
      alert('Network error.');
    } finally {
      setEnteringId(null);
    }
  };

  const handleStartMock = async (subj: string) => {
    setStartingMock(true);
    try {
      const res = await apiFetch('/exam-engine/exams/start_mock/', {
        method: 'POST',
        body: JSON.stringify({ subject: subj, duration_minutes: 45 })
      });
      if (res.status === 200) {
        const data = await res.json();
        handleEnterExam(data.exam_id);
      } else {
        alert("Failed to initialize AI Mock Practice Exam.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setStartingMock(false);
    }
  };

  const isAttempted = (ex: Exam) => {
    return ['submitted', 'auto_submitted', 'flagged'].includes(ex.student_session_status || '') ||
      results.some(r => r.exam_id === ex.id);
  };

  // STRICT FILTERING: Include ONLY mock tests
  const mockExams = exams.filter(ex => ex.is_mock || (ex.title || '').toLowerCase().includes('mock'));
  const availableMocks = mockExams.filter(ex => !isAttempted(ex));
  const attemptedMocks = mockExams.filter(ex => isAttempted(ex));

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--background)' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ── Navbar ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 56,
        background: 'var(--nav-bg)', borderBottom: '1px solid var(--nav-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
            onClick={() => router.push('/student/dashboard')}
          >
            AI-Exam
          </span>
          <span style={{ color: 'var(--muted-text)', margin: '0 8px' }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{tQuestion("Practice Hub")}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeSelector />
          <LanguageSelector />
          <ProfileDropdown user={user} />
        </div>
      </nav>

      {/* ── Content ── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>
        
        {/* Module Switcher Tab */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginBottom: '32px' 
        }}>
          <div style={{
            display: 'flex',
            background: 'var(--table-head-bg)',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
          }}>
            <Link href="/student/exams" style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '10px 24px',
                borderRadius: '8px',
                background: 'transparent',
                color: 'var(--muted-text)',
                fontWeight: 600,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}>
                <span style={{ fontSize: '16px', opacity: 0.7 }}>📝</span>
                {tQuestion("Assessments")}
              </div>
            </Link>
            <Link href="/student/practice" style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '10px 24px',
                borderRadius: '8px',
                background: 'var(--card-bg)',
                color: 'var(--foreground)',
                fontWeight: 700,
                fontSize: '14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}>
                <span style={{ fontSize: '16px' }}>⚡</span>
                {tQuestion("Practice Hub")}
              </div>
            </Link>
          </div>
        </div>

        {/* AI Mock Test Generator Banner - Soft Pastel Gradient */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: '20px',
          padding: '32px',
          marginBottom: '36px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '24px'
        }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <span style={{ fontSize: '14px' }}>✨</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {tQuestion("Instant AI Practice Mock Test")}
              </span>
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--foreground)' }}>
              {tQuestion("Practice Anytime. No Limits.")}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--muted-text)', margin: 0, maxWidth: '600px', lineHeight: 1.6 }}>
              {tQuestion("Generate an instant practice exam for any subject. Submit anytime for real-time AI grading and immediate scorecard feedback to improve your skills.")}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--card-bg)',
                color: 'var(--foreground)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}
            >
              {mockSubjects.map(sub => (
                <option key={sub} value={sub}>{tQuestion(sub)}</option>
              ))}
            </select>

            <button
              onClick={() => handleStartMock(selectedSubject)}
              disabled={startingMock || enteringId !== null}
              style={{
                padding: '12px 24px',
                background: '#8b5cf6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.3)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {startingMock ? tQuestion('Generating...') : tQuestion('Start Practice →')}
            </button>
          </div>
        </div>

        {/* Split Layout: Available vs Attempted */}
        <div style={{ display: 'flex', gap: '2px', background: 'var(--table-head-bg)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)', maxWidth: 'max-content', marginBottom: '24px' }}>
          <button
            onClick={() => setActiveTab('available')}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'available' ? 'var(--card-bg)' : 'transparent',
              color: activeTab === 'available' ? 'var(--foreground)' : 'var(--muted-text)',
              fontSize: '14px',
              fontWeight: activeTab === 'available' ? 600 : 500,
              cursor: 'pointer',
              boxShadow: activeTab === 'available' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {tQuestion("Available Mock Tests")}
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: activeTab === 'available' ? 'var(--table-head-bg)' : 'rgba(128,128,128,0.1)', fontWeight: 700 }}>
              {availableMocks.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('attempted')}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'attempted' ? 'var(--card-bg)' : 'transparent',
              color: activeTab === 'attempted' ? 'var(--foreground)' : 'var(--muted-text)',
              fontSize: '14px',
              fontWeight: activeTab === 'attempted' ? 600 : 500,
              cursor: 'pointer',
              boxShadow: activeTab === 'attempted' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {tQuestion("Attempted Mock Tests")}
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: activeTab === 'attempted' ? 'var(--table-head-bg)' : 'rgba(128,128,128,0.1)', fontWeight: 700 }}>
              {attemptedMocks.length}
            </span>
          </button>
        </div>

        {/* Exam Cards Grid */}
        {(activeTab === 'available' ? availableMocks : attemptedMocks).length === 0 ? (
          <div style={{ padding: '80px 20px', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.8 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 8px 0' }}>
              {activeTab === 'available' ? tQuestion("No available mock tests right now") : tQuestion("No mock tests attempted yet")}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--muted-text)', margin: 0, maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
              {activeTab === 'available' 
                ? tQuestion('Use the banner above to instantly generate a new practice mock test for any subject.')
                : tQuestion('Once you complete a practice mock test, you can review your score and AI-graded analytics here.')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {(activeTab === 'available' ? availableMocks : attemptedMocks).map(ex => {
              const resultData = results.find(r => r.exam_id === ex.id);

              return (
                <div key={ex.id} style={{
                  background: 'var(--card-bg)',
                  borderRadius: '16px',
                  border: '1px solid var(--border)',
                  padding: '24px',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                  cursor: (activeTab === 'available') ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  if (activeTab === 'available') {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.06)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab === 'available') {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)';
                  }
                }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#8b5cf6' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(139, 92, 246, 0.1)',
                      color: '#8b5cf6',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      <span style={{ fontSize: '13px' }}>⚡</span>
                      {tQuestion("Practice Mock")}
                    </div>
                  </div>

                  <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--foreground)', lineHeight: 1.3 }}>
                    {tQuestion(ex.title)}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', background: 'var(--table-head-bg)', color: 'var(--muted-text)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                      {tQuestion(ex.subject)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--muted-text)', marginBottom: '20px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      <span>{tQuestion("Duration")}: {ex.duration_minutes} {tQuestion("minutes")}</span>
                    </div>

                    {activeTab === 'attempted' && (
                      <div style={{
                        marginTop: '6px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: resultData ? 'rgba(16, 185, 129, 0.08)' : 'rgba(139, 92, 246, 0.08)',
                        border: `1px solid ${resultData ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.2)'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        {resultData ? (
                          <>
                            <span style={{ fontSize: '12px', color: 'var(--foreground)', fontWeight: 600 }}>{tQuestion("Score")}: <strong style={{ color: '#10b981' }}>{resultData.total_score}</strong></span>
                            {resultData.percentile !== null && resultData.percentile !== undefined && (
                              <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 600 }}>{resultData.percentile}%ile</span>
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: 500 }}>
                            {tQuestion("Submitted (Under Review)")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {activeTab === 'available' ? (
                    <button
                      onClick={() => handleEnterExam(ex.id)}
                      disabled={enteringId === ex.id}
                      style={{
                        width: '100%',
                        padding: '11px 0',
                        background: '#8b5cf6',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {enteringId === ex.id ? tQuestion('Entering...') : tQuestion('Start Practice →')}
                    </button>
                  ) : (
                    <button
                      onClick={() => resultData ? router.push(`/student/results/${ex.id}`) : null}
                      disabled={!resultData}
                      style={{
                        width: '100%',
                        padding: '11px 0',
                        background: 'transparent',
                        color: resultData ? '#3b82f6' : 'var(--muted-text)',
                        border: `1px solid ${resultData ? 'rgba(59, 130, 246, 0.3)' : 'var(--border)'}`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: resultData ? 'pointer' : 'not-allowed',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {resultData ? tQuestion("View Score & Analytics") : tQuestion("Pending AI Review")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
