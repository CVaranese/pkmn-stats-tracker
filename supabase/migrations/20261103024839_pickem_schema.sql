-- Pick'em (site Pick'em tab, S-1). One row per signed-in person; league membership by Discord server, written only by
-- the pickem-join Edge Function (service key); picks writable by members until the contest locks; results written by
-- the admin (tools/challonge_bracket.py --sql). Built so a points ledger keyed to people can be added later.
-- Applied 2026-11-02 through the Supabase MCP server (project djwfayvdytvvdcecsnqa); this file is the record.

create table public.people (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text not null unique,
  name text not null              -- Discord global display name, else username
);

create table public.guild_members (
  guild_id text not null,
  person_id uuid not null references public.people (id) on delete cascade,
  primary key (guild_id, person_id)
);

create table public.contests (
  id text primary key,
  league text not null,
  kind text not null default 'bracket',
  guild_id text not null,         -- only members of this Discord server can enter
  lock_at timestamptz not null    -- picks can't change from then on
);

create table public.pickem_matches (
  contest_id text not null references public.contests (id) on delete cascade,
  match_id text not null,
  round smallint not null,
  points smallint not null,
  winner smallint,                -- seed of the winner once played
  primary key (contest_id, match_id)
);

create table public.picks (
  person_id uuid not null default auth.uid() references public.people (id) on delete cascade,
  contest_id text not null,
  match_id text not null,
  pick smallint not null check (pick between 1 and 256),   -- seed picked to win
  primary key (person_id, contest_id, match_id),
  foreign key (contest_id, match_id) references public.pickem_matches (contest_id, match_id) on delete cascade
);
create index picks_contest on public.picks (contest_id);

alter table public.people enable row level security;
alter table public.guild_members enable row level security;
alter table public.contests enable row level security;
alter table public.pickem_matches enable row level security;
alter table public.picks enable row level security;

-- may this person still change picks in this contest: a member of its server, before the lock
create function public.pickem_can_pick(c text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contests k
    join public.guild_members g on g.guild_id = k.guild_id and g.person_id = (select auth.uid())
    where k.id = c and now() < k.lock_at)
$$;
-- has the contest locked (everyone's picks can be seen)
create function public.pickem_locked(c text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.contests k where k.id = c and now() >= k.lock_at)
$$;

create policy "own row" on public.people for select to authenticated using (id = (select auth.uid()));
create policy "own membership" on public.guild_members for select to authenticated using (person_id = (select auth.uid()));
create policy "contests are public" on public.contests for select to anon, authenticated using (true);
create policy "matches are public" on public.pickem_matches for select to anon, authenticated using (true);

create policy "own picks, everyone's after the lock" on public.picks for select to anon, authenticated
  using (person_id = (select auth.uid()) or public.pickem_locked(contest_id));
create policy "members pick before the lock" on public.picks for insert to authenticated
  with check (person_id = (select auth.uid()) and public.pickem_can_pick(contest_id));
create policy "members change picks before the lock" on public.picks for update to authenticated
  using (person_id = (select auth.uid()) and public.pickem_can_pick(contest_id))
  with check (person_id = (select auth.uid()) and public.pickem_can_pick(contest_id));
create policy "members drop picks before the lock" on public.picks for delete to authenticated
  using (person_id = (select auth.uid()) and public.pickem_can_pick(contest_id));

revoke all on public.people, public.guild_members, public.contests, public.pickem_matches, public.picks from anon, authenticated;
grant select on public.people, public.guild_members to authenticated;
grant select on public.contests, public.pickem_matches to anon, authenticated;
grant select on public.picks to anon, authenticated;
grant insert, update, delete on public.picks to authenticated;

-- the leaderboard: everyone who has picked, with points from right picks (results from pickem_matches)
-- (replaced by 20261103024905_pickem_consistent_scoring)
create function public.pickem_leaderboard(c text)
returns table (person_id uuid, name text, points integer, picked integer)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name,
    coalesce(sum(m.points) filter (where m.winner is not null and m.winner = k.pick), 0)::integer,
    count(k.match_id)::integer
  from public.picks k
  join public.people p on p.id = k.person_id
  join public.pickem_matches m on m.contest_id = k.contest_id and m.match_id = k.match_id
  where k.contest_id = c
  group by p.id, p.name
$$;

revoke execute on function public.pickem_can_pick(text), public.pickem_locked(text), public.pickem_leaderboard(text) from public;
grant execute on function public.pickem_can_pick(text), public.pickem_locked(text), public.pickem_leaderboard(text) to anon, authenticated;

-- Sunday 2026-11-08 9 PM Pacific (PST, UTC-8)
insert into public.contests (id, league, kind, guild_id, lock_at)
values ('ppppp-2026-playoffs', 'ppppp', 'bracket', '879895025062936576', '2026-11-09T05:00:00Z');
insert into public.pickem_matches (contest_id, match_id, round, points, winner) values
  ('ppppp-2026-playoffs', 'A', 1, 1, null), ('ppppp-2026-playoffs', 'B', 1, 1, null),
  ('ppppp-2026-playoffs', 'C', 1, 1, null), ('ppppp-2026-playoffs', 'D', 1, 1, null),
  ('ppppp-2026-playoffs', 'E', 2, 2, null), ('ppppp-2026-playoffs', 'F', 2, 2, null),
  ('ppppp-2026-playoffs', 'G', 2, 2, null), ('ppppp-2026-playoffs', 'H', 2, 2, null),
  ('ppppp-2026-playoffs', 'I', 3, 4, null), ('ppppp-2026-playoffs', 'J', 3, 4, null),
  ('ppppp-2026-playoffs', 'K', 4, 8, null);
