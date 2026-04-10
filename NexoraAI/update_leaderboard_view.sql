-- =============================================================================
-- NexoraAI — Leaderboard View (Updated for flat-column schema)
-- =============================================================================
-- Run in Supabase SQL Editor (Dashboard → SQL Editor).
--
-- ⚠️  This file REPLACES the old leaderboard view that used the deprecated
--      `profiles` and `user_activity` tables. The canonical schema is now
--      the `users` table with flat gamification columns (xp, level, streak).
--
-- This view is also included in the master migration:
--   NexoraAI/supabase_migration.sql (Section 8)
-- =============================================================================

-- ─── Create / Replace leaderboard_view ───────────────────────────────────────
-- Columns exposed:
--   uid        → matches users.id (UUID)
--   email      → masked by the frontend (first 3 chars + ***)
--   xp         → total XP earned (gamification flat column)
--   level      → numeric level 1-8
--   level_name → human-readable rank (Rookie → Elite)
--   streak     → current daily streak
--   last_login → last profile update (proxy for last active timestamp)

CREATE OR REPLACE VIEW public.leaderboard_view AS
SELECT
  u.id                     AS uid,
  u.email,
  COALESCE(u.xp, 0)        AS xp,
  COALESCE(u.level, 1)     AS level,
  CASE
    WHEN COALESCE(u.level, 1) = 1 THEN 'Rookie'
    WHEN u.level = 2              THEN 'Apprentice'
    WHEN u.level = 3              THEN 'Defender'
    WHEN u.level = 4              THEN 'Guardian'
    WHEN u.level = 5              THEN 'Sentinel'
    WHEN u.level = 6              THEN 'Specialist'
    WHEN u.level = 7              THEN 'Expert'
    WHEN u.level = 8              THEN 'Elite'
    ELSE                               'Rookie'
  END                       AS level_name,
  COALESCE(u.streak, 0)    AS streak,
  u.updated_at              AS last_login
FROM public.users u
ORDER BY u.xp DESC NULLS LAST;

-- Allow all authenticated users to query the view
GRANT SELECT ON public.leaderboard_view TO authenticated;
