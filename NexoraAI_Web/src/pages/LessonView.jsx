import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { fetchLesson, markLessonComplete } from '../lib/lessonService';
import { awardBadge, XP_RULES } from '../lib/gamificationService';
import {
  Play, ChevronRight, ChevronLeft,
  CheckCircle, BookOpen, Loader, AlertTriangle, RefreshCw
} from 'lucide-react';

// ── Video area sub-components ─────────────────────────────────────────────────

const VIDEO_MAP = {
  'day-1': '/videos/introduction-to-phishing.mp4',
  'introduction-to-phishing': '/videos/introduction-to-phishing.mp4',
  'day-2': '/videos/password-security.mp4',
  'password-security': '/videos/password-security.mp4',
  'day-3': '/videos/social-engineering.mp4',
  'social-engineering': '/videos/social-engineering.mp4',
};

function VideoReady({ lesson, lessonId }) {
  // Real video from backend: render <video> element
  if (lesson.video_url && !lesson.video_url.includes('placeholder')) {
    return (
      <video
        src={lesson.video_url}
        controls
        style={{ width: '100%', display: 'block', maxHeight: 480, objectFit: 'contain', background: '#000' }}
      />
    );
  }

  // Derive videoSrc from VIDEO_MAP using lessonId or lesson title slug
  const titleSlug = lesson.title
    ? lesson.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    : '';
  const videoSrc = VIDEO_MAP[lessonId] || VIDEO_MAP[titleSlug] || null;

  if (videoSrc) {
    return (
      <video
        controls
        width="100%"
        style={{ borderRadius: '8px', maxHeight: '400px', background: '#000', display: 'block' }}
      >
        <source src={videoSrc} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    );
  }

  // Placeholder: styled content card with play icon + lesson text preview
  const preview = lesson.content
    ? lesson.content.slice(0, 280) + (lesson.content.length > 280 ? '…' : '')
    : null;

  return (
    <div style={{
      minHeight: 340,
      background: 'linear-gradient(135deg, rgba(0,245,255,0.04) 0%, var(--surface) 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 24, padding: '48px 40px', textAlign: 'center',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Play icon ring */}
      <div style={{
        width: 88, height: 88, borderRadius: '50%',
        background: 'var(--primary-dim)',
        border: '2px solid var(--glass-border-lg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--shadow-neon)',
      }}>
        <Play size={38} color="var(--primary)" style={{ marginLeft: 4 }} />
      </div>

      <div style={{ maxWidth: 500 }}>
        <p style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
          Video coming soon — read the content below
        </p>
        {preview && (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            {preview}
          </p>
        )}
      </div>
    </div>
  );
}

function VideoGenerating() {
  return (
    <div style={{
      minHeight: 320, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20, padding: 48,
      background: 'var(--surface)', textAlign: 'center',
    }}>
      <Loader size={48} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
      <div>
        <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Generating your lesson…</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 380 }}>
          Our AI is building a personalised video. This usually takes 1–2 minutes.
          The page will update automatically.
        </p>
      </div>
      <div style={{
        display: 'flex', gap: 6, alignItems: 'center',
        padding: '6px 14px', borderRadius: 20,
        background: 'var(--primary-dim)', border: '1px solid var(--glass-border-lg)',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1.2s ease-in-out infinite' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>Processing…</span>
      </div>
    </div>
  );
}

function VideoFailed({ onRetry }) {
  return (
    <div style={{
      minHeight: 280, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20, padding: 48,
      background: 'var(--surface)', textAlign: 'center',
    }}>
      <AlertTriangle size={44} color="var(--danger)" />
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Video generation failed</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Something went wrong. You can still read the lesson content and take the quiz below.
        </p>
      </div>
      <button className="btn btn-outline" onClick={onRetry} style={{ gap: 8 }}>
        <RefreshCw size={15} /> Retry Generation
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LessonView({ user, profile, onLogout, refreshProfile }) {
  const { dayId, id } = useParams();
  const lessonId = dayId || id;
  const navigate = useNavigate();

  const [lesson,      setLesson]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState(false);
  const [xpAwarded,   setXpAwarded]   = useState(false);

  // Load lesson from Supabase directly (avoids dependency on remote EDU backend)
  useEffect(() => {
    if (!lessonId) return;
    setLoading(true);
    setFetchError(false);

    (async () => {
      try {
        const data = await fetchLesson(lessonId);
        if (!data) setFetchError(true);
        else setLesson(data);
      } catch {
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [lessonId]);

  // Poll every 10 s while video is generating
  useEffect(() => {
    const status = lesson?.video_status;
    if (status !== 'pending' && status !== 'generating') return;

    const interval = setInterval(async () => {
      let fresh = null;
      try { fresh = await fetchLesson(lessonId); } catch { fresh = null; }
      if (fresh) setLesson(fresh);
      if (fresh?.video_status === 'ready' || fresh?.video_status === 'failed') {
        clearInterval(interval);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [lesson?.video_status, lessonId]);

  const handleCompleteLesson = async () => {
    if (!xpAwarded && user?.id) {
      try {
        await markLessonComplete(user.id, lessonId);
        await awardBadge(user.id, 'first_lesson');
        setXpAwarded(true);
        refreshProfile?.();
      } catch (e) {
        console.warn('[LessonView] completion error:', e.message);
      }
    }
    navigate(`/quiz/${lessonId}`);
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="app-layout">
        <Sidebar user={user} profile={profile} onLogout={onLogout} />
        <main className="main-content">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 20 }}>
            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading lesson…</p>
          </div>
        </main>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (fetchError || !lesson) {
    return (
      <div className="app-layout">
        <Sidebar user={user} profile={profile} onLogout={onLogout} />
        <main className="main-content">
          <div className="page-container" style={{ maxWidth: 700, textAlign: 'center', paddingTop: 80 }}>
            <AlertTriangle size={48} color="var(--danger)" style={{ marginBottom: 20 }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Lesson not found</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 28 }}>
              This lesson doesn't exist yet or couldn't be loaded.
            </p>
            <Link to="/dashboard" className="btn btn-primary">← Back to Dashboard</Link>
          </div>
        </main>
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const videoStatus   = lesson.video_status || 'none';
  const summaryPoints = lesson.summary_points || [];
  const content       = lesson.content || '';

  // Summary fallback if AI hasn't generated points yet
  const displayPoints = summaryPoints.length > 0
    ? summaryPoints
    : content
      ? content.match(/[^.!?]+[.!?]+/g)?.slice(0, 3).map(s => s.trim()) || []
      : [
          'Always verify the sender before clicking links or sharing information.',
          'AI-powered phishing attacks are increasingly difficult to detect.',
          'Enable multi-factor authentication on all critical accounts.',
        ];

  return (
    <div className="app-layout">
      <Sidebar user={user} profile={profile} onLogout={onLogout} />

      <main className="main-content">
        <div className="page-container" style={{ maxWidth: 900 }}>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, fontSize: 13, color: 'var(--text-muted)' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', padding: 0 }}
            >
              <ChevronLeft size={14} style={{ verticalAlign: 'middle' }} /> Dashboard
            </button>
            <span>/</span>
            <span>Day {lesson.day_id} — Lesson</span>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Day {lesson.day_id}
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 0 }}>{lesson.title}</h1>
          </div>

          {/* ── Video Area ── */}
          <div className="card-neon" style={{ marginBottom: 32, padding: 0, overflow: 'hidden' }}>
            {(videoStatus === 'ready' || videoStatus === 'none') && (
              <VideoReady lesson={lesson} lessonId={lessonId} />
            )}
            {(videoStatus === 'pending' || videoStatus === 'generating') && (
              <VideoGenerating />
            )}
            {videoStatus === 'failed' && (
              <VideoFailed onRetry={() => setLesson(l => ({ ...l, video_status: 'none' }))} />
            )}
          </div>

          {/* ── Full lesson content (always visible) ── */}
          {content.length > 0 && (
            <div className="card" style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--primary-dim)', border: '1px solid var(--glass-border-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={16} color="var(--primary)" />
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 800 }}>Lesson Content</h2>
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {content}
              </p>
            </div>
          )}

          {/* ── Summary Points ── */}
          {displayPoints.length > 0 && (
            <div className="card-neon" style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-dim)', border: '1px solid var(--glass-border-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={18} color="var(--primary)" />
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 800 }}>Key Takeaways</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {displayPoints.map((point, i) => (
                  <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    {/* Cyan numbered bullet */}
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: 'var(--primary-dim)',
                      border: '1px solid var(--glass-border-lg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 900, color: 'var(--primary)',
                    }}>
                      {i + 1}
                    </div>
                    <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', paddingTop: 4 }}>
                      {point}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Take the Quiz CTA ── */}
          <button
            onClick={handleCompleteLesson}
            className="btn btn-primary btn-full btn-lg animate-slide"
            style={{ fontSize: 17, marginBottom: 60 }}
          >
            <CheckCircle size={20} />
            Take the Quiz — +{(XP_RULES.LESSON_COMPLETE || 50) + (XP_RULES.QUIZ_PASS || 50)} XP possible
            <ChevronRight size={20} />
          </button>

        </div>
      </main>
    </div>
  );
}
