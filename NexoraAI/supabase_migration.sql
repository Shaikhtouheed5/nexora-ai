-- =============================================================================
-- NexoraAI — Supabase Database Setup
-- =============================================================================
-- Run these statements in the Supabase SQL Editor (Dashboard → SQL Editor)
-- to create all required tables, views, and policies.
-- =============================================================================

-- ─── 1. users table (if not already created) ──────────────────────────────────
-- This is the main user profile table referenced by Auth triggers, gamification,
-- leaderboard, and all client queries.
CREATE TABLE IF NOT EXISTS public.users (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT,
  name             TEXT,
  avatar_url       TEXT,
  auth_provider    TEXT DEFAULT 'email',

  -- Gamification (flat columns, NOT JSONB)
  xp               INTEGER DEFAULT 0,
  level            INTEGER DEFAULT 1,
  streak           INTEGER DEFAULT 0,
  last_active_date TIMESTAMPTZ,
  badges           TEXT[] DEFAULT '{}',

  -- User preferences (JSONB is fine for settings since it's opaque blob)
  settings         JSONB DEFAULT '{}',

  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own row; leaderboard_view handles public reads
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);


-- ─── 2. user_progress table ──────────────────────────────────────────────────
-- Tracks which lessons a user has completed and XP earned per lesson.
-- Referenced by lessonService.js (web) for fetchUserProgress + markLessonComplete.
CREATE TABLE IF NOT EXISTS public.user_progress (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id    TEXT NOT NULL,
  xp_earned    INTEGER DEFAULT 0,
  completed    BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,

  UNIQUE(user_id, lesson_id)
);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress" ON public.user_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" ON public.user_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" ON public.user_progress
  FOR UPDATE USING (auth.uid() = user_id);


-- ─── 3. quiz_results table ───────────────────────────────────────────────────
-- Stores quiz attempts with scores (referenced by saveQuizResult in lessonService).
CREATE TABLE IF NOT EXISTS public.quiz_results (
  id               BIGSERIAL PRIMARY KEY,
  uid              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_id           TEXT NOT NULL,
  score            INTEGER NOT NULL,
  total_questions  INTEGER NOT NULL,
  xp_earned        INTEGER DEFAULT 0,
  answers          JSONB,
  taken_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quizzes" ON public.quiz_results
  FOR SELECT USING (auth.uid() = uid);

CREATE POLICY "Users can insert own quizzes" ON public.quiz_results
  FOR INSERT WITH CHECK (auth.uid() = uid);


-- ─── 4. lessons table ────────────────────────────────────────────────────────
-- Stores lesson content, AI-generated summaries, quizzes, and video status.
CREATE TABLE IF NOT EXISTS public.lessons (
  id                   SERIAL PRIMARY KEY,
  day_id               TEXT UNIQUE NOT NULL,
  title                TEXT NOT NULL,
  content              TEXT,
  slides               JSONB,

  -- AI-generated content (populated by content_gen.py endpoints)
  summary_points       JSONB,
  summary_generated_at TIMESTAMPTZ,
  quizzes              JSONB,
  quiz_generated_at    TIMESTAMPTZ,

  -- Video pipeline state
  video_status         TEXT DEFAULT 'none',    -- none | pending | generating | ready | failed
  video_url            TEXT,
  video_script         TEXT,
  video_error          TEXT,
  video_started_at     TIMESTAMPTZ,
  video_ready_at       TIMESTAMPTZ,

  created_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- Lessons are public-readable for all authenticated users
CREATE POLICY "Authenticated users can read lessons" ON public.lessons
  FOR SELECT USING (auth.role() = 'authenticated');


-- ─── 5. scan_history table ───────────────────────────────────────────────────
-- Stores scan results per user (referenced by scanner.py backend).
CREATE TABLE IF NOT EXISTS public.scan_history (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message_content  TEXT,
  classification   TEXT,
  confidence_score FLOAT,
  scanned_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scans" ON public.scan_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert scans" ON public.scan_history
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);


-- ─── 6. training_feedback table ──────────────────────────────────────────────
-- User feedback on scan results (mark-safe / mark-malicious).
CREATE TABLE IF NOT EXISTS public.training_feedback (
  id                       BIGSERIAL PRIMARY KEY,
  user_id                  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sender                   TEXT,
  message_body             TEXT,
  original_classification  TEXT,
  user_label               TEXT,
  confidence               FLOAT,
  created_at               TIMESTAMPTZ DEFAULT now()
);


-- ─── 7. user_whitelist table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_whitelist (
  id        BIGSERIAL PRIMARY KEY,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender    TEXT NOT NULL,

  UNIQUE(user_id, sender)
);


-- ─── 8. leaderboard_view ─────────────────────────────────────────────────────
-- Public view used by Leaderboard.jsx (web) and LeaderboardScreen.js (mobile).
-- Columns: uid, email, xp, level, level_name, streak, last_login
CREATE OR REPLACE VIEW public.leaderboard_view AS
SELECT
  u.id                     AS uid,
  u.email,
  COALESCE(u.xp, 0)       AS xp,
  COALESCE(u.level, 1)     AS level,
  CASE
    WHEN COALESCE(u.level, 1) = 1 THEN 'Rookie'
    WHEN u.level = 2 THEN 'Apprentice'
    WHEN u.level = 3 THEN 'Defender'
    WHEN u.level = 4 THEN 'Guardian'
    WHEN u.level = 5 THEN 'Sentinel'
    WHEN u.level = 6 THEN 'Specialist'
    WHEN u.level = 7 THEN 'Expert'
    WHEN u.level = 8 THEN 'Elite'
    ELSE 'Rookie'
  END                      AS level_name,
  COALESCE(u.streak, 0)   AS streak,
  u.updated_at             AS last_login
FROM public.users u
ORDER BY u.xp DESC NULLS LAST;

-- Grant read access to all authenticated users
GRANT SELECT ON public.leaderboard_view TO authenticated;


-- ─── 9. Auto-create user profile on signup ───────────────────────────────────
-- This function + trigger ensures every new auth.users row gets a public.users row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, auth_provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  )
  ON CONFLICT (id) DO UPDATE SET
    email       = EXCLUDED.email,
    avatar_url  = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    updated_at  = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists then create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
