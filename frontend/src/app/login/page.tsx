'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, setAuthSession } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

// Encryption / Decryption helper for secure pre-filled auth links
export function encryptCredentials(user: string, pass: string): string {
  try {
    const payload = JSON.stringify({ u: user, p: pass, t: Date.now() });
    return btoa(encodeURIComponent(payload));
  } catch {
    return '';
  }
}

export function decryptCredentials(token: string): { username?: string; password?: string } | null {
  try {
    const json = decodeURIComponent(atob(token));
    const data = JSON.parse(json);
    return { username: data.u, password: data.p };
  } catch {
    return null;
  }
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccess('Registration successful! Please log in.');
    }

    let u = searchParams.get('username') || searchParams.get('u');
    let p = searchParams.get('password') || searchParams.get('p');
    const token = searchParams.get('auth') || searchParams.get('token') || searchParams.get('data');

    if (token) {
      const decrypted = decryptCredentials(token);
      if (decrypted?.username && decrypted?.password) {
        u = decrypted.username;
        p = decrypted.password;
      }
    }

    if (u || p) {
      setFormData((prev) => ({
        username: u || prev.username,
        password: p || prev.password,
      }));

      // Immediately scrub sensitive credentials from browser URL address bar
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!formData.username || !formData.password) { setError('Username and password are required.'); return; }
    setLoading(true);
    try {
      const response = await apiFetch('/auth/login/', { method: 'POST', body: JSON.stringify(formData) });
      if (response.status === 200) {
        const data = await response.json();
        setAuthSession(data);
        router.push('/');
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.detail || data.message || 'Invalid username or password.');
      }
    } catch (err: any) {
      console.error('Mobile PWA Login Error:', err);
      setError(
        'Unable to reach backend server. Please verify your internet connection or backend web service status.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={s.logo}>AI-EXAM</div>
          <p style={s.subtitle}>{t('auth.login_sub')}</p>
        </div>

        {success && <div style={s.alertOk}>{success}</div>}
        {error && <div style={s.alertErr}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={s.label}>{t('auth.username')}</label>
            <input type="text" name="username" value={formData.username} onChange={handleChange}
              placeholder="Enter username or email" style={s.input} required />
          </div>
          <div style={{ position: 'relative' }}>
            <label style={s.label}>{t('auth.password')}</label>
            <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange}
              placeholder="Enter password" style={{...s.input, paddingRight: '40px'}} required />
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
          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? t('auth.signing_in') : t('auth.sign_in')}
          </button>
        </form>

        <p style={s.footer}>
          Don&apos;t have an account?{' '}
          <Link href="/register" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            {t('nav.register')}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: 'var(--muted-text)' }}>Loading...</div>}>
      <LoginContent />
    </Suspense>
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
    letterSpacing: '0.08em',
    marginBottom: 6,
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
  alertOk: {
    padding: '10px 14px', borderRadius: 8, marginBottom: 16,
    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
    color: '#059669', fontSize: 13, textAlign: 'center',
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
