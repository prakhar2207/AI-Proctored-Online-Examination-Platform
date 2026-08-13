'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuthSession, apiFetch } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import ProfileDropdown from '@/components/ProfileDropdown';
import LanguageSelector from '@/components/LanguageSelector';
import ThemeSelector from '@/components/ThemeSelector';

interface Result {
  exam_id: number;
  exam_title: string;
  subject: string;
  exam_type?: 'mass' | 'individual';
  cutoff_score?: number | null;
  is_passed?: boolean | null;
  total_score: string;
  max_score: number;
  percentage_score: number;
  percentile: string | null;
  submitted_at: string;
}

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const examFilterId = searchParams.get('exam');
  
  const { t, tQuestion } = useLanguage();
  const [user, setUser] = useState<{ username: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [allResults, setResults] = useState<Result[]>([]);

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
      const resultRes = await apiFetch('/results-portal/student/');
      if (resultRes.status === 200) setResults(await resultRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--background)' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  // Filter results if an examId is specified
  const displayedResults = examFilterId 
    ? allResults.filter(r => r.exam_id.toString() === examFilterId)
    : allResults;

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
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{tQuestion("Results")}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeSelector />
          <LanguageSelector />
          <ProfileDropdown user={user} />
        </div>
      </nav>

      {/* ── Content ── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>
              {examFilterId && displayedResults.length === 1 ? tQuestion("Assessment Result") : tQuestion("Exam Results")}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted-text)', margin: 0 }}>
              {examFilterId && displayedResults.length === 1 
                ? tQuestion("Detailed scorecard for this assessment")
                : tQuestion("View your performance, scores, and evaluation records across completed assessments")}
            </p>
          </div>
          {examFilterId && (
            <button
              onClick={() => router.push('/student/results')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              {tQuestion("View All Results")}
            </button>
          )}
        </div>

        {displayedResults.length === 0 ? (
          <div style={{ padding: '64px 20px', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 8px 0' }}>{tQuestion("No results found")}</h3>
            <p style={{ fontSize: '14px', color: 'var(--muted-text)', margin: 0 }}>
              {examFilterId 
                ? tQuestion("We couldn't find a result for this specific assessment.")
                : tQuestion("You haven't completed any exams yet, or results are pending review.")}
            </p>
            {examFilterId && (
              <button
                onClick={() => router.push('/student/results')}
                style={{
                  marginTop: '16px',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {tQuestion("View All Results")}
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {displayedResults.map((res, i) => {
              const hasCutoff = res.cutoff_score !== null && res.cutoff_score !== undefined;

              return (
                <div key={i} style={{
                  background: 'var(--card-bg)',
                  borderRadius: '14px',
                  padding: '24px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  position: 'relative',
                  overflow: 'hidden',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}>
                  {/* Left accent bar */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: '4px',
                    background: '#10b981'
                  }} />

                  <div style={{ flex: 1, minWidth: '240px', paddingLeft: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', background: 'var(--table-head-bg)', color: 'var(--muted-text)', padding: '3px 8px', borderRadius: '12px', fontWeight: 600 }}>
                        {tQuestion(res.subject)}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--muted-text)' }}>
                        {tQuestion("Submitted")}: {res.submitted_at ? new Date(res.submitted_at).toLocaleDateString() : tQuestion("Recorded")}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--foreground)' }}>
                      {tQuestion(res.exam_title)}
                    </h3>

                    {/* Cutoff / Qualification status if configured */}
                    {hasCutoff && (
                      <div style={{ marginTop: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: 'var(--muted-text)' }}>{tQuestion("Passing Cutoff")}: {res.cutoff_score} {tQuestion("Marks")} • </span>
                        {res.is_passed ? (
                          <span style={{ color: '#10b981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            ✓ {tQuestion("Qualified (Cleared Cutoff)")}
                          </span>
                        ) : (
                          <span style={{ color: '#ef4444', fontWeight: 700, background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            ✕ {tQuestion("Below Cutoff")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Metrics on right */}
                  <div style={{ display: 'flex', gap: '28px', textAlign: 'right', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--muted-text)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                        {tQuestion("Score")}
                      </div>
                      <div style={{ fontSize: '26px', fontWeight: 800, color: '#10b981' }}>
                        {res.percentage_score}%
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted-text)', marginTop: '2px' }}>
                        ({res.total_score} / {res.max_score})
                      </div>
                    </div>

                    {res.percentile !== null && res.percentile !== undefined && (
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--muted-text)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                          {tQuestion("Percentile")}
                        </div>
                        <div style={{ fontSize: '26px', fontWeight: 800, color: '#3b82f6' }}>
                          {res.percentile}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function StudentResultsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--background)' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}
