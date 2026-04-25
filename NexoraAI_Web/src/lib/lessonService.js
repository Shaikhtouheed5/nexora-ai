/**
 * lessonService.js — NexoraAI Web
 * ================================
 * Direct Supabase queries against the lessons + user_progress tables.
 *
 * DB tables used:
 *   lessons       — id, day_id, title, content, summary_points, video_url, video_status
 *   user_progress — id, user_id, lesson_id, xp_earned, completed, completed_at
 */

import { supabase } from './supabase';
import { awardXP, updateStreak } from './gamificationService';

// ─── fetchLesson ──────────────────────────────────────────────────────────────
/**
 * Fetch a single lesson by its day_id.
 * @param {string|number} dayId
 * @returns {object|null}
 */
export async function fetchLesson(dayId) {
  try {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('day_id', dayId)
      .single();

    if (error) throw error;
    return data;
  } catch (e) {
    console.warn('[lessonService] fetchLesson failed:', e.message);
    return null;
  }
}

// ─── fetchLessons ─────────────────────────────────────────────────────────────
/**
 * Fetch all lessons ordered by day_id (for roadmap/dashboard).
 * @returns {object[]}
 */
export async function fetchLessons() {
  try {
    const { data, error } = await supabase
      .from('lessons')
      .select('id, day_id, title, video_status')
      .order('day_id', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('[lessonService] fetchLessons failed:', e.message);
    return [];
  }
}

// ─── fetchUserProgress ────────────────────────────────────────────────────────
/**
 * Fetch all progress rows for a user.
 * @param {string} uid  — Supabase auth user id
 * @returns {object[]}  array of user_progress rows
 */
export async function fetchUserProgress(uid) {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', uid);

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('[lessonService] fetchUserProgress failed:', e.message);
    return [];
  }
}

// ─── markLessonComplete ───────────────────────────────────────────────────────
/**
 * Upsert a completed lesson for the user, award 50 XP, update streak.
 * @param {string} uid    — Supabase auth user id
 * @param {string} dayId  — lesson day_id
 */
export async function markLessonComplete(uid, dayId) {
  try {
    const xpEarned = 50;

    const { error } = await supabase
      .from('user_progress')
      .upsert(
        {
          user_id:      uid,
          lesson_id:    dayId,
          xp_earned:    xpEarned,
          completed:    true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,lesson_id' }
      );

    if (error) throw error;

    // Award XP and update streak in parallel
    await Promise.all([
      awardXP(uid, xpEarned),
      updateStreak(uid),
    ]);

    return { status: 'success', xp_earned: xpEarned };
  } catch (e) {
    console.warn('[lessonService] markLessonComplete failed:', e.message);
    return null;
  }
}

// ─── fetchQuiz ────────────────────────────────────────────────────────────────
/**
 * Fetch the quiz questions for a given day from lessons.quizzes JSONB.
 * @param {string|number} dayId
 * @returns {object[]|null}
 */
export async function fetchQuiz(dayId) {
  try {
    const { data, error } = await supabase
      .from('lessons')
      .select('quizzes')
      .eq('day_id', dayId)
      .single();

    if (error) throw error;
    return data?.quizzes || null;
  } catch (e) {
    console.warn('[lessonService] fetchQuiz failed:', e.message);
    return null;
  }
}
