import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { ChevronDown, ChevronUp, Github, ExternalLink, Send, Mail, User, MessageSquare } from 'lucide-react';

const FAQS = [
  {
    q: 'What is Nexora AI?',
    a: 'Nexora AI is an AI-powered cybersecurity training platform that helps you identify phishing attacks, social engineering scams, and other cyber threats through interactive lessons, quizzes, and real-time message scanning.'
  },
  {
    q: 'How does the message scanner work?',
    a: 'The scanner uses a machine learning model trained on thousands of phishing and legitimate messages. It analyzes patterns like urgency language, suspicious links, impersonation cues, and unusual sender behavior to assign a risk score.'
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. All authentication is handled via Supabase with row-level security policies. Your messages are analyzed on our secured backend and are never stored without your consent. Communication is encrypted end-to-end.'
  },
  {
    q: 'How do I earn XP and badges?',
    a: 'You earn XP by completing lessons (+100 XP), finishing quizzes (+50 XP), scoring perfectly (+100 bonus XP), maintaining daily streaks (+30 XP/day), and correctly identifying scenarios (+30 XP each). Badges are unlocked by hitting specific milestones.'
  },
  {
    q: 'Can I use the scanner on my mobile phone?',
    a: 'Yes! Download the Nexora AI mobile app (Android/iOS). The mobile app can scan your SMS inbox directly, monitor incoming messages in real-time, and give you instant threat alerts.'
  },
  {
    q: 'What happens if I lose my streak?',
    a: 'Your streak resets to 1 if you miss a day of activity. We recommend enabling daily reminder notifications (in Settings) to keep your streak alive. Once you hit a 7-day streak, you earn a bonus +200 XP and the Week Warrior badge.'
  },
  {
    q: 'How do I report a false positive or false negative?',
    a: 'On the scan results screen, you\'ll find a "Report as False Positive" button. Your feedback is collected and used to improve the model over time. You can also contact us via the form below.'
  },
];

export default function HelpCenter({ user, profile, onLogout }) {
  const [openFaq, setOpenFaq]   = useState(null);
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState(user?.email || '');
  const [message, setMessage]   = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    // TODO: connect to a contact/support Supabase table or email service
    await new Promise(r => setTimeout(r, 1000));
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <div className="app-layout">
      <Sidebar user={user} profile={profile} onLogout={onLogout} />
      <main className="main-content">
        <div className="page-container" style={{ maxWidth: 760 }}>

          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Help Center</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 40 }}>
            Find answers to common questions or reach out to our team.
          </p>

          {/* ── FAQ ── */}
          <div style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Frequently Asked Questions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {FAQS.map((faq, i) => (
                <div key={i} className="card" style={{ padding: '20px 24px', cursor: 'pointer', transition: 'var(--transition)' }}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{faq.q}</span>
                    {openFaq === i ? <ChevronUp size={18} color="var(--primary)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                  </div>
                  {openFaq === i && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--glass-border)' }}>
                      {faq.a}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Contact Form ── */}
          <div className="card-neon" style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Contact Support</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
              Can't find your answer? Send us a message and we'll get back to you within 24 hours.
            </p>

            {submitted ? (
              <div className="alert alert-success" style={{ justifyContent: 'center', padding: 24 }}>
                ✅ Message sent! We'll respond to {email} shortly.
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Your Name</label>
                    <div className="input-wrapper">
                      <User size={15} style={{ position: 'absolute', left: 14, color: 'var(--text-muted)', zIndex: 1 }} />
                      <input type="text" className="form-input" style={{ paddingLeft: 40 }}
                        placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <div className="input-wrapper">
                      <Mail size={15} style={{ position: 'absolute', left: 14, color: 'var(--text-muted)', zIndex: 1 }} />
                      <input type="email" className="form-input" style={{ paddingLeft: 40 }}
                        placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Your Message</label>
                  <textarea className="form-input" rows={5} style={{ resize: 'vertical', lineHeight: 1.6 }}
                    placeholder="Describe your issue or question in detail..."
                    value={message} onChange={e => setMessage(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ alignSelf: 'flex-start', padding: '12px 28px' }}>
                  {submitting ? <span className="spinner" /> : <><Send size={16} /> Send Message</>}
                </button>
              </form>
            )}
          </div>

          {/* ── Links ── */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
              <Github size={16} /> GitHub Repository
            </a>
            <a href="#" className="btn btn-ghost btn-sm">
              <ExternalLink size={16} /> Privacy Policy
            </a>
            <a href="#" className="btn btn-ghost btn-sm">
              <ExternalLink size={16} /> Terms of Service
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
