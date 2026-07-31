'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!formData.username || !formData.email || !formData.password) {
      setError('All fields are required.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch('/auth/register/', {
        method: 'POST',
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role
        })
      });

      if (response.status === 201) {
        // Success
        router.push('/login?registered=true');
      } else {
        const data = await response.json();
        // Extract field-specific errors
        let msg = 'Registration failed.';
        if (data.username) msg = `Username: ${data.username[0]}`;
        else if (data.email) msg = `Email: ${data.email[0]}`;
        else if (data.password) msg = `Password: ${data.password[0]}`;
        else if (data.detail) msg = data.detail;
        setError(msg);
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.glassCard}>
        <div style={styles.header}>
          <h2 style={styles.title}>Create Account</h2>
          <p style={styles.subtitle}>AI-Proctored Examination Platform</p>
        </div>

        {error && <div style={styles.errorAlert}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter username"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="name@example.com"
              style={styles.input}
              required
            />
          </div>



          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create password"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter password"
              style={styles.input}
              required
            />
          </div>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Signing up...' : 'Register'}
          </button>
        </form>

        <div style={styles.footer}>
          <span>Already have an account? </span>
          <Link href="/login" style={styles.link}>
            Login here
          </Link>
        </div>
      </div>
    </div>
  );
}

// Custom Premium Dark Glassmorphism Styling
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
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
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
    textShadow: 'none',
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
    color: '#34d399',
    fontSize: '14px',
    marginBottom: '20px',
    textAlign: 'center',
    boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)',
  },
  errorAlert: {
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid #ef4444',
    color: '#f87171',
    fontSize: '14px',
    marginBottom: '20px',
    textAlign: 'center',
    boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)',
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
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: 'var(--foreground)',
    fontSize: '15px',
    outline: 'none',
    boxShadow: 'none',
    transition: 'border 0.2s',
  },
  button: {
    padding: '16px',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '800',
    cursor: 'pointer',
    marginTop: '10px',
    boxShadow: '0 0 20px rgba(14, 165, 233, 0.4)',
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
    textShadow: 'none',
  },
  loading: {
    color: 'var(--accent)',
    fontSize: '18px',
    textAlign: 'center',
    marginTop: '50px',
    animation: 'pulse 1.5s infinite',
  }
};
