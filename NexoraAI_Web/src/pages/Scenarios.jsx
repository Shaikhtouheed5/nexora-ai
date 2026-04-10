import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { supabase } from '../lib/supabase';
import { awardXP, XP_RULES } from '../lib/gamificationService';
import { CheckCircle, AlertTriangle, MessageSquare, Mail, Phone } from 'lucide-react';

// Hard-coded scenario bank (extend via Supabase 'scenarios' table in production)
const SCENARIO_BANK = [
  {
    id: 's1',
    type: 'sms',
    sender: 'SBI BANK',
    content: 'URGENT: Your account has been blocked due to suspicious activity. Click here to reactivate: http://sbi-secure-login.xyz/verify',
    isPhishing: true,
    redFlags: ['Unknown shortened URL', 'Urgency language', 'Bank impersonation', 'Unofficial domain (.xyz)'],
    explanation: 'Legitimate banks NEVER send reactivation links via SMS. The domain "sbi-secure-login.xyz" is not an official SBI domain.',
  },
  {
    id: 's2',
    type: 'email',
    sender: 'noreply@amazon.com',
    content: 'Your Amazon order #405-2938472 has been shipped. Expected delivery: April 5, 2026. Track your package at amazon.com/orders.',
    isPhishing: false,
    redFlags: [],
    explanation: 'This is a legitimate Amazon shipping notification. The sender is the official amazon.com domain, no suspicious link, no urgency pressure.',
  },
  {
    id: 's3',
    type: 'whatsapp',
    sender: '+91 9876543210',
    content: 'Congratulations! You\'ve won a Rs.50,000 gift card from Flipkart. Share your OTP 8472 to claim your prize now!',
    isPhishing: true,
    redFlags: ['Unsolicited prize claim', 'Requesting OTP — NEVER share OTP', 'Unknown sender', 'Social engineering'],
    explanation: 'This is a classic OTP theft scam. No legitimate company will ever ask you to share an OTP via WhatsApp. The "prize" is bait.',
  },
  {
    id: 's4',
    type: 'sms',
    sender: 'HDFC BANK',
    content: 'INR 2,500.00 debited from A/c XX1234 on 02-Apr-26. UPI Ref: 432981742. Avl Bal: INR 18,432.50. Not you? Call 1800-266-4332.',
    isPhishing: false,
    redFlags: [],
    explanation: 'Legitimate bank transaction alert. Contains partial account number, real reference number, and official helpline (verify independently). No links.',
  },
  {
    id: 's5',
    type: 'email',
    sender: 'security-alert@g00gl3-accounts.com',
    content: 'We detected unusual sign-in activity on your Google account. Verify your identity immediately to avoid account suspension: http://g00gle-verify.net/secure',
    isPhishing: true,
    redFlags: ['Typosquatted sender domain (g00gl3)', 'Suspicious link (.net not google.com)', 'Account suspension threat', 'Urgency language'],
    explanation: 'The sender domain uses zeros instead of "oo" in Google — a classic typosquatting tactic. Real Google alerts come from accounts.google.com.',
  },
  {
    id: 's6',
    type: 'whatsapp',
    sender: 'Swiggy',
    content: 'Your Swiggy order from McDonald\'s is on the way! ETA: 25 mins. Track: swiggy.com/track/O-293847',
    isPhishing: false,
    redFlags: [],
    explanation: 'Legitimate food delivery notification using the official swiggy.com domain. No personal info requested, no urgency, no suspicious links.',
  },
];

const TYPE_ICONS = { sms: Phone, email: Mail, whatsapp: MessageSquare };

