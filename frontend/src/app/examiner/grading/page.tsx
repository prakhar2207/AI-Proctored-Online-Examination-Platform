'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSession, clearAuthSession } from '@/lib/api';

export default function ExaminerGradingPortal() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getAuthSession();
    if (!session || (session.role !== 'examiner' && session.role !== 'admin')) {
      router.replace('/login');
    } else {
      setUser({
        username: session.username || 'Examiner',
        email: session.email || '',
        role: session.role
      });
      setLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    clearAuthSession();
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <p>Loading examiner portal...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <div style={styles.logo}>Examiner Portal</div>
        <div style={styles.navActions}>
          <span style={styles.userInfo}>
            {user?.username} ({user?.role})
          </span>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </nav>

      <main style={styles.main}>
        <div style={styles.welcomeSection}>
          <h1 style={styles.title}>Evaluator Dashboard</h1>
          <p style={styles.subtitle}>Grading queue for subjective written answers and handwritten upload reviews.</p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Subjective Grading Queue</h2>
          <div style={styles.emptyState}>
            <p>No answer submissions currently require evaluation.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at top left, #1e293b 0%, #0f172a 100%)',
    color: '#e2e8f0',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 40px',
    background: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
  },
  logo: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#38bdf8',
    textShadow: '0 0 15px rgba(56, 189, 248, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  navActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  userInfo: {
    fontSize: '14px',
    color: '#94a3b8',
    fontWeight: '500',
  },
  logoutBtn: {
    padding: '8px 20px',
    borderRadius: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: '#f87171',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '700',
    transition: 'all 0.2s',
    boxShadow: '0 0 10px rgba(239, 68, 68, 0.1)',
  },
  main: {
    padding: '40px',
    maxWidth: '1280px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
  },
  welcomeSection: {
    marginBottom: '20px',
  },
  title: {
    fontSize: '32px',
    fontWeight: '800',
    marginBottom: '10px',
    color: '#f8fafc',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: '15px',
  },
  tabContainer: {
    display: 'flex',
    gap: '16px',
    borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
    marginBottom: '30px',
  },
  tab: {
    padding: '12px 24px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#64748b',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  activeTab: {
    padding: '12px 24px',
    background: 'rgba(56, 189, 248, 0.1)',
    border: 'none',
    borderBottom: '2px solid #38bdf8',
    color: '#38bdf8',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    textShadow: '0 0 10px rgba(56, 189, 248, 0.4)',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#f8fafc',
  },
  primaryBtn: {
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 0 15px rgba(14, 165, 233, 0.3)',
    transition: 'all 0.2s',
  },
  secondaryBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid #38bdf8',
    background: 'rgba(56, 189, 248, 0.1)',
    color: '#38bdf8',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: 'inset 0 0 10px rgba(56, 189, 248, 0.1)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px',
  },
  card: {
    padding: '24px',
    borderRadius: '16px',
    background: 'rgba(30, 41, 59, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    transition: 'transform 0.2s, border-color 0.2s',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#38bdf8',
  },
  cardMeta: {
    fontSize: '14px',
    color: '#94a3b8',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardStatus: {
    display: 'inline-block',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: 'auto',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  },
  emptyState: {
    padding: '60px',
    textAlign: 'center',
    color: '#64748b',
    background: 'rgba(30, 41, 59, 0.3)',
    borderRadius: '16px',
    border: '1px dashed rgba(255, 255, 255, 0.1)',
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderRadius: '12px',
    background: 'rgba(30, 41, 59, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  listMeta: {
    fontSize: '14px',
    color: '#94a3b8',
    display: 'flex',
    gap: '24px',
  },
  actionBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    background: 'rgba(56, 189, 248, 0.1)',
    border: '1px solid #38bdf8',
    color: '#38bdf8',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: '100%',
    maxWidth: '560px',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    borderRadius: '16px',
    padding: '32px',
    color: '#f8fafc',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 0 50px rgba(0, 0, 0, 0.5)',
  },
  modalHeader: {
    fontSize: '20px',
    fontWeight: '800',
    marginBottom: '24px',
    color: '#38bdf8',
    textTransform: 'uppercase',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '20px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#cbd5e1',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    color: '#f8fafc',
    fontSize: '14px',
    outline: 'none',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '30px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },
  cancelBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: '#cbd5e1',
    cursor: 'pointer',
    fontWeight: '600',
  },
  submitBtn: {
    padding: '10px 24px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
    border: 'none',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: '700',
  }
};
