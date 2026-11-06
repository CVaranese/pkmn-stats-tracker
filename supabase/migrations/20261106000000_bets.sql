-- Play-money bets (Gambling tab, S-3). One slate of bets per contest, sharing the contest's lock with Pick'em. Slate and
-- outcomes are written by the admin (tools/bets.py); a person's picks, and their one lock (it counts double), are
-- writable by league members until the contest locks, and everyone's open after it, as Pick'em's are.
-- Applied through the Supabase MCP server (project djwfayvdytvvdcecsnqa); this file is the record.

create table public.bet_props (
  contest_id text not null references public.contests (id) on delete cascade,
  bet_id text not null,           -- an id in Bet.PROPS (site/bet.js), which has the wording
  position smallint not null,     -- order on the page
  kind text not null check (kind in ('ou', 'yn')),
  line numeric,                   -- x.5 for an over / under, so there's no push; none for a yes / no
  outcome text check (outcome in ('Over', 'Under', 'Yes', 'No', 'void')),  -- empty until settled
  detail text,                    -- the count so far, or what made it Yes
  primary key (contest_id, bet_id),
  check ((kind = 'ou') = (line is not null))
);

create table public.bets (
  person_id uuid not null default auth.uid() references public.people (id) on delete cascade,
  contest_id text not null,
  bet_id text not null,
  pick text not null check (pick in ('Over', 'Under', 'Yes', 'No')),
  primary key (person_id, contest_id, bet_id),
  foreign key (contest_id, bet_id) references public.bet_props (contest_id, bet_id) on delete cascade
);
create index bets_contest on public.bets (contest_id);

-- a row of its own, so one person can't have two (primary key) and moving it is one write; it needs a pick on that bet,
-- and goes when the pick goes
create table public.bet_locks (
  person_id uuid not null default auth.uid(),
  contest_id text not null,
  bet_id text not null,
  primary key (person_id, contest_id),
  foreign key (person_id, contest_id, bet_id) references public.bets (person_id, contest_id, bet_id) on delete cascade
);

alter table public.bet_props enable row level security;
alter table public.bets enable row level security;
alter table public.bet_locks enable row level security;

-- a pick that fits its bet: Over / Under on an over / under, Yes / No on a yes / no
create function private.bet_pick_fits(c text, b text, p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bet_props x
    where x.contest_id = c and x.bet_id = b
      and ((x.kind = 'ou' and p in ('Over', 'Under')) or (x.kind = 'yn' and p in ('Yes', 'No'))))
$$;
revoke execute on function private.bet_pick_fits(text, text, text) from public;
grant execute on function private.bet_pick_fits(text, text, text) to authenticated;

create policy "bets on offer are public" on public.bet_props for select to anon, authenticated using (true);

create policy "own bets, everyone's after the lock" on public.bets for select to anon, authenticated
  using (person_id = (select auth.uid()) or private.pickem_locked(contest_id));
create policy "members bet before the lock" on public.bets for insert to authenticated
  with check (person_id = (select auth.uid()) and private.pickem_can_pick(contest_id) and private.bet_pick_fits(contest_id, bet_id, pick));
create policy "members change bets before the lock" on public.bets for update to authenticated
  using (person_id = (select auth.uid()) and private.pickem_can_pick(contest_id))
  with check (person_id = (select auth.uid()) and private.pickem_can_pick(contest_id) and private.bet_pick_fits(contest_id, bet_id, pick));
create policy "members drop bets before the lock" on public.bets for delete to authenticated
  using (person_id = (select auth.uid()) and private.pickem_can_pick(contest_id));

create policy "own lock, everyone's after the lock" on public.bet_locks for select to anon, authenticated
  using (person_id = (select auth.uid()) or private.pickem_locked(contest_id));
create policy "members set their lock before the lock" on public.bet_locks for insert to authenticated
  with check (person_id = (select auth.uid()) and private.pickem_can_pick(contest_id));
create policy "members move their lock before the lock" on public.bet_locks for update to authenticated
  using (person_id = (select auth.uid()) and private.pickem_can_pick(contest_id))
  with check (person_id = (select auth.uid()) and private.pickem_can_pick(contest_id));
create policy "members drop their lock before the lock" on public.bet_locks for delete to authenticated
  using (person_id = (select auth.uid()) and private.pickem_can_pick(contest_id));

revoke all on public.bet_props, public.bets, public.bet_locks from anon, authenticated;
grant select on public.bet_props to anon, authenticated;
grant select on public.bets, public.bet_locks to anon, authenticated;
grant insert, update, delete on public.bets, public.bet_locks to authenticated;
grant select, insert, update, delete on public.bet_props, public.bets, public.bet_locks to service_role;

-- the leaderboard: everyone who has bet. Right +10, wrong -10, void 0, double on the lock (Bet.BET_STAKE, Bet.slipScore
-- in site/bet.js count the same way). Picks aren't in it, so it's safe before the lock.
create function public.bets_leaderboard(c text)
returns table (person_id uuid, name text, score integer, won integer, lost integer, voided integer, open integer, picked integer)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name,
    coalesce(sum(case when x.outcome is null or x.outcome = 'void' then 0 when x.outcome = b.pick then 10 else -10 end
      * case when l.bet_id is null then 1 else 2 end), 0)::integer,
    count(*) filter (where x.outcome = b.pick)::integer,
    count(*) filter (where x.outcome is not null and x.outcome <> 'void' and x.outcome <> b.pick)::integer,
    count(*) filter (where x.outcome = 'void')::integer,
    count(*) filter (where x.outcome is null)::integer,
    count(*)::integer
  from public.bets b
  join public.people p on p.id = b.person_id
  join public.bet_props x on x.contest_id = b.contest_id and x.bet_id = b.bet_id
  left join public.bet_locks l on l.person_id = b.person_id and l.contest_id = b.contest_id and l.bet_id = b.bet_id
  where b.contest_id = c
  group by p.id, p.name
$$;
revoke execute on function public.bets_leaderboard(text) from public;
grant execute on function public.bets_leaderboard(text) to anon, authenticated;
