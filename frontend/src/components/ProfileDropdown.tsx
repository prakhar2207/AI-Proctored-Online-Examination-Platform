'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuthSession } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

interface ProfileDropdownProps {
  user: { username: string; email: string; role: string } | null;
}

export default function ProfileDropdown({ user }: ProfileDropdownProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { clearAuthSession(); router.push('/login'); };

  if (!user) return null;

  const initial = user.username ? user.username.charAt(0).toUpperCase() : 'U';

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'var(--accent)', color: '#fff',
          border: 'none', cursor: 'pointer',
          fontSize: 15, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'box-shadow 0.2s',
          boxShadow: open ? '0 0 0 3px var(--accent-glow)' : 'none',
        }}
      >
        {initial}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          minWidth: 200, background: 'var(--card-bg)',
          border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
          zIndex: 200, overflow: 'hidden',
        }}>
          {/* User info header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{user.username}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-text)', marginTop: 2 }}>{user.email}</div>
          </div>

          {/* Menu */}
          <div style={{ padding: '6px 0' }}>
            {user.role === 'student' && (
              <>
                <MenuItem label="Dashboard" onClick={() => { setOpen(false); router.push('/student/dashboard'); }} />
                <MenuItem label="My Exams" onClick={() => { setOpen(false); router.push('/student/exams'); }} />
                <MenuItem label="Results" onClick={() => { setOpen(false); router.push('/student/results'); }} />
                <MenuItem label="Analytics" onClick={() => { setOpen(false); router.push('/student/analytics'); }} />
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              </>
            )}
            {(user.role === 'admin' || user.role === 'examiner') && (
              <>
                <MenuItem label="Dashboard" onClick={() => { setOpen(false); router.push(`/${user.role}/dashboard`); }} />
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              </>
            )}
            <MenuItem label="Profile" onClick={() => { setOpen(false); router.push('/profile'); }} />
            <MenuItem label="Settings" onClick={() => { setOpen(false); router.push('/change-password'); }} />
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <MenuItem label={t('nav.logout')} onClick={handleLogout} danger />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  const { tQuestion } = useLanguage();
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '9px 16px', border: 'none',
        background: hovered ? 'var(--table-head-bg)' : 'transparent',
        fontSize: 13, fontWeight: 500, cursor: 'pointer',
        color: danger ? '#ef4444' : 'var(--foreground)',
        transition: 'background 0.15s',
      }}
    >
      {tQuestion(label)}
    </button>
  );
}
