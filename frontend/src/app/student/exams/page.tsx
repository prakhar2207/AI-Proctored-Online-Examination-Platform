'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
  exam_type?: 'mass' | 'individual';
  cutoff_score?: number | null;
  is_passed?: boolean | null;
  total_score: string;
  percentile: string | null;
  submitted_at: string;
}

export default function StudentExamsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { t, tQuestion } = useLanguage();
  const [user, setUser] = useState<{ username: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [enteringId, setEnteringId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'attempted' | 'past'>('all');

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
      const [examRes, resultRes] = await Promise.all([
        apiFetch('/exam-engine/exams/'),
        apiFetch('/results-portal/student/')
      ]);
      if (examRes.status === 200) setExams(await examRes.json());
      if (resultRes.status === 200) setResults(await resultRes.json());
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

  const now = new Date();

  const isAttempted = (ex: Exam) => {
    return ['submitted', 'auto_submitted', 'flagged'].includes(ex.student_session_status || '') ||
      results.some(r => r.exam_id === ex.id);
  };

  // STRICT FILTERING: Exclude ALL mock tests from this view
  const officialExams = exams.filter(ex => !ex.is_mock && !(ex.title || '').toLowerCase().includes('mock'));

  const attemptedExams = officialExams.filter(ex => isAttempted(ex));
  const liveExams = officialExams.filter(ex =>
    !isAttempted(ex) &&
    new Date(ex.start_window) <= now &&
    new Date(ex.end_window) >= now
  );
  const upcomingExams = officialExams.filter(ex =>
    !isAttempted(ex) &&
    new Date(ex.start_window) > now
  );
  const pastExams = officialExams.filter(ex =>
    !isAttempted(ex) &&
    new Date(ex.end_window) < now
  );

  const getDisplayedExams = () => {
    switch (filter) {
      case 'live': return liveExams;
      case 'upcoming': return upcomingExams;
      case 'attempted': return attemptedExams;
      case 'past': return pastExams;
      case 'all':
      default:
        return officialExams;
    }
  };

  const displayedExams = getDisplayedExams();

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
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{tQuestion("My Exams")}</span>
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
                <span style={{ fontSize: '16px' }}>📝</span>
                {tQuestion("Assessments")}
              </div>
            </Link>
            <Link href="/student/practice" style={{ textDecoration: 'none' }}>
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
                <span style={{ fontSize: '16px', opacity: 0.7 }}>⚡</span>
                {tQuestion("Practice Hub")}
              </div>
            </Link>
          </div>
        </div>

        {/* Filter Bar Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>{tQuestion("Examinations")}</h1>
            <p style={{ fontSize: 14, color: 'var(--muted-text)', margin: 0 }}>{tQuestion("Browse and take your assigned official exams.")}</p>
          </div>

          {/* Filter Tabs */}
          <div style={{
            display: 'flex',
            background: 'var(--table-head-bg)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            gap: '2px',
            overflowX: 'auto',
            maxWidth: '100%'
          }}>
            {[
              { key: 'all', label: 'All', count: officialExams.length },
              { key: 'live', label: 'Live', count: liveExams.length, dotColor: '#10b981' },
              { key: 'upcoming', label: 'Upcoming', count: upcomingExams.length, dotColor: '#3b82f6' },
              { key: 'attempted', label: 'Attempted', count: attemptedExams.length, dotColor: '#10b981' },
              { key: 'past', label: 'Past / Closed', count: pastExams.length, dotColor: '#64748b' },
            ].map(tab => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: active ? 'var(--card-bg)' : 'transparent',
                    color: active ? 'var(--foreground)' : 'var(--muted-text)',
                    fontSize: '13px',
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab.dotColor && (
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: tab.dotColor
                    }} />
                  )}
                  <span>{tQuestion(tab.label)}</span>
                  <span style={{
                    fontSize: '11px',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: active ? 'var(--table-head-bg)' : 'rgba(128,128,128,0.15)',
                    color: active ? 'var(--foreground)' : 'var(--muted-text)',
                    fontWeight: 600
                  }}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Exam Cards Grid */}
        {displayedExams.length === 0 ? (
          <div style={{ padding: '64px 20px', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px' }}>
            <div style={{ fontSize: '44px', marginBottom: '14px' }}>
              {filter === 'live' ? '⚡' : filter === 'upcoming' ? '🗓️' : filter === 'attempted' ? '✍️' : filter === 'past' ? '📁' : '📚'}
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 6px 0' }}>
              No {filter !== 'all' ? tQuestion(filter) : ''} official exams found
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--muted-text)', margin: 0 }}>
              {filter === 'live' && tQuestion('There are no live assigned exams open right now.')}
              {filter === 'upcoming' && tQuestion('You have no upcoming scheduled exams.')}
              {filter === 'attempted' && tQuestion('You have not completed any exams yet.')}
              {filter === 'past' && tQuestion('You have no past or closed examinations.')}
              {filter === 'all' && tQuestion('You do not have any assigned examinations at the moment.')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {displayedExams.map(ex => {
              const attempted = isAttempted(ex);
              const isLive = !attempted && (new Date(ex.start_window) <= now && new Date(ex.end_window) >= now);
              const isUpcoming = !attempted && new Date(ex.start_window) > now;
              const isPast = !attempted && new Date(ex.end_window) < now;

              const resultData = results.find(r => r.exam_id === ex.id);

              let statusColor = '#3b82f6';
              let statusText = 'Upcoming';
              let topBarColor = '#3b82f6';

              if (attempted) {
                statusColor = '#10b981';
                statusText = resultData ? 'Completed & Graded' : 'Submitted';
                topBarColor = '#10b981';
              } else if (isLive) {
                statusColor = '#10b981';
                statusText = 'Live Now';
                topBarColor = '#10b981';
              } else if (isPast) {
                statusColor = '#64748b';
                statusText = 'Closed / Expired';
                topBarColor = '#64748b';
              }

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
                  cursor: (isLive && !attempted) ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  if (isLive && !attempted) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.06)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isLive && !attempted) {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)';
                  }
                }}
                >
                  {/* Status Bar */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: topBarColor }} />

                  {/* Header Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: `${statusColor}15`,
                      color: statusColor,
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      {isLive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />}
                      {tQuestion(statusText)}
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

                  {/* Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--muted-text)', marginBottom: '20px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      <span>{tQuestion("Duration")}: {ex.duration_minutes} {tQuestion("minutes")}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      <span>{tQuestion("Window")}: {new Date(ex.start_window).toLocaleDateString()} – {new Date(ex.end_window).toLocaleDateString()}</span>
                    </div>

                    {/* Result pill if attempted */}
                    {attempted && (
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
                  {isLive && (
                    <button
                      onClick={() => handleEnterExam(ex.id)}
                      disabled={enteringId === ex.id}
                      style={{
                        width: '100%',
                        padding: '11px 0',
                        background: '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {enteringId === ex.id ? tQuestion('Entering Assessment...') : tQuestion('Enter Exam Now →')}
                    </button>
                  )}

                  {isUpcoming && (
                    <button
                      disabled
                      style={{
                        width: '100%',
                        padding: '11px 0',
                        background: 'var(--table-head-bg)',
                        color: 'var(--muted-text)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'not-allowed',
                      }}
                    >
                      {tQuestion("Not Yet Open")}
                    </button>
                  )}
                  {isPast && (
                    <button
                      disabled
                      style={{
                        width: '100%',
                        padding: '11px 0',
                        background: 'transparent',
                        color: 'var(--muted-text)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'not-allowed',
                      }}
                    >
                      {tQuestion("Closed")}
                    </button>
                  )}
                  {attempted && !resultData && (
                    <button
                      disabled
                      style={{
                        width: '100%',
                        padding: '11px 0',
                        background: 'rgba(139, 92, 246, 0.1)',
                        color: '#8b5cf6',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'not-allowed',
                      }}
                    >
                      {tQuestion("Pending Review")}
                    </button>
                  )}
                  {attempted && resultData && (
                    <button
                      onClick={() => router.push(`/student/results/${ex.id}`)}
                      style={{
                        width: '100%',
                        padding: '11px 0',
                        background: 'transparent',
                        color: '#3b82f6',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {tQuestion("View Result Card")}
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
