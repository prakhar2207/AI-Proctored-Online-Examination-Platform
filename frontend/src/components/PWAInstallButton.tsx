'use client';

import React, { useEffect, useState } from 'react';

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Check global prompt captured by PWAInstallPrompt
    if (typeof window !== 'undefined' && (window as any).deferredPWAInstallPrompt) {
      setDeferredPrompt((window as any).deferredPWAInstallPrompt);
    }

    // Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[PWA] SW active:', reg.scope))
        .catch((err) => console.warn('[PWA] SW registration failed:', err));
    }

    // Detect Standalone PWA Mode & Platform
    if (typeof window !== 'undefined') {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes('android-app://');

      if (standalone) {
        setIsStandalone(true);
      }

      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIPhone = /iphone|ipad|ipod/.test(userAgent);
      if (isIPhone) {
        setIsIOS(true);
      }

      const isMobileDevice = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      setIsDesktop(!isMobileDevice);
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPWAInstallPrompt = e;
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptObj = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPWAInstallPrompt : null);

    if (promptObj) {
      try {
        promptObj.prompt();
        const choiceResult = await promptObj.userChoice;
        console.log(`[PWA] Native Install Prompt Choice: ${choiceResult?.outcome}`);
        setDeferredPrompt(null);
        if (typeof window !== 'undefined') {
          (window as any).deferredPWAInstallPrompt = null;
        }
        return;
      } catch (err) {
        console.warn('[PWA] Native install prompt trigger error:', err);
      }
    }

    // Fallback to step-by-step guidance modal
    setShowModal(true);
  };

  if (isStandalone) return null;

  return (
    <>
      <button
        onClick={handleInstallClick}
        style={styles.navInstallBtn}
        title={isDesktop ? "Install Application on Laptop/Desktop" : "Install Application on Mobile"}
      >
        <span style={styles.icon}>{isDesktop ? '💻' : '📱'}</span>
        <span>{isDesktop ? 'Install App' : 'Install App'}</span>
      </button>

      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleRow}>
                <span style={{ fontSize: '24px' }}>{isDesktop ? '💻' : '📱'}</span>
                <h3 style={styles.modalTitle}>Install Exam Platform App</h3>
              </div>
              <button style={styles.closeBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>

            <p style={styles.modalDesc}>
              Install AI Proctored Examination Platform directly on your {isDesktop ? 'laptop/desktop' : 'device'} for a native, standalone app experience.
            </p>

            {isDesktop ? (
              <div style={styles.stepBox}>
                <div style={styles.stepTitle}>💻 Laptop / Desktop (Chrome / Edge / Brave):</div>
                <ol style={styles.stepList}>
                  <li>Look for the <strong>Install icon (💻 or ⊕)</strong> at the right side of your browser&apos;s URL address bar.</li>
                  <li>Or click the <strong>3 dots (⋮)</strong> browser menu top-right → <strong>Save and Share</strong> → <strong>Install AI Proctored Examination Platform</strong>.</li>
                  <li>Click <strong>Install</strong> to launch as a standalone Desktop App!</li>
                </ol>
              </div>
            ) : isIOS ? (
              <div style={styles.stepBox}>
                <div style={styles.stepTitle}>🍏 iPhone / iPad (Safari):</div>
                <ol style={styles.stepList}>
                  <li>Tap the <strong>Share button (⎋)</strong> at the bottom of Safari.</li>
                  <li>Scroll down and tap <strong>Add to Home Screen (➕)</strong>.</li>
                  <li>Tap <strong>Add</strong> at top right.</li>
                </ol>
              </div>
            ) : (
              <div style={styles.stepBox}>
                <div style={styles.stepTitle}>🤖 Android (Chrome / Brave / Edge):</div>
                <ol style={styles.stepList}>
                  <li>Tap the <strong>3 dots (⋮)</strong> menu in top-right of browser.</li>
                  <li>Tap <strong>"Install app"</strong> (or "Add to Home screen").</li>
                  <li>Confirm <strong>Install</strong> to create a native standalone WebAPK application!</li>
                </ol>
              </div>
            )}

            <button style={styles.gotItBtn} onClick={() => setShowModal(false)}>
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  navInstallBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '20px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    zIndex: 20,
  },
  icon: {
    fontSize: '14px',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 99999,
    background: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
  },
  modalContent: {
    background: '#ffffff',
    borderRadius: '16px',
    maxWidth: '420px',
    width: '100%',
    padding: '24px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
    fontFamily: 'Inter, system-ui, sans-serif',
    color: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 800,
    color: '#2563eb',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#64748b',
  },
  modalDesc: {
    fontSize: '14px',
    color: '#475569',
    margin: 0,
    lineHeight: '1.5',
  },
  stepBox: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
  },
  stepTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '8px',
  },
  stepList: {
    margin: 0,
    paddingLeft: '20px',
    fontSize: '13px',
    color: '#334155',
    lineHeight: '1.6',
  },
  gotItBtn: {
    background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
  },
};
