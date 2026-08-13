'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  percentile: string | null;
  submitted_at: string;
}

interface Exam {
  id: number;
  title: string;
  subject: string;
  duration_minutes: number;
  start_window: string;
  end_window: string;
  student_session_status?: string;
}

export default function StudentAnalyticsPage() {
  const router = useRouter();
  const { t, tQuestion } = useLanguage();
  const [user, setUser] = useState<{ username: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Result[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

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
      const [resultRes, examRes] = await Promise.all([
        apiFetch('/results-portal/student/'),
        apiFetch('/exam-engine/exams/')
      ]);
      if (resultRes.status === 200) setResults(await resultRes.json());
      if (examRes.status === 200) setExams(await examRes.json());
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

  // --- Analytical Calculations ---
  const numericScores = results.map(r => parseFloat(r.total_score || '0')).filter(n => !isNaN(n));
  const avgScore = numericScores.length > 0 ? Math.round(numericScores.reduce((a, b) => a + b, 0) / numericScores.length) : 0;
  const bestScore = numericScores.length > 0 ? Math.max(...numericScores) : 0;
  const lowestScore = numericScores.length > 0 ? Math.min(...numericScores) : 0;

  // Mass Cohort Percentiles
  const massResults = results.filter(r => r.exam_type !== 'individual');
  const massPercentiles = massResults
    .map(r => (r.percentile !== null && r.percentile !== undefined) ? parseFloat(r.percentile) : null)
    .filter((p): p is number => p !== null && !isNaN(p));
  const avgPercentile = massPercentiles.length > 0
    ? Math.round(massPercentiles.reduce((a, b) => a + b, 0) / massPercentiles.length)
    : null;

  // Cutoff Passing Rate
  const cutoffExams = results.filter(r => r.cutoff_score !== null && r.cutoff_score !== undefined);
  const passedCutoffCount = cutoffExams.filter(r => r.is_passed).length;
  const cutoffPassRate = cutoffExams.length > 0 ? Math.round((passedCutoffCount / cutoffExams.length) * 100) : null;

  // Subject-wise grouping
  const subjectMap: { [sub: string]: { totalScore: number; count: number; maxScore: number } } = {};
  results.forEach(r => {
    const sub = r.subject || 'General';
    const score = parseFloat(r.total_score || '0');
    if (!subjectMap[sub]) {
      subjectMap[sub] = { totalScore: 0, count: 0, maxScore: 0 };
    }
    subjectMap[sub].totalScore += score;
    subjectMap[sub].count += 1;
    if (score > subjectMap[sub].maxScore) {
      subjectMap[sub].maxScore = score;
    }
  });

  const subjectStats = Object.keys(subjectMap).map(sub => ({
    subject: sub,
    avg: Math.round(subjectMap[sub].totalScore / subjectMap[sub].count),
    max: subjectMap[sub].maxScore,
    count: subjectMap[sub].count
  })).sort((a, b) => b.avg - a.avg);

  const topSubject = subjectStats.length > 0 ? subjectStats[0] : null;
  const focusSubject = subjectStats.length > 1 ? subjectStats[subjectStats.length - 1] : null;

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
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{tQuestion("Analytics")}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeSelector />
          <LanguageSelector />
          <ProfileDropdown user={user} />
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>{tQuestion("Performance Analytics")}</h1>
            <p style={{ fontSize: 14, color: 'var(--muted-text)', margin: 0 }}>
              {tQuestion("Deep insights, score trajectories, and subject-level proficiency")}
            </p>
          </div>
          <button
            onClick={() => router.push('/student/results')}
            style={{
              padding: '8px 16px',
              background: 'var(--table-head-bg)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {tQuestion("View All Results →")}
          </button>
        </div>

        {results.length === 0 ? (
          <div style={{ padding: '64px 20px', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 8px 0' }}>{tQuestion("No analytics available yet")}</h3>
            <p style={{ fontSize: '14px', color: 'var(--muted-text)', margin: '0 0 20px 0' }}>
              {tQuestion("Complete and submit assessments to see personalized performance trends and strengths.")}
            </p>
            <button
              onClick={() => router.push('/student/exams')}
              style={{
                padding: '10px 20px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {tQuestion("Browse Available Exams")}
            </button>
          </div>
        ) : (
          <>
            {/* ── Key Metric Stat Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
              
              {/* Average Score */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#3b82f6' }} />
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  {tQuestion("Average Score")}
                </div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#3b82f6', marginBottom: '4px' }}>
                  {avgScore}%
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted-text)' }}>{tQuestion("Across")} {results.length} {tQuestion("completed test(s)")}</div>
              </div>

              {/* Best Score */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#10b981' }} />
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  {tQuestion("Highest Score")}
                </div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#10b981', marginBottom: '4px' }}>
                  {bestScore}%
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted-text)' }}>{tQuestion("Lowest recorded")}: {lowestScore}%</div>
              </div>

              {/* Average Cohort Percentile */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#8b5cf6' }} />
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  {tQuestion("Average Percentile")}
                </div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#8b5cf6', marginBottom: '4px' }}>
                  {avgPercentile !== null ? `${avgPercentile}%` : 'N/A'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted-text)' }}>{tQuestion("Across ranked assessments")}</div>
              </div>

              {/* Cutoff Qualification */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#f59e0b' }} />
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  {tQuestion("Cutoff Clearance")}
                </div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#f59e0b', marginBottom: '4px' }}>
                  {cutoffPassRate !== null ? `${cutoffPassRate}%` : '100%'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted-text)' }}>
                  {cutoffExams.length > 0 ? `${passedCutoffCount} ${tQuestion("of")} ${cutoffExams.length} ${tQuestion("cutoff exams qualified")}` : tQuestion("Direct evaluations passed")}
                </div>
              </div>

            </div>

            {/* ── 2 Column Insights Layout ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
              
              {/* Subject Breakdown Card */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--foreground)' }}>
                  {tQuestion("Subject Proficiency Breakdown")}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {subjectStats.map(s => {
                    const barWidth = Math.min(100, Math.max(8, s.avg));
                    return (
                      <div key={s.subject}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{tQuestion(s.subject)}</span>
                          <span style={{ color: 'var(--muted-text)' }}>Avg: <strong style={{ color: 'var(--foreground)' }}>{s.avg}%</strong> ({s.count} test{s.count > 1 ? 's' : ''})</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'var(--table-head-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${barWidth}%`,
                            height: '100%',
                            background: s.avg >= 75 ? '#10b981' : s.avg >= 50 ? '#3b82f6' : '#f59e0b',
                            borderRadius: '4px',
                            transition: 'width 0.4s ease'
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Strengths & Focus Areas */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--foreground)' }}>
                    {tQuestion("Insights & Recommendations")}
                  </h3>

                  {topSubject && (
                    <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '16px' }}>🌟</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>{tQuestion("Strongest Area")}: {tQuestion(topSubject.subject)}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--muted-text)', margin: 0 }}>
                        {tQuestion("You're maintaining a strong average of")} <strong>{topSubject.avg}%</strong> {tQuestion("with a peak score of")} {topSubject.max}%.
                      </p>
                    </div>
                  )}

                  {focusSubject && focusSubject.subject !== topSubject?.subject && (
                    <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '16px' }}>🎯</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#3b82f6' }}>{tQuestion("Growth Opportunity")}: {tQuestion(focusSubject.subject)}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--muted-text)', margin: 0 }}>
                        {tQuestion("Average is currently at")} <strong>{focusSubject.avg}%</strong>. {tQuestion("Practicing question banks in this subject can boost your overall score.")}
                      </p>
                    </div>
                  )}
                </div>

                <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--table-head-bg)', fontSize: '12px', color: 'var(--muted-text)' }}>
                  💡 <em>Pro Tip: {tQuestion("Review question-by-question examiner feedback from your published results to target specific areas for improvement.")}</em>
                </div>
              </div>

            </div>

            {/* ── Chronological Performance Timeline ── */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 18px 0', color: 'var(--foreground)' }}>
                {tQuestion("Assessment Score History")}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {results.map((r, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: 'var(--table-head-bg)',
                    border: '1px solid var(--border)',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '14px'
                      }}>
                        {i + 1}
                      </div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--foreground)' }}>{tQuestion(r.exam_title)}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted-text)' }}>
                          {tQuestion(r.subject)} • {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : tQuestion('Completed')}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--muted-text)', fontWeight: 600, textTransform: 'uppercase' }}>{tQuestion("Score")}</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981' }}>{r.total_score}</div>
                      </div>
                      {r.percentile !== null && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11px', color: 'var(--muted-text)', fontWeight: 600, textTransform: 'uppercase' }}>{tQuestion("Percentile")}</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#3b82f6' }}>{r.percentile}%</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
