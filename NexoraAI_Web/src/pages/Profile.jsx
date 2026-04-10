import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { supabase } from '../lib/supabase';
import { BADGES, getLevelFromXP } from '../lib/gamificationService';
import { Shield, Mail, Calendar, Edit2, Save, X, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile({ user, profile, onLogout, refreshProfile }) {
  const navigate = useNavigate();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName]         = useState('');
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState('');

  // Flat columns from users table (no more JSONB)
  const xp     = profile?.xp || 0;
  const level  = profile?.level || 1;
  const streak = profile?.streak || 0;
  const badges = profile?.badges || [];

  const displayName = profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Agent';
  const avatarUrl   = profile?.avatar_url || user?.user_metadata?.avatar_url || null;
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown';
  const provider    = profile?.auth_provider || 'email';
  const levelInfo   = getLevelFromXP(xp);

  const getInitials = () => {
    const n = displayName.trim().split(' ');
    return n.length >= 2 ? (n[0][0] + n[n.length - 1][0]).toUpperCase() : displayName.slice(0, 2).toUpperCase();
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await supabase.from('users').update({ name: newName.trim() }).eq('id', user.id);
      setSaveMsg('Name updated!');
      setEditingName(false);
      refreshProfile?.();
      setTimeout(() => setSaveMsg(''), 3000);
    } catch {
      setSaveMsg('Failed to update.');
    } finally {
      setSaving(false);
    }
  };

  const allBadgeIds   = Object.keys(BADGES);

  return (
    <div className="app-layout">
      <Sidebar user={user} profile={profile} onLogout={onLogout} />
      <main className="main-content">
        <div className="page-container" style={{ maxWidth: 800 }}>

          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 32 }}>My Profile</h1>

          {/* ── Avatar + Info ── */}
          <div className="card-neon" style={{ padding: '36px', marginBottom: 24, display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{ flexShrink: 0 }}>
              <div style={{
                width: 100, height: 100, borderRadius: '50%',
                background: 'var(--primary-dim)', border: '3px solid var(--glass-border-lg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 900, color: 'var(--primary)', overflow: 'hidden',
                boxShadow: 'var(--shadow-neon)',
              }}>
                {avatarUrl ? <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials()}
              </div>
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              {/* Name */}
              <div style={{ marginBottom: 16 }}>
                {editingName ? (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      className="form-input"
                      style={{ maxWidth: 260, padding: '10px 14px' }}
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Full name"
                      autoFocus
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleSaveName} disabled={saving}>
                      <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingName(false)}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 900 }}>{displayName}</h2>
                    <button onClick={() => { setNewName(displayName); setEditingName(true); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                      <Edit2 size={16} />
                    </button>
                  </div>
                )}
                {saveMsg && <p className="form-success" style={{ fontSize: 13, marginTop: 4 }}>{saveMsg}</p>}
              </div>

              {/* Meta info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                  <Mail size={15} /> {user?.email}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                  <Calendar size={15} /> Member since {memberSince}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
                  <Shield size={15} color="var(--primary)" />
                  <span style={{ color: 'var(--text-secondary)' }}>Auth via</span>
                  <span className="badge badge-primary" style={{ fontSize: 11 }}>{provider.toUpperCase()}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                <button className="btn btn-outline btn-sm" onClick={() => navigate('/change-password')}>
                  <Key size={14} /> Change Password
                </button>
              </div>
            </div>
          </div>

          {/* ── Stats Grid ── */}
          <div className="grid-4" style={{ marginBottom: 24 }}>
            {[
              { label: 'Streak', value: `${streak}d` },
              { label: 'Badges', value: badges.length },
              { label: 'Current Level', value: `Lv.${level}` },
              { label: 'Total XP', value: xp.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="card" style={{ textAlign: 'center', cursor: 'default' }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--primary)', marginBottom: 6 }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* ── Badges ── */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Badges</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
              {allBadgeIds.map(bid => {
                const b = BADGES[bid];
                const earned = badges.includes(bid);
                return (
                  <div key={bid} style={{
                    padding: '16px', borderRadius: 14, textAlign: 'center',
                    background: earned ? 'var(--primary-dim)' : 'var(--surface)',
                    border: `1px solid ${earned ? 'var(--glass-border-lg)' : 'var(--glass-border)'}`,
                    opacity: earned ? 1 : 0.45,
                    filter: earned ? 'none' : 'grayscale(1)',
                    transition: 'var(--transition)',
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{b.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: earned ? 'var(--primary)' : 'var(--text-muted)', marginBottom: 4 }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{b.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
