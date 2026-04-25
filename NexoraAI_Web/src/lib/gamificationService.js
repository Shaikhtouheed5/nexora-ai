/**
 * gamificationService.js — XP, Levels, Streaks & Badges
 *
 * DB schema (users table — flat columns, NOT JSONB):
 *   xp               INTEGER
 *   level            INTEGER
 *   streak           INTEGER
 *   last_active_date TEXT  (ISO date string)
 *   badges           TEXT[] (Postgres array)
 *
 * XP Rules:
 *   Complete a lesson   → +50 XP
 *   Complete a quiz     → (correct/total) × 100 XP
 *   Scenario correct    → +25 XP
 *   Daily streak        → streak bonus built into updateStreak
 */

import { supabase } from './supabase';

// ─── XP Rules ─────────────────────────────────────────────────────────────────
export const XP_RULES = {
  LESSON_COMPLETE:  50,
  QUIZ_PERFECT:    100,
  QUIZ_PASS:        50,
  SCENARIO_CORRECT: 25,
  DAILY_LOGIN:      10,
  STREAK_BONUS:     20,
};

// ─── Level Table ───────────────────────────────────────────────────────────────
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

// ─── Badge Definitions ────────────────────────────────────────────────────────
export const BADGES = {
  first_login:    { name: 'First Login',      desc: 'Logged in for the first time',      icon: '👋' },
  first_lesson:   { name: 'First Lesson',     desc: 'Completed your first lesson',        icon: '🎓' },
  first_quiz:     { name: 'Quiz Taker',       desc: 'Completed your first quiz',          icon: '📝' },
  streak_3:       { name: 'On Fire',          desc: 'Maintained a 3-day streak',          icon: '🔥' },
  streak_7:       { name: 'Week Warrior',     desc: 'Maintained a 7-day streak',          icon: '📅' },
  level_5:        { name: 'Sentinel',         desc: 'Reached Level 5',                    icon: '🛡️' },
  all_scenarios:  { name: 'Scenario Master',  desc: 'Completed all phishing scenarios',   icon: '🎯' },
  perfect_quiz:   { name: 'Perfect Score',    desc: 'Scored 100% on any quiz',            icon: '🏆' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getLevelFromXP(xp) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.xpRequired) current = l;
  }
  const nextIndex = LEVELS.findIndex(l => l.level === current.level) + 1;
  const next = LEVELS[nextIndex] || null;
  return { ...current, nextXp: next?.xpRequired ?? null };
}

// ─── awardXP ─────────────────────────────────────────────────────────────────
/**
 * Add XP to a user, check for level-up, and update the users table.
 * @param {string} uid  — Supabase auth user id
 * @param {number} amount
 */
export async function awardXP(uid, amount) {
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

// ─── updateStreak ─────────────────────────────────────────────────────────────
/**
 * Call on each login / lesson completion.
 * Reads last_active_date, increments or resets streak, writes back.
 * @param {string} uid
 */
export async function updateStreak(uid) {
  const { data: user, error } = await supabase
    .from('users')
    .select('streak, last_active_date')
    .eq('id', uid)
    .single();

  if (error || !user) return { streak: 0 };

  const today     = new Date().toISOString().split('T')[0];          // YYYY-MM-DD
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastDate  = user.last_active_date ? user.last_active_date.split('T')[0] : null;

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
    .update({ streak, last_active_date: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', uid);

  // Streak badges
  if (streak >= 3) await awardBadge(uid, 'streak_3');
  if (streak >= 7) await awardBadge(uid, 'streak_7');

  return { streak };
}

// ─── awardBadge ───────────────────────────────────────────────────────────────
/**
 * Idempotent badge award — appends to users.badges array only if not present.
 * @param {string} uid
 * @param {string} badgeId  — key from BADGES object
 * @returns {boolean} true if badge was newly awarded
 */
export async function awardBadge(uid, badgeId) {
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
