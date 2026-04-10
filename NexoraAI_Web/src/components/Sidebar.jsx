import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Trophy, User, Shield,
  Settings, HelpCircle, LogOut, Crosshair, Swords
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/scenarios',  icon: Swords,           label: 'Scenarios' },
  { path: '/leaderboard',icon: Trophy,           label: 'Leaderboard' },
  { path: '/profile',    icon: User,             label: 'Profile' },
  { path: '/change-password', icon: Shield,      label: 'Security' },
  { path: '/settings',   icon: Settings,         label: 'Settings' },
  { path: '/help',       icon: HelpCircle,       label: 'Help Center' },
];

function maskEmail(email = '') {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return name.slice(0, 3) + '***@' + domain;
}

function getInitials(profile, user) {
  const name = profile?.name || user?.user_metadata?.full_name || user?.email || '';
  if (!name) return 'N';
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export default function Sidebar({ user, profile, onLogout }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  const displayName = profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Agent';
  const avatarUrl   = profile?.avatar_url || user?.user_metadata?.avatar_url || null;
  const initials    = getInitials(profile, user);
  const email       = user?.email || '';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <span className="sidebar-logo-text">
          NEX<span>ORA</span>
        </span>
      </div>

      {/* User Profile Block */}
      <div className="sidebar-user">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="sidebar-avatar">
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} />
              : initials
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-user-name">{displayName}</div>
            <div className="sidebar-user-email">{maskEmail(email)}</div>
          </div>
        </div>

        {/* XP + Level if available */}
        {profile && (() => {
          const xp  = profile.xp  || 0;
          const lvl = profile.level || 1;
          const LEVEL_XP = [0, 0, 100, 300, 600, 1000, 1500, 2200, 3000];
          const nextXp   = LEVEL_XP[lvl + 1] ?? LEVEL_XP[LEVEL_XP.length - 1];
          const prevXp   = LEVEL_XP[lvl]     || 0;
          const pct      = nextXp > prevXp
            ? Math.min(100, Math.round((xp - prevXp) / (nextXp - prevXp) * 100))
            : 100;
          const LEVEL_NAMES = ['','Rookie','Apprentice','Defender','Guardian','Sentinel','Specialist','Expert','Elite'];

          return (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>
                  Lv.{lvl} · {LEVEL_NAMES[lvl] || 'Rookie'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>
                  {xp.toLocaleString()} XP
                </span>
              </div>
              <div className="xp-bar-track">
                <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })()}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path ||
            (path !== '/dashboard' && location.pathname.startsWith(path));
          return (
            <button
              key={path}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(path)}
            >
              <Icon size={18} />
              {label}
            </button>
          );
        })}

        <div className="sidebar-divider" />
      </nav>

      {/* Logout */}
      <div className="sidebar-logout">
        <button className="sidebar-nav-item" onClick={onLogout}>
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
