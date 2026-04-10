-- NexoraAI Leaderboard Table Migration
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS leaderboard (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    display_name  text,
    avatar_initials text,
    xp_points     integer DEFAULT 0,
    scans_completed  integer DEFAULT 0,
    threats_detected integer DEFAULT 0,
    quiz_score_total integer DEFAULT 0,
    updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leaderboard_xp_idx ON leaderboard(xp_points DESC);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read leaderboard"
    ON leaderboard FOR SELECT USING (true);

CREATE POLICY "Users manage own leaderboard row"
    ON leaderboard FOR ALL USING (auth.uid() = user_id);

-- user_settings table (for email notification preferences)
CREATE TABLE IF NOT EXISTS user_settings (
    id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id            uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email_notifications boolean DEFAULT false,
    user_email         text,
    updated_at         timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own settings"
    ON user_settings FOR ALL USING (auth.uid() = user_id);