export default function Scenarios({ user, profile, onLogout, refreshProfile }) {
  const [current, setCurrent]     = useState(0);
  const [answered, setAnswered]   = useState({});
  const [showResult, setShowResult] = useState(false);
  const [score, setScore]         = useState(0);
  const [done, setDone]           = useState(false);

  const scenario = SCENARIO_BANK[current];
  const TypeIcon = TYPE_ICONS[scenario?.type] || MessageSquare;
  const totalDone = Object.keys(answered).length;

  const handleAnswer = async (userSaidPhishing) => {
    if (answered[current] !== undefined) return;
    const correct = userSaidPhishing === scenario.isPhishing;
    const newAnswered = { ...answered, [current]: { userSaidPhishing, correct } };
    setAnswered(newAnswered);

    if (correct && user?.id) {
      await awardXP(user.id, XP_RULES.SCENARIO_CORRECT);
      refreshProfile?.();
      setScore(s => s + 1);
    }

    setShowResult(true);
  };

  const handleNext = () => {
    setShowResult(false);
    if (current + 1 < SCENARIO_BANK.length) {
      setCurrent(current + 1);
    } else {
      setDone(true);
    }
  };

  const handleRestart = () => {
    setCurrent(0);
    setAnswered({});
    setShowResult(false);
    setScore(0);
    setDone(false);
  };

  if (done) {
    const pct = Math.round((score / SCENARIO_BANK.length) * 100);
    return (
      <div className="app-layout">
        <Sidebar user={user} profile={profile} onLogout={onLogout} />
        <main className="main-content">
          <div className="page-container" style={{ maxWidth: 600, textAlign: 'center' }}>
            <div className="card-neon animate-slide" style={{ padding: 48 }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>{pct >= 70 ? '🛡️' : '📚'}</div>
              <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 12 }}>Scenario Training Complete!</h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: 28 }}>
                You identified <strong style={{ color: 'var(--primary)' }}>{score} out of {SCENARIO_BANK.length}</strong> scenarios correctly.
              </p>
              <div style={{ fontSize: 56, fontWeight: 900, color: pct >= 70 ? 'var(--safe)' : 'var(--suspicious)', marginBottom: 28 }}>
                {pct}%
              </div>
              <div className="badge badge-primary" style={{ fontSize: 15, padding: '10px 24px', marginBottom: 28 }}>
                +{score * XP_RULES.SCENARIO_CORRECT} XP earned
              </div>
              <button onClick={handleRestart} className="btn btn-primary btn-lg btn-full">
                Train Again
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar user={user} profile={profile} onLogout={onLogout} />
      <main className="main-content">
        <div className="page-container" style={{ maxWidth: 680 }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Scenario Training</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
              Identify if the message below is phishing or legitimate. Train your instincts.
            </p>
          </div>

          {/* Progress */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>Scenario {current + 1} of {SCENARIO_BANK.length}</span>
            <span>{score} correct  ·  +{score * XP_RULES.SCENARIO_CORRECT} XP earned</span>
          </div>
          <div className="progress-bar" style={{ marginBottom: 28 }}>
            <div className="progress-fill" style={{ width: `${(current / SCENARIO_BANK.length) * 100}%` }} />
          </div>

          {/* Scenario Card */}
          <div className="card-neon animate-slide" style={{ marginBottom: 24 }}>
            {/* Type badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-dim)', border: '1px solid var(--glass-border-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TypeIcon size={18} color="var(--primary)" />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{scenario.type} message</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>From: {scenario.sender}</div>
              </div>
            </div>

            {/* Message Content */}
            <div style={{
              background: 'var(--bg-dark)',
              border: '1px solid var(--glass-border)',
              borderRadius: 14,
              padding: '20px 22px',
              fontSize: 15,
              lineHeight: 1.7,
              color: 'var(--text)',
              fontFamily: scenario.type === 'sms' ? 'monospace' : 'inherit',
              marginBottom: 28,
            }}>
              {scenario.content}
            </div>

            {/* Answer Buttons */}
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
                {/* Result Banner */}
                <div className={`alert ${answered[current]?.correct ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 20, fontSize: 15 }}>
                  {answered[current]?.correct
                    ? <><CheckCircle size={18} /> Correct! +{XP_RULES.SCENARIO_CORRECT} XP</>
                    : <><AlertTriangle size={18} /> Incorrect. This was {scenario.isPhishing ? 'a phishing message' : 'a legitimate message'}.</>
                  }
                </div>

                {/* Red Flags */}
                {scenario.redFlags.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Red Flags Detected</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {scenario.redFlags.map(f => (
                        <span key={f} className="badge badge-malicious">{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Explanation */}
                <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  💡 {scenario.explanation}
                </div>

                <button onClick={handleNext} className="btn btn-primary btn-full" style={{ height: 52, fontSize: 15 }}>
                  {current + 1 < SCENARIO_BANK.length ? 'Next Scenario →' : 'See Results'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
