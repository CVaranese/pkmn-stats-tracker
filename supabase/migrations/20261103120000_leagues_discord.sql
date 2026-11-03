-- Discord sign-in site-wide (S-2): a league's Discord server is the league's, not each contest's. The membership
-- check (pickem-join) records the servers of every league here, so a member is known on any tab, before the league
-- has a contest; contests read the server from their league. contests.guild_id stays until the page on `next` no
-- longer reads it (then drop it in its own migration).
-- Applied 2026-11-02 through the Supabase MCP server (project djwfayvdytvvdcecsnqa), with supabase/functions/pickem-join
-- redeployed right after (version 2, verify_jwt off); this file is the record.

create table public.leagues (
  id text primary key,            -- the league's id in site/leagues.json
  guild_id text not null          -- its Discord server; site/leagues.json discord.guild is the same id
);
alter table public.leagues enable row level security;
create policy "leagues are public" on public.leagues for select to anon, authenticated using (true);
revoke all on public.leagues from anon, authenticated;
grant select on public.leagues to anon, authenticated;
grant select, insert, update, delete on public.leagues to service_role;

insert into public.leagues (id, guild_id) values ('ppppp', '879895025062936576');
alter table public.contests add constraint contests_league_fkey foreign key (league) references public.leagues (id);

-- may this person still change picks in this contest: a member of its league's server, before the lock
create or replace function private.pickem_can_pick(c text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contests k
    join public.leagues l on l.id = k.league
    join public.guild_members g on g.guild_id = l.guild_id and g.person_id = (select auth.uid())
    where k.id = c and now() < k.lock_at)
$$;
