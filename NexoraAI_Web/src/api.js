/**
 * api.js — NexoraAI Web API Client
 * ==================================
 * Unified backend: https://nexora-scanner.onrender.com
 */

import { supabase } from './lib/supabase';

const EDU_API_BASE = import.meta.env.VITE_API_URL || 'https://nexora-scanner.onrender.com';

class ApiClient {
  async _getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async fetch(endpoint, options = {}) {
    const token = await this._getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${EDU_API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      await supabase.auth.signOut();
      window.location.href = '/login';
      return null;
    }

    if (!response.ok) {
      let errMsg = `API error ${response.status}`;
      try {
        const err = await response.json();
        errMsg = err.detail || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }

    return response.json();
  }

  // ── Lessons ──────────────────────────────────────────────────────────────
  getLessons(lang = 'en') {
    return this.fetch(`/lessons?lang=${lang}`);
  }

  getLessonDetail(id, lang = 'en') {
    return this.fetch(`/lessons/${id}?lang=${lang}`);
  }

  completeLesson(id) {
    return this.fetch(`/lessons/${id}/complete`, { method: 'POST' });
  }

  // ── Quiz ─────────────────────────────────────────────────────────────────
  getDailyQuiz(lang = 'en') {
    return this.fetch(`/quiz/daily?lang=${lang}`);
  }

  submitQuizScore(quizId, quizType, answers) {
    return this.fetch('/quiz/score', {
      method: 'POST',
      body: JSON.stringify({ quiz_id: quizId, quiz_type: quizType, answers }),
    });
  }

  // ── Profile & Leaderboard ────────────────────────────────────────────────
  getProfile() {
    return this.fetch('/profile');
  }

  getLeaderboard() {
    return this.fetch('/leaderboard');
  }

  getActivity() {
    return this.fetch('/activity');
  }

  // ── Advice ───────────────────────────────────────────────────────────────
  getAdvice(lang = 'en') {
    return this.fetch(`/advice?lang=${lang}`);
  }

  getMessageAdvice(message, classification, lang = 'en') {
    return this.fetch('/advice/message', {
      method: 'POST',
      body: JSON.stringify({ message, classification, lang }),
    });
  }

  // ── History (backward-compat) ────────────────────────────────────────────
  async getHistory() {
    const { data, error } = await supabase
      .from('scan_history')
      .select('*')
      .order('scanned_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  }

  // ── XP & Lesson Completion (Supabase direct) ────────────────────────────
  /**
   * Add XP to a user's profile.
   * Reads current XP first, then increments — safe without a DB function.
   * @param {string} userId  Supabase user UUID
   * @param {number} amount  XP to add (positive integer)
   */
  async updateUserXP(userId, amount) {
    if (!userId || !amount) return;
    try {
      // Try users table first (primary)
      const { data: row } = await supabase
        .from('users')
        .select('xp')
        .eq('uid', userId)
        .single();

      if (row !== null) {
        await supabase
          .from('users')
          .update({ xp: (row?.xp || 0) + amount })
          .eq('uid', userId);
        return;
      }

      // Fall back to profiles table
      const { data: prof } = await supabase
        .from('profiles')
        .select('xp')
        .eq('id', userId)
        .single();

      await supabase
        .from('profiles')
        .update({ xp: (prof?.xp || 0) + amount })
        .eq('id', userId);
    } catch (e) {
      console.error('[api.updateUserXP]', e.message);
    }
  }

  /**
   * Mark a lesson as completed for a user.
   * Upserts into user_lessons — safe to call multiple times.
   * @param {string} userId    Supabase user UUID
   * @param {string} lessonId  e.g. 'day-1'
   */
  async markLessonComplete(userId, lessonId) {
    if (!userId || !lessonId) return;
    try {
      await supabase
        .from('user_lessons')
        .upsert(
          {
            user_id: userId,
            lesson_id: lessonId,
            completed: true,
            completed_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,lesson_id' }
        );
    } catch (e) {
      console.error('[api.markLessonComplete]', e.message);
    }
  }

  logout() {
    return supabase.auth.signOut();
  }
}

export const api = new ApiClient();
