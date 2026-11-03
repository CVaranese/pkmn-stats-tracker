-- the pickem-join function writes people and guild_members with the secret key (service_role); this project gives
-- new tables no default rights, so grant them (found 2026-11-02: the first real sign-in got a 500)
grant select, insert, update, delete on public.people, public.guild_members, public.contests, public.pickem_matches, public.picks to service_role;
grant usage on schema private to service_role;
grant execute on function public.pickem_leaderboard(text) to service_role;
