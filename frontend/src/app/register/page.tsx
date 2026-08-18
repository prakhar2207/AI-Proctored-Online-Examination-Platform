'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', confirmPassword: '', role: 'student'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.username || !formData.email || !formData.password) { setError('All fields are required.'); return; }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const response = await apiFetch('/auth/register/', {
        method: 'POST',
        body: JSON.stringify({ username: formData.username, email: formData.email, password: formData.password, role: formData.role })
      });
      if (response.status === 201) { router.push('/login?registered=true'); }
      else {
        const data = await response.json();
        let msg = 'Registration failed.';
        if (data.username) msg = `Username: ${data.username[0]}`;
        else if (data.email) msg = `Email: ${data.email[0]}`;
        else if (data.password) msg = `Password: ${data.password[0]}`;
        else if (data.detail) msg = data.detail;
        setError(msg);
      }
    } catch (err) { console.error(err); setError('An unexpected network error occurred.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={s.logo}>AI-EXAM</div>
          <p style={s.subtitle}>Create your account</p>
        </div>

        {error && <div style={s.alertErr}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={s.label}>Username</label>
            <input type="text" name="username" value={formData.username} onChange={handleChange}
              placeholder="Enter username" style={s.input} required />
          </div>
          <div>
            <label style={s.label}>Email Address</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange}
              placeholder="name@example.com" style={s.input} required />
          </div>
          <div style={{ position: 'relative' }}>
            <label style={s.label}>Password</label>
            <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange}
              placeholder="Create password" style={{...s.input, paddingRight: '40px'}} required />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: '12px', top: '34px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: '18px', color: 'var(--muted-text)', padding: 0
              }}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <label style={s.label}>Confirm Password</label>
            <input type={showConfirmPassword ? "text" : "password"} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
              placeholder="Re-enter password" style={{...s.input, paddingRight: '40px'}} required />
            <button 
              type="button" 
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              style={{
                position: 'absolute', right: '12px', top: '34px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: '18px', color: 'var(--muted-text)', padding: 0
              }}
              title={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? '🙈' : '👁️'}
            </button>
          </div>
          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'Signing up...' : 'Register'}
          </button>
        </form>

        <p style={s.footer}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}

const s: { [key: string]: React.CSSProperties } = {
  page: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    minHeight: '100vh', background: 'var(--background)',
    fontFamily: 'Inter, system-ui, sans-serif', padding: 20,
  },
  card: {
    width: '100%', maxWidth: 400, padding: '40px 36px',
    borderRadius: 12, background: 'var(--card-bg)',
    border: '1px solid var(--border)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
  },
  logo: {
    fontSize: 20, fontWeight: 800, color: 'var(--accent)',
    letterSpacing: '0.08em', marginBottom: 6,
  },
  subtitle: {
    fontSize: 14, color: 'var(--muted-text)', margin: 0,
  },
  label: {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--muted-text)', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  input: {
    width: '100%', padding: '12px 14px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--background)',
    color: 'var(--foreground)', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s',
  },
  btn: {
    width: '100%', padding: 14, borderRadius: 8,
    border: 'none', background: 'var(--accent)', color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    letterSpacing: '0.03em', transition: 'opacity 0.2s',
    marginTop: 4,
  },
  alertErr: {
    padding: '10px 14px', borderRadius: 8, marginBottom: 16,
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#dc2626', fontSize: 13, textAlign: 'center',
  },
  footer: {
    marginTop: 24, textAlign: 'center', fontSize: 13,
    color: 'var(--muted-text)',
  },
};
