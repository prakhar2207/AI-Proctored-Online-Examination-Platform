'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getAuthSession } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import ProfileDropdown from '@/components/ProfileDropdown';
import ThemeSelector from '@/components/ThemeSelector';
import LanguageSelector from '@/components/LanguageSelector';

interface StudentResult {
  session_id: number;
  student_id: number;
  student_username: string;
  student_name: string;
  exam_id: number;
  exam_title: string;
  subject: string;
  exam_type: string;
  status: string;
  score: string | null;
  percentile: string | null;
  finalized: boolean;
  submitted_at: string | null;
}

export default function ExaminerResultsPage() {
  const router = useRouter();
  const { tQuestion } = useLanguage();
  
  const [user, setUser] = useState<{ username: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [activeTab, setActiveTab] = useState<'individual' | 'mass'>('individual');

  useEffect(() => {
    const session = getAuthSession();
    if (!session || (session.role !== 'examiner' && session.role !== 'admin')) {
      router.replace('/login');
      return;
    }
    setUser({ username: session.username || 'Examiner', email: session.email || '', role: session.role });
    fetchResults();
  }, [router]);

  const fetchResults = async () => {
    try {
      const res = await apiFetch('/auth/examiner/students/results/');
      if (res.status === 200) {
        const data: StudentResult[] = await res.json();
        // Only show finalized (Published) results
        setResults(data.filter(r => r.finalized));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const individualResults = results.filter(r => r.exam_type === 'individual');
  const massResults = results.filter(r => r.exam_type === 'mass');

  const renderResultTable = (data: StudentResult[]) => {
    if (data.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <p className="text-slate-500 font-medium text-sm">No published results found in this category.</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200">
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Exam Title</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Score</th>
              {activeTab === 'mass' && (
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Percentile</th>
              )}
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map(r => (
              <tr key={r.session_id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-900">{r.student_name || r.student_username}</span>
                    <span className="text-[11px] text-slate-500 font-medium">{r.student_username}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-800">{r.exam_title}</span>
                    <span className="text-[11px] font-medium text-slate-400 uppercase">{r.subject}</span>
                  </div>
                </td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                    {r.score !== null ? r.score : 'N/A'}
                  </span>
                </td>
                {activeTab === 'mass' && (
                  <td className="p-4">
                    <span className="text-sm font-semibold text-slate-600">{r.percentile ? `${r.percentile}%ile` : '-'}</span>
                  </td>
                )}
                <td className="p-4 text-right">
                  <button 
                    onClick={() => router.push(`/examiner/grading?sessionId=${r.session_id}`)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    View Analytics
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading Results & Analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* ── Navbar ── */}
      <nav className="flex items-center justify-between px-6 h-16 bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/examiner/dashboard')} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Operations Dashboard
          </button>
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <h1 className="text-sm font-black text-slate-900 tracking-tight uppercase">Results & Analytics</h1>
        </div>

        <div className="flex items-center gap-3">
          <ThemeSelector />
          <LanguageSelector />
          <div className="h-6 w-px bg-slate-200 mx-1" />
          <ProfileDropdown user={user} />
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-8">
        
        <header className="mb-8">
          <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Published Exam Results</h2>
          <p className="text-sm text-slate-500 font-medium">Review finalized scores, percentiles, and detailed analytics for all your students.</p>
        </header>

        {/* Custom Tabs */}
        <div className="flex gap-2 mb-6 bg-slate-200/50 p-1 rounded-xl w-max border border-slate-200/60">
          <button 
            onClick={() => setActiveTab('individual')}
            className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'individual' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Single Student Exams
          </button>
          <button 
            onClick={() => setActiveTab('mass')}
            className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'mass' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Mass Cohort Exams
          </button>
        </div>

        {/* Tab Content */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {activeTab === 'individual' ? renderResultTable(individualResults) : renderResultTable(massResults)}
        </div>

      </main>
    </div>
  );
}
