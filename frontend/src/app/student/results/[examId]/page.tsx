'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getAuthSession, apiFetch } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import ProfileDropdown from '@/components/ProfileDropdown';
import LanguageSelector from '@/components/LanguageSelector';
import ThemeSelector from '@/components/ThemeSelector';

interface Result {
  exam_id: number;
  exam_title: string;
  subject: string;
  exam_type: string;
  total_score: string;
  max_score: number;
  percentage_score: number;
  percentile: string | null;
  submitted_at: string;
  is_passed?: boolean | null;
}

// Dummy interface for the detailed breakdown (simulated data)
interface QuestionDetail {
  id: string;
  text: string;
  studentAnswer: string;
  correctAnswer: string;
  status: 'correct' | 'incorrect' | 'partial';
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export default function StudentDrillDownReport() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;
  
  const { t, tQuestion } = useLanguage();
  const [user, setUser] = useState<{ username: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    const session = getAuthSession();
    if (!session) { router.replace('/login'); return; }
    if (session.role !== 'student') {
      router.replace(session.role === 'admin' ? '/admin/dashboard' : '/examiner/dashboard');
      return;
    }
    setUser({ username: session.username || 'Student', email: session.email || '', role: session.role });
    loadData();
  }, [router, examId]);

  const loadData = async () => {
    try {
      const resultRes = await apiFetch('/results-portal/student/');
      if (resultRes.status === 200) {
        const results: Result[] = await resultRes.json();
        const found = results.find(r => r.exam_id.toString() === examId);
        if (found) setResult(found);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    const next = new Set(expandedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedRows(next);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--background)' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (!result) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
        <div style={{ padding: '64px 20px', textAlign: 'center' }}>
          <h2>{tQuestion("Result Not Found")}</h2>
          <button onClick={() => router.push('/student/dashboard')} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  // Simulated detailed data for UI visualization
  const mockQuestions: QuestionDetail[] = [
    { id: 'Q1', text: 'What is the time complexity of binary search?', studentAnswer: 'O(log n)', correctAnswer: 'O(log n)', status: 'correct', topic: 'Algorithms', difficulty: 'easy' },
    { id: 'Q2', text: 'Explain the concept of polymorphic inheritance.', studentAnswer: 'It allows objects of different types to be treated as instances of the same class through a common interface.', correctAnswer: 'Polymorphism allows methods to do different things based on the object it is acting upon, typically through inheritance.', status: 'partial', topic: 'OOP', difficulty: 'hard' },
    { id: 'Q3', text: 'What is the capital of France?', studentAnswer: 'Berlin', correctAnswer: 'Paris', status: 'incorrect', topic: 'General Knowledge', difficulty: 'easy' },
    { id: 'Q4', text: 'Define a RESTful API.', studentAnswer: 'An API that uses HTTP requests to GET, PUT, POST and DELETE data.', correctAnswer: 'Representational State Transfer (REST) is an architectural style that defines a set of constraints to be used for creating web services.', status: 'correct', topic: 'Web Dev', difficulty: 'medium' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ── Navbar ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 56,
        background: 'var(--nav-bg)', borderBottom: '1px solid var(--nav-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }} onClick={() => router.push('/student/dashboard')}>
            AI-Exam
          </span>
          <span style={{ color: 'var(--muted-text)', margin: '0 8px' }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{tQuestion("Analytics")}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeSelector />
          <LanguageSelector />
          <ProfileDropdown user={user} />
        </div>
      </nav>

      {/* ── Content ── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>
              {tQuestion("Performance Report")}: {result.exam_title} - {user?.username}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted-text)', fontSize: '14px' }}>
              <span style={{ background: 'var(--table-head-bg)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>{result.subject}</span>
              <span>•</span>
              <span>{tQuestion("Submitted")}: {new Date(result.submitted_at).toLocaleString()}</span>
            </div>
          </div>
          <button
            onClick={() => router.push('/student/exams')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              transition: 'all 0.2s'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            {tQuestion("Back to My Exams")}
          </button>
        </div>

        {/* Overview Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          
          {/* Overall Score Overview Card */}
          <div style={{
            background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: '13px', color: 'var(--muted-text)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              {tQuestion("Overall Score")}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '48px', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1 }}>{result.percentage_score}%</span>
              {result.percentile && result.exam_type === 'mass' && <span style={{ fontSize: '20px', fontWeight: 600, color: '#3b82f6' }}>({result.percentile}%ile)</span>}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted-text)', marginBottom: '16px', fontWeight: 500 }}>
              {result.total_score} / {result.max_score} {tQuestion("Marks")}
            </div>
            {result.is_passed !== undefined && result.is_passed !== null && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 16px', borderRadius: '20px',
                background: result.is_passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: result.is_passed ? '#10b981' : '#ef4444',
                fontWeight: 700, fontSize: '14px'
              }}>
                {result.is_passed ? (
                  <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>{tQuestion("Passed")}</>
                ) : (
                  <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>{tQuestion("Failed")}</>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Empty state for missing detailed data */}
        <div style={{
            background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.02)', textAlign: 'center', minHeight: '200px'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--muted-text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 8px' }}>
              {tQuestion("Detailed Analytics Unavailable")}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--muted-text)', margin: 0, maxWidth: '400px' }}>
              {tQuestion("The detailed question breakdown and AI performance advisor are not recorded or not available for this specific past assessment.")}
            </p>
          </div>

      </main>
    </div>
  );
}
