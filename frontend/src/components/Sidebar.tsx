'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { clearAuthSession } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import ThemeSelector from '@/components/ThemeSelector';
import LanguageSelector from '@/components/LanguageSelector';

import PWAInstallButton from '@/components/PWAInstallButton';

export interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

interface SidebarProps {
  user: { username: string; email?: string; role: string } | null;
  navItems: NavItem[];
  activeKey: string;
  onNavChange: (key: string) => void;
}

/* ── SVG icon helpers ── */
const Icon = {
  dashboard: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  exam: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  results: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  users: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  questions: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  grading: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  settings: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  logout: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  sessions: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  menu: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  close: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

export { Icon };

export default function Sidebar({ user, navItems, activeKey, onNavChange }: SidebarProps) {
  const router = useRouter();
  const { t, tQuestion } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { clearAuthSession(); router.push('/login'); };
  const initial = user?.username?.charAt(0).toUpperCase() || 'U';

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={st.logoBox}>
        <span style={st.logo}>AI-EXAM</span>
      </div>

      {/* Nav items */}
      <nav style={st.nav}>
        {navItems.map(item => {
          const active = item.key === activeKey;
          return (
            <button
              key={item.key}
              onClick={() => { item.onClick ? item.onClick() : onNavChange(item.key); setMobileOpen(false); }}
              style={{ ...st.navItem, ...(active ? st.navItemActive : {}) }}
            >
              <span style={{ color: active ? 'var(--accent)' : 'var(--muted-text)', display: 'flex' }}>{item.icon}</span>
              <span>{tQuestion(item.label)}</span>
            </button>
          );
        })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Bottom section */}
      <div style={st.bottom}>
        <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
          <PWAInstallButton />
        </div>
        <div style={st.controls}>
          <ThemeSelector />
          <LanguageSelector />
        </div>
        <div style={st.divider} />
        <div style={st.userSection}>
          <div style={st.avatar}>{initial}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={st.userName}>{user?.username}</div>
            <div style={st.userRole}>{tQuestion(user?.role || '')}</div>
          </div>
        </div>
        <button onClick={handleLogout} style={st.logoutBtn}>
          {Icon.logout}
          <span>{t('nav.logout')}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button className="app-mobile-toggle" style={st.mobileToggle} onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? Icon.close : Icon.menu}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && <div style={st.overlay} onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`app-sidebar ${mobileOpen ? 'app-sidebar-open' : ''}`} style={{ ...st.sidebar, ...(mobileOpen ? st.sidebarOpen : {}) }}>
        {sidebarContent}
      </aside>
    </>
  );
}

/* ── Layout wrapper for pages with sidebar ── */
export function DashboardLayout({
  user, navItems, activeKey, onNavChange, children,
}: SidebarProps & { children: React.ReactNode }) {
  return (
    <div style={st.layout}>
      <Sidebar user={user} navItems={navItems} activeKey={activeKey} onNavChange={onNavChange} />
      <main className="app-main-content" style={st.content}>
        {children}
      </main>
    </div>
  );
}

const st: { [key: string]: React.CSSProperties } = {
  layout: {
    display: 'flex', minHeight: '100vh', background: 'var(--background)',
    fontFamily: 'Inter, system-ui, sans-serif', color: 'var(--foreground)',
  },
  sidebar: {
    width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
    background: 'var(--card-bg)', borderRight: '1px solid var(--border)',
    height: '100vh', position: 'sticky', top: 0, overflowY: 'auto',
    zIndex: 50,
  },
  sidebarOpen: {
    position: 'fixed', left: 0, top: 0, bottom: 0,
    boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
  },
  content: {
    flex: 1, minWidth: 0, padding: '32px 28px 60px',
    maxWidth: 1200, overflowX: 'hidden',
  },
  logoBox: {
    padding: '20px 20px 16px', borderBottom: '1px solid var(--border)',
  },
  logo: {
    fontSize: 16, fontWeight: 800, color: 'var(--accent)',
    letterSpacing: '0.08em',
  },
  nav: {
    padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2,
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 14px', borderRadius: 8,
    background: 'transparent', border: 'none',
    color: 'var(--foreground)', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', textAlign: 'left', width: '100%',
    transition: 'all 0.15s',
  },
  navItemActive: {
    background: 'var(--accent-glow)',
    color: 'var(--accent)', fontWeight: 600,
  },
  bottom: {
    padding: '12px 14px 16px', borderTop: '1px solid var(--border)',
  },
  controls: {
    display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center',
  },
  divider: {
    height: 1, background: 'var(--border)', margin: '8px 0',
  },
  userSection: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
  },
  avatar: {
    width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700, flexShrink: 0,
  },
  userName: {
    fontSize: 13, fontWeight: 600, color: 'var(--foreground)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  userRole: {
    fontSize: 11, color: 'var(--muted-text)', textTransform: 'capitalize',
  },
  logoutBtn: {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '9px 14px', marginTop: 4,
    borderRadius: 8, border: 'none', background: 'transparent',
    color: '#ef4444', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', textAlign: 'left',
    transition: 'background 0.15s',
  },
  mobileToggle: {
    position: 'fixed', top: 14, left: 14, zIndex: 60,
    width: 40, height: 40, borderRadius: 8,
    background: 'var(--card-bg)', border: '1px solid var(--border)',
    display: 'none', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: 'var(--foreground)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    zIndex: 45,
  },
};

// Add responsive CSS via style tag
if (typeof document !== 'undefined') {
  const id = 'sidebar-responsive';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @media (max-width: 768px) {
        .app-sidebar { 
          position: fixed !important; left: -260px !important; transition: left 0.25s ease !important; z-index: 50 !important; 
        }
        .app-sidebar.app-sidebar-open {
          left: 0 !important;
        }
        .app-mobile-toggle { display: flex !important; }
        .app-main-content { padding: 60px 14px 40px !important; }
      }
    `;
    document.head.appendChild(style);
  }
}
