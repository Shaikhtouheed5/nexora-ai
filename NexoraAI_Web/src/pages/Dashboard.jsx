import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { supabase } from '../lib/supabase';
import { fetchLessons, fetchUserProgress } from '../lib/lessonService';
import { updateStreak, getLevelFromXP, BADGES } from '../lib/gamificationService';
import {
  BookOpen, ChevronRight, Trophy, Flame, Star,
  ArrowRight, Play, AlertTriangle, Lock
} from 'lucide-react';

export default function Dashboard({ user, profile, onLogout, refreshProfile }) {
  const navigate = useNavigate();
  const [lessons,  setLessons]  = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Flat profile columns
  const xp      = profile?.xp      || 0;
  const level   = profile?.level   || 1;
  const streak  = profile?.streak  || 0;
  const badges  = profile?.badges  || [];

  const levelInfo = getLevelFromXP(xp);
  const xpPct = levelInfo.nextXp
    ? Math.min(100, Math.round((xp - levelInfo.xpRequired) / (levelInfo.nextXp - levelInfo.xpRequired) * 100))
    : 100;

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const { data, error } = await supabase
          .from('lessons')
          .select('*')
          .order('day_id')

        if (error) throw error
        setLessons(data || [])
      } catch (err) {
        console.error('Lessons error:', err)
        setFetchError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchLessons()
  }, [])

  const displayName      = profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Agent';
  const lessonsCompleted = progress.filter(p => p.completed).length;
  const continueLesson   = lessons.find(l => !l.is_completed) || lessons[0];
  const earnedBadges     = badges.slice(0, 4);

  return (
    <div className="app-layout">
      <Sidebar user={user} profile={profile} onLogout={onLogout} />

      <main className="main-content">
        <div className="page-container">

          {/* ── Header ── */}
          <header style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 6, letterSpacing: '-0.02em' }}>
                  Welcome back, <span style={{ color: 'var(--primary)' }}>{displayName}</span> 👋
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>
                  Your security training dashboard — stay sharp.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {streak > 0 && (
                  <div className="streak-badge animate-glow">
                    <Flame size={16} /> {streak}-day streak
                  </div>
                )}
                <span className="badge badge-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                  <Star size={14} /> Lv.{level} · {levelInfo.name}
                </span>
              </div>
            </div>

            {/* XP Bar */}
            <div className="xp-bar-wrapper" style={{ marginTop: 24, maxWidth: 500 }}>
              <div className="xp-bar-labels">
                <span>{xp.toLocaleString()} XP</span>
                {levelInfo.nextXp && <span>Next: {levelInfo.nextXp.toLocaleString()} XP</span>}
              </div>
              <div className="xp-bar-track" style={{ height: 8 }}>
                <div className="xp-bar-fill" style={{ width: `${xpPct}%` }} />
              </div>
            </div>
          </header>

          {/* ── Quick Stats ── */}
          <div className="grid-4" style={{ marginBottom: 36 }}>
            {[
              { label: 'Lessons Done',   value: lessonsCompleted,       color: 'var(--primary)',    icon: BookOpen },
              { label: 'Current Streak', value: `${streak}d`,           color: '#FF9500',           icon: Flame },
              { label: 'Current Level',  value: `Lv.${level}`,          color: 'var(--safe)',       icon: Trophy },
              { label: 'Badges Earned',  value: badges.length,          color: 'var(--suspicious)', icon: Star },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="card" style={{ padding: '20px 24px', cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Icon size={16} color={color} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* ── Continue Learning Card ── */}
          {continueLesson && (
            <div
              className="card-neon animate-fade"
              style={{
                background: 'linear-gradient(135deg, rgba(0,245,255,0.08) 0%, rgba(14,21,36,0.9) 100%)',
                padding: '32px', marginBottom: 36, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
              }}
              onClick={() => navigate(`/lesson/${continueLesson.day_id}`)}
            >
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: 'var(--primary-dim)', border: '1px solid var(--glass-border-lg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                boxShadow: 'var(--shadow-neon)',
              }}>
                <Play size={28} color="var(--primary)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Continue Learning · Day {String(continueLesson.day_id).replace(/^day-?/i, '')}
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{continueLesson.title}</h2>
              </div>
              <button className="btn btn-primary" style={{ flexShrink: 0 }}>
                Start Lesson <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ── Recent Badges ── */}
          {earnedBadges.length > 0 && (
            <div style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Recent Badges</h2>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {earnedBadges.map(badgeId => {
                  const b = BADGES[badgeId];
                  if (!b) return null;
                  return (
                    <div key={badgeId} className="card" style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', cursor: 'default', minWidth: 180 }}>
                      <span style={{ fontSize: 28 }}>{b.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{b.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── All Lessons ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>Security Protocols</h2>
              {!loading && !fetchError && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {lessonsCompleted} / {lessons.length} completed
                </span>
              )}
            </div>

            {/* Loading */}
            {loading && (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                Loading protocols...
              </div>
            )}

            {/* Error state */}
            {!loading && fetchError && (
              <div style={{
                textAlign: 'center', padding: 48,
                background: 'var(--surface)', borderRadius: 20,
                border: '1px solid rgba(255,61,87,0.15)',
              }}>
                <AlertTriangle size={36} color="var(--danger)" style={{ marginBottom: 16 }} />
                <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Could not load lessons. Check your connection and try again.
                </p>
                <button className="btn btn-outline" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !fetchError && lessons.length === 0 && (
              <div style={{
                textAlign: 'center', padding: 60,
                background: 'var(--surface)', borderRadius: 20,
                border: '1px solid var(--border)',
              }}>
                <Lock size={36} color="var(--text-muted)" style={{ marginBottom: 16 }} />
                <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No lessons yet</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  Lessons are being loaded into the system. Check back soon.
                </p>
              </div>
            )}

            {/* Lesson grid */}
            {!loading && !fetchError && lessons.length > 0 && (
              <div className="grid-auto">
                {lessons.map(lesson => (
                  <div
                    key={lesson.id}
                    className="card animate-fade"
                    style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                  >
                    {/* Icon + done badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 14,
                        background: lesson.is_completed ? 'var(--safe-dim)' : 'var(--primary-dim)',
                        border: `1px solid ${lesson.is_completed ? 'rgba(0,230,118,0.2)' : 'var(--glass-border-lg)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <BookOpen size={22} color={lesson.is_completed ? 'var(--safe)' : 'var(--primary)'} />
                      </div>
                      {lesson.is_completed && <span className="badge badge-safe">✓ Done</span>}
                    </div>

                    {/* Title + day */}
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                        Day {String(lesson.day_id).replace(/^day-?/i, '')}
                      </div>
                      <h3 style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>{lesson.title}</h3>
                    </div>

                    {/* Start button */}
                    <div style={{ marginTop: 'auto' }}>
                      <Link
                        to={`/lesson/${lesson.day_id}`}
                        className="btn btn-outline"
                        style={{ width: '100%', textAlign: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 13 }}
                      >
                        {lesson.is_completed ? 'Review Lesson' : 'Start Lesson'}
                        <ChevronRight size={15} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
