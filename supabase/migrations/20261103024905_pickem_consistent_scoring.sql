-- where each match's two players come from (a seed, or the winner of an earlier match), so a pick scores only when
-- that player reaches the match through the person's own earlier picks (as League.pickemClean on the page): picking
-- different players for one path can't hedge
alter table public.pickem_matches
  add column p1_seed smallint, add column p1_from text,
  add column p2_seed smallint, add column p2_from text;

update public.pickem_matches m set p1_seed = v.p1s, p1_from = v.p1f, p2_seed = v.p2s, p2_from = v.p2f
from (values
  ('A', 8, null, 9, null), ('B', 5, null, 12, null), ('C', 7, null, 10, null), ('D', 6, null, 11, null),
  ('E', 1, null, null, 'A'), ('F', 4, null, null, 'B'), ('G', 2, null, null, 'C'), ('H', 3, null, null, 'D'),
  ('I', null, 'E', null, 'F'), ('J', null, 'G', null, 'H'), ('K', null, 'I', null, 'J')
) as v(id, p1s, p1f, p2s, p2f)
where m.contest_id = 'ppppp-2026-playoffs' and m.match_id = v.id;

create or replace function public.pickem_leaderboard(c text)
returns table (person_id uuid, name text, points integer, picked integer)
language sql stable security definer set search_path = '' as $$
  with recursive ok (person_id, match_id, pick) as (
    select k.person_id, k.match_id, k.pick
    from public.picks k join public.pickem_matches m on m.contest_id = k.contest_id and m.match_id = k.match_id
    where k.contest_id = c and k.pick in (m.p1_seed, m.p2_seed)
    union
    select k.person_id, k.match_id, k.pick
    from public.picks k join public.pickem_matches m on m.contest_id = k.contest_id and m.match_id = k.match_id
    join ok on ok.person_id = k.person_id and ok.match_id in (m.p1_from, m.p2_from) and ok.pick = k.pick
    where k.contest_id = c
  )
  select p.id, p.name,
    coalesce((select sum(m.points) from ok join public.pickem_matches m on m.contest_id = c and m.match_id = ok.match_id
              where ok.person_id = p.id and m.winner = ok.pick), 0)::integer,
    (select count(*) from ok where ok.person_id = p.id)::integer
  from public.people p
  where exists (select 1 from public.picks k where k.person_id = p.id and k.contest_id = c)
$$;
revoke execute on function public.pickem_leaderboard(text) from public;
grant execute on function public.pickem_leaderboard(text) to anon, authenticated;
