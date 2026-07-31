'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSession, clearAuthSession, apiFetch } from '@/lib/api';

interface Exam {
  id: number;
  title: string;
  subject: string;
  duration_minutes: number;
  start_window: string;
  end_window: string;
}

interface Result {
  exam_id: number;
  exam_title: string;
  subject: string;
  total_score: string;
  percentile: string;
  submitted_at: string;
}

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [enteringId, setEnteringId] = useState<number | null>(null);

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      router.replace('/login');
    } else if (session.must_change_password) {
      router.replace('/change-password');
    } else if (session.role !== 'student') {
      if (session.role === 'admin') {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/examiner/dashboard');
      }
    } else {
      setUser({ username: session.username || 'Student', email: session.email || '' });
      setLoading(false);
      loadDashboardData();
    }
  }, [router]);

  const loadDashboardData = async () => {
    try {
      const examRes = await apiFetch('/exam-engine/exams/');
      if (examRes.status === 200) setExams(await examRes.json());
      const resultRes = await apiFetch('/results-portal/student/');
      if (resultRes.status === 200) setResults(await resultRes.json());
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  const handleEnterExam = async (examId: number) => {
    setEnteringId(examId);
    try {
      const res = await apiFetch(`/exam-engine/exams/${examId}/enter/`, { method: 'POST' });
      if (res.status === 200) {
        router.push(`/student/exam/${examId}`);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to enter exam.');
      }
    } catch (err) {
      alert('Network request failed.');
    } finally {
      setEnteringId(null);
    }
  };

  const handleLogout = () => { clearAuthSession(); router.push('/login'); };

  if (loading) {
    return (
      <div style={s.loadingScreen}>
        <div className="animated-bg"><div className="orb orb-1"/><div className="orb orb-2"/></div>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={s.spinner} />
          <p style={{ color: '#64748b', marginTop: 16 }}>Loading candidate portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Subtle animated bg */}
      <div className="animated-bg"><div className="orb orb-1"/><div className="orb orb-2"/><div className="orb orb-3"/></div>

      {/* ── NAVBAR ── */}
      <nav style={s.nav}>
        <div style={s.navBrand}>
          <span className="ai-dot" />
          <span style={s.navLogo}>Candidate Portal</span>
        </div>
        <div style={s.navRight}>
          <div style={s.navUserChip}>
            <span style={s.navUserName}>{user?.username}</span>
            {user?.email && <span style={s.navUserEmail}>{user.email}</span>}
          </div>
          <button className="btn-danger" onClick={handleLogout}>Sign Out</button>
        </div>
      </nav>

      {/* ── MAIN ── */}
      <main style={s.main}>

        {/* Filter available vs closed exams based on current time */}
        {(() => {
          const now = new Date();
          const availableExams = exams.filter((ex) => new Date(ex.end_window) >= now);
          const closedExams = exams.filter((ex) => new Date(ex.end_window) < now);
          const pastTotalCount = closedExams.length + results.length;

          return (
            <>
              {/* Hero welcome strip */}
              <div style={s.heroStrip} className="hero-content">
                <div>
                  <h1 style={s.heroTitle}>Welcome back, <span style={s.heroAccent}>{user?.username}</span></h1>
                  <p style={s.heroSub}>Your personalised examination hub — active sessions and performance records below.</p>
                </div>
                <div style={s.heroStats}>
                  <div style={s.statPill}>
                    <span style={s.statNum}>{availableExams.length}</span>
                    <span style={s.statLabel}>Available Exams</span>
                  </div>
                  <div style={s.statPill}>
                    <span style={s.statNum}>{pastTotalCount}</span>
                    <span style={s.statLabel}>Past / Completed</span>
                  </div>
                </div>
              </div>

              {/* Cards grid */}
            <div style={s.grid}>

              {/* Available exams card */}
              <div style={s.card} className="card-hover hero-content">
                <div style={s.cardHead}>
                  <div style={s.cardTitleRow}>
                    <div style={{ ...s.cardAccentBar, background: 'linear-gradient(180deg, #0ea5e9, #2563eb)' }} />
                    <h2 style={s.cardTitle}>Available Examinations</h2>
                  </div>
                  <span style={s.cardBadge}>{availableExams.length} Available</span>
                </div>

                {availableExams.length === 0 ? (
                  <div style={s.emptyBox}>
                    <div style={s.emptyIcon}>◎</div>
                    <p style={s.emptyText}>No active examinations scheduled for you right now.</p>
                    <p style={s.emptyHint}>Check back later or contact your examiner.</p>
                  </div>
                ) : (
                  <div style={s.examList}>
                    {availableExams.map((ex) => (
                      <div key={ex.id} style={s.examRow}>
                        <div style={s.examInfo}>
                          <h4 style={s.examTitle}>{ex.title}</h4>
                          <div style={s.examMeta}>
                            <span style={s.metaChip}>{ex.subject}</span>
                            <span style={s.metaChip}>{ex.duration_minutes} min</span>
                          </div>
                        </div>
                        <button
                          className="btn-primary"
                          onClick={() => handleEnterExam(ex.id)}
                          disabled={enteringId !== null}
                          style={{ flexShrink: 0, opacity: enteringId !== null ? 0.6 : 1 }}
                        >
                          {enteringId === ex.id ? 'Entering...' : 'Start Exam'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Past & Closed Exams / Performance card */}
              <div style={s.card} className="card-hover hero-content">
                <div style={s.cardHead}>
                  <div style={s.cardTitleRow}>
                    <div style={{ ...s.cardAccentBar, background: 'linear-gradient(180deg, #10b981, #059669)' }} />
                    <h2 style={s.cardTitle}>Past & Closed Examinations</h2>
                  </div>
                  <span style={{ ...s.cardBadge, background: 'rgba(16,185,129,0.1)', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}>
                    {pastTotalCount} Record{pastTotalCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {pastTotalCount === 0 ? (
                  <div style={s.emptyBox}>
                    <div style={s.emptyIcon}>◈</div>
                    <p style={s.emptyText}>No past or closed examinations found.</p>
                    <p style={s.emptyHint}>Closed exams and evaluated results will appear here.</p>
                  </div>
                ) : (
                  <div style={s.examList}>
                    {/* Render Closed / Expired Assigned Exams */}
                    {closedExams.map((ex) => (
                      <div key={`closed-${ex.id}`} style={{ ...s.examRow, opacity: 0.85 }}>
                        <div style={s.examInfo}>
                          <h4 style={s.examTitle}>{ex.title}</h4>
                          <div style={s.examMeta}>
                            <span style={s.metaChip}>{ex.subject}</span>
                            <span style={s.metaChip}>{ex.duration_minutes} min</span>
                            <span style={{ ...s.metaChip, color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }}>
                              Closed on {new Date(ex.end_window).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', flexShrink: 0 }}>
                          Exam Closed
                        </span>
                      </div>
                    ))}

                    {/* Render Evaluated Results */}
                    {results.map((res, idx) => (
                      <div key={`res-${idx}`} style={s.examRow}>
                        <div style={s.examInfo}>
                          <h4 style={s.examTitle}>{res.exam_title}</h4>
                          <div style={s.examMeta}>
                            <span style={s.metaChip}>{res.subject}</span>
                            <span style={s.metaChip}>Submitted: {new Date(res.submitted_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div style={s.scoreBox}>
                          <div style={s.scoreNum}>{res.total_score}</div>
                          <div style={s.scorePct}>{res.percentile}%ile</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </>
        );
      })()}

      </main>
    </div>
  );
}

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    background: 'var(--background)',
    color: 'var(--foreground)',
    fontFamily: 'Inter, system-ui, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },
  loadingScreen: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'var(--background)',
    position: 'relative',
    overflow: 'hidden',
  },
  spinner: {
    width: 44,
    height: 44,
    border: '3px solid rgba(56,189,248,0.15)',
    borderTopColor: '#38bdf8',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
  /* ─ NAV ─ */
  nav: {
    position: 'relative',
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 40px',
    height: 64,
    background: '#ffffff',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
  },
  navBrand: { display: 'flex', alignItems: 'center', gap: 10 },
  navLogo: {
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    textShadow: 'none',
  },
  navRight: { display: 'flex', alignItems: 'center', gap: 16 },
  navUserChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  navUserName: { fontSize: 14, fontWeight: 700, color: 'var(--foreground)' },
  navUserEmail: { fontSize: 11, color: '#64748b' },

  /* ─ MAIN ─ */
  main: {
    position: 'relative',
    zIndex: 10,
    maxWidth: 1200,
    margin: '0 auto',
    padding: '40px 40px 60px',
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
  },

  /* ─ HERO STRIP ─ */
  heroStrip: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '28px 32px',
    background: 'rgba(37,99,235,0.04)',
    border: '1px solid rgba(37,99,235,0.15)',
    borderRadius: 16,
    backdropFilter: 'blur(10px)',
    gap: 24,
    flexWrap: 'wrap',
  },
  heroTitle: { fontSize: 26, fontWeight: 800, color: 'var(--foreground)', margin: 0, marginBottom: 6 },
  heroAccent: { color: 'var(--accent)', textShadow: '0 0 20px rgba(56,189,248,0.4)' },
  heroSub: { fontSize: 14, color: '#475569', margin: 0 },
  heroStats: { display: 'flex', gap: 12 },
  statPill: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 24px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    minWidth: 90,
  },
  statNum: { fontSize: 28, fontWeight: 900, color: 'var(--accent)', lineHeight: 1 },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' },

  /* ─ GRID ─ */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
    gap: 24,
  },

  /* ─ CARD ─ */
  card: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 16,
    backdropFilter: 'blur(16px)',
    padding: 0,
    overflow: 'hidden',
    boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
    display: 'flex',
    flexDirection: 'column',
  },
  cardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #cbd5e1',
    background: 'rgba(0,0,0,0.02)',
  },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: 12 },
  cardAccentBar: {
    width: 3,
    height: 22,
    borderRadius: 4,
    flexShrink: 0,
  },
  cardTitle: { fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: 0 },
  cardBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 12px',
    borderRadius: 99,
    background: 'rgba(37,99,235,0.08)',
    color: 'var(--accent)',
    border: '1px solid rgba(56,189,248,0.25)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  /* ─ EMPTY STATE ─ */
  emptyBox: {
    padding: '56px 24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 40, color: '#1e3a5f', marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#475569', fontWeight: 600, margin: 0 },
  emptyHint: { fontSize: 13, color: '#334155', margin: 0 },

  /* ─ EXAM LIST ─ */
  examList: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 0',
  },
  examRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #f1f5f9',
    gap: 16,
    transition: 'background 0.15s',
  },
  examInfo: { flex: 1, minWidth: 0 },
  examTitle: { fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  examMeta: { display: 'flex', gap: 8 },
  metaChip: {
    fontSize: 11,
    padding: '3px 10px',
    borderRadius: 99,
    background: '#f1f5f9',
    border: '1px solid #cbd5e1',
    color: '#475569',
    fontWeight: 500,
  },

  /* ─ SCORE ─ */
  scoreBox: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 },
  scoreNum: { fontSize: 20, fontWeight: 900, color: '#10b981', textShadow: 'none' },
  scorePct: { fontSize: 11, color: '#64748b' },
};
