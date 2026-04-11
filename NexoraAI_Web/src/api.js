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
  getHistory() {
    // Returns scan history from Supabase directly — not proxied via edu API
    return supabase
      .from('scan_history')
      .select('*')
      .order('scanned_at', { ascending: false })
      .limit(50)
      .then(({ data }) => data || []);
  }

  // ── Legacy stubs (kept for backward-compat, no-op) ───────────────────────
  logout() {
    return supabase.auth.signOut();
  }
}

export const api = new ApiClient();
