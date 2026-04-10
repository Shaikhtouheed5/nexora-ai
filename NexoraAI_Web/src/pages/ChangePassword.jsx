import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, Lock, CheckCircle } from 'lucide-react';

export default function ChangePassword({ user, profile, onLogout }) {
  const [currentPwd, setCurrentPwd]   = useState('');
  const [newPwd, setNewPwd]           = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!currentPwd || !newPwd || !confirmPwd) { setError('All fields are required.'); return; }
    if (newPwd !== confirmPwd) { setError('New passwords do not match.'); return; }
    if (newPwd.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (newPwd === currentPwd) { setError('New password must be different from current password.'); return; }

    setLoading(true);
    try {
      // Re-authenticate by re-signing in with current password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user?.email,
        password: currentPwd,
      });
      if (authError) throw new Error('Current password is incorrect.');

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPwd });
      if (updateError) throw updateError;

      setSuccess('Password updated successfully! Use your new password next time you sign in.');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err) {
      setError(err.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar user={user} profile={profile} onLogout={onLogout} />
      <main className="main-content">
        <div className="page-container" style={{ maxWidth: 500 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Change Password</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 36, fontSize: 15 }}>
            Keep your account secure by using a strong, unique password.
          </p>

          <div className="card-neon">
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Current Password */}
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <div className="input-wrapper">
                  <Lock size={16} style={{ position: 'absolute', left: 16, color: 'var(--text-muted)', zIndex: 1 }} />
                  <input type={showCurrent ? 'text' : 'password'} className="form-input" style={{ paddingLeft: 44 }}
                    placeholder="Your current password" value={currentPwd}
                    onChange={e => { setCurrentPwd(e.target.value); setError(''); }} required />
                  <button type="button" className="input-eye-toggle" onClick={() => setShowCurrent(!showCurrent)}>
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div className="input-wrapper">
                  <Lock size={16} style={{ position: 'absolute', left: 16, color: 'var(--text-muted)', zIndex: 1 }} />
                  <input type={showNew ? 'text' : 'password'} className="form-input" style={{ paddingLeft: 44 }}
                    placeholder="Min. 6 characters" value={newPwd}
                    onChange={e => { setNewPwd(e.target.value); setError(''); }} required />
                  <button type="button" className="input-eye-toggle" onClick={() => setShowNew(!showNew)}>
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <div className="input-wrapper">
                  <Lock size={16} style={{ position: 'absolute', left: 16, color: 'var(--text-muted)', zIndex: 1 }} />
                  <input type={showConfirm ? 'text' : 'password'} className="form-input" style={{ paddingLeft: 44 }}
                    placeholder="Repeat new password" value={confirmPwd}
                    onChange={e => { setConfirmPwd(e.target.value); setError(''); }} required />
                  <button type="button" className="input-eye-toggle" onClick={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error   && <div className="alert alert-error">{error}</div>}
              {success && <div className="alert alert-success"><CheckCircle size={16} /> {success}</div>}

              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                {loading ? <span className="spinner" /> : <><Lock size={16} /> Update Password</>}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
