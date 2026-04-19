import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { supabase } from '../lib/supabase';
import { Trophy, Flame, Star } from 'lucide-react';

function maskEmail(email = '') {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return name.slice(0, 3) + '***@' + domain;
}

const TABS = ['All Time', 'This Week', 'Today'];

export default function Leaderboard({ user, profile, onLogout }) {
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('All Time');
  const [userRank, setUserRank] = useState(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [tab, user?.id]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      // leaderboard_view exposes: uid, email, xp, level, level_name, streak, last_login
      let query = supabase
        .from('leaderboard_view')
        .select('uid, email, xp, level, level_name, streak, last_login')
        .order('xp', { ascending: false })
        .limit(50);

      if (tab === 'This Week') {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        query = query.gte('last_login', weekAgo);
      } else if (tab === 'Today') {
        const today = new Date().toISOString().split('T')[0];
        query = query.gte('last_login', today);
      }

      const { data, error } = await query;
      if (error) throw error;

      let rows = (data || []).map(u => ({
        ...u,
        xp: u.xp || 0,
        level: u.level || 1,
        levelName: u.level_name || 'Rookie',
        streak: u.streak || 0,
      }));

      // Inject current user from profile if the view didn't include them
      const inList = rows.some(e => e.uid === user?.id);
      if (!inList && user && profile) {
        rows = [
          ...rows,
          {
            uid: user.id,
            email: user.email || '',
            xp: profile.xp || 0,
            level: profile.level || 1,
            levelName: profile.level_name || 'Rookie',
            streak: profile.streak || 0,
          },
        ];
      }

      // Sort by XP descending and assign ranks
      const sorted = rows
        .sort((a, b) => b.xp - a.xp)
        .map((u, i) => ({ ...u, rank: i + 1 }));

      setEntries(sorted);

      const myRank = sorted.findIndex(e => e.uid === user?.id);
      setUserRank(myRank >= 0 ? myRank + 1 : null);
    } catch (err) {
      console.error('Leaderboard error:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const getRankStyle = (rank) => {
    if (rank === 1) return { color: '#FFD700', emoji: '🥇' };
    if (rank === 2) return { color: '#C0C0C0', emoji: '🥈' };
    if (rank === 3) return { color: '#CD7F32', emoji: '🥉' };
    return { color: 'var(--text-muted)', emoji: `#${rank}` };
  };

  return (
    <div className="app-layout">
      <Sidebar user={user} profile={profile} onLogout={onLogout} />
      <main className="main-content">
        <div className="page-container" style={{ maxWidth: 800 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>
                <Trophy size={26} color="var(--primary)" style={{ verticalAlign: 'middle', marginRight: 10 }} />
                Leaderboard
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Top security agents ranked by XP</p>
            </div>
            {userRank && (
              <span className="badge badge-primary" style={{ fontSize: 14, padding: '10px 18px' }}>
                Your Rank: #{userRank}
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="tab-list" style={{ marginBottom: 24, maxWidth: 360 }}>
            {TABS.map(t => (
              <button key={t} className={`tab-item ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>

          {/* Table */}
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            {/* Table Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '60px 1fr 100px 80px 80px',
              padding: '14px 24px', borderBottom: '1px solid var(--glass-border)',
              background: 'var(--surface)',
            }}>
              {['Rank', 'Agent', 'XP', 'Level', 'Streak'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</div>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading rankings...</p>
              </div>
            ) : entries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                No entries found for this period.
              </div>
            ) : (
              entries.map((entry, idx) => {
                const { color, emoji } = getRankStyle(entry.rank);
                const isMe = entry.uid === user?.id;
                return (
                  <div key={entry.uid} style={{
                    display: 'grid', gridTemplateColumns: '60px 1fr 100px 80px 80px',
                    padding: '16px 24px',
                    borderBottom: idx < entries.length - 1 ? '1px solid var(--glass-border)' : 'none',
                    background: isMe ? 'var(--primary-dim)' : 'transparent',
                    transition: 'background 0.2s',
                  }}
                    onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={e => { if (!isMe) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 16, color }}>{emoji}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: isMe ? 'var(--primary)' : 'var(--text)' }}>
                        {isMe ? '(You) ' : ''}{maskEmail(entry.email)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{entry.levelName}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--primary)' }}>{entry.xp.toLocaleString()}</div>
                    <div style={{ fontWeight: 700 }}>Lv.{entry.level}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Flame size={14} color="#FF9500" /> {entry.streak}d
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Current user pinned at bottom if not in top 50 */}
          {!loading && userRank === null && user && (
            <div className="card-neon" style={{ marginTop: 16, padding: '16px 24px', display: 'grid', gridTemplateColumns: '60px 1fr 100px 80px 80px' }}>
              <div style={{ fontWeight: 900, color: 'var(--text-muted)' }}>—</div>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--primary)' }}>(You) {maskEmail(user.email)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Not in top 50 yet</div>
              </div>
              <div style={{ fontWeight: 800, color: 'var(--primary)' }}>{(profile?.xp || 0).toLocaleString()}</div>
              <div>Lv.{profile?.level || 1}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Flame size={14} color="#FF9500" /> {profile?.streak || 0}d
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
