'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSession, clearAuthSession, apiFetch } from '@/lib/api';

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
        <div className="animated-bg"><div className="orb orb-1"/><div className="orb orb-2"/></div>
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
      <div className="animated-bg"><div className="orb orb-1"/><div className="orb orb-2"/><div className="orb orb-3"/></div>

      {/* ── NAV ── */}
      <nav style={s.nav}>
        <div style={s.navBrand}><span className="ai-dot"/><span style={s.navLogo}>Admin Console</span></div>
        <div style={s.navRight}>
          <div style={s.navChip}>
            <span style={s.navName}>{session?.username}</span>
            <span style={s.navRole}>ADMINISTRATOR</span>
          </div>
          <button className="btn-danger" onClick={handleLogout}>Sign Out</button>
        </div>
      </nav>

      <main style={s.main}>
        {/* Alert banner */}
        {alert.text && (
          <div style={alert.type === 'success' ? s.alertOk : s.alertErr}>{alert.text}</div>
        )}

        {/* ── TAB BAR ── */}
        <div style={s.tabBar}>
          {(['stats', 'users', 'exams', 'sessions'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={tab === t ? 'tab-btn-active' : 'tab-btn'}
            >
              {t === 'stats' ? 'Overview' : t === 'users' ? `Users (${users.length || '…'})` : t === 'exams' ? `Exams (${exams.length || '…'})` : `Sessions (${sessions.length || '…'})`}
            </button>
          ))}
        </div>

        {/* ════════════════ STATS TAB ════════════════ */}
        {tab === 'stats' && (
          <div style={s.statsGrid}>
            {stats && [
              { label: 'Total Users',    val: stats.total_users,       color: '#38bdf8' },
              { label: 'Students',       val: stats.students,          color: '#6ee7b7' },
              { label: 'Examiners',      val: stats.examiners,         color: '#7dd3fc' },
              { label: 'Admins',         val: stats.admins,            color: '#d8b4fe' },
              { label: 'Total Exams',    val: stats.total_exams,       color: '#38bdf8' },
              { label: 'Sessions',       val: stats.total_sessions,    color: '#94a3b8' },
              { label: 'Submitted',      val: stats.submitted_sessions, color: '#6ee7b7' },
              { label: 'Flagged',        val: stats.flagged_sessions,  color: '#f87171' },
            ].map(({ label, val, color }) => (
              <div key={label} style={s.statCard} className="card-hover">
                <div style={{ ...s.statVal, color }}>{val}</div>
                <div style={s.statLbl}>{label}</div>
              </div>
            ))}
            {!stats && <p style={{ color: '#64748b' }}>Loading statistics…</p>}
          </div>
        )}

        {/* ════════════════ USERS TAB ════════════════ */}
        {tab === 'users' && (
          <div style={s.section}>
            {/* Header row */}
            <div style={s.sectionHead}>
              <div style={s.filterRow}>
                {(['all', 'admin', 'examiner', 'student'] as RoleFilter[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={roleFilter === r ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
                  >
                    {r === 'all' ? 'All Roles' : r.charAt(0).toUpperCase() + r.slice(1) + 's'}
                  </button>
                ))}
              </div>
              <button className="btn-success" onClick={() => setShowCreate(true)}>+ Add User</button>
            </div>

            {/* Users table */}
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <th style={s.th}>User</th>
                    <th style={s.th}>Email</th>
                    <th style={s.th}>Role</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Joined</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} style={{ ...s.tr, background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                      <td style={s.td}>
                        <div style={s.userCell}>
                          <div style={{ ...s.avatar, background: u.role === 'admin' ? 'rgba(168,85,247,0.2)' : u.role === 'examiner' ? 'rgba(56,189,248,0.15)' : 'rgba(16,185,129,0.15)' }}>
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={s.userName}>{u.username}</div>
                            {u.name && <div style={s.userFullName}>{u.name}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={s.td}><span style={s.emailText}>{u.email}</span></td>
                      <td style={s.td}>{rolePill(u.role)}</td>
                      <td style={s.td}>
                        <span style={{ color: u.is_active ? '#6ee7b7' : '#f87171', fontSize: 12, fontWeight: 700 }}>
                          {u.is_active ? 'Active' : 'Disabled'}
                        </span>
                        {u.must_change_password && <span style={s.pwdTag}>pwd reset</span>}
                      </td>
                      <td style={{ ...s.td, color: '#475569', fontSize: 12 }}>{fmtDate(u.date_joined)}</td>
                      <td style={s.td}>
                        <div style={s.actionBtns}>
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => {
                              setEditUser(u);
                              setEditForm({ username: u.username, email: u.email, first_name: u.name.split(' ')[0] || '', last_name: u.name.split(' ').slice(1).join(' ') || '', role: u.role, is_active: u.is_active, send_email: false });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-ghost btn-sm"
                            onClick={() => { setResetUser(u); setTempPasswordResult(''); }}
                          >
                            Reset Pwd
                          </button>
                          <button
                            className="btn-danger btn-sm"
                            onClick={() => setConfirmDelete(u)}
                            disabled={u.id === session?.id}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', padding: 48, color: '#475569' }}>No users found.</td></tr>
                  )}
                </tbody>
              </table>
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
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <th style={s.th}>Title</th>
                    <th style={s.th}>Subject</th>
                    <th style={s.th}>Duration</th>
                    <th style={s.th}>Created By</th>
                    <th style={s.th}>Sessions</th>
                    <th style={s.th}>Webcam</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((ex, i) => (
                    <tr key={ex.id} style={{ ...s.tr, background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                      <td style={s.td}><span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{ex.title}</span></td>
                      <td style={s.td}><span style={s.chipBlue}>{ex.subject}</span></td>
                      <td style={{ ...s.td, color: '#94a3b8' }}>{ex.duration_minutes} min</td>
                      <td style={{ ...s.td, color: '#94a3b8' }}>{ex.created_by}</td>
                      <td style={s.td}><span style={s.chipGreen}>{ex.sessions_count}</span></td>
                      <td style={{ ...s.td, color: ex.enable_webcam ? '#6ee7b7' : '#f87171', fontSize: 12, fontWeight: 700 }}>
                        {ex.enable_webcam ? 'On' : 'Off'}
                      </td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button className="btn-danger btn-sm" onClick={() => setConfirmDeleteExam(ex)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {exams.length === 0 && (
                    <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', padding: 48, color: '#475569' }}>No exams found.</td></tr>
                  )}
                </tbody>
              </table>
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
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <th style={s.th}>Student</th>
                    <th style={s.th}>Exam</th>
                    <th style={s.th}>Subject</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Started</th>
                    <th style={s.th}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((ss, i) => (
                    <tr key={ss.id} style={{ ...s.tr, background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                      <td style={s.td}><span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{ss.student}</span></td>
                      <td style={{ ...s.td, color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ss.exam}</td>
                      <td style={s.td}><span style={s.chipBlue}>{ss.subject}</span></td>
                      <td style={s.td}>{statusPill(ss.status)}</td>
                      <td style={{ ...s.td, color: '#475569', fontSize: 12 }}>{fmtDate(ss.start_time)}</td>
                      <td style={{ ...s.td, color: '#475569', fontSize: 12 }}>{ss.submitted_at ? fmtDate(ss.submitted_at) : '—'}</td>
                    </tr>
                  ))}
                  {sessions.length === 0 && (
                    <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', padding: 48, color: '#475569' }}>No sessions found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ════════════════ MODALS ════════════════ */}

      {/* Create User Modal */}
      {showCreate && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHead}>Create New User</div>
            <form onSubmit={handleCreateUser} style={s.modalBody}>
              <div style={s.fRow}>
                <div style={s.ig}>
                  <label style={s.lbl}>Username *</label>
                  <input style={s.inp} value={createForm.username} onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))} required placeholder="username" />
                </div>
                <div style={s.ig}>
                  <label style={s.lbl}>Full Name</label>
                  <input style={s.inp} value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                </div>
              </div>
              <div style={s.ig}>
                <label style={s.lbl}>Email *</label>
                <input style={s.inp} type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} required placeholder="user@example.com" />
              </div>
              <div style={s.ig}>
                <label style={s.lbl}>Role *</label>
                <select style={s.sel} value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value as any }))}>
                  <option value="student">Student</option>
                  <option value="examiner">Examiner</option>
                </select>
              </div>
              <label style={{ ...s.lbl, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={createForm.send_email} onChange={e => setCreateForm(f => ({ ...f, send_email: e.target.checked }))} />
                Send credentials via email
              </label>
              <div style={s.modalFoot}>
                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHead}>Edit User — {editUser.username}</div>
            <form onSubmit={handleUpdateUser} style={s.modalBody}>
              <div style={s.fRow}>
                <div style={s.ig}>
                  <label style={s.lbl}>Username</label>
                  <input style={s.inp} value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} />
                </div>
                <div style={s.ig}>
                  <label style={s.lbl}>Email</label>
                  <input style={s.inp} type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div style={s.fRow}>
                <div style={s.ig}>
                  <label style={s.lbl}>First Name</label>
                  <input style={s.inp} value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div style={s.ig}>
                  <label style={s.lbl}>Last Name</label>
                  <input style={s.inp} value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                </div>
              </div>
              <div style={s.fRow}>
                <div style={s.ig}>
                  <label style={s.lbl}>Role</label>
                  <select style={s.sel} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="student">Student</option>
                    <option value="examiner">Examiner</option>
                  </select>
                </div>
                <div style={s.ig}>
                  <label style={s.lbl}>Account Status</label>
                  <select style={s.sel} value={editForm.is_active ? 'active' : 'disabled'} onChange={e => setEditForm(f => ({ ...f, is_active: e.target.value === 'active' }))}>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              {/* Change summary preview */}
              {editUser && (
                <div style={s.changeSummary}>
                  <div style={s.changeSummaryTitle}>Notification Email</div>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editForm.send_email}
                      onChange={e => setEditForm(f => ({ ...f, send_email: e.target.checked }))}
                      style={{ marginTop: 2, accentColor: '#38bdf8' }}
                    />
                    <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                      Send a notification email to <strong style={{ color: '#38bdf8' }}>{editForm.email || editUser.email}</strong> describing all changes made.
                      {editForm.role !== editUser.role && (
                        <span style={{ display: 'block', marginTop: 4, color: '#d97706', fontSize: 12 }}>
                          Role change detected: <strong>{editUser.role}</strong> → <strong>{editForm.role}</strong>
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              )}

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
            <div style={s.modalHead}>Confirm Delete</div>
            <div style={s.modalBody}>
              <p style={{ color: 'var(--foreground)', marginBottom: 24, lineHeight: 1.6 }}>
                Are you sure you want to permanently delete user <strong style={{ color: '#f87171' }}>{confirmDelete.username}</strong> ({confirmDelete.role})?
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
                  <p style={{ color: '#475569', marginBottom: 24, lineHeight: 1.6 }}>
                    A new temporary password will be generated and emailed to <strong style={{ color: '#38bdf8' }}>{resetUser.email}</strong>.
                  </p>
                  <div style={s.modalFoot}>
                    <button className="btn-ghost" onClick={() => setResetUser(null)}>Cancel</button>
                    <button className="btn-primary" onClick={handleResetPassword} disabled={busy}>{busy ? 'Resetting…' : 'Reset & Email'}</button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ color: '#059669', marginBottom: 12, fontWeight: 700 }}>Password reset successfully!</p>
                  <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '14px 18px', marginBottom: 24 }}>
                    <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>TEMPORARY PASSWORD</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#059669', letterSpacing: '0.08em', fontFamily: 'monospace' }}>{tempPasswordResult}</div>
                  </div>
                  <p style={{ color: '#475569', fontSize: 13 }}>An email has been sent to the user. Share this password if needed.</p>
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
                Delete exam <strong style={{ color: '#f87171' }}>{confirmDeleteExam.title}</strong>?
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
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const s: { [k: string]: React.CSSProperties } = {
  page: { minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', overflow: 'hidden' },
  loadingScreen: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--background)', position: 'relative', overflow: 'hidden' },
  spinner: { width: 44, height: 44, border: '3px solid rgba(37,99,235,0.15)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' },
  /* Nav */
  nav: { position: 'relative', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', height: 64, background: '#ffffff', backdropFilter: 'blur(16px)', borderBottom: '1px solid #e2e8f0', boxShadow: '0 2px 24px rgba(0,0,0,0.4)' },
  navBrand: { display: 'flex', alignItems: 'center', gap: 10 },
  navLogo: { fontSize: 18, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', textShadow: '0 0 16px rgba(56,189,248,0.4)' },
  navRight: { display: 'flex', alignItems: 'center', gap: 16 },
  navChip: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  navName: { fontSize: 14, fontWeight: 700, color: 'var(--foreground)' },
  navRole: { fontSize: 10, color: 'var(--purple)', fontWeight: 800, letterSpacing: '0.08em' },
  /* Main */
  main: { position: 'relative', zIndex: 10, maxWidth: 1440, margin: '0 auto', padding: '32px 40px 60px', display: 'flex', flexDirection: 'column', gap: 24 },
  /* Alerts */
  alertOk: { padding: '13px 20px', borderRadius: 10, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', color: '#059669', fontSize: 14, lineHeight: 1.5 },
  alertErr: { padding: '13px 20px', borderRadius: 10, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: 14, lineHeight: 1.5 },
  /* Tab bar */
  tabBar: { display: 'flex', gap: 4, borderBottom: '1px solid #cbd5e1' },
  /* Stats grid */
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  statCard: { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 14, padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' },
  statVal: { fontSize: 48, fontWeight: 900, lineHeight: 1, textShadow: 'none', marginBottom: 10 },
  statLbl: { fontSize: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 },
  /* Section */
  section: { display: 'flex', flexDirection: 'column', gap: 16 },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: 0 },
  filterRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  /* Table */
  tableWrap: { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 14, overflow: 'auto', backdropFilter: 'blur(12px)' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 700 },
  thead: { background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid #e2e8f0' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f1f5f9', transition: 'background 0.12s' },
  td: { padding: '13px 16px', fontSize: 13, color: 'var(--foreground)', verticalAlign: 'middle' },
  /* User cell */
  userCell: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'var(--foreground)', flexShrink: 0 },
  userName: { fontSize: 13, fontWeight: 700, color: 'var(--foreground)' },
  userFullName: { fontSize: 11, color: '#475569', marginTop: 2 },
  emailText: { color: '#475569', fontSize: 12 },
  pwdTag: { display: 'inline-block', marginLeft: 6, padding: '1px 7px', borderRadius: 99, background: 'rgba(217,119,6,0.08)', color: '#d97706', fontSize: 10, fontWeight: 700 },
  actionBtns: { display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' },
  /* Chips */
  chipBlue: { padding: '2px 10px', borderRadius: 99, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', color: 'var(--accent)', fontSize: 11, fontWeight: 700 },
  chipGreen: { padding: '2px 10px', borderRadius: 99, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#059669', fontSize: 11, fontWeight: 700 },
  /* Modal */
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 },
  modal: { width: '100%', maxWidth: 600, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 18, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto' },
  modalHead: { fontSize: 15, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '20px 28px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' },
  modalBody: { padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 },
  modalFoot: { display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8 },
  /* Form */
  fRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  ig: { display: 'flex', flexDirection: 'column', gap: 6 },
  lbl: { fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' },
  inp: { padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', color: 'var(--foreground)', fontSize: 14, outline: 'none' },
  sel: { padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', color: 'var(--foreground)', fontSize: 14, outline: 'none' },
  changeSummary: { padding: '14px 16px', borderRadius: 10, background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.15)', display: 'flex', flexDirection: 'column', gap: 10 } as React.CSSProperties,
  changeSummaryTitle: { fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' } as React.CSSProperties,
};

