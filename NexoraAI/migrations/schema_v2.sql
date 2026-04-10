-- ============================================================
-- NexoraAI — Full Schema Migration v2
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- ── Scan History ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_history (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  text       TEXT        NOT NULL,
  result     JSONB       NOT NULL DEFAULT '{}',
  source     TEXT        DEFAULT 'manual',  -- 'manual' | 'sms' | 'telegram' | 'image'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scan_history_user_id_idx ON scan_history(user_id);
CREATE INDEX IF NOT EXISTS scan_history_created_at_idx ON scan_history(created_at DESC);

ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own history" ON scan_history;
CREATE POLICY "Users see own history" ON scan_history
  FOR ALL USING (auth.uid() = user_id);

-- ── Leaderboard ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leaderboard (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID        REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name      TEXT,
  avatar_initials   TEXT,
  xp_points         INTEGER     DEFAULT 0,
  scans_completed   INTEGER     DEFAULT 0,
  threats_detected  INTEGER     DEFAULT 0,
  quiz_score_total  INTEGER     DEFAULT 0,
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read leaderboard" ON leaderboard;
CREATE POLICY "Anyone can read leaderboard" ON leaderboard
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users update own leaderboard row" ON leaderboard;
CREATE POLICY "Users update own leaderboard row" ON leaderboard
  FOR ALL USING (auth.uid() = user_id);

-- ── User Scores (alias for leaderboard compatibility) ──────────
CREATE TABLE IF NOT EXISTS user_scores (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  username    TEXT    NOT NULL,
  score       INTEGER DEFAULT 0,
  badge_count INTEGER DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads scores" ON user_scores;
CREATE POLICY "Anyone reads scores" ON user_scores
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users update own score" ON user_scores;
CREATE POLICY "Users update own score" ON user_scores
  FOR ALL USING (auth.uid() = user_id);

-- ── User Settings ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  id                  UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID    REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  language            TEXT    DEFAULT 'en',
  theme               TEXT    DEFAULT 'dark',
  email_notifications BOOLEAN DEFAULT false,
  user_email          TEXT,
  data_sharing        BOOLEAN DEFAULT false,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own settings" ON user_settings;
CREATE POLICY "Users manage own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id);

-- ── Telegram Connections ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_connections (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID    REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  telegram_chat_id BIGINT  NOT NULL,
  connected_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE telegram_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own telegram" ON telegram_connections;
CREATE POLICY "Users manage own telegram" ON telegram_connections
  FOR ALL USING (auth.uid() = user_id);

-- ── Training Feedback (for ML retraining) ──────────────────────
CREATE TABLE IF NOT EXISTS training_feedback (
  id                      UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 UUID    REFERENCES auth.users(id) ON DELETE CASCADE,
  sender                  TEXT,
  message_body            TEXT,
  original_classification TEXT,
  user_label              TEXT    CHECK (user_label IN ('safe', 'malicious')),
  confidence              FLOAT,
  created_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE training_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own feedback" ON training_feedback;
CREATE POLICY "Users insert own feedback" ON training_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── User Whitelist (sender trust list) ────────────────────────
CREATE TABLE IF NOT EXISTS user_whitelist (
  id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID    REFERENCES auth.users(id) ON DELETE CASCADE,
  sender     TEXT    NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, sender)
);

ALTER TABLE user_whitelist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own whitelist" ON user_whitelist;
CREATE POLICY "Users manage own whitelist" ON user_whitelist
  FOR ALL USING (auth.uid() = user_id);

-- ── Helper: auto-updated updated_at ───────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_leaderboard_updated_at') THEN
    CREATE TRIGGER set_leaderboard_updated_at
      BEFORE UPDATE ON leaderboard
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_user_settings_updated_at') THEN
    CREATE TRIGGER set_user_settings_updated_at
      BEFORE UPDATE ON user_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_user_scores_updated_at') THEN
    CREATE TRIGGER set_user_scores_updated_at
      BEFORE UPDATE ON user_scores
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
