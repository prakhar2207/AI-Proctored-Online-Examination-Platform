'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, getAuthSession } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import ProfileDropdown from '@/components/ProfileDropdown';
import ThemeSelector from '@/components/ThemeSelector';
import LanguageSelector from '@/components/LanguageSelector';
import Link from 'next/link';

interface AttemptedQuestion {
  id: number;
  question_id: number;
  question_type: string;
  question_text: string;
  marks: number;
  text_answer?: string;
  image_answer_url?: string;
  word_count?: number;
  score?: number | null;
  is_evaluated: boolean;
  ai_justification?: string;
  examiner_feedback?: string;
}

interface ExamSessionData {
  session_id: number;
  student_username: string;
  student_email: string;
  exam_id: number;
  exam_title: string;
  status: string;
  start_time: string;
  submitted_at?: string;
  total_questions: number;
  attempted_count: number;
  unanswered_count: number;
  is_fully_evaluated: boolean;
  suspicion_score: number;
  warnings_count: number;
  max_allowed_warnings: number;
  proctor_events: {
    id: number;
    event_type: string;
    event_type_display: string;
    suspicion_increment: number;
    timestamp: string;
    details?: any;
  }[];
  attempted_questions: AttemptedQuestion[];
}

interface AIFlag {
  id: string;
  type: string;
  timestamp: number;
  displayTime: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

const mockFlags: AIFlag[] = [
  { id: 'f1', type: 'Mobile Device Detected', timestamp: 145, displayTime: '02:25', severity: 'high', description: 'Unauthorized electronic device visible in webcam feed.' },
  { id: 'f2', type: 'Face Left Frame', timestamp: 420, displayTime: '07:00', severity: 'medium', description: 'Student looked away from the screen for an extended period.' },
  { id: 'f3', type: 'Multiple Voices', timestamp: 890, displayTime: '14:50', severity: 'high', description: 'Background whispering detected in audio feed.' },
];

export default function UnifiedEvaluationPortal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get('sessionId');
  const { tQuestion } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<ExamSessionData | null>(null);
  const [user, setUser] = useState<{ username: string; email: string; role: string } | null>(null);
  const [alertMsg, setAlertMsg] = useState({ text: '', type: '' });

  // Grading State
  const [overrideScores, setOverrideScores] = useState<{ [ansId: number]: string }>({});
  const [overrideFeedbacks, setOverrideFeedbacks] = useState<{ [ansId: number]: string }>({});
  const [savingAnsId, setSavingAnsId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Video State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeFlag, setActiveFlag] = useState<string | null>(null);

  useEffect(() => {
    const session = getAuthSession();
    if (!session || (session.role !== 'examiner' && session.role !== 'admin')) {
      router.replace('/login');
      return;
    }
    setUser({ username: session.username || 'Examiner', email: session.email || '', role: session.role });
    if (sessionIdParam) {
      fetchSessionData(sessionIdParam);
    } else {
      router.replace('/examiner/dashboard');
    }
  }, [router, sessionIdParam]);

