-- the two checks the picks policies use don't need to be callable through the API: a schema the API doesn't expose.
-- (The Supabase advisor's remaining warning, pickem_leaderboard callable without signing in, is on purpose: everyone
-- can see the leaderboard, user 2026-11-02.)
create schema if not exists private;
grant usage on schema private to anon, authenticated;
alter function public.pickem_can_pick(text) set schema private;
alter function public.pickem_locked(text) set schema private;
