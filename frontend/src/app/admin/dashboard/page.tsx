'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSession, clearAuthSession, apiFetch } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';
import ThemeSelector from '@/components/ThemeSelector';
import ProfileDropdown from '@/components/ProfileDropdown';

// ─── Types ────────────────────────────────────────────────────────
interface UserRow {
  id: number;
  username: string;
  email: string;
  name: string;
  role: 'student' | 'examiner' | 'admin';
  is_active: boolean;
  must_change_password: boolean;
  date_joined: string;
}

interface ExamRow {
  id: number;
  title: string;
  subject: string;
  duration_minutes: number;
  created_by: string;
  sessions_count: number;
  start_window: string;
  end_window: string;
  enable_webcam: boolean;
}

interface SessionRow {
  id: number;
  student: string;
  exam: string;
  subject: string;
  status: string;
  start_time: string;
  submitted_at: string | null;
}

interface Stats {
  total_users: number;
  students: number;
  examiners: number;
  admins: number;
  total_exams: number;
  total_sessions: number;
  submitted_sessions: number;
  flagged_sessions: number;
}

type Tab = 'stats' | 'users' | 'exams' | 'sessions';
type RoleFilter = 'all' | 'student' | 'examiner' | 'admin';

// ─── Modal form state ─────────────────────────────────────────────
const blankUser = { username: '', email: '', name: '', role: 'student' as const, send_email: true };

