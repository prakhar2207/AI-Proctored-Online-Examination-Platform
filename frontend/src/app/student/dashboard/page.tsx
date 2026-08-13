'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSession, apiFetch } from '@/lib/api';
import ProfileDropdown from '@/components/ProfileDropdown';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';
import ThemeSelector from '@/components/ThemeSelector';

interface Exam {
  id: number;
  title: string;
  subject: string;
  duration_minutes: number;
  start_window: string;
  end_window: string;
  is_mock?: boolean;
  student_session_status?: string;
}

interface Result {
  exam_id: number;
  exam_title: string;
  subject: string;
  total_score: string;
  max_score: number;
  percentage_score: number;
  percentile: string;
  submitted_at: string;
}

export default function StudentDashboard() {
  const router = useRouter();
  const { t, tQuestion } = useLanguage();
  const [user, setUser] = useState<{ username: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [enteringId, setEnteringId] = useState<number | null>(null);

  useEffect(() => {
    const session = getAuthSession();
    if (!session) { router.replace('/login'); return; }
    if (session.must_change_password) { router.replace('/change-password'); return; }
    if (session.role !== 'student') {
      router.replace(session.role === 'admin' ? '/admin/dashboard' : '/examiner/dashboard');
      return;
    }
    setUser({ username: session.username || 'Student', email: session.email || '', role: session.role });
    setLoading(false);
    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      const [examRes, resultRes] = await Promise.all([
        apiFetch('/exam-engine/exams/'),
        apiFetch('/results-portal/student/'),
      ]);
      if (examRes.status === 200) setExams(await examRes.json());
      if (resultRes.status === 200) setResults(await resultRes.json());
    } catch (err) { console.error(err); }
  };

  const handleEnterExam = async (examId: number) => {
    setEnteringId(examId);
    try {
      const res = await apiFetch(`/exam-engine/exams/${examId}/enter/`, { method: 'POST' });
      if (res.status === 200) { router.push(`/student/exam/${examId}`); }
      else { const e = await res.json(); alert(e.error || 'Failed to enter exam.'); }
    } catch { alert('Network error.'); }
    finally { setEnteringId(null); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--card-bg)' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: '#0ea5e9', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  const now = new Date();
  
  // Calculate stats - exclude mock practice exams from scheduled cohort stats and Today's Exams
  const liveExams = exams.filter(ex => !ex.is_mock && !ex.title.toLowerCase().includes('mock') && new Date(ex.start_window) <= now && new Date(ex.end_window) >= now && !['submitted','auto_submitted','flagged'].includes(ex.student_session_status || ''));
  const upcomingExams = exams.filter(ex => !ex.is_mock && !ex.title.toLowerCase().includes('mock') && new Date(ex.start_window) > now);
  const completedCount = results.length;
  
  const averageScore = results.length > 0 
    ? Math.round(results.reduce((acc, curr) => acc + (curr.percentage_score || 0), 0) / results.length)
    : 0;
    
  const bestScore = results.length > 0 ? Math.max(...results.map(r => r.percentage_score || 0)) : 0;
  const lowestScore = results.length > 0 ? Math.min(...results.map(r => r.percentage_score || 0)) : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ── Navbar ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 56,
        background: 'var(--nav-bg)', borderBottom: '1px solid var(--nav-border)',
      }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          AI-Exam
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeSelector />
          <LanguageSelector />
          <ProfileDropdown user={user} />
        </div>
      </nav>

      {/* ── Content ── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* Hero Banner Section */}
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '28px 32px',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', marginBottom: '8px', textTransform: 'uppercase' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              {tQuestion("STUDENT DASHBOARD")}
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--foreground)' }}>
              {tQuestion("Good evening, student").replace("student", user?.username || "Student")} 👋
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--muted-text)', margin: 0 }}>
              {liveExams.length} {tQuestion("exams live right now.")}
            </p>
          </div>

          <button 
            onClick={() => router.push('/student/exams')}
            className="btn-primary"
            style={{
              background: 'var(--accent)',
              color: '#ffffff',
              border: 'none',
              padding: '11px 22px',
              borderRadius: '10px', 
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(14, 165, 233, 0.25)',
              whiteSpace: 'nowrap'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
            {tQuestion("Browse all exams")}
          </button>
        </div>

        {/* 4 Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard 
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>}
            iconBg="rgba(244, 63, 94, 0.2)"
            label={tQuestion("LIVE EXAMS")}
            value={liveExams.length}
            subtext={tQuestion("Exams open for entry")}
          />
          <StatCard 
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>}
            iconBg="rgba(59, 130, 246, 0.2)"
            label={tQuestion("UPCOMING EXAMS")}
            value={upcomingExams.length}
            subtext={tQuestion("Scheduled soon")}
          />
          <StatCard 
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>}
            iconBg="rgba(14, 165, 233, 0.2)"
            label={tQuestion("COMPLETED EXAMS")}
            value={completedCount}
            subtext={tQuestion("Exams completed")}
          />
          <StatCard 
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>}
            iconBg="rgba(168, 85, 247, 0.2)"
            label={tQuestion("AVERAGE SCORE")}
            value={`${averageScore}%`}
            subtext={tQuestion("Across all exams")}
          />
        </div>

        {/* 2 Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
          
          {/* Left Column: Today's Exams */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>{tQuestion("Today's Exams")}</h2>
              <button onClick={() => router.push('/student/exams')} style={{ color: '#3b82f6', fontSize: '13px', textDecoration: 'none', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>{tQuestion("View all →")}</button>
            </div>
            
            {liveExams.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-text)', fontSize: '14px', background: 'var(--table-head-bg)', borderRadius: '12px' }}>
                {tQuestion("No exams available today.")}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
                {liveExams.map(ex => (
                  <div key={ex.id} style={{ 
                    minWidth: '220px', 
                    background: 'var(--table-head-bg)', 
                    borderRadius: '12px', 
                    padding: '20px',
                    border: '1px solid var(--border)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#10b981' }}></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>{tQuestion("Live now")}</span>
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--foreground)' }}>{tQuestion(ex.title)}</h3>
                    <div style={{ fontSize: '13px', color: 'var(--muted-text)', marginBottom: '20px' }}>{tQuestion(ex.subject)}</div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted-text)', marginBottom: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      {new Date(ex.start_window).toLocaleDateString()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted-text)', marginBottom: '20px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      {ex.duration_minutes} {tQuestion("min")}
                    </div>
                    
                    <button 
                      onClick={() => handleEnterExam(ex.id)}
                      disabled={enteringId === ex.id}
                      style={{ 
                        width: '100%', padding: '10px 0', background: 'rgba(16, 185, 129, 0.1)', 
                        color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', 
                        borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                    >
                      {enteringId === ex.id ? tQuestion('Entering...') : tQuestion('Enter Exam')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Performance Overview (Donut Chart) */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: 'currentColor' }}>{tQuestion("Performance Overview")}</h2>
              </div>
              <button onClick={() => router.push('/student/results')} style={{ color: '#3b82f6', fontSize: '13px', textDecoration: 'none', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>{tQuestion("View all →")}</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* SVG Donut Chart */}
              <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                <svg width="160" height="160" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="12" />
                  <circle 
                    cx="50" cy="50" r="40" fill="none" 
                    stroke="url(#gradient)" 
                    strokeWidth="12" 
                    strokeDasharray={`${(averageScore / 100) * 251.2} 251.2`}
                    strokeDashoffset={251.2 * 0.25} /* Start from top */
                    strokeLinecap="round"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dasharray 1s ease-out' }}
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div style={{ position: 'absolute', top: '0', left: '0', right: '0', bottom: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--foreground)' }}>{averageScore}%</span>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted-text)', letterSpacing: '0.05em' }}>{tQuestion("AVERAGE SCORE")}</span>
                </div>
              </div>

              {/* Stats List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--muted-text)' }}>{tQuestion("Best Score")}</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--foreground)' }}>{bestScore}%</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e' }}></span>
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--muted-text)' }}>{tQuestion("Lowest Score")}</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--foreground)' }}>{lowestScore}%</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></span>
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--muted-text)' }}>{tQuestion("Total Exams")}</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--foreground)' }}>{completedCount}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}

function StatCard({ icon, iconBg, label, value, subtext }: { icon: React.ReactNode, iconBg: string, label: string, value: number | string, subtext: string }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px',
      padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ background: iconBg, padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted-text)', letterSpacing: '0.05em' }}>{label}</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2 }}>{value}</div>
        </div>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--muted-text)' }}>{subtext}</div>
    </div>
  );
}
