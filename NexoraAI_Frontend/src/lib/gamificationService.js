/**
 * gamificationService.js — Mobile (React Native)
 * ================================================
 * Mirrors the web gamification service using the same Supabase backend.
 *
 * DB schema (users table — FLAT columns, NOT JSONB):
 *   xp               INTEGER DEFAULT 0
 *   level            INTEGER DEFAULT 1
 *   streak           INTEGER DEFAULT 0
 *   last_active_date TIMESTAMPTZ
 *   badges           TEXT[]  (Postgres array)
 */

import { supabase } from './supabase.js';

// ── XP Award Rules ───────────────────────────────────────────────────────────
export const XP_RULES = {
  COMPLETE_LESSON:   50,
  COMPLETE_QUIZ:     50,     // base — actual = (correct/total) × 100
  QUIZ_PERFECT:     100,
  DAILY_STREAK:      10,
  SCENARIO_CORRECT:  25,
  FIRST_SCAN:        20,
};

// ── Level Table (matches web exactly) ────────────────────────────────────────
export const LEVELS = [
  { level: 1, name: 'Rookie',     xpRequired: 0    },
  { level: 2, name: 'Apprentice', xpRequired: 100  },
  { level: 3, name: 'Defender',   xpRequired: 300  },
  { level: 4, name: 'Guardian',   xpRequired: 600  },
  { level: 5, name: 'Sentinel',   xpRequired: 1000 },
  { level: 6, name: 'Specialist', xpRequired: 1500 },
  { level: 7, name: 'Expert',     xpRequired: 2200 },
  { level: 8, name: 'Elite',      xpRequired: 3000 },
];

// ── Badge Definitions (matches web) ──────────────────────────────────────────
export const BADGES = {
  first_login:    { name: 'First Login',      desc: 'Logged in for the first time',      icon: '👋' },
  first_lesson:   { name: 'First Lesson',     desc: 'Completed your first lesson',        icon: '🎓' },
  first_quiz:     { name: 'Quiz Taker',       desc: 'Completed your first quiz',          icon: '📝' },
  streak_3:       { name: 'On Fire',          desc: 'Maintained a 3-day streak',          icon: '🔥' },
  streak_7:       { name: 'Week Warrior',     desc: 'Maintained a 7-day streak',          icon: '📅' },
  level_5:        { name: 'Sentinel',         desc: 'Reached Level 5',                    icon: '🛡️' },
  all_scenarios:  { name: 'Scenario Master',  desc: 'Completed all phishing scenarios',   icon: '🎯' },
  perfect_quiz:   { name: 'Perfect Score',    desc: 'Scored 100% on any quiz',            icon: '🏆' },
  scam_detector:  { name: 'Scam Detector',    desc: 'Completed your first scan',          icon: '🔍' },
};

/**
 * Get level info from XP
 */
export function getLevelFromXP(xp = 0) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.xpRequired) current = l;
  }
  const nextIdx = LEVELS.findIndex(l => l.level === current.level) + 1;
  const next    = LEVELS[nextIdx] || null;
  return { ...current, nextXp: next?.xpRequired ?? null };
}

/**
 * Award XP to a user and check for level-up.
 * Uses FLAT columns: users.xp, users.level
 */
export async function awardXP(uid, amount) {
  if (!uid || !amount) return { newXP: 0, leveledUp: false, newLevelName: null };

  const { data: user, error } = await supabase
    .from('users')
    .select('xp, level')
    .eq('id', uid)
    .single();

  if (error || !user) return { newXP: 0, leveledUp: false, newLevelName: null };

  const oldXP  = user.xp || 0;
  const newXP  = oldXP + amount;
  const oldLvl = getLevelFromXP(oldXP);
  const newLvl = getLevelFromXP(newXP);
  const leveledUp = newLvl.level > oldLvl.level;

  await supabase
    .from('users')
    .update({ xp: newXP, level: newLvl.level, updated_at: new Date().toISOString() })
    .eq('id', uid);

  // Auto-award level_5 badge
  if (newLvl.level >= 5) await awardBadge(uid, 'level_5');

  return { newXP, leveledUp, newLevelName: leveledUp ? newLvl.name : null };
}

/**
 * Update daily streak.
 * Uses FLAT columns: users.streak, users.last_active_date
 */
export async function updateStreak(uid) {
  if (!uid) return { streak: 0 };

  const { data: user, error } = await supabase
    .from('users')
    .select('streak, last_active_date')
    .eq('id', uid)
    .single();

  if (error || !user) return { streak: 0 };

  const today     = new Date().toISOString().split('T')[0];            // YYYY-MM-DD
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastDate  = user.last_active_date
    ? user.last_active_date.split('T')[0]
    : null;

  let streak = user.streak || 0;

  if (lastDate === today) {
    // Already active today — no change
    return { streak };
  } else if (lastDate === yesterday) {
    streak += 1;
  } else {
    streak = 1; // gap or first time
  }

  await supabase
    .from('users')
    .update({
      streak,
      last_active_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', uid);

  // Streak badges
  if (streak >= 3) await awardBadge(uid, 'streak_3');
  if (streak >= 7) await awardBadge(uid, 'streak_7');

  return { streak };
}

/**
 * Award a badge (idempotent).
 * Uses FLAT column: users.badges (TEXT[])
 */
export async function awardBadge(uid, badgeId) {
  if (!uid || !badgeId) return false;

  const { data: user, error } = await supabase
    .from('users')
    .select('badges')
    .eq('id', uid)
    .single();

  if (error || !user) return false;

  const badges = user.badges || [];
  if (badges.includes(badgeId)) return false;

  await supabase
    .from('users')
    .update({ badges: [...badges, badgeId], updated_at: new Date().toISOString() })
    .eq('id', uid);

  return true;
}
