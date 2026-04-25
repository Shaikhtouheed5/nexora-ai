CREATE OR REPLACE FUNCTION public.increment_xp(user_id uuid, xp_amount int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users SET xp = xp + xp_amount WHERE id = user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_xp(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_xp(uuid, int) TO service_role;
