'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSession, setAuthSession, apiFetch } from '@/lib/api';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const activeSession = getAuthSession();
    if (!activeSession) {
      router.replace('/login');
    } else {
      setSession(activeSession);
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.newPassword || !formData.confirmPassword) {
      setError('Both fields are required.');
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch('/auth/change-password/', {
        method: 'POST',
        body: JSON.stringify({
          new_password: formData.newPassword
        })
      });

      if (response.status === 200) {
        setSuccess('Password updated successfully! Redirecting...');
        
        // Update must_change_password in localStorage
        if (session) {
          const updatedSession = { ...session, must_change_password: false };
          setAuthSession(updatedSession);
        }

        setTimeout(() => {
          router.replace('/');
        }, 1500);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update password.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div style={styles.container}>
      <div style={styles.glassCard}>
        <div style={styles.header}>
          <h2 style={styles.title}>Secure Your Account</h2>
          <p style={styles.subtitle}>First-time login password change required</p>
        </div>

        {error && <div style={styles.errorAlert}>{error}</div>}
        {success && <div style={styles.successAlert}>{success}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>New Password</label>
            <input
              type="password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              placeholder="Enter new secure password"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Confirm New Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter new password"
              style={styles.input}
              required
            />
          </div>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Updating Password...' : 'Save & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Reusing matching premium Dark glassmorphism styles
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'var(--background)',
    fontFamily: 'Inter, system-ui, sans-serif',
    padding: '20px',
  },
  glassCard: {
    width: '100%',
    maxWidth: '440px',
    padding: '40px',
    borderRadius: '16px',
    background: 'var(--card-bg)',
    border: '1px solid var(--border)',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04)',
    color: 'var(--foreground)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '800',
    marginBottom: '8px',
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  subtitle: {
    fontSize: '14px',
    color: '#475569',
  },
  successAlert: {
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid #10b981',
    color: '#059669',
    fontSize: '14px',
    marginBottom: '20px',
    textAlign: 'center',
  },
  errorAlert: {
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid #ef4444',
    color: '#dc2626',
    fontSize: '14px',
    marginBottom: '20px',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    padding: '14px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
    fontSize: '15px',
    outline: 'none',
    transition: 'border 0.2s',
  },
  button: {
    padding: '16px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--accent)',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '800',
    cursor: 'pointer',
    marginTop: '10px',
    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    transition: 'all 0.2s',
  },
  footer: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '14px',
    color: '#475569',
  },
  link: {
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: '600',
  },
  loading: {
    color: 'var(--accent)',
    fontSize: '18px',
    textAlign: 'center',
    marginTop: '50px',
    animation: 'pulse 1.5s infinite',
  }
};
