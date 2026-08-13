'use client';

import React from 'react';
import { useLanguage, Language, LANGUAGE_OPTIONS } from '@/context/LanguageContext';

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  return (
    <div style={styles.container}>
      <span style={styles.globeIcon}>🌐</span>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        style={styles.select}
        aria-label="Select Language"
      >
        {LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt.code} value={opt.code} style={styles.option}>
            {opt.flag} {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    padding: '4px 10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    transition: 'all 0.2s ease',
  },
  globeIcon: {
    fontSize: '13px',
    opacity: 0.9,
  },
  select: {
    background: 'transparent',
    color: 'var(--foreground)',
    border: 'none',
    outline: 'none',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  option: {
    backgroundColor: 'var(--card-bg)',
    color: 'var(--foreground)',
    fontSize: '12px',
    padding: '6px',
  },
};
