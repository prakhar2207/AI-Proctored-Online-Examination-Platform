'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSession, apiFetch } from '@/lib/api';
import { User, Edit2, Mail, Phone, GraduationCap, Award, Building2, ChevronLeft, MapPin } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    organization: '',
    role: '',
    overall_performance: 'N/A'
  });

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    organization: ''
  });
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const activeSession = getAuthSession();
    if (!activeSession) {
      router.replace('/login');
    } else {
      setSession(activeSession);
      fetchProfile();
    }
  }, [router]);

  const fetchProfile = async () => {
    const activeSession = getAuthSession();
    try {
      const res = await apiFetch('/auth/profile/');
      if (res.status === 200) {
        const data = await res.json();
        
        const fetchedData = {
          first_name: data.first_name || data.username || activeSession?.username || '',
          last_name: data.last_name || '',
          email: data.email || activeSession?.email || '',
          phone_number: data.phone_number || '',
          organization: data.organization || '',
          role: data.role || activeSession?.role || '',
          overall_performance: data.overall_performance || 'N/A'
        };

        setProfileData(fetchedData);
        setFormData({
          first_name: fetchedData.first_name,
          last_name: fetchedData.last_name,
          email: fetchedData.email,
          phone_number: fetchedData.phone_number,
          organization: fetchedData.organization
        });
      } else if (activeSession) {
        setProfileData(prev => ({
          ...prev,
          first_name: activeSession.username || '',
          email: activeSession.email || '',
          role: activeSession.role || ''
        }));
      }
    } catch (err) {
      console.error(err);
      if (activeSession) {
        setProfileData(prev => ({
          ...prev,
          first_name: activeSession.username || '',
          email: activeSession.email || '',
          role: activeSession.role || ''
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const response = await apiFetch('/auth/profile/', {
        method: 'PATCH',
        body: JSON.stringify(formData)
      });

      if (response.status === 200) {
        // Refresh local data
        setProfileData(prev => ({
          ...prev,
          ...formData
        }));
        setIsEditOpen(false);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      setError('Network error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (session) {
      if (session.role === 'admin') router.push('/admin/dashboard');
      else if (session.role === 'examiner') router.push('/examiner/dashboard');
      else router.push('/student/dashboard');
    }
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.spinner} />
      </div>
    );
  }

  const fullName = `${profileData.first_name} ${profileData.last_name}`.trim() || profileData.email.split('@')[0];
  const isStudent = profileData.role === 'student';

  return (
    <div style={styles.page}>
      
      {/* ── BACK BUTTON ── */}
      <button onClick={goBack} style={styles.backButton}>
        <ChevronLeft size={18} style={{ marginRight: 4 }} />
        Back to Dashboard
      </button>

      <div style={styles.container}>
        
        {/* ── HERO HEADER ── */}
        <div style={styles.heroCard}>
          <div style={styles.heroContent}>
            <div style={styles.avatarWrap}>
              <User size={48} color="var(--accent)" />
            </div>
            
            <div style={styles.userInfo}>
              <h1 style={styles.heroName}>{fullName}</h1>
              
              <div style={styles.heroMetaList}>
                {profileData.organization && (
                  <div style={styles.metaItem}>
                    <GraduationCap size={16} />
                    <span>{profileData.organization}</span>
                  </div>
                )}
                <div style={styles.metaItem}>
                  <Building2 size={16} />
                  <span>{profileData.role.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>
          
          {isStudent && (
            <div style={styles.heroStats}>
              <div style={styles.statBox}>
                <span style={styles.statValue}>{profileData.overall_performance}</span>
                <span style={styles.statLabel}>Avg Score</span>
              </div>
            </div>
          )}
        </div>

        {/* ── TABS ── */}
        <div className="tab-container" style={{ alignSelf: 'flex-start', margin: '24px 0' }}>
          <button 
            className={activeTab === 'overview' ? 'tab-btn-active' : 'tab-btn'} 
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={activeTab === 'activity' ? 'tab-btn-active' : 'tab-btn'} 
            onClick={() => setActiveTab('activity')}
          >
            Activity Logs
          </button>
        </div>

        {/* ── MAIN CONTENT ── */}
        {activeTab === 'overview' && (
          <div style={styles.mainGrid}>
            
            {/* Left Column: Basic Info & Contact */}
            <div style={styles.column}>
              
              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <h3 style={styles.sectionTitle}>Basic Information</h3>
                  <button style={styles.editBtn} onClick={() => setIsEditOpen(true)} title="Edit Profile">
                    <Edit2 size={16} />
                  </button>
                </div>
                
                <p style={styles.sectionDesc}>Edit your name, contact, and organization.</p>
                
                <div style={styles.infoList}>
                  <div style={styles.infoRow}>
                    <span style={styles.infoKey}>First Name</span>
                    <span style={styles.infoVal}>{profileData.first_name || '-'}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoKey}>Last Name</span>
                    <span style={styles.infoVal}>{profileData.last_name || '-'}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoKey}>Email Address</span>
                    <span style={{ ...styles.infoVal, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Mail size={14} color="var(--muted-text)" />
                      {profileData.email}
                    </span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoKey}>Phone Number</span>
                    <span style={{ ...styles.infoVal, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Phone size={14} color="var(--muted-text)" />
                      {profileData.phone_number || 'Not provided'}
                    </span>
                  </div>
                </div>
              </div>
              
            </div>

            {/* Right Column: Qualifications & Performance */}
            <div style={styles.column}>
              
              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <h3 style={styles.sectionTitle}>Qualifications</h3>
                  <button style={styles.editBtn} onClick={() => setIsEditOpen(true)}>
                    <Edit2 size={16} />
                  </button>
                </div>
                
                <div style={styles.qualiBox}>
                  <div style={styles.qualiIcon}>
                    <GraduationCap size={20} color="var(--success)" />
                  </div>
                  <div style={styles.qualiText}>
                    <div style={styles.qualiName}>
                      {profileData.organization || 'No Organization Added'}
                    </div>
                    <div style={styles.qualiSub}>Current Affiliation</div>
                  </div>
                </div>
              </div>

              {isStudent && (
                <div style={styles.sectionCard}>
                  <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionTitle}>Overall Performance</h3>
                  </div>
                  
                  <div style={styles.perfBox}>
                    <Award size={32} color="var(--accent)" style={{ marginBottom: 12 }} />
                    <div style={styles.perfScore}>{profileData.overall_performance}</div>
                    <div style={styles.perfLabel}>Average Assessment Score</div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div style={styles.emptyState}>
            <p>Activity logs will be available soon.</p>
          </div>
        )}

      </div>

      {/* ── EDIT MODAL ── */}
      {isEditOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsEditOpen(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Edit Profile</h2>
              <button style={styles.closeBtn} onClick={() => setIsEditOpen(false)}>×</button>
            </div>
            
            {error && <div style={styles.errorAlert}>{error}</div>}
            
            <form onSubmit={handleSave} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>First Name</label>
                  <input
                    style={styles.input}
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Last Name</label>
                  <input
                    style={styles.input}
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>College / Organization</label>
                <input
                  style={styles.input}
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  placeholder="e.g. Stanford University"
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled
                  style={{...styles.input, opacity: 0.6, cursor: 'not-allowed'}}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Phone Number</label>
                <input
                  style={styles.input}
                  type="text"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                />
              </div>

              <div style={styles.modalFooter}>
                <button 
                  type="button" 
                  style={styles.cancelBtn} 
                  onClick={() => setIsEditOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ ...styles.submitBtn, opacity: saving ? 0.7 : 1 }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--background)',
    color: 'var(--foreground)',
    fontFamily: 'Inter, system-ui, sans-serif',
    padding: '40px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  container: {
    width: '100%',
    maxWidth: 1000,
    display: 'flex',
    flexDirection: 'column'
  },
  backButton: {
    alignSelf: 'flex-start',
    display: 'flex',
    alignItems: 'center',
    background: 'transparent',
    border: 'none',
    color: 'var(--muted-text)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 24,
    transition: 'color 0.2s',
  },
  
  // HERO SECTION
  heroCard: {
    background: 'var(--card-bg)',
    borderRadius: 16,
    border: '1px solid var(--border)',
    padding: 32,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
    flexWrap: 'wrap',
    gap: 24
  },
  heroContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 24
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    background: 'var(--accent-glow)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid rgba(37, 99, 235, 0.2)'
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  heroName: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--foreground)'
  },
  heroMetaList: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap'
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--accent)',
    fontSize: 14,
    fontWeight: 500
  },
  heroStats: {
    display: 'flex',
    gap: 16
  },
  statBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'var(--background)',
    border: '1px solid var(--border)',
    padding: '12px 20px',
    borderRadius: 12
  },
  statValue: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--foreground)'
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--muted-text)',
    textTransform: 'uppercase'
  },

  // MAIN GRID
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: 24,
    width: '100%'
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24
  },
  
  // SECTIONS
  sectionCard: {
    background: 'var(--card-bg)',
    borderRadius: 16,
    border: '1px solid var(--border)',
    padding: 24,
    boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
  },
  sectionDesc: {
    margin: '0 0 20px 0',
    fontSize: 14,
    color: 'var(--muted-text)'
  },
  editBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--muted-text)',
    cursor: 'pointer',
    padding: 6,
    borderRadius: '50%',
    display: 'flex',
    transition: 'background 0.2s, color 0.2s'
  },
  
  // INFO LIST
  infoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  },
  infoRow: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr',
    gap: 12,
    alignItems: 'center'
  },
  infoKey: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--muted-text)',
  },
  infoVal: {
    fontSize: 14,
    color: 'var(--foreground)',
    fontWeight: 500
  },

  // QUALIFICATIONS
  qualiBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    background: 'var(--background)',
    padding: 16,
    borderRadius: 12,
    border: '1px solid var(--border)'
  },
  qualiIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: 'var(--success-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  qualiText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  qualiName: {
    fontWeight: 600,
    fontSize: 15
  },
  qualiSub: {
    fontSize: 13,
    color: 'var(--muted-text)'
  },

  // PERFORMANCE
  perfBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'var(--background)',
    padding: '32px 16px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    textAlign: 'center'
  },
  perfScore: {
    fontSize: 36,
    fontWeight: 800,
    color: 'var(--foreground)'
  },
  perfLabel: {
    fontSize: 14,
    color: 'var(--muted-text)',
    marginTop: 4
  },

  // EMPTY STATE
  emptyState: {
    background: 'var(--card-bg)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 60,
    textAlign: 'center',
    color: 'var(--muted-text)'
  },

  // MODAL
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 24
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    background: 'var(--card-bg)',
    borderRadius: 16,
    border: '1px solid var(--border)',
    boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
    padding: 32,
    animation: 'fade-in-up 0.3s ease-out forwards'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  modalTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 24,
    color: 'var(--muted-text)',
    cursor: 'pointer',
    padding: 0
  },
  
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  },
  formRow: {
    display: 'flex',
    gap: 12
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flex: 1
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--muted-text)',
    textTransform: 'uppercase'
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--background)',
    color: 'var(--foreground)',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16
  },
  cancelBtn: {
    padding: '10px 20px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--background)',
    color: 'var(--foreground)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer'
  },
  submitBtn: {
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer'
  },
  
  errorAlert: {
    padding: '12px',
    borderRadius: 8,
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 16,
    fontWeight: 500
  },
  spinner: {
    width: 30,
    height: 30,
    border: '3px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }
};
