import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { createOrFetchUser } from './lib/userService';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LessonView from './pages/LessonView';
import Leaderboard from './pages/Leaderboard';
import DailyQuiz from './pages/DailyQuiz';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import HelpCenter from './pages/HelpCenter';
import Scenarios from './pages/Scenarios';
import ChangePassword from './pages/ChangePassword';

// ─── Protected Route Wrapper ──────────────────────────────────────────────────
function ProtectedRoute({ user, children }) {
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

// ─── Loading Screen ────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div style={{
        width: 64, height: 64,
        background: 'var(--primary-dim)',
        border: '1px solid var(--glass-border-lg)',
        borderRadius: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--shadow-neon)',
        marginBottom: 8,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
      <p className="loading-title">Initializing Nexora AI</p>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Handle OAuth callback from Google
      if (window.location.hash.includes('access_token')) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          window.location.hash = '';
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (supabaseUser) => {
    setUser(supabaseUser);
    const prof = await createOrFetchUser(supabaseUser);
    setProfile(prof);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      const prof = await createOrFetchUser(user);
      setProfile(prof);
    }
  };

  if (loading) return <LoadingScreen />;

  // Shared props for authenticated pages
  const authProps = { user, profile, onLogout: handleLogout, refreshProfile };

  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />}
        />

        {/* Protected Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute user={user}>
            <Dashboard {...authProps} />
          </ProtectedRoute>
        } />
        <Route path="/lesson/:dayId" element={
          <ProtectedRoute user={user}>
            <LessonView {...authProps} />
          </ProtectedRoute>
        } />
        <Route path="/lessons/:id" element={
          <ProtectedRoute user={user}>
            <LessonView {...authProps} />
          </ProtectedRoute>
        } />
        <Route path="/quiz/:dayId" element={
          <ProtectedRoute user={user}>
            <DailyQuiz {...authProps} />
          </ProtectedRoute>
        } />
        <Route path="/daily-quiz" element={
          <ProtectedRoute user={user}>
            <DailyQuiz {...authProps} />
          </ProtectedRoute>
        } />
        <Route path="/leaderboard" element={
          <ProtectedRoute user={user}>
            <Leaderboard {...authProps} />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute user={user}>
            <Profile {...authProps} />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute user={user}>
            <Settings {...authProps} />
          </ProtectedRoute>
        } />
        <Route path="/help" element={
          <ProtectedRoute user={user}>
            <HelpCenter {...authProps} />
          </ProtectedRoute>
        } />
        <Route path="/scenarios" element={
          <ProtectedRoute user={user}>
            <Scenarios {...authProps} />
          </ProtectedRoute>
        } />
        <Route path="/change-password" element={
          <ProtectedRoute user={user}>
            <ChangePassword {...authProps} />
          </ProtectedRoute>
        } />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
