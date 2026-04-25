-- ── challenges ──────────────────────────────────────────────────────────────
-- Pool of daily challenge definitions. Seeded by admins via service_role only.

CREATE TABLE IF NOT EXISTS public.challenges (
    id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    title       text        NOT NULL,
    description text        NOT NULL,
    type        text        NOT NULL CHECK (type IN ('scenario', 'quiz', 'scan')),
    difficulty  text        NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    xp_reward   int         NOT NULL DEFAULT 10,
    created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read challenges
CREATE POLICY "challenges_select_public"
    ON public.challenges
    FOR SELECT
    USING (true);

-- Only service_role can write (seed / update / delete)
CREATE POLICY "challenges_write_service_role"
    ON public.challenges
    FOR ALL
    USING (auth.role() = 'service_role');


-- ── user_challenge_progress ──────────────────────────────────────────────────
-- One row per (user, challenge, IST calendar day) — enforced by unique index.

CREATE TABLE IF NOT EXISTS public.user_challenge_progress (
    id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      uuid        NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
    challenge_id uuid        NOT NULL REFERENCES public.challenges(id)    ON DELETE CASCADE,
    completed_at timestamptz DEFAULT now(),
    xp_earned    int         NOT NULL DEFAULT 0
);

-- Expression-based unique index: one completion per user per challenge per IST day.
-- PostgreSQL does not support expression UNIQUEs inline in CREATE TABLE,
-- so this must be a separate CREATE UNIQUE INDEX statement.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_challenge_ist_day
    ON public.user_challenge_progress (
        user_id,
        challenge_id,
        ((completed_at AT TIME ZONE 'Asia/Kolkata')::date)
    );

ALTER TABLE public.user_challenge_progress ENABLE ROW LEVEL SECURITY;

-- Users can only read their own progress
CREATE POLICY "ucp_select_own"
    ON public.user_challenge_progress
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can only insert rows for themselves
CREATE POLICY "ucp_insert_own"
    ON public.user_challenge_progress
    FOR INSERT
    WITH CHECK (user_id = auth.uid());
