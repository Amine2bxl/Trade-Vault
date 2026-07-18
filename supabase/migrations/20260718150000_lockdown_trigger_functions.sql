-- ============ HARDENING: lock down trigger-only SECURITY DEFINER functions ==
-- handle_new_user_billing() is a SECURITY DEFINER function invoked *only* by
-- the on_auth_user_created_billing trigger. Postgres grants EXECUTE to PUBLIC
-- by default, which left it callable directly via PostgREST RPC by anon and
-- authenticated roles (Supabase security advisor 0028/0029). Revoke it — the
-- trigger runs as the definer regardless, so nothing legitimate breaks.

revoke all on function public.handle_new_user_billing() from public, anon, authenticated;
