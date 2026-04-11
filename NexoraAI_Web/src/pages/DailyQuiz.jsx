import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import QuizEngine from '../components/QuizEngine';
import { fetchQuiz } from '../lib/lessonService';
import { supabase } from '../lib/supabase';

// Static quiz data — add more lesson files here as they are created
const STATIC_QUIZZES = {
  'day-1': () => import('../data/quizzes/day-1.js').then(m => m.day1Quiz),
};

export default function DailyQuiz({ user, profile, onLogout, refreshProfile }) {
  const { dayId } = useParams();

  const [quizData, setQuizData]       = useState(null);   // { lessonId, category, questions }
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [prevResult, setPrevResult]   = useState(null);   // prior completion info

  useEffect(() => {
    setLoading(true);
    setError(null);
    setQuizData(null);

    const load = async () => {
      // 1. Check for a static quiz data file first
      if (STATIC_QUIZZES[dayId]) {
        try {
          const data = await STATIC_QUIZZES[dayId]();
          setQuizData(data);
        } catch {
          setError('Failed to load quiz data.');
        }
      } else {
        // 2. Fall back to backend (lessonService / Supabase)
        try {
          const questions = await fetchQuiz(dayId);
          if (!questions?.length) throw new Error('No questions found');
          setQuizData({ lessonId: dayId, category: null, questions });
        } catch (e) {
          setError(e.message || 'Quiz not found.');
        }
      }

      // 3. Check if user already completed this quiz
      if (user?.id && dayId) {
        const { data } = await supabase
          .from('quiz_results')
          .select('score, total, accuracy_percent, completed_at')
          .eq('user_id', user.id)
          .eq('quiz_id', dayId)
          .order('completed_at', { ascending: false })
          .limit(1)
          .catch(() => ({ data: null }));

        if (data?.[0]) setPrevResult(data[0]);
      }

      setLoading(false);
    };

    load();
  }, [dayId, user?.id]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0f1a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 20,
      }}>
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading quiz…</p>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !quizData) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0f1a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16, padding: 24,
      }}>
        <span style={{ fontSize: 48 }}>😕</span>
        <h2 style={{ color: '#E8F4F8', fontWeight: 800 }}>Quiz Not Found</h2>
        <p style={{ color: '#546A7D', textAlign: 'center', maxWidth: 340 }}>
          {error || `No quiz found for "${dayId}".`}
        </p>
      </div>
    );
  }

  // ── Quiz ───────────────────────────────────────────────────────────────────
  return (
    <QuizEngine
      questions={quizData.questions}
      lessonId={quizData.lessonId}
      category={quizData.category}
      user={user}
      onComplete={(correct, xp) => {
        refreshProfile?.();
      }}
    />
  );
}
