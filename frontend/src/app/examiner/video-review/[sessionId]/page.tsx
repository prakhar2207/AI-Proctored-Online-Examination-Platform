'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getAuthSession } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import ProfileDropdown from '@/components/ProfileDropdown';
import ThemeSelector from '@/components/ThemeSelector';
import LanguageSelector from '@/components/LanguageSelector';

// Mock data for AI Flags
interface AIFlag {
  id: string;
  type: string;
  timestamp: number; // in seconds
  displayTime: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

const mockFlags: AIFlag[] = [
  { id: 'f1', type: 'Mobile Device Detected', timestamp: 145, displayTime: '02:25', severity: 'high', description: 'Unauthorized electronic device visible in webcam feed.' },
  { id: 'f2', type: 'Face Left Frame', timestamp: 420, displayTime: '07:00', severity: 'medium', description: 'Student looked away from the screen for an extended period.' },
  { id: 'f3', type: 'Multiple Voices', timestamp: 890, displayTime: '14:50', severity: 'high', description: 'Background whispering detected in audio feed.' },
  { id: 'f4', type: 'Screen Switch Attempt', timestamp: 1205, displayTime: '20:05', severity: 'high', description: 'Attempted to minimize fullscreen mode.' },
];

export default function VideoReviewDashboard() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { tQuestion } = useLanguage();
  
  const [user, setUser] = useState<{ username: string; email: string; role: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeFlag, setActiveFlag] = useState<string | null>(null);
  
  // Refs for custom mock players
  const webcamRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const session = getAuthSession();
    if (!session) { router.replace('/login'); return; }
    if (session.role !== 'admin' && session.role !== 'examiner') {
      router.replace('/student/dashboard');
      return;
    }
    setUser({ username: session.username || 'Examiner', email: session.email || '', role: session.role });
  }, [router]);

  // Simulate video playback time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // The Crucial UX: Context Pre-Roll Logic (-15 seconds)
  const handleFlagClick = (flag: AIFlag) => {
    const PRE_ROLL_SECONDS = 15;
    const targetTime = Math.max(0, flag.timestamp - PRE_ROLL_SECONDS);
    
    // Jump video to contextual pre-roll time
    setCurrentTime(targetTime);
    setActiveFlag(flag.id);
    setIsPlaying(true);
    
    // In a real implementation with actual video elements:
    // if (webcamRef.current) webcamRef.current.currentTime = targetTime;
    // if (screenRef.current) screenRef.current.currentTime = targetTime;
    // webcamRef.current.play(); screenRef.current.play();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getSeverityColor = (severity: string) => {
    // Accessible warning colors, avoiding harsh reds
    if (severity === 'high') return '#d97706'; // Amber-600
    if (severity === 'medium') return '#ca8a04'; // Yellow-600
    return '#3b82f6'; // Blue-500
  };

  const getSeverityBg = (severity: string) => {
    if (severity === 'high') return 'rgba(217, 119, 6, 0.1)';
    if (severity === 'medium') return 'rgba(202, 138, 4, 0.1)';
    return 'rgba(59, 130, 246, 0.1)';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      
      {/* ── Navbar ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 56, background: '#ffffff', borderBottom: '1px solid #e2e8f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#3b82f6', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }} onClick={() => router.push('/examiner/dashboard')}>
            AI-Exam
          </span>
          <span style={{ color: '#94a3b8', margin: '0 8px' }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{tQuestion("Session Review")}: {sessionId}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeSelector />
          <LanguageSelector />
          <ProfileDropdown user={user} />
        </div>
      </nav>

      {/* ── Main Dashboard Layout ── */}
      <main style={{ flex: 1, display: 'flex', padding: '24px', gap: '24px', height: 'calc(100vh - 56px)', boxSizing: 'border-box' }}>
        
        {/* ── Left Column: Media Player (70%) ── */}
        <div style={{ flex: '7', display: 'flex', flexDirection: 'column', gap: '16px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>{tQuestion("Student Review")}: Jane Doe</h1>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Exam: TCS 1 (Aptitude) • Oct 12, 2023</p>
            </div>
            <button onClick={() => router.push('/examiner/analytics')} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#334155', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
              {tQuestion("Back to Analytics")}
            </button>
          </div>

          {/* Synchronized Media Players Layout (Side-by-Side) */}
          <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: '400px' }}>
            
            {/* Webcam Feed */}
            <div style={{ flex: 1, background: '#0f172a', borderRadius: '12px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 600, zIndex: 10, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }}></div>
                Webcam & Audio
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </div>
            </div>

            {/* Screen Recording Feed */}
            <div style={{ flex: 1.5, background: '#1e293b', borderRadius: '12px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 600, zIndex: 10, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }}></div>
                Screen Activity
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
            </div>
            
          </div>

          {/* Custom Media Controls */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Timeline Scrubber */}
            <div style={{ position: 'relative', height: '6px', background: '#cbd5e1', borderRadius: '3px', cursor: 'pointer' }} onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              setCurrentTime(Math.floor(pct * 3600)); // Assume 1 hour max for mock
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', background: '#3b82f6', borderRadius: '3px', width: `${(currentTime / 3600) * 100}%` }}></div>
              
              {/* Plot Flags on Timeline */}
              {mockFlags.map(flag => (
                <div 
                  key={flag.id} 
                  title={flag.type}
                  onClick={(e) => { e.stopPropagation(); handleFlagClick(flag); }}
                  style={{ 
                    position: 'absolute', top: '-4px', left: `${(flag.timestamp / 3600) * 100}%`, 
                    width: '4px', height: '14px', background: getSeverityColor(flag.severity), 
                    borderRadius: '2px', cursor: 'pointer', zIndex: 5,
                    border: activeFlag === flag.id ? '1px solid #000' : 'none'
                  }} 
                />
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={() => setIsPlaying(!isPlaying)} style={{ background: '#3b82f6', color: '#fff', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  {isPlaying ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  )}
                </button>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(currentTime)} / 60:00
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>1.0x</button>
                <button style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>[ ]</button>
              </div>
            </div>

          </div>
        </div>

        {/* ── Right Column: Interactive Flag Log (30%) ── */}
        <div style={{ flex: '3', display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
          
          <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
              AI Incident Log
            </h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>{mockFlags.length} total flags detected</p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mockFlags.map(flag => {
              const isActive = activeFlag === flag.id;
              const color = getSeverityColor(flag.severity);
              const bg = getSeverityBg(flag.severity);
              
              return (
                <div 
                  key={flag.id}
                  onClick={() => handleFlagClick(flag)}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: `1px solid ${isActive ? color : '#e2e8f0'}`,
                    background: isActive ? '#f8fafc' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: isActive ? `0 0 0 2px ${color}33` : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ padding: '4px 8px', borderRadius: '6px', background: bg, color: color, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        ⚠️ {tQuestion(flag.severity)}
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', fontVariantNumeric: 'tabular-nums', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                      {flag.displayTime}
                    </div>
                  </div>
                  
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: '0 0 4px' }}>{flag.type}</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>{flag.description}</p>
                  
                  {isActive && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1', display: 'flex', gap: '8px' }}>
                      <button style={{ flex: 1, padding: '6px 0', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#334155', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Dismiss</button>
                      <button style={{ flex: 1, padding: '6px 0', background: '#3b82f6', border: 'none', borderRadius: '6px', color: '#ffffff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Confirm Violation</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
        </div>

      </main>
    </div>
  );
}
