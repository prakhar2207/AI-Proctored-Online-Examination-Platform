'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSession, apiFetch } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import ProfileDropdown from '@/components/ProfileDropdown';
import LanguageSelector from '@/components/LanguageSelector';
import ThemeSelector from '@/components/ThemeSelector';

export default function ExaminerAnalyticsHub() {
  const router = useRouter();
  const { t, tQuestion } = useLanguage();
  const [user, setUser] = useState<{ username: string; email: string; role: string } | null>(null);
  
  const [activeView, setActiveView] = useState<'assessment' | 'student' | 'group'>('assessment');
  
  useEffect(() => {
    const session = getAuthSession();
    if (!session) { router.replace('/login'); return; }
    if (session.role !== 'admin' && session.role !== 'examiner') {
      router.replace('/student/dashboard');
      return;
    }
    setUser({ username: session.username || 'Examiner', email: session.email || '', role: session.role });
  }, [router]);

  // SVG Trend Line Chart Component (Pure CSS/SVG)
  const TrendLineChart = ({ data, color = '#3b82f6' }: { data: number[], color?: string }) => {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data, 100);
    const min = Math.min(...data, 0);
    const width = 600;
    const height = 200;
    
    // Calculate points
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / (max - min)) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div style={{ width: '100%', overflowX: 'auto', padding: '16px 0' }}>
        <svg viewBox={`0 -10 ${width} ${height + 20}`} style={{ width: '100%', minWidth: '400px', height: '220px', overflow: 'visible' }}>
          {/* Grid lines */}
          <line x1="0" y1={height} x2={width} y2={height} stroke="var(--border)" strokeWidth="1" />
          <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" y1="0" x2={width} y2="0" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
          
          {/* Line */}
          <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          
          {/* Data points */}
          {data.map((val, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((val - min) / (max - min)) * height;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="5" fill={color} stroke="var(--card-bg)" strokeWidth="2" />
                <text x={x} y={y - 12} fill="var(--muted-text)" fontSize="11" textAnchor="middle" fontWeight="600">{val}%</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderAssessmentView = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>{tQuestion("Single Assessment Analysis")}</h2>
        <select style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--foreground)', fontSize: '14px', fontWeight: 600 }}>
          <option>TCS 1 (Aptitude)</option>
          <option>TCS 2 (Technical)</option>
        </select>
      </div>

      {/* Aggregated Metrics Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Average Score', value: '76%', color: '#3b82f6' },
          { label: 'High Score', value: '98%', color: '#10b981' },
          { label: 'Low Score', value: '32%', color: '#ef4444' },
          { label: 'Pass Rate', value: '85%', color: '#8b5cf6' }
        ].map((m, i) => (
          <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted-text)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>{tQuestion(m.label)}</span>
            <span style={{ fontSize: '28px', fontWeight: 800, color: m.color }}>{m.value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Score Distribution Histogram */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 20px', color: 'var(--foreground)' }}>{tQuestion("Score Distribution")}</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '200px', gap: '4px' }}>
            {[
              { range: '0-20', count: 2 },
              { range: '21-40', count: 5 },
              { range: '41-60', count: 12 },
              { range: '61-80', count: 45 },
              { range: '81-100', count: 28 },
            ].map((bin, i) => {
              const heightPct = (bin.count / 45) * 100;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '100%', height: '180px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div style={{ width: '80%', height: `${heightPct}%`, background: '#3b82f6', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--muted-text)', fontWeight: 600 }}>{bin.range}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Question Difficulty Analysis */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', overflowY: 'auto', maxHeight: '280px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 16px', color: 'var(--foreground)' }}>{tQuestion("Question Difficulty Analysis")}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: 'var(--muted-text)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 0', fontWeight: 600 }}>Q.ID</th>
                <th style={{ padding: '8px 0', fontWeight: 600 }}>{tQuestion("Pass Rate")}</th>
                <th style={{ padding: '8px 0', fontWeight: 600 }}>{tQuestion("Difficulty")}</th>
              </tr>
            </thead>
            <tbody>
              {[
                { id: 'Q1', pass: 95, diff: 'easy' },
                { id: 'Q2', pass: 82, diff: 'medium' },
                { id: 'Q3', pass: 24, diff: 'hard' },
                { id: 'Q4', pass: 45, diff: 'medium' },
              ].map((q, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 0', color: 'var(--foreground)', fontWeight: 600 }}>{q.id}</td>
                  <td style={{ padding: '12px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '60px', height: '6px', background: 'var(--table-head-bg)', borderRadius: '3px' }}>
                        <div style={{ width: `${q.pass}%`, height: '100%', background: q.pass > 70 ? '#10b981' : q.pass > 40 ? '#f59e0b' : '#ef4444', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--muted-text)' }}>{q.pass}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 0' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', background: 'var(--table-head-bg)', padding: '2px 6px', borderRadius: '4px', color: 'var(--muted-text)', fontWeight: 600 }}>
                      {q.diff}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Performance Table */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 16px', color: 'var(--foreground)' }}>{tQuestion("Student Performance")}</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: 'var(--table-head-bg)', color: 'var(--muted-text)', fontSize: '12px', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>{tQuestion("Student")}</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>{tQuestion("Score")}</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>{tQuestion("Duration")}</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}></th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'John Doe', score: 85, pct: 85, dur: '42m' },
              { name: 'Jane Smith', score: 92, pct: 92, dur: '38m' },
              { name: 'Alex Johnson', score: 45, pct: 45, dur: '58m' },
            ].map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px', color: 'var(--foreground)', fontWeight: 600 }}>{s.name}</td>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: s.pct >= 50 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{s.score}</span>
                    <span style={{ color: 'var(--muted-text)', fontSize: '12px' }}>({s.pct}%)</span>
                  </div>
                </td>
                <td style={{ padding: '16px', color: 'var(--muted-text)' }}>{s.dur}</td>
                <td style={{ padding: '16px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => router.push('/examiner/video-review/sess-123')} style={{ padding: '6px 12px', background: '#f59e0b', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    📹 {tQuestion("Video Review")}
                  </button>
                  <button style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    {tQuestion("View Detailed Report")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderStudentView = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>{tQuestion("Performance Profile")}: <span style={{ color: 'var(--accent)' }}>Jane Smith</span></h2>
        <input type="text" placeholder={tQuestion("Search student...")} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--foreground)', fontSize: '14px' }} />
      </div>

      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 16px', color: 'var(--foreground)' }}>{tQuestion("Score Trend Over Time")}</h3>
        <TrendLineChart data={[65, 72, 68, 85, 92]} color="#8b5cf6" />
      </div>

      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 16px', color: 'var(--foreground)' }}>{tQuestion("Completed Assessments")}</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: 'var(--table-head-bg)', color: 'var(--muted-text)', fontSize: '12px', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>{tQuestion("Assessment")}</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>{tQuestion("Date")}</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>{tQuestion("Score")}</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}></th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'TCS 1 (Aptitude)', date: 'Oct 12, 2023', score: 92 },
              { name: 'TCS 2 (Technical)', date: 'Sep 28, 2023', score: 85 },
              { name: 'Midterm Practice', date: 'Sep 15, 2023', score: 68 },
            ].map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px', color: 'var(--foreground)', fontWeight: 600 }}>{s.name}</td>
                <td style={{ padding: '16px', color: 'var(--muted-text)' }}>{s.date}</td>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: s.score >= 50 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{s.score}%</span>
                  </div>
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    {tQuestion("View Detailed Report")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderGroupView = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>{tQuestion("Group Performance Analysis")}: <span style={{ color: 'var(--accent)' }}>Cohort A</span></h2>
        <select style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--foreground)', fontSize: '14px', fontWeight: 600 }}>
          <option>Cohort A</option>
          <option>Cohort B</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 16px', color: 'var(--foreground)' }}>{tQuestion("Group Average Trend")}</h3>
          <TrendLineChart data={[70, 71, 75, 78, 80]} color="#10b981" />
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 16px', color: 'var(--foreground)' }}>{tQuestion("Cohort Comparison")}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ color: 'var(--muted-text)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 0', fontWeight: 600 }}>{tQuestion("Group")}</th>
                <th style={{ padding: '8px 0', fontWeight: 600 }}>{tQuestion("Avg Score")}</th>
                <th style={{ padding: '8px 0', fontWeight: 600 }}>{tQuestion("Pass Rate")}</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Cohort A (Selected)', avg: 80, pass: 92, color: '#10b981' },
                { name: 'Cohort B', avg: 72, pass: 85, color: 'var(--muted-text)' },
                { name: 'Cohort C', avg: 68, pass: 78, color: 'var(--muted-text)' },
              ].map((g, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 0', color: g.color, fontWeight: 700 }}>{g.name}</td>
                  <td style={{ padding: '12px 0', color: 'var(--foreground)' }}>{g.avg}%</td>
                  <td style={{ padding: '12px 0', color: 'var(--foreground)' }}>{g.pass}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 56,
        background: 'var(--nav-bg)', borderBottom: '1px solid var(--nav-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }} onClick={() => router.push('/examiner/dashboard')}>
            AI-Exam
          </span>
          <span style={{ color: 'var(--muted-text)', margin: '0 8px' }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{tQuestion("Analytics Hub")}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeSelector />
          <LanguageSelector />
          <ProfileDropdown user={user} />
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px 60px' }}>
        
        {/* Module Switcher Tab */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'flex', background: 'var(--table-head-bg)', padding: '4px',
            borderRadius: '12px', border: '1px solid var(--border)',
          }}>
            {[
              { id: 'assessment', label: 'Single Assessment', icon: '📝' },
              { id: 'student', label: 'Student History', icon: '👤' },
              { id: 'group', label: 'Group Analysis', icon: '👥' },
            ].map(tab => (
              <div
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  background: activeView === tab.id ? 'var(--card-bg)' : 'transparent',
                  color: activeView === tab.id ? 'var(--foreground)' : 'var(--muted-text)',
                  fontWeight: activeView === tab.id ? 700 : 600,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: activeView === tab.id ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '16px', opacity: activeView === tab.id ? 1 : 0.7 }}>{tab.icon}</span>
                {tQuestion(tab.label)}
              </div>
            ))}
          </div>
        </div>

        {activeView === 'assessment' && renderAssessmentView()}
        {activeView === 'student' && renderStudentView()}
        {activeView === 'group' && renderGroupView()}

      </main>
    </div>
  );
}
