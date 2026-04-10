import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { createOrFetchUser } from '../lib/userService';
import { Shield, Eye, EyeOff, Mail, Lock, User, Phone, ChevronRight, X } from 'lucide-react';

// ─── Tabs for auth method ───────────────────────────────────────────────────
const AUTH_MODES = { LOGIN: 'login', REGISTER: 'register', FORGOT: 'forgot', PHONE: 'phone' };

export default function Login({ onLogin }) {
  const [mode, setMode] = useState(AUTH_MODES.LOGIN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  const clearMessages = () => { setError(''); setSuccess(''); };

  // ── Google OAuth Sign-In ──────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    clearMessages();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      // After redirect back, onAuthStateChange in App.jsx handles the session
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Email / Password Sign In ──────────────────────────────────────────────
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    clearMessages();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const profile = await createOrFetchUser(data.user);
      onLogin({ ...data.user, profile });
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Invalid login')) setError('Wrong email or password. Please try again.');
      else if (msg.includes('Email not confirmed')) setError('Please verify your email before logging in.');
      else setError(msg || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Register ─────────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !password || !confirmPassword) { setError('All fields are required.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    clearMessages();
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      if (data.user) {
        await createOrFetchUser(data.user);
      }
      setSuccess('Account created! Check your inbox to verify your email, then sign in.');
      setMode(AUTH_MODES.LOGIN);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('already registered')) setError('This email is already in use. Try logging in.');
      else setError(msg || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password ───────────────────────────────────────────────────────
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) { setError('Please enter your email address.'); return; }
    setLoading(true);
    clearMessages();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/change-password`,
      });
      if (error) throw error;
      setSuccess('Reset link sent! Check your inbox.');
      setForgotEmail('');
    } catch (err) {
      setError(err.message || 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password Modal ─────────────────────────────────────────────────
  const ForgotPasswordModal = () => (
    <div className="modal-overlay" onClick={() => setForgotModalOpen(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Reset Password</h2>
          <button onClick={() => setForgotModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
          Enter your email address and we'll send you a link to reset your password.
        </p>
        <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              required
            />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Send Reset Link'}
          </button>
        </form>
      </div>
    </div>
  );

  // ── Render: Login Form ────────────────────────────────────────────────────
  const renderLogin = () => (
    <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="form-group">
        <label className="form-label">Email Address</label>
        <div className="input-wrapper">
          <Mail size={16} style={{ position: 'absolute', left: 16, color: 'var(--text-muted)', zIndex: 1 }} />
          <input
            type="email"
            className="form-input"
            style={{ paddingLeft: 44 }}
            placeholder="you@example.com"
            value={email}
            onChange={e => { setEmail(e.target.value); clearMessages(); }}
            autoComplete="email"
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Password</label>
        <div className="input-wrapper">
          <Lock size={16} style={{ position: 'absolute', left: 16, color: 'var(--text-muted)', zIndex: 1 }} />
          <input
            type={showPassword ? 'text' : 'password'}
            className="form-input"
            style={{ paddingLeft: 44 }}
            placeholder="••••••••"
            value={password}
            onChange={e => { setPassword(e.target.value); clearMessages(); }}
            autoComplete="current-password"
            required
          />
          <button type="button" className="input-eye-toggle" onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error"><span>{error}</span></div>}
      {success && <div className="alert alert-success"><span>{success}</span></div>}

      <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
        {loading ? <span className="spinner" /> : 'Sign In Securely'}
        {!loading && <ChevronRight size={18} />}
      </button>

      <div style={{ textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => { clearMessages(); setForgotModalOpen(true); }}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Forgot Password?
        </button>
      </div>
    </form>
  );

  // ── Render: Register Form ─────────────────────────────────────────────────
  const renderRegister = () => (
    <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="form-group">
        <label className="form-label">Full Name</label>
        <div className="input-wrapper">
          <User size={16} style={{ position: 'absolute', left: 16, color: 'var(--text-muted)', zIndex: 1 }} />
          <input type="text" className="form-input" style={{ paddingLeft: 44 }} placeholder="Your full name"
            value={fullName} onChange={e => { setFullName(e.target.value); clearMessages(); }} required />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Email Address</label>
        <div className="input-wrapper">
          <Mail size={16} style={{ position: 'absolute', left: 16, color: 'var(--text-muted)', zIndex: 1 }} />
          <input type="email" className="form-input" style={{ paddingLeft: 44 }} placeholder="you@example.com"
            value={email} onChange={e => { setEmail(e.target.value); clearMessages(); }} autoComplete="email" required />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Password</label>
        <div className="input-wrapper">
          <Lock size={16} style={{ position: 'absolute', left: 16, color: 'var(--text-muted)', zIndex: 1 }} />
          <input type={showPassword ? 'text' : 'password'} className="form-input" style={{ paddingLeft: 44 }}
            placeholder="Min. 6 characters" value={password} onChange={e => { setPassword(e.target.value); clearMessages(); }} required />
          <button type="button" className="input-eye-toggle" onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Confirm Password</label>
        <div className="input-wrapper">
          <Lock size={16} style={{ position: 'absolute', left: 16, color: 'var(--text-muted)', zIndex: 1 }} />
          <input type={showConfirmPassword ? 'text' : 'password'} className="form-input" style={{ paddingLeft: 44 }}
            placeholder="Repeat password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); clearMessages(); }} required />
          <button type="button" className="input-eye-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error"><span>{error}</span></div>}
      {success && <div className="alert alert-success"><span>{success}</span></div>}

      <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
        {loading ? <span className="spinner" /> : 'Create Account'}
        {!loading && <ChevronRight size={18} />}
      </button>
    </form>
  );

  // ── Render: Phone OTP (Placeholder) ──────────────────────────────────────
  const renderPhone = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📱</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Phone Login</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
          OTP-based login via phone number is coming soon.
          Use Google or email login in the meantime.
        </p>
        <span className="badge badge-primary" style={{ marginTop: 16 }}>Coming Soon</span>
      </div>
      <div className="form-group">
        <label className="form-label">Mobile Number</label>
        <div className="input-wrapper">
          <Phone size={16} style={{ position: 'absolute', left: 16, color: 'var(--text-muted)', zIndex: 1 }} />
          <input type="tel" className="form-input" style={{ paddingLeft: 44, opacity: 0.5 }}
            placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} disabled />
        </div>
      </div>
      <button className="btn btn-outline btn-full btn-lg" disabled>Send OTP (Coming Soon)</button>
    </div>
  );

  // ── Main Render ───────────────────────────────────────────────────────────
  return (
    <div className="auth-page">
      {forgotModalOpen && <ForgotPasswordModal />}

      {/* Background grid effect */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(0,245,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <div className="auth-card animate-slide">
        {/* Logo + Title */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64,
            background: 'var(--primary-dim)',
            border: '1px solid var(--glass-border-lg)',
            borderRadius: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: 'var(--shadow-neon)',
          }}>
            <Shield size={32} color="var(--primary)" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 6 }}>
            NEXORA <span style={{ color: 'var(--primary)' }}>AI</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>
            AI-Powered Phishing Detection & Security Training
          </p>
        </div>

        {/* Google Sign-In Button */}
        {mode !== AUTH_MODES.PHONE && (
          <>
            <button
              className="btn btn-google btn-full btn-lg"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              style={{ marginBottom: 16 }}
            >
              {googleLoading ? <span className="spinner" /> : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                </svg>
              )}
              Continue with Google
            </button>

            <div className="divider" style={{ margin: '20px 0' }}>OR</div>
          </>
        )}

        {/* Login / Register / Phone Tabs */}
        <div className="tab-list" style={{ marginBottom: 28 }}>
          <button
            className={`tab-item ${mode === AUTH_MODES.LOGIN ? 'active' : ''}`}
            onClick={() => { setMode(AUTH_MODES.LOGIN); clearMessages(); }}
          >Sign In</button>
          <button
            className={`tab-item ${mode === AUTH_MODES.REGISTER ? 'active' : ''}`}
            onClick={() => { setMode(AUTH_MODES.REGISTER); clearMessages(); }}
          >Register</button>
          <button
            className={`tab-item ${mode === AUTH_MODES.PHONE ? 'active' : ''}`}
            onClick={() => { setMode(AUTH_MODES.PHONE); clearMessages(); }}
          >📱 OTP</button>
        </div>

        {/* Dynamic Form */}
        {mode === AUTH_MODES.LOGIN && renderLogin()}
        {mode === AUTH_MODES.REGISTER && renderRegister()}
        {mode === AUTH_MODES.PHONE && renderPhone()}

        {/* Trust footer */}
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center', gap: 20 }}>
          {['End-to-end encrypted', 'Zero-knowledge auth', 'Supabase secured'].map(t => (
            <span key={t} style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
              ✦ {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
