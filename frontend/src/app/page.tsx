'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAuthSession } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';
import ThemeSelector from '@/components/ThemeSelector';
import PWAInstallButton from '@/components/PWAInstallButton';

export default function HomePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [userSession, setUserSession] = useState<any>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const session = getAuthSession();
    if (session) {
      setUserSession(session);
      setRedirecting(true);
      const timer = setTimeout(() => {
        if (session.must_change_password) {
          router.replace('/change-password');
        } else if (session.role === 'student') {
          router.replace('/student/dashboard');
        } else if (session.role === 'admin') {
          router.replace('/admin/dashboard');
        } else {
          router.replace('/examiner/dashboard');
        }
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setChecking(false);
    }
  }, [router]);

  if (redirecting) {
    return (
      <div style={styles.loadingContainer}>
        <div className="animated-bg"><div className="orb orb-1"/><div className="orb orb-2"/><div className="orb orb-3"/></div>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={styles.successPulse}>✓</div>
          <h2 style={styles.successTitle}>{t('landing.auth_success')}</h2>
          <p style={styles.successText}>{t('landing.welcome_back')} <strong style={{ color: '#38bdf8' }}>{userSession?.username}</strong></p>
          <p style={styles.loadingText}>
            <span className="ai-dot" />
            {t('landing.redirecting')} {userSession?.role} dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <div style={styles.loadingContainer}>
        <div className="animated-bg"><div className="orb orb-1"/><div className="orb orb-2"/></div>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>{t('landing.init_session')}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container} className="landing-container">
      {/* Animated background */}
      <div className="animated-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <header style={styles.header} className="landing-header">
        <div style={styles.logoBox}>
          <span className="ai-dot" />
          <span style={styles.logo}>AI-EXAM</span>
        </div>
        <div style={styles.headerRight} className="landing-header-right">
          <PWAInstallButton />
          <ThemeSelector />
          <LanguageSelector />
          <Link href="/login" className="btn-primary btn-sm">{t('nav.login')}</Link>
        </div>
      </header>

      <main style={styles.main} className="landing-main">
        <div className="hero-content" style={styles.hero}>
          {/* Badge */}
          <div style={styles.badge}>
            <span className="ai-dot" />
            {t('landing.badge')}
          </div>

          <h1 style={styles.title} className="landing-title">
            {t('landing.title_1')}<br />
            <span style={styles.gradientText}>{t('landing.title_2')}</span>
          </h1>

          <p style={styles.description} className="landing-desc">
            {t('landing.desc')}
          </p>

          <div style={styles.ctaGroup} className="landing-cta-group">
            <Link href="/login" className="btn-primary btn-lg">
              {t('landing.enter_exam')}
            </Link>
            <Link href="/register" className="btn-secondary btn-lg">
              {t('landing.register_candidate')}
            </Link>
          </div>

          {/* Prominent PWA Install Action */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
            <PWAInstallButton />
          </div>

          {/* Stats row */}
          <div style={styles.statsRow} className="landing-stats">
            <div style={styles.stat}>
              <div style={styles.statNum}>99.8%</div>
              <div style={styles.statLabel}>{t('landing.accuracy')}</div>
            </div>
            <div style={styles.statDivider} className="landing-stat-divider" />
            <div style={styles.stat}>
              <div style={styles.statNum}>5</div>
              <div style={styles.statLabel}>{t('landing.q_types')}</div>
            </div>
            <div style={styles.statDivider} className="landing-stat-divider" />
            <div style={styles.stat}>
              <div style={styles.statNum}>AI</div>
              <div style={styles.statLabel}>{t('landing.auto_eval')}</div>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div style={styles.features} className="landing-features">
          {[
            {
              title: t('landing.f1_title'),
              text: t('landing.f1_text'),
              accent: '#38bdf8',
              icon: '◉',
            },
            {
              title: t('landing.f2_title'),
              text: t('landing.f2_text'),
              accent: '#10b981',
              icon: '◷',
            },
            {
              title: t('landing.f3_title'),
              text: t('landing.f3_text'),
              accent: '#a855f7',
              icon: '◈',
            },
          ].map((f) => (
            <div key={f.title} className="card-hover landing-feature-card" style={{ ...styles.featureCard, borderTopColor: f.accent }}>
              <div style={{ ...styles.featureIcon, color: f.accent }}>{f.icon}</div>
              <h3 style={{ ...styles.featureTitle, color: f.accent }}>{f.title}</h3>
              <p style={styles.featureText}>{f.text}</p>
            </div>
          ))}
        </div>
      </main>

      <footer style={styles.footer}>
        <span>{t('landing.footer_brand')}</span>
        <span style={{ color: '#334155' }}>|</span>
        <span>{t('landing.footer_slogan')}</span>
      </footer>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    position: 'relative',
    zIndex: 10,
    padding: '16px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--nav-bg)',
    borderBottom: '1px solid var(--nav-border)',
    backdropFilter: 'blur(10px)',
    width: '100%',
  },
  logoBox: {
    display: 'flex',
    alignItems: 'center',
  },
  logo: {
    fontSize: '20px',
    fontWeight: '900',
    color: 'var(--accent)',
    letterSpacing: '0.12em',
    textShadow: 'none',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginLeft: 'auto',
  },
  headerTag: {
    fontSize: '12px',
    color: '#475569',
    fontWeight: '500',
    letterSpacing: '0.05em',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 48px',
    position: 'relative',
    zIndex: 1,
  },
  hero: {
    maxWidth: '780px',
    textAlign: 'center',
    marginBottom: '80px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 16px',
    borderRadius: '99px',
    background: 'rgba(56, 189, 248, 0.08)',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    color: 'var(--accent)',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '28px',
    letterSpacing: '0.02em',
  },
  title: {
    fontSize: '58px',
    fontWeight: '900',
    lineHeight: '1.15',
    marginBottom: '24px',
    color: 'var(--foreground)',
    letterSpacing: '-0.02em',
  },
  gradientText: {
    background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #a855f7 100%)',
    backgroundSize: '200% 200%',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    animation: 'gradient-shift 4s ease infinite',
  },
  description: {
    fontSize: '18px',
    color: '#475569',
    lineHeight: '1.7',
    marginBottom: '44px',
    maxWidth: '620px',
    margin: '0 auto 44px auto',
  },
  ctaGroup: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: '56px',
  },
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '40px',
    marginTop: '20px',
    padding: '24px 40px',
    background: 'var(--card-bg)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    backdropFilter: 'blur(10px)',
  },
  stat: {
    textAlign: 'center',
  },
  statNum: {
    fontSize: '28px',
    fontWeight: '800',
    color: 'var(--accent)',
    textShadow: 'none',
  },
  statLabel: {
    fontSize: '12px',
    color: '#475569',
    marginTop: '4px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  statDivider: {
    width: '1px',
    height: '40px',
    background: '#cbd5e1',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
    width: '100%',
    maxWidth: '1100px',
  },
  featureCard: {
    background: 'var(--card-bg)',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--border)',
    borderTop: '3px solid #38bdf8',
    padding: '32px',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
  },
  featureIcon: {
    fontSize: '32px',
    marginBottom: '16px',
  },
  featureTitle: {
    fontSize: '20px',
    fontWeight: '700',
    marginBottom: '12px',
  },
  featureText: {
    fontSize: '15px',
    color: '#475569',
    lineHeight: '1.65',
  },
  footer: {
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    padding: '20px',
    borderTop: '1px solid var(--border)',
    fontSize: '13px',
    color: '#475569',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '3px solid rgba(56, 189, 248, 0.2)',
    borderTopColor: '#38bdf8',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 20px auto',
  },
  successPulse: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(16, 185, 129, 0.15)',
    border: '2px solid #10b981',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '28px',
    color: '#10b981',
    margin: '0 auto 20px auto',
    boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)',
  },
  successTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#10b981',
    marginBottom: '8px',
  },
  successText: {
    fontSize: '16px',
    color: '#475569',
    marginBottom: '12px',
  },
  loadingText: {
    color: '#475569',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

if (typeof document !== 'undefined') {
  const id = 'landing-responsive';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @media (max-width: 640px) {
        .landing-header {
          padding: 12px 14px !important;
          flex-wrap: wrap !important;
          gap: 8px !important;
        }
        .landing-header-right {
          gap: 6px !important;
          flex-wrap: wrap !important;
        }
        .landing-main {
          padding: 24px 16px 40px !important;
        }
        .landing-title {
          font-size: 32px !important;
          line-height: 1.25 !important;
        }
        .landing-desc {
          font-size: 15px !important;
          margin-bottom: 24px !important;
        }
        .landing-stats {
          gap: 16px !important;
          padding: 16px 14px !important;
          flex-wrap: wrap !important;
        }
        .landing-stat-divider {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
}