  const fetchSessionData = async (id: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/grading-portal/portal/queue/`);
      if (res.status === 200) {
        const data: ExamSessionData[] = await res.json();
        const match = data.find((s) => String(s.session_id) === id);
        if (match) {
          setSessionData(match);
          initOverrides(match);
        } else {
          setAlertMsg({ text: 'Session not found.', type: 'error' });
        }
      }
    } catch (err) {
      console.error(err);
      setAlertMsg({ text: 'Failed to load evaluation portal.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const initOverrides = (sess: ExamSessionData) => {
    const scores: { [id: number]: string } = {};
    const feedbacks: { [id: number]: string } = {};
    sess.attempted_questions.forEach((q) => {
      scores[q.id] = q.score !== undefined && q.score !== null ? String(q.score) : '';
      feedbacks[q.id] = q.examiner_feedback || '';
    });
    setOverrideScores(scores);
    setOverrideFeedbacks(feedbacks);
  };

  const handleSaveOverride = async (ansId: number) => {
    const scoreVal = overrideScores[ansId];
    const feedbackVal = overrideFeedbacks[ansId];

    if (scoreVal === undefined || scoreVal === '') {
      setAlertMsg({ text: 'Please enter a valid numeric score.', type: 'error' });
      return;
    }
    setSavingAnsId(ansId);
    setAlertMsg({ text: '', type: '' });

    try {
      const res = await apiFetch(`/grading-portal/portal/queue/${ansId}/override/`, {
        method: 'POST',
        body: JSON.stringify({
          score: parseFloat(scoreVal),
          examiner_feedback: feedbackVal || '',
        }),
      });

      if (res.status === 200) {
        setAlertMsg({ text: 'Score saved successfully!', type: 'success' });
        if (sessionIdParam) fetchSessionData(sessionIdParam);
      } else {
        const err = await res.json();
        setAlertMsg({ text: err.error || 'Failed to save score.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setAlertMsg({ text: 'Network error saving score.', type: 'error' });
    } finally {
      setSavingAnsId(null);
    }
  };

  const handlePublishResults = async () => {
    if (!sessionData) return;
    if (!confirm("Are you sure you want to finalize and publish these results to the student?")) return;

    setPublishing(true);
    setAlertMsg({ text: '', type: '' });
    try {
      const res = await apiFetch(`/grading-portal/portal/queue/${sessionData.session_id}/publish/`, { method: 'POST' });
      if (res.status === 200) {
        setAlertMsg({ text: 'Results finalized and published successfully!', type: 'success' });
        fetchSessionData(String(sessionData.session_id));
      } else {
        const err = await res.json();
        setAlertMsg({ text: err.error || 'Failed to publish results.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setAlertMsg({ text: 'Network error publishing results.', type: 'error' });
    } finally {
      setPublishing(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!sessionData) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Question ID,Question Type,Marks,Student Score,AI Justification,Examiner Feedback\\n";
    sessionData.attempted_questions.forEach(q => {
      const score = q.score !== null ? q.score : "N/A";
      const just = q.ai_justification ? q.ai_justification.replace(/,/g, "") : "";
      const fb = q.examiner_feedback ? q.examiner_feedback.replace(/,/g, "") : "";
      csvContent += `${q.question_id},${q.question_type},${q.marks},${score},${just},${fb}\\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `evaluation_report_${sessionData.student_username}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Video Player Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => setCurrentTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleFlagClick = (flag: AIFlag) => {
    setCurrentTime(Math.max(0, flag.timestamp - 15));
    setActiveFlag(flag.id);
    setIsPlaying(true);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading Unified Evaluation Portal...</p>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">⚠️</div>
          <h2 className="text-xl font-black text-slate-900 mb-3">Evaluation Data Unavailable</h2>
          <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
            {alertMsg.text || 'The requested evaluation session could not be found or you do not have permission to view it.'}
          </p>
          <button 
            onClick={() => router.push('/examiner/dashboard')} 
            className="w-full px-4 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* ── Top Navigation Action Bar ── */}
      <nav className="flex items-center justify-between px-6 h-16 bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/examiner/dashboard')} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to Dashboard
          </button>
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <div className="flex flex-col">
            <h1 className="text-sm font-bold text-slate-900">{sessionData.student_username} <span className="text-slate-400 font-normal">({sessionData.student_email})</span></h1>
            <p className="text-xs text-slate-500 font-medium">{tQuestion(sessionData.exam_title)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleDownloadCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Export CSV
          </button>
          <button onClick={() => alert("PDF export is generating...")} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
            Export PDF
          </button>
          <button onClick={handlePublishResults} disabled={publishing || sessionData.is_fully_evaluated} className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-bold shadow-sm transition-colors ml-2">
            {publishing ? "Publishing..." : sessionData.is_fully_evaluated ? "✓ Published" : "Publish Final Results 🚀"}
          </button>
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <ProfileDropdown user={user} />
        </div>
      </nav>

      {/* ── Main Split View ── */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4 h-[calc(100vh-64px)]">
        
        {/* LEFT PANEL: Video & Security Context (45% width) */}
        <div className="w-[45%] flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Smart Analytics Summary */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
              Smart Evaluation Analytics
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Suspicion Score</p>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-black ${sessionData.suspicion_score >= 50 ? 'text-red-600' : 'text-blue-600'}`}>{sessionData.suspicion_score}</span>
                  <span className="text-sm text-slate-400 font-medium mb-1">/ 100</span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Violations</p>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-black ${sessionData.warnings_count >= sessionData.max_allowed_warnings ? 'text-red-600' : 'text-slate-700'}`}>{sessionData.warnings_count}</span>
                  <span className="text-sm text-slate-400 font-medium mb-1">/ {sessionData.max_allowed_warnings} Max</span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 col-span-2">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Grading Progress</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(sessionData.attempted_count / sessionData.total_questions) * 100}%` }} />
                  </div>
                  <span className="text-sm font-bold text-slate-700">{sessionData.attempted_count}/{sessionData.total_questions}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Synchronized Media Player (or Empty State) */}
          <div className="bg-slate-900 rounded-xl overflow-hidden shadow-md flex flex-col h-[350px] shrink-0 border border-slate-800 relative">
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-2 z-10">
              <div className="w-2 h-2 bg-slate-400 rounded-full" />
              Video Recording
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-50"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <p className="text-sm font-semibold">No video recording available for this session.</p>
            </div>
          </div>

          {/* AI Proctoring Flags Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex-1 flex flex-col">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/></svg>
              AI Flagged Incidents
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
              {(!sessionData.proctor_events || sessionData.proctor_events.length === 0) ? (
                <div className="text-sm font-medium text-slate-500 py-6 text-center">
                  No flagged incidents recorded.
                </div>
              ) : (
                sessionData.proctor_events.map(ev => (
                  <div 
                    key={ev.id} 
                    className="w-full text-left p-3 rounded-lg border bg-slate-50 border-slate-100"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-slate-900">{ev.event_type_display}</span>
                      <span className="text-[11px] font-mono font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-red-600 mt-1">+{ev.suspicion_increment} Suspicion Pts</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Academic Grading (55% width) */}
        <div className="w-[55%] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
              Question-by-Question Evaluation
            </h2>
            <span className="text-xs font-semibold px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
              {sessionData.attempted_questions.filter(q => q.is_evaluated).length} / {sessionData.attempted_count} Evaluated
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 custom-scrollbar">
            {alertMsg.text && (
              <div className={`mb-6 p-4 rounded-lg text-sm font-bold flex items-center gap-2 ${alertMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {alertMsg.type === 'success' ? '✓' : '⚠️'} {alertMsg.text}
              </div>
            )}

            {sessionData.attempted_questions.length === 0 ? (
              <div className="text-center py-12 text-sm text-slate-500 font-medium">No attempted questions found.</div>
            ) : (
              <div className="flex flex-col gap-6">
                {sessionData.attempted_questions.map((q, idx) => (
                  <div key={q.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <span className="text-sm font-bold text-slate-800">Q{idx + 1} <span className="text-slate-400 font-semibold text-xs ml-1 uppercase">({q.question_type})</span></span>
                      <span className="text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">Max Marks: {q.marks}</span>
                    </div>
                    
                    <div className="p-5">
                      <p className="text-sm font-semibold text-slate-900 leading-relaxed mb-4">{tQuestion(q.question_text)}</p>
                      
                      {/* Student Response */}
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 mb-4">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Student Response</p>
                        {q.text_answer ? (
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{q.text_answer}</p>
                        ) : q.image_answer_url ? (
                          <img src={q.image_answer_url} alt="Upload" className="max-w-full rounded-md border border-slate-200" />
                        ) : (
                          <p className="text-sm text-slate-500 italic">Objective answer recorded.</p>
                        )}
                      </div>

                      {/* AI Evaluation */}
                      <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 mb-5">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a2 2 0 0 1 2 2c0 1.1-.9 2-2 2s-2-.9-2-2c0-1.1.9-2 2-2zM4 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm16 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4zM2 14h20v2H2zM9 22v-4M15 22v-4"/></svg>
                            AI Evaluation
                          </p>
                          <span className="text-sm font-black text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200 shadow-sm">{q.score !== null ? q.score : '?'} / {q.marks}</span>
                        </div>
                        <p className="text-xs text-blue-900 leading-relaxed">{q.ai_justification || "No justification provided."}</p>
                      </div>

                      {/* Manual Override Controls */}
                      <div className="border-t border-slate-100 pt-4 mt-2">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Examiner Review & Override</p>
                        <div className="flex gap-4">
                          <div className="w-24">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Score</label>
                            <input 
                              type="number" 
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={overrideScores[q.id] || ''}
                              onChange={e => setOverrideScores({...overrideScores, [q.id]: e.target.value})}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Examiner Feedback (Optional)</label>
                            <input 
                              type="text" 
                              placeholder="Add notes for the student..."
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={overrideFeedbacks[q.id] || ''}
                              onChange={e => setOverrideFeedbacks({...overrideFeedbacks, [q.id]: e.target.value})}
                            />
                          </div>
                          <div className="flex items-end">
                            <button 
                              onClick={() => handleSaveOverride(q.id)}
                              disabled={savingAnsId === q.id}
                              className="h-[38px] px-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:bg-slate-400"
                            >
                              {savingAnsId === q.id ? "Saving..." : "Save Score"}
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
