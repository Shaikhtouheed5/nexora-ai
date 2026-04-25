import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { awardXP, XP_RULES } from '../lib/gamificationService';
import { CheckCircle, AlertTriangle, MessageSquare, RefreshCw, Sparkles } from 'lucide-react';

const SCANNER_BASE = 'https://nexora-scanner.onrender.com';

const DIFFICULTY_BADGE = {
  easy:   { color: '#00c896', bg: 'rgba(0,200,150,0.12)', border: 'rgba(0,200,150,0.3)', label: 'Easy' },
  medium: { color: '#FFB300', bg: 'rgba(255,179,0,0.12)', border: 'rgba(255,179,0,0.3)',  label: 'Medium' },
  hard:   { color: '#FF3D57', bg: 'rgba(255,61,87,0.12)', border: 'rgba(255,61,87,0.3)',  label: 'Hard' },
};

async function fetchScenarios(count = 6, difficulty = 'mixed') {
  const res = await fetch(`${SCANNER_BASE}/generate-scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count, difficulty }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  console.log('[Scenarios] raw API response:', JSON.stringify(data, null, 2));
  return data.scenarios || [];
}

export default function Scenarios({ user, profile, onLogout, refreshProfile }) {
  const [scenarios, setScenarios]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState(null);
  const [current, setCurrent]         = useState(0);
  const [answered, setAnswered]       = useState({});
  const [showResult, setShowResult]   = useState(false);
  const [score, setScore]             = useState(0);
  const [done, setDone]               = useState(false);
  const [refreshing, setRefreshing]   = useState(false);

  const loadScenarios = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    try {
      const data = await fetchScenarios(6, 'mixed');
      setScenarios(data);
      setCurrent(0);
      setAnswered({});
      setShowResult(false);
      setScore(0);
      setDone(false);
    } catch (e) {
      setLoadError('Could not load scenarios. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadScenarios(); }, [loadScenarios]);

  const scenario = scenarios[current];
  const diff = DIFFICULTY_BADGE[scenario?.difficulty] || DIFFICULTY_BADGE.medium;

  const handleAnswer = async (userSaidPhishing) => {
    if (answered[current] !== undefined) return;
    const correct = userSaidPhishing === scenario.isPhishing;
    setAnswered(prev => ({ ...prev, [current]: { userSaidPhishing, correct } }));

    if (correct && user?.id) {
      await awardXP(user.id, XP_RULES.SCENARIO_CORRECT).catch((e) => console.error('[Scenarios] awardXP failed:', e.message));
      refreshProfile?.();
      setScore(s => s + 1);
    }
    setShowResult(true);
  };

  const handleNext = () => {
    setShowResult(false);
    if (current + 1 < scenarios.length) {
      setCurrent(current + 1);
    } else {
      setDone(true);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="app-layout">
        <Sidebar user={user} profile={profile} onLogout={onLogout} />
        <main className="main-content">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 20 }}>
            <div style={{ position: 'relative', width: 60, height: 60 }}>
              <div className="spinner" style={{ width: 60, height: 60, borderWidth: 3 }} />
              <Sparkles size={22} color="var(--primary)" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, fontWeight: 600 }}>Generating scenarios with AI…</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Powered by Groq · Indian context included</p>
          </div>
        </main>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="app-layout">
        <Sidebar user={user} profile={profile} onLogout={onLogout} />
        <main className="main-content">
          <div className="page-container" style={{ maxWidth: 600, textAlign: 'center', paddingTop: 80 }}>
            <AlertTriangle size={48} color="var(--danger)" style={{ marginBottom: 20 }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Failed to Load Scenarios</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 28 }}>{loadError}</p>
            <button onClick={() => loadScenarios()} className="btn btn-primary">
              <RefreshCw size={16} /> Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (done) {
    const pct = Math.round((score / scenarios.length) * 100);
    return (
      <div className="app-layout">
        <Sidebar user={user} profile={profile} onLogout={onLogout} />
        <main className="main-content">
          <div className="page-container" style={{ maxWidth: 600, textAlign: 'center' }}>
            <div className="card-neon animate-slide" style={{ padding: 48 }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>{pct >= 70 ? '🛡️' : '📚'}</div>
              <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 12 }}>Round Complete!</h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                You identified <strong style={{ color: 'var(--primary)' }}>{score} of {scenarios.length}</strong> scenarios correctly.
              </p>
              <div style={{ fontSize: 56, fontWeight: 900, color: pct >= 70 ? 'var(--safe)' : 'var(--suspicious)', marginBottom: 20 }}>
                {pct}%
              </div>
              <div className="badge badge-primary" style={{ fontSize: 15, padding: '10px 24px', marginBottom: 32 }}>
                +{score * (XP_RULES.SCENARIO_CORRECT || 10)} XP earned
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => loadScenarios(true)}
                  disabled={refreshing}
                  className="btn btn-primary btn-lg"
                  style={{ flex: 1 }}
                >
                  {refreshing
                    ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Generating…</>
                    : <><Sparkles size={18} /> New AI Scenarios</>}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Main quiz ────────────────────────────────────────────────────────────────
  console.log(`[Scenarios] current scenario (index ${current}):`, JSON.stringify(scenario, null, 2));
  return (
    <div className="app-layout">
      <Sidebar user={user} profile={profile} onLogout={onLogout} />
      <main className="main-content">
        <div className="page-container" style={{ maxWidth: 680 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Scenario Training</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                Identify if the message below is phishing or legitimate.
              </p>
            </div>
            <button
              onClick={() => loadScenarios(true)}
              disabled={refreshing}
              className="btn btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, whiteSpace: 'nowrap' }}
              title="Fetch fresh AI-generated scenarios"
            >
              <RefreshCw size={14} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {/* Progress */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>Scenario {current + 1} of {scenarios.length}</span>
            <span>{score} correct · +{score * (XP_RULES.SCENARIO_CORRECT || 10)} XP</span>
          </div>
          <div className="progress-bar" style={{ marginBottom: 28 }}>
            <div className="progress-fill" style={{ width: `${(current / scenarios.length) * 100}%` }} />
          </div>

          {/* Scenario Card */}
          <div className="card-neon animate-slide" style={{ marginBottom: 24 }}>

            {/* Header row: sender + difficulty badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-dim)', border: '1px solid var(--glass-border-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={18} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>SMS message</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>From: {scenario.sender}</div>
                </div>
              </div>

              {/* Difficulty badge */}
              <span style={{
                fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20,
                color: diff.color, background: diff.bg, border: `1px solid ${diff.border}`,
                letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                {diff.label}
              </span>
            </div>

            {/* Message bubble */}
            <div style={{
              background: 'var(--bg-dark)', border: '1px solid var(--glass-border)',
              borderRadius: 14, padding: '20px 22px', fontSize: 15,
              lineHeight: 1.7, color: 'var(--text)', fontFamily: 'monospace',
              marginBottom: 28, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {scenario.message}
            </div>

            {/* Answer buttons / Result */}
            {!showResult ? (
              <div style={{ display: 'flex', gap: 14 }}>
                <button
                  onClick={() => handleAnswer(false)}
                  className="btn"
                  style={{ flex: 1, background: 'var(--safe-dim)', color: 'var(--safe)', border: '1px solid rgba(0,230,118,0.25)', fontSize: 16, height: 56 }}
                >
                  ✅ Safe
                </button>
                <button
                  onClick={() => handleAnswer(true)}
                  className="btn"
                  style={{ flex: 1, background: 'var(--malicious-dim)', color: 'var(--malicious)', border: '1px solid rgba(255,61,87,0.25)', fontSize: 16, height: 56 }}
                >
                  ⚠️ Phishing
                </button>
              </div>
            ) : (
              <div className="animate-fade">
                {/* Result banner */}
                <div className={`alert ${answered[current]?.correct ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 20, fontSize: 15 }}>
                  {answered[current]?.correct
                    ? <><CheckCircle size={18} /> Correct! +{XP_RULES.SCENARIO_CORRECT || 10} XP</>
                    : <><AlertTriangle size={18} /> Incorrect — this was {scenario.isPhishing ? 'a phishing message' : 'a legitimate message'}.</>}
                </div>

                {/* Explanation */}
                <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '14px 18px', marginBottom: 14, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  💡 {scenario.explanation}
                </div>

                {/* Red flags */}
                {scenario.red_flags?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#FF3D57', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                      Red flags
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {scenario.red_flags.map((flag, i) => (
                        <span key={i} style={{
                          fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: 'rgba(255,61,87,0.12)', color: '#FF3D57',
                          border: '1px solid rgba(255,61,87,0.3)',
                        }}>
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trust signals */}
                {scenario.trust_signals?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#00c896', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                      Trust signals
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {scenario.trust_signals.map((signal, i) => (
                        <span key={i} style={{
                          fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: 'rgba(0,200,150,0.12)', color: '#00c896',
                          border: '1px solid rgba(0,200,150,0.3)',
                        }}>
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={handleNext} className="btn btn-primary btn-full" style={{ height: 52, fontSize: 15 }}>
                  {current + 1 < scenarios.length ? 'Next Scenario →' : '🏁 See Results'}
                </button>
              </div>
            )}
          </div>

          {/* AI badge */}
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Sparkles size={12} color="var(--primary)" />
            Scenarios generated by Groq AI · Indian cybersecurity context
          </div>

        </div>
      </main>
    </div>
  );
}
