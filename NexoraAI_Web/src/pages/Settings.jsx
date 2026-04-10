import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { supabase } from '../lib/supabase';
import { Bell, Globe, Trash2, AlertTriangle } from 'lucide-react';

export default function Settings({ user, profile, onLogout, refreshProfile }) {
  const settings = profile?.settings || { notificationsEnabled: true, preferredLanguage: 'english', voiceMode: 'female' };

  const [notifications, setNotifications] = useState(settings.notificationsEnabled);
  const [language, setLanguage]           = useState(settings.preferredLanguage);
  const [voice, setVoice]                 = useState(settings.voiceMode);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [deleteInput, setDeleteInput]     = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting]           = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('users').update({
        settings: { notificationsEnabled: notifications, preferredLanguage: language, voiceMode: voice }
      }).eq('uid', user.id);
      setSaved(true);
      refreshProfile?.();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') return;
    setDeleting(true);
    try {
      await supabase.from('users').delete().eq('uid', user.id);
      await supabase.auth.admin?.deleteUser(user.id).catch(() => {});
      await supabase.auth.signOut();
    } catch (err) { console.error(err); }
    setDeleting(false);
  };

  return (
    <div className="app-layout">
      <Sidebar user={user} profile={profile} onLogout={onLogout} />
      <main className="main-content">
        <div className="page-container" style={{ maxWidth: 640 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 32 }}>Settings</h1>

          {/* ── Preferences ── */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 24 }}>Preferences</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Notifications */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Bell size={18} color="var(--primary)" />
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>Email Notifications</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Daily lesson reminders and alerts</div>
                  </div>
                </div>
                <button
                  onClick={() => setNotifications(!notifications)}
                  style={{
                    width: 52, height: 28, borderRadius: 14, position: 'relative', border: 'none', cursor: 'pointer',
                    background: notifications ? 'var(--primary)' : 'var(--surface-light)', transition: 'background 0.2s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: notifications ? 27 : 3, width: 22, height: 22,
                    borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                  }} />
                </button>
              </div>

              {/* Language */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Globe size={18} color="var(--primary)" />
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>Preferred Language</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>For lessons and interface</div>
                  </div>
                </div>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <option value="english">English</option>
                  <option value="hindi">Hindi (Coming Soon)</option>
                  <option value="arabic">Arabic (Coming Soon)</option>
                </select>
              </div>

              {/* AI Voice */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 18 }}>🎙️</span>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>AI Voice (Lesson Videos)</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Voice used for AI-generated lessons</div>
                  </div>
                </div>
                <select
                  value={voice}
                  onChange={e => setVoice(e.target.value)}
                  style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="btn btn-primary btn-full"
              style={{ marginTop: 28 }}
              disabled={saving}
            >
              {saving ? <span className="spinner" /> : saved ? '✓ Saved!' : 'Save Settings'}
            </button>
          </div>

          {/* ── Danger Zone ── */}
          <div className="card" style={{ border: '1px solid rgba(255,61,87,0.2)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
              <AlertTriangle size={18} color="var(--malicious)" />
              <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--malicious)' }}>Danger Zone</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
              Deleting your account is permanent and cannot be undone. All your data, progress, and badges will be lost.
            </p>

            {!showDeleteConfirm ? (
              <button className="btn btn-danger btn-full" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={16} /> Delete Account
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="alert alert-error">
                  Type <strong>DELETE</strong> below to confirm account deletion.
                </div>
                <input
                  className="form-input"
                  placeholder="Type DELETE"
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-danger" style={{ flex: 1 }}
                    disabled={deleteInput !== 'DELETE' || deleting}
                    onClick={handleDeleteAccount}
                  >
                    {deleting ? <span className="spinner" /> : 'Permanently Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
