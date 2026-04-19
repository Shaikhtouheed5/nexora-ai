/**
 * QuizEngine.jsx — Reusable full-screen quiz component
 *
 * Props:
 *   questions   — array of { id, question, options[], correctIndex, explanation }
 *   lessonId    — string  e.g. 'day-1'
 *   category    — string  e.g. 'INTRODUCTION TO PHISHING'
 *   user        — Supabase user object
 *   onComplete  — optional callback(correctCount, xpEarned)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Trophy, RotateCcw, ArrowRight, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { awardXP, XP_RULES } from '../lib/gamificationService';

const LABELS = ['A', 'B', 'C', 'D'];

// ─── Colour constants ──────────────────────────────────────────────────────────
const C = {
  bg:      '#0a0f1a',
  card:    '#0e1524',
  opt:     '#111820',
  cyan:    '#00e5ff',
  green:   '#00c896',
  red:     '#e05252',
  white:   '#E8F4F8',
  muted:   '#546A7D',
  sub:     '#94A9BC',
};

// ─── Option card styling helpers ───────────────────────────────────────────────
function getCardStyle(idx, answered, selectedIdx, correctIndex) {
  if (!answered) {
    return { background: C.opt, border: `1.5px solid rgba(255,255,255,0.08)` };
  }
  if (idx === correctIndex) {
    return { background: 'rgba(0,200,150,0.12)', border: `1.5px solid ${C.green}` };
  }
  if (idx === selectedIdx) {
    return { background: 'rgba(224,82,82,0.1)', border: `1.5px solid ${C.red}` };
  }
  return { background: C.opt, border: '1.5px solid rgba(255,255,255,0.04)' };
}

function getBadgeStyle(idx, answered, selectedIdx, correctIndex) {
  if (!answered) return { background: 'rgba(255,255,255,0.06)', color: C.muted };
  if (idx === correctIndex) return { background: C.green, color: '#000' };
  if (idx === selectedIdx) return { background: C.red, color: '#fff' };
  return { background: 'rgba(255,255,255,0.04)', color: C.muted };
}

function getTextColor(idx, answered, selectedIdx, correctIndex) {
  if (!answered) return C.white;
  if (idx === correctIndex) return C.green;
  if (idx === selectedIdx) return C.red;
  return C.muted;
}

// ─── XP helper ────────────────────────────────────────────────────────────────
const getXP = (correct, total) => {
  const pct = (correct / total) * 100;
  if (pct >= 90) return 100;
  if (pct >= 70) return 75;
  if (pct >= 50) return 50;
  if (pct >= 30) return 25;
  return 10;
};

// ─── Results Screen ────────────────────────────────────────────────────────────
function ResultsScreen({ correctCount, totalQ, xpEarned, onRetry }) {
  const navigate = useNavigate();
  const pct   = Math.round((correctCount / totalQ) * 100);
  const wrong = totalQ - correctCount;
  const title =
    pct === 100 ? 'Perfect Score!' :
    pct >= 60   ? 'Quiz Complete!' :
                  'Keep Practicing!';
  const emoji = pct === 100 ? '🏆' : pct >= 60 ? '🎉' : '📚';

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ maxWidth: 560, width: '100%' }}>
        <div style={{
          background: C.card, borderRadius: 24, padding: '48px 40px',
          border: `1px solid rgba(0,229,255,0.15)`,
          boxShadow: '0 0 60px rgba(0,229,255,0.04)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>{emoji}</div>

          <h1 style={{ fontSize: 32, fontWeight: 900, color: C.white, marginBottom: 8 }}>
            {title}
          </h1>
          <p style={{ color: C.muted, fontSize: 15, marginBottom: 32 }}>
            You answered {correctCount} of {totalQ} questions correctly
          </p>

          {/* XP badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,229,255,0.08)', border: `1px solid rgba(0,229,255,0.3)`,
            borderRadius: 50, padding: '10px 28px', marginBottom: 36,
            fontSize: 20, fontWeight: 800, color: C.cyan,
          }}>
            <Trophy size={20} /> +{xpEarned} XP
          </div>

          {/* Score breakdown */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 40 }}>
            {[
              { value: correctCount, label: 'CORRECT', color: C.green, bg: 'rgba(0,200,150,0.1)', border: 'rgba(0,200,150,0.25)' },
              { value: wrong,        label: 'WRONG',   color: C.red,   bg: 'rgba(224,82,82,0.1)', border: 'rgba(224,82,82,0.25)' },
              { value: `${pct}%`,    label: 'SCORE',   color: C.cyan,  bg: 'rgba(0,229,255,0.08)', border: 'rgba(0,229,255,0.2)' },
            ].map(({ value, label, color, bg, border }) => (
              <div key={label} style={{
                background: bg, border: `1px solid ${border}`, borderRadius: 16,
                padding: '20px 24px', flex: 1,
              }}>
                <div style={{ fontSize: 30, fontWeight: 900, color }}>{value}</div>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 800, marginTop: 4, letterSpacing: 1 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onRetry}
              style={{
                flex: 1, height: 52, borderRadius: 14, cursor: 'pointer',
                background: 'transparent', border: `1.5px solid rgba(0,229,255,0.3)`,
                color: C.cyan, fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <RotateCcw size={16} /> Retry
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                flex: 1, height: 52, borderRadius: 14, cursor: 'pointer',
                background: C.cyan, border: 'none',
                color: '#000', fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Home size={16} /> Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main QuizEngine ───────────────────────────────────────────────────────────
export default function QuizEngine({ questions = [], lessonId, category, user, onComplete }) {
  const [current,      setCurrent]      = useState(0);
  const [answered,     setAnswered]     = useState(false);
  const [selectedIdx,  setSelectedIdx]  = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showResults,  setShowResults]  = useState(false);
  const [xpEarned,     setXpEarned]     = useState(0);
  const [saving,       setSaving]       = useState(false);

  const totalQ    = questions.length;
  const currentQ  = questions[current];
  const progress  = answered
    ? ((current + 1) / totalQ) * 100
    : (current / totalQ) * 100;

  // ── Select answer ────────────────────────────────────────────────────────────
  const handleSelect = (idx) => {
    if (answered) return;
    setSelectedIdx(idx);
    setAnswered(true);
    if (idx === currentQ.correctIndex) setCorrectCount(c => c + 1);
  };

  // ── Advance or finish ────────────────────────────────────────────────────────
  const handleNext = async () => {
    if (current + 1 < totalQ) {
      setCurrent(c => c + 1);
      setAnswered(false);
      setSelectedIdx(null);
      return;
    }

    // Last question — save and show results
    setSaving(true);
    const finalCorrect = correctCount; // already incremented by handleSelect
    const earned = getXP(finalCorrect, totalQ);
    setXpEarned(earned);

    if (user?.id) {
      try {
        // Award XP
        try { await awardXP(user.id, earned); } catch { /* non-critical */ }

        // Mark lesson complete
        if (lessonId) {
          try {
            await supabase
              .from('user_lessons')
              .upsert(
                { user_id: user.id, lesson_id: lessonId, completed: true, completed_at: new Date().toISOString() },
                { onConflict: 'user_id,lesson_id' }
              );
          } catch { /* non-critical */ }
        }

        // Save quiz result
        try {
          await supabase
            .from('quiz_results')
            .insert({
              user_id: user.id,
              quiz_id: lessonId || 'day-1',
              score: finalCorrect,
              total: totalQ,
              accuracy_percent: Math.round((finalCorrect / totalQ) * 100),
              completed_at: new Date().toISOString(),
            });
        } catch { /* non-critical */ }
      } catch (e) {
        console.error('[QuizEngine] Failed to save result:', e);
      }
    }

    setSaving(false);
    setShowResults(true);
    onComplete?.(finalCorrect, earned);
  };

  // ── Retry ────────────────────────────────────────────────────────────────────
  const handleRetry = () => {
    setCurrent(0);
    setAnswered(false);
    setSelectedIdx(null);
    setCorrectCount(0);
    setShowResults(false);
    setXpEarned(0);
  };

  // ── Results ──────────────────────────────────────────────────────────────────
  if (showResults) {
    return (
      <ResultsScreen
        correctCount={correctCount}
        totalQ={totalQ}
        xpEarned={xpEarned}
        onRetry={handleRetry}
      />
    );
  }

  if (!currentQ) return null;

  const isLast = current + 1 === totalQ;

  // ── Quiz screen ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px 0', position: 'sticky', top: 0, background: C.bg, zIndex: 10 }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.cyan }}>
              Question {current + 1} of {totalQ}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 800, color: C.cyan, letterSpacing: 1,
              border: `1px solid rgba(0,229,255,0.35)`, borderRadius: 50,
              padding: '5px 16px',
            }}>
              + XP ON COMPLETION
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 2 }}>
            <div style={{
              height: '100%', background: C.cyan, borderRadius: 2,
              width: `${progress}%`, transition: 'width 0.5s cubic-bezier(.4,0,.2,1)',
              boxShadow: `0 0 8px rgba(0,229,255,0.6)`,
            }} />
          </div>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '36px 24px 48px' }}>
        <div style={{ maxWidth: 720, width: '100%' }}>

          {/* Category label */}
          <p style={{
            fontSize: 11, fontWeight: 800, color: C.cyan,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 18,
            opacity: 0.75,
          }}>
            DAY {lessonId?.replace('day-', '') || '1'} · {category || 'INTRODUCTION TO PHISHING'}
          </p>

          {/* Question */}
          <h2 style={{
            fontSize: 28, fontWeight: 500, color: C.white,
            lineHeight: 1.45, marginBottom: 36,
          }}>
            {currentQ.question}
          </h2>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {currentQ.options.map((opt, idx) => {
              const cardStyle  = getCardStyle(idx, answered, selectedIdx, currentQ.correctIndex);
              const badgeStyle = getBadgeStyle(idx, answered, selectedIdx, currentQ.correctIndex);
              const textColor  = getTextColor(idx, answered, selectedIdx, currentQ.correctIndex);

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={answered}
                  style={{
                    ...cardStyle,
                    borderRadius: 14, padding: '15px 18px',
                    cursor: answered ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 14,
                    fontFamily: 'inherit', width: '100%', textAlign: 'left',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={e => {
                    if (!answered) {
                      e.currentTarget.style.borderColor = `rgba(0,229,255,0.55)`;
                      e.currentTarget.style.boxShadow  = '0 0 16px rgba(0,229,255,0.08)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!answered) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.boxShadow  = 'none';
                    }
                  }}
                >
                  {/* Key badge */}
                  <span style={{
                    ...badgeStyle,
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, transition: 'all 0.18s',
                  }}>
                    {LABELS[idx]}
                  </span>

                  {/* Option text */}
                  <span style={{ fontSize: 15, fontWeight: 500, color: textColor, flex: 1, lineHeight: 1.4 }}>
                    {opt}
                  </span>

                  {/* Result icon */}
                  {answered && idx === currentQ.correctIndex && (
                    <CheckCircle size={18} color={C.green} style={{ flexShrink: 0 }} />
                  )}
                  {answered && idx === selectedIdx && idx !== currentQ.correctIndex && (
                    <XCircle size={18} color={C.red} style={{ flexShrink: 0 }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Feedback explanation */}
          {answered && currentQ.explanation && (
            <div style={{
              background: 'rgba(0,229,255,0.04)',
              border: `1px solid rgba(0,229,255,0.14)`,
              borderRadius: 14, padding: '16px 20px', marginBottom: 20,
              display: 'flex', gap: 12, alignItems: 'flex-start',
              animation: 'fadeIn 0.25s ease',
            }}>
              <span style={{ fontSize: 17, flexShrink: 0, marginTop: 1 }}>💡</span>
              <p style={{ color: C.sub, fontSize: 14, lineHeight: 1.65, margin: 0 }}>
                {currentQ.explanation}
              </p>
            </div>
          )}

          {/* Next / See Results button */}
          {answered && (
            <button
              onClick={handleNext}
              disabled={saving}
              style={{
                width: '100%', height: 56, borderRadius: 16,
                background: C.cyan, border: 'none',
                color: '#000', fontSize: 16, fontWeight: 800, fontFamily: 'inherit',
                cursor: saving ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: `0 4px 24px rgba(0,229,255,0.25)`,
                animation: 'fadeIn 0.2s ease',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : isLast ? (
                <><Trophy size={20} /> See Results</>
              ) : (
                <>Next Question <ArrowRight size={20} /></>
              )}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
