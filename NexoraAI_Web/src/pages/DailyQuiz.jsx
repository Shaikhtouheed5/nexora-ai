import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { fetchQuiz } from '../lib/lessonService';
import { awardXP, awardBadge, XP_RULES } from '../lib/gamificationService';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, ChevronRight, Trophy, RotateCcw, Home } from 'lucide-react';

export default function DailyQuiz({ user, profile, onLogout, refreshProfile }) {
  const { dayId } = useParams();
  const navigate  = useNavigate();

  const [quiz, setQuiz]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [current, setCurrent]         = useState(0);
  const [answers, setAnswers]         = useState({});
  const [selected, setSelected]       = useState(null);
  const [submitted, setSubmitted]     = useState(false);
  const [score, setScore]             = useState(0);
  const [xpGained, setXpGained]       = useState(0);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchQuiz(dayId)
      .then(data => setQuiz({ questions: data }))
      .catch(() => setQuiz(null))
      .finally(() => setLoading(false));
  }, [dayId]);

  const questions = quiz?.questions || [];
  const totalQ    = questions.length;
  const currentQ  = questions[current];

  const handleSelect = (optionIdx) => {
    if (submitted) return;
    setSelected(optionIdx);
  };

  const handleNext = () => {
    if (selected === null) return;
    const newAnswers = { ...answers, [current]: selected };
    setAnswers(newAnswers);

    if (current + 1 < totalQ) {
      setCurrent(current + 1);
      setSelected(newAnswers[current + 1] ?? null);
    } else {
      // Score and submit
      submitQuiz(newAnswers);
    }
  };

  const submitQuiz = async (finalAnswers) => {
    setSubmitted(true);
    let correct = 0;
    questions.forEach((q, i) => {
      if (finalAnswers[i] === q.correctIndex) correct++;
    });
    setScore(correct);

    // XP calculation
    let xp = XP_RULES.COMPLETE_QUIZ;
    if (correct === totalQ) {
      xp += XP_RULES.QUIZ_PERFECT;
      if (user?.id) await awardBadge(user.id, 'quiz_ace');
    }
    setXpGained(xp);
    if (user?.id) await awardXP(user.id, xp);

    // Save to Supabase quiz_results table
    if (user?.id) {
      const accuracy = Math.round((correct / totalQ) * 100);
      await supabase.from('quiz_results').insert({
        user_id: user.id,
        quiz_id: quiz?.id || dayId || 'daily',
        score: correct,
        total: totalQ,
        accuracy_percent: accuracy,
        answers: finalAnswers,
        completed_at: new Date().toISOString(),
      }).catch(console.error);

      // Update user quiz_data aggregate
      const qd = profile?.quiz_data || { totalScore: 0, totalAttempts: 0, accuracyPercent: 0, history: [] };
      const newAttempts = (qd.totalAttempts || 0) + 1;
      const newScore    = (qd.totalScore    || 0) + correct;
      const newAccuracy = Math.round(newScore / (newAttempts * totalQ) * 100);
      await supabase.from('users').update({
        quiz_data: {
          ...qd,
          totalScore: newScore,
          totalAttempts: newAttempts,
          accuracyPercent: newAccuracy,
          history: [...(qd.history || []).slice(-19), { score: correct, total: totalQ, date: new Date().toISOString() }],
        }
      }).eq('uid', user.id).catch(console.error);
    }

    setShowResults(true);
    refreshProfile?.();
  };

  const handleRetry = () => {
    setCurrent(0);
    setAnswers({});
    setSelected(null);
    setSubmitted(false);
    setScore(0);
    setXpGained(0);
    setShowResults(false);
  };

  if (loading) {
    return (
      <div className="app-layout">
        <Sidebar user={user} profile={profile} onLogout={onLogout} />
        <main className="main-content">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 20 }}>
            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading quiz...</p>
          </div>
        </main>
      </div>
    );
  }

  // ── Results Screen ─────────────────────────────────────────────────────────
  if (showResults) {
    const pct = Math.round((score / totalQ) * 100);
    const passed = score >= Math.ceil(totalQ * 0.6);

    return (
      <div className="app-layout">
        <Sidebar user={user} profile={profile} onLogout={onLogout} />
        <main className="main-content">
          <div className="page-container" style={{ maxWidth: 700 }}>

            {/* Score Header */}
            <div className="card-neon animate-slide" style={{ textAlign: 'center', padding: '48px 40px', marginBottom: 28 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>{passed ? '🎉' : '📚'}</div>
              <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>
                {passed ? 'Well Done!' : 'Keep Practicing!'}
              </h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 16 }}>
                You scored {score} out of {totalQ}
              </p>

              {/* Score Ring */}
              <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 28px' }}>
                <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="50" fill="none"
                    stroke={pct >= 70 ? 'var(--safe)' : pct >= 40 ? 'var(--suspicious)' : 'var(--malicious)'}
                    strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <span style={{ fontSize: 24, fontWeight: 900 }}>{pct}%</span>
                </div>
              </div>

              <div className="badge badge-primary" style={{ fontSize: 15, padding: '10px 24px' }}>
                +{xpGained} XP earned
              </div>
            </div>

            {/* Question Review */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
              {questions.map((q, qi) => {
                const userAns = answers[qi];
                const correct = userAns === q.correctIndex;
                return (
                  <div key={qi} className="card" style={{ border: `1px solid ${correct ? 'rgba(0,230,118,0.25)' : 'rgba(255,61,87,0.25)'}` }}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                      {correct
                        ? <CheckCircle size={20} color="var(--safe)" />
                        : <XCircle size={20} color="var(--malicious)" />
                      }
                      <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Q{qi + 1}: {q.question}</span>
                    </div>
                    <div style={{ fontSize: 13, color: correct ? 'var(--safe)' : 'var(--malicious)', marginBottom: 8 }}>
                      Your answer: {q.options?.[userAns] ?? 'No answer'}
                    </div>
                    {!correct && (
                      <div style={{ fontSize: 13, color: 'var(--safe)' }}>
                        Correct: {q.options?.[q.correctIndex]}
                      </div>
                    )}
                    {q.explanation && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, padding: '10px 14px', background: 'var(--surface)', borderRadius: 10 }}>
                        💡 {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => navigate('/dashboard')} className="btn btn-outline" style={{ flex: 1 }}>
                <Home size={16} /> Dashboard
              </button>
              {!passed && (
                <button onClick={handleRetry} className="btn btn-primary" style={{ flex: 1 }}>
                  <RotateCcw size={16} /> Try Again
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Question Screen ────────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      <Sidebar user={user} profile={profile} onLogout={onLogout} />
      <main className="main-content">
        <div className="page-container" style={{ maxWidth: 700 }}>

          {/* Progress */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
              <span style={{ fontWeight: 700 }}>Question {current + 1} of {totalQ}</span>
              <span className="badge badge-primary">+{XP_RULES.COMPLETE_QUIZ} XP on completion</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${((current) / totalQ) * 100}%` }} />
            </div>
          </div>

          {/* Question */}
          {currentQ && (
            <div className="card-neon animate-slide" style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.5, marginBottom: 32 }}>
                {currentQ.question}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(currentQ.options || []).map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(idx)}
                    style={{
                      background: selected === idx ? 'var(--primary-dim)' : 'var(--surface)',
                      border: `2px solid ${selected === idx ? 'var(--primary)' : 'var(--glass-border)'}`,
                      borderRadius: 14,
                      padding: '16px 20px',
                      textAlign: 'left',
                      color: selected === idx ? 'var(--primary)' : 'var(--text)',
                      cursor: 'pointer',
                      fontSize: 15,
                      fontWeight: selected === idx ? 700 : 500,
                      fontFamily: 'inherit',
                      transition: 'var(--transition)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                    }}
                  >
                    <span style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: selected === idx ? 'var(--primary)' : 'var(--surface-light)',
                      color: selected === idx ? '#000' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800,
                    }}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>

              <button
                onClick={handleNext}
                disabled={selected === null}
                className="btn btn-primary btn-full"
                style={{ marginTop: 28, height: 52, fontSize: 15 }}
              >
                {current + 1 < totalQ ? <>Next <ChevronRight size={18} /></> : <>Submit Quiz <Trophy size={18} /></>}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