export default function AdminDashboard() {
  const router = useRouter();
  const { t, tQuestion } = useLanguage();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('stats');

  // Data
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  // UI state
  const [alert, setAlert] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(blankUser);

  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ username: '', email: '', first_name: '', last_name: '', role: '', is_active: true, send_email: false });

  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [confirmDeleteExam, setConfirmDeleteExam] = useState<ExamRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [tempPasswordResult, setTempPasswordResult] = useState('');

  // ─── Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    const s = getAuthSession();
    if (!s) { router.replace('/login'); return; }
    if (s.must_change_password) { router.replace('/change-password'); return; }
    if (s.role !== 'admin') {
      router.replace(s.role === 'examiner' ? '/examiner/dashboard' : '/student/dashboard');
      return;
    }
    setSession(s);
    setLoading(false);
  }, [router]);

  const showAlert = (type: string, text: string) => {
    setAlert({ type, text });
    setTimeout(() => setAlert({ type: '', text: '' }), 5000);
  };

  // ─── Data fetchers ──────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    const res = await apiFetch('/auth/admin/stats/');
    if (res.status === 200) setStats(await res.json());
  }, []);

  const fetchUsers = useCallback(async () => {
    const url = roleFilter === 'all' ? '/auth/admin/users/' : `/auth/admin/users/?role=${roleFilter}`;
    const res = await apiFetch(url);
    if (res.status === 200) setUsers(await res.json());
  }, [roleFilter]);

  const fetchExams = useCallback(async () => {
    const res = await apiFetch('/auth/admin/exams/');
    if (res.status === 200) setExams(await res.json());
  }, []);

  const fetchSessions = useCallback(async () => {
    const res = await apiFetch('/auth/admin/sessions/');
    if (res.status === 200) setSessions(await res.json());
  }, []);

  useEffect(() => { if (!loading) fetchStats(); }, [loading, fetchStats]);
  useEffect(() => { if (tab === 'users') fetchUsers(); }, [tab, fetchUsers, roleFilter]);
  useEffect(() => { if (tab === 'exams') fetchExams(); }, [tab, fetchExams]);
  useEffect(() => { if (tab === 'sessions') fetchSessions(); }, [tab, fetchSessions]);

  // ─── Actions ───────────────────────────────────────────────────
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiFetch('/auth/admin/users/', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (res.status === 201) {
        showAlert('success', `User "${createForm.username}" created. Temp password: ${data.temp_password}`);
        setShowCreate(false);
        setCreateForm(blankUser);
        fetchUsers();
        fetchStats();
      } else {
        showAlert('error', data.error || 'Failed to create user.');
      }
    } catch { showAlert('error', 'Network error.'); }
    finally { setBusy(false); }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/auth/admin/users/${editUser.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (res.status === 200) {
        const changesSummary = data.changes && data.changes.length
          ? ` Changes: ${data.changes.join('; ')}.` : '';
        const emailNote = data.email_sent ? ' Notification email sent.' : '';
        showAlert('success', `User "${data.username}" updated.${changesSummary}${emailNote}`);
        setEditUser(null);
        fetchUsers();
        fetchStats();
      } else {
        showAlert('error', data.error || 'Failed to update user.');
      }
    } catch { showAlert('error', 'Network error.'); }
    finally { setBusy(false); }
  };

  const handleDeleteUser = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/auth/admin/users/${confirmDelete.id}/`, { method: 'DELETE' });
      const data = await res.json();
      if (res.status === 200) {
        showAlert('success', data.status);
        setConfirmDelete(null);
        fetchUsers();
        fetchStats();
      } else {
        showAlert('error', data.error || 'Failed to delete user.');
      }
    } catch { showAlert('error', 'Network error.'); }
    finally { setBusy(false); }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/auth/admin/users/${resetUser.id}/reset-password/`, { method: 'POST' });
      const data = await res.json();
      if (res.status === 200) {
        setTempPasswordResult(data.temp_password);
        fetchUsers();
      } else {
        showAlert('error', data.error || 'Failed to reset password.');
        setResetUser(null);
      }
    } catch { showAlert('error', 'Network error.'); }
    finally { setBusy(false); }
  };

  const handleDeleteExam = async () => {
    if (!confirmDeleteExam) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/auth/admin/exams/${confirmDeleteExam.id}/`, { method: 'DELETE' });
      const data = await res.json();
      if (res.status === 200) {
        showAlert('success', data.status);
        setConfirmDeleteExam(null);
        fetchExams();
        fetchStats();
      } else {
        showAlert('error', data.error || 'Failed to delete exam.');
      }
    } catch { showAlert('error', 'Network error.'); }
    finally { setBusy(false); }
  };

  const handleLogout = () => { clearAuthSession(); router.push('/login'); };

  // ─── Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={s.loadingScreen}>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={s.spinner} />
          <p style={{ color: '#475569', marginTop: 16 }}>Loading admin console...</p>
        </div>
      </div>
    );
  }

  // ─── Helper renderers ──────────────────────────────────────────
  const rolePill = (role: string) => {
    const colors: Record<string, [string, string, string]> = {
      admin:    ['rgba(168,85,247,0.12)', 'rgba(168,85,247,0.4)', '#d8b4fe'],
      examiner: ['rgba(56,189,248,0.1)',  'rgba(56,189,248,0.35)', '#7dd3fc'],
      student:  ['rgba(16,185,129,0.1)',  'rgba(16,185,129,0.35)', '#6ee7b7'],
    };
    const [bg, border, color] = colors[role] || ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)', '#94a3b8'];
    return (
      <span style={{ background: bg, border: `1px solid ${border}`, color, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {role}
      </span>
    );
  };

  const statusPill = (status: string) => {
    const colors: Record<string, [string, string]> = {
      submitted:      ['rgba(16,185,129,0.12)', '#6ee7b7'],
      auto_submitted: ['rgba(245,158,11,0.12)', '#fbbf24'],
      flagged:        ['rgba(239,68,68,0.12)',  '#f87171'],
      in_progress:    ['rgba(56,189,248,0.1)',  '#7dd3fc'],
    };
    const [bg, color] = colors[status] || ['rgba(255,255,255,0.05)', '#94a3b8'];
    return (
      <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {/* ── NAV ── */}
      <nav style={s.nav}>
        <div style={s.navBrand}><span style={s.navLogo}>{t('admin.title')}</span></div>
        <div style={s.navRight}>
          <ThemeSelector />
          <LanguageSelector />
          <ProfileDropdown user={session} />
        </div>
      </nav>

      <main style={s.main}>
        {/* Welcome */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>
            Welcome back, <span style={{ color: 'var(--accent)' }}>{session?.username}</span>
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted-text)', margin: 0 }}>System administration and management</p>
        </div>

        {/* Alert banner */}
        {alert.text && (
          <div style={alert.type === 'success' ? s.alertOk : s.alertErr}>{alert.text}</div>
        )}

        {/* ── TAB BAR ── */}
        <div className="tab-container">
          {(['stats', 'users', 'exams', 'sessions'] as Tab[]).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={tab === tabKey ? 'tab-btn-active' : 'tab-btn'}
            >
              {tabKey === 'stats' ? t('admin.tab_overview') : tabKey === 'users' ? t('admin.tab_users') : tabKey === 'exams' ? t('admin.tab_exams') : t('admin.tab_sessions')}
            </button>
          ))}
        </div>

        {/* ════════════════ STATS TAB ════════════════ */}
        {tab === 'stats' && (
          <div style={s.statsGrid}>
            {stats && [
              { label: t('admin.stat_total_users'), val: stats.total_users,       color: 'var(--accent)' },
              { label: t('admin.stat_students'),    val: stats.students,          color: 'var(--success)' },
              { label: t('admin.stat_examiners'),   val: stats.examiners,         color: 'var(--accent)' },
              { label: t('admin.stat_admins'),      val: stats.admins,            color: 'var(--purple)' },
              { label: t('admin.stat_total_exams'), val: stats.total_exams,       color: 'var(--accent)' },
              { label: t('admin.stat_sessions'),    val: stats.total_sessions,    color: 'var(--muted-text)' },
              { label: t('admin.stat_submitted'),   val: stats.submitted_sessions, color: 'var(--success)' },
              { label: t('admin.stat_flagged'),     val: stats.flagged_sessions,  color: 'var(--danger)' },
            ].map(({ label, val, color }) => (
              <div key={label} style={s.statCard} className="card-hover">
                <div style={{ ...s.statVal, color }}>{val}</div>
                <div style={s.statLbl}>{label}</div>
              </div>
            ))}
            {!stats && <p style={{ color: 'var(--muted-text)' }}>{t('common.loading')}</p>}
          </div>
        )}

        {/* ════════════════ USERS TAB ════════════════ */}
        {tab === 'users' && (
          <div style={s.section}>
            <div style={s.sectionHead}>
              <div style={s.filterRow}>
                {(['all', 'admin', 'examiner', 'student'] as RoleFilter[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={roleFilter === r ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
                  >
                    {r === 'all' ? t('admin.all_roles') : r === 'admin' ? t('admin.stat_admins') : r === 'examiner' ? t('admin.stat_examiners') : t('admin.stat_students')}
                  </button>
                ))}
              </div>
              <button className="btn-success" onClick={() => setShowCreate(true)}>{t('admin.add_user')}</button>
            </div>

            <div style={s.listContainer}>
              {users.map((u) => (
                <div key={u.id} style={s.itemCard} className="card-hover">
                  <div style={s.itemContent}>
                    <div style={s.userCell}>
                      <div style={{ ...s.avatar, background: u.role === 'admin' ? 'var(--purple-bg)' : u.role === 'examiner' ? 'var(--accent-glow)' : 'var(--success-bg)', color: u.role === 'admin' ? 'var(--purple)' : u.role === 'examiner' ? 'var(--accent)' : 'var(--success)' }}>
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={s.userName}>{u.username}</div>
                        {u.name && <div style={s.userFullName}>{u.name}</div>}
                        <div style={s.userFullName}>{u.email}</div>
                      </div>
                    </div>

                    <div style={s.itemMetaGroup}>
                      <div style={s.itemMetaBox}>
                        <div style={s.metaLabel}>ROLE</div>
                        {rolePill(u.role)}
                      </div>
                      <div style={s.itemMetaBox}>
                        <div style={s.metaLabel}>STATUS</div>
                        <span style={{ color: u.is_active ? 'var(--success)' : 'var(--danger)', fontSize: 12, fontWeight: 700 }}>
                          {u.is_active ? t('admin.active') : t('admin.disabled')}
                        </span>
                      </div>
                      <div style={s.itemMetaBox}>
                        <div style={s.metaLabel}>JOINED</div>
                        <div style={{ color: 'var(--muted-text)', fontSize: 12 }}>{fmtDate(u.date_joined)}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div style={s.itemFooter}>
                    {u.must_change_password && <span style={s.pwdTag}>Password Reset Pending</span>}
                    <div style={{ flex: 1 }} />
                    <div style={s.actionBtns}>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => {
                          setEditUser(u);
                          setEditForm({ username: u.username, email: u.email, first_name: u.name.split(' ')[0] || '', last_name: u.name.split(' ').slice(1).join(' ') || '', role: u.role, is_active: u.is_active, send_email: false });
                        }}
                      >
                        {t('admin.edit')}
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => { setResetUser(u); setTempPasswordResult(''); }}>
                        {t('admin.reset_pwd')}
                      </button>
                      <button className="btn-danger btn-sm" onClick={() => setConfirmDelete(u)} disabled={u.id === session?.id}>
                        {t('admin.delete')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <div style={s.emptyState}>{t('admin.no_users')}</div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════ EXAMS TAB ════════════════ */}
        {tab === 'exams' && (
          <div style={s.section}>
            <div style={s.sectionHead}>
              <h2 style={s.sectionTitle}>All Examinations</h2>
              <button className="btn-secondary btn-sm" onClick={fetchExams}>Refresh</button>
            </div>
            <div style={s.listContainer}>
              {exams.map(ex => (
                <div key={ex.id} style={s.itemCard} className="card-hover">
                  <div style={s.itemContent}>
                    <div style={{ flex: 1 }}>
                      <div style={s.userName}>{tQuestion(ex.title)}</div>
                      <div style={s.userFullName}>{t('examiner.subject')}: {tQuestion(ex.subject)}</div>
                    </div>
                    
                    <div style={s.itemMetaGroup}>
                      <div style={s.itemMetaBox}>
                        <div style={s.metaLabel}>DURATION</div>
                        <div style={{ color: 'var(--muted-text)', fontSize: 12 }}>{ex.duration_minutes} min</div>
                      </div>
                      <div style={s.itemMetaBox}>
                        <div style={s.metaLabel}>CREATED BY</div>
                        <div style={{ color: 'var(--muted-text)', fontSize: 12 }}>{ex.created_by}</div>
                      </div>
                      <div style={s.itemMetaBox}>
                        <div style={s.metaLabel}>SESSIONS</div>
                        <div style={{ color: 'var(--muted-text)', fontSize: 12 }}>{ex.sessions_count}</div>
                      </div>
                      <div style={s.itemMetaBox}>
                        <div style={s.metaLabel}>WEBCAM</div>
                        <div style={{ color: ex.enable_webcam ? 'var(--success)' : 'var(--danger)', fontSize: 12, fontWeight: 700 }}>
                          {ex.enable_webcam ? 'Required' : 'Disabled'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div style={s.itemFooter}>
                    <div style={{ flex: 1 }} />
                    <button className="btn-danger btn-sm" onClick={() => setConfirmDeleteExam(ex)}>Delete</button>
                  </div>
                </div>
              ))}
              {exams.length === 0 && (
                <div style={s.emptyState}>No exams found.</div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════ SESSIONS TAB ════════════════ */}
        {tab === 'sessions' && (
          <div style={s.section}>
            <div style={s.sectionHead}>
              <h2 style={s.sectionTitle}>Exam Sessions</h2>
              <button className="btn-secondary btn-sm" onClick={fetchSessions}>Refresh</button>
            </div>
            <div style={s.listContainer}>
              {sessions.map(ss => (
                <div key={ss.id} style={s.itemCard} className="card-hover">
                  <div style={s.itemContent}>
                    <div style={{ flex: 1 }}>
                      <div style={s.userName}>{ss.student}</div>
                      <div style={s.userFullName}>{ss.exam}</div>
                    </div>
                    
                    <div style={s.itemMetaGroup}>
                      <div style={s.itemMetaBox}>
                        <div style={s.metaLabel}>STATUS</div>
                        {statusPill(ss.status)}
                      </div>
                      <div style={s.itemMetaBox}>
                        <div style={s.metaLabel}>START TIME</div>
                        <div style={{ color: 'var(--muted-text)', fontSize: 12 }}>{fmtDate(ss.start_time)}</div>
                      </div>
                      <div style={s.itemMetaBox}>
                        <div style={s.metaLabel}>SUBMITTED</div>
                        <div style={{ color: 'var(--muted-text)', fontSize: 12 }}>{ss.submitted_at ? fmtDate(ss.submitted_at) : '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <div style={s.emptyState}>No sessions found.</div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════ MODALS ════════════════ */}

        {/* Create User Modal */}
        {showCreate && (
          <div style={s.overlay}>
            <div style={s.modal}>
              <div style={s.modalHead}>{t('admin.add_user')}</div>
              <form onSubmit={handleCreateUser} style={s.modalBody}>
                <div style={s.formGroup}>
                  <label style={s.label}>Username</label>
                  <input style={s.input} value={createForm.username} onChange={e => setCreateForm({ ...createForm, username: e.target.value })} required />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Email Address</label>
                  <input style={s.input} type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} required />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Full Name</label>
                  <input style={s.input} value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Role</label>
                  <select style={s.select} value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value as any })}>
                    <option value="student">Student</option>
                    <option value="examiner">Examiner</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <label style={s.chkLabel}>
                  <input type="checkbox" checked={createForm.send_email} onChange={e => setCreateForm({ ...createForm, send_email: e.target.checked })} />
                  Send welcome email with password
                </label>
                <div style={s.modalFoot}>
                  <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create User'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {editUser && (
          <div style={s.overlay}>
            <div style={s.modal}>
              <div style={s.modalHead}>{t('admin.edit_user')} — {editUser.username}</div>
              <form onSubmit={handleUpdateUser} style={s.modalBody}>
                <div style={s.formRow}>
                  <div style={s.formGroup}>
                    <label style={s.label}>First Name</label>
                    <input style={s.input} value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} />
                  </div>
                  <div style={s.formGroup}>
                    <label style={s.label}>Last Name</label>
                    <input style={s.input} value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} />
                  </div>
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Email Address</label>
                  <input style={s.input} type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} required />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Role</label>
                  <select style={s.select} value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} disabled={editUser.id === session?.id}>
                    <option value="student">Student</option>
                    <option value="examiner">Examiner</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <label style={s.chkLabel}>
                  <input type="checkbox" checked={editForm.is_active} onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })} disabled={editUser.id === session?.id} />
                  Account is active
                </label>
                <label style={{ ...s.chkLabel, marginTop: 8 }}>
                  <input type="checkbox" checked={editForm.send_email} onChange={e => setEditForm({ ...editForm, send_email: e.target.checked })} />
                  Send email notification about these changes
                </label>
                <div style={s.modalFoot}>
                  <button type="button" className="btn-ghost" onClick={() => setEditUser(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirm Delete User */}
        {confirmDelete && (
          <div style={s.overlay}>
            <div style={{ ...s.modal, maxWidth: 440 }}>
              <div style={s.modalHead}>Delete User</div>
              <div style={s.modalBody}>
                <p style={{ color: 'var(--foreground)', marginBottom: 24, lineHeight: 1.6 }}>
                  Are you sure you want to permanently delete user <strong style={{ color: 'var(--danger)' }}>{confirmDelete.username}</strong> ({confirmDelete.role})?
                  This action cannot be undone.
                </p>
                <div style={s.modalFoot}>
                  <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
                  <button className="btn-danger" onClick={handleDeleteUser} disabled={busy}>{busy ? 'Deleting…' : 'Delete User'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {resetUser && (
          <div style={s.overlay}>
            <div style={{ ...s.modal, maxWidth: 440 }}>
              <div style={s.modalHead}>Reset Password — {resetUser.username}</div>
              <div style={s.modalBody}>
                {!tempPasswordResult ? (
                  <>
                    <p style={{ color: 'var(--muted-text)', marginBottom: 24, lineHeight: 1.6 }}>
                      A new temporary password will be generated and emailed to <strong style={{ color: 'var(--accent)' }}>{resetUser.email}</strong>.
                    </p>
                    <div style={s.modalFoot}>
                      <button className="btn-ghost" onClick={() => setResetUser(null)}>Cancel</button>
                      <button className="btn-primary" onClick={handleResetPassword} disabled={busy}>{busy ? 'Resetting…' : 'Reset & Email'}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ color: 'var(--success)', marginBottom: 12, fontWeight: 700 }}>Password reset successfully!</p>
                    <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 8, padding: '14px 18px', marginBottom: 24 }}>
                      <div style={{ fontSize: 11, color: 'var(--success)', marginBottom: 4 }}>TEMPORARY PASSWORD</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--success)', letterSpacing: '0.08em', fontFamily: 'monospace' }}>{tempPasswordResult}</div>
                    </div>
                    <p style={{ color: 'var(--muted-text)', fontSize: 13 }}>An email has been sent to the user. Share this password if needed.</p>
                    <div style={s.modalFoot}>
                      <button className="btn-primary" onClick={() => setResetUser(null)}>Done</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Confirm Delete Exam */}
        {confirmDeleteExam && (
          <div style={s.overlay}>
            <div style={{ ...s.modal, maxWidth: 440 }}>
              <div style={s.modalHead}>Delete Exam</div>
              <div style={s.modalBody}>
                <p style={{ color: 'var(--foreground)', marginBottom: 24, lineHeight: 1.6 }}>
                  Delete exam <strong style={{ color: 'var(--danger)' }}>{confirmDeleteExam.title}</strong>?
                  This will also delete all <strong>{confirmDeleteExam.sessions_count}</strong> associated sessions and answers.
                </p>
                <div style={s.modalFoot}>
                  <button className="btn-ghost" onClick={() => setConfirmDeleteExam(null)}>Cancel</button>
                  <button className="btn-danger" onClick={handleDeleteExam} disabled={busy}>{busy ? 'Deleting…' : 'Delete Exam'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const s: { [k: string]: React.CSSProperties } = {
  page: { minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'Inter, system-ui, sans-serif' },
  loadingScreen: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--background)' },
  spinner: { width: 44, height: 44, border: '3px solid var(--accent-glow)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' },
  /* Nav */
  nav: { position: 'relative', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 56, background: 'var(--nav-bg)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--nav-border)' },
  navBrand: { display: 'flex', alignItems: 'center', gap: 10 },
  navLogo: { fontSize: 15, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', textShadow: 'none' },
  navRight: { display: 'flex', alignItems: 'center', gap: 16 },
  /* Main */
  main: { position: 'relative', zIndex: 10, maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px', display: 'flex', flexDirection: 'column', gap: 24 },
  /* Alerts */
  alertOk: { padding: '13px 20px', borderRadius: 10, background: 'var(--success-bg)', border: '1px solid var(--border)', color: 'var(--success)', fontSize: 14, lineHeight: 1.5 },
  alertErr: { padding: '13px 20px', borderRadius: 10, background: 'var(--danger-bg)', border: '1px solid var(--border)', color: 'var(--danger)', fontSize: 14, lineHeight: 1.5 },
  /* Stats grid */
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  statCard: { background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' },
  statVal: { fontSize: 48, fontWeight: 900, lineHeight: 1, textShadow: 'none', marginBottom: 10 },
  statLbl: { fontSize: 12, color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 },
  /* Section */
  section: { display: 'flex', flexDirection: 'column', gap: 16 },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: 0 },
  filterRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  /* Lists replacing tables */
  listContainer: { display: 'flex', flexDirection: 'column', gap: 16 },
  itemCard: { background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.04)' },
  itemContent: { padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 },
  itemFooter: { display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '12px 24px', borderTop: '1px solid var(--border)' },
  /* Meta Grid */
  itemMetaGroup: { display: 'flex', gap: 32, flexWrap: 'wrap' },
  itemMetaBox: { display: 'flex', flexDirection: 'column', gap: 6 },
  metaLabel: { fontSize: 11, fontWeight: 800, color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  /* User cell */
  userCell: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 200 },
  avatar: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 },
  userName: { fontSize: 14, fontWeight: 700, color: 'var(--foreground)' },
  userFullName: { fontSize: 12, color: 'var(--muted-text)', marginTop: 2 },
  /* Action Btns */
  actionBtns: { display: 'flex', gap: 8 },
  pwdTag: { fontSize: 11, fontWeight: 700, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '2px 8px', borderRadius: 99 },
  /* Modals */
  overlay: { position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '100%', maxWidth: 540, background: 'var(--card-bg)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' },
  modalHead: { padding: '24px 28px', borderBottom: '1px solid var(--border)', fontSize: 18, fontWeight: 700, color: 'var(--foreground)', background: 'rgba(0,0,0,0.01)' },
  modalBody: { padding: '28px', display: 'flex', flexDirection: 'column', gap: 20 },
  modalFoot: { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  /* Forms */
  formRow: { display: 'flex', gap: 16 },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 8, flex: 1 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--foreground)' },
  input: { padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)', fontSize: 14, outline: 'none' },
  select: { padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)', fontSize: 14, outline: 'none' },
  chkLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted-text)', cursor: 'pointer' },
  emptyState: { padding: '60px 24px', textAlign: 'center', color: 'var(--muted-text)', fontSize: 14, background: 'var(--card-bg)', borderRadius: 12, border: '1px dashed var(--border)' },
};
