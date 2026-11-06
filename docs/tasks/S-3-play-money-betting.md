# S-3: Real play-money betting on the Gambling tab (release 1.2)

**Status:** started (branch `betting`)
**Needs you:** OK to apply the store migration when it's ready, then a check on the preview before the release.
**Links:** [BETTING_PROPS.md](../BETTING_PROPS.md), [FEATURES.md "Betting with play money"](../FEATURES.md), [S-2 sign-in](done/S-2-sitewide-discord-signin.md), [S-1 Pick'em](done/S-1-playoff-pickem.md)

## Goal
Signed-in Pinecord members bet play money on playoff rounds from the existing six-bet weekly draw. Picks are kept in
the Supabase store (project `djwfayvdytvvdcecsnqa`) with row-level rules like Pick'em's; each round has a lock time;
bets are settled from the replays/bracket; a public leaderboard. The Gambling tab stops being only a tease once this
ships (the tease rule, memory "gambling-tease-only", ends with it).

User decision 2026-11-05: "I want the Gambling tab since we have discord sign in"; picked "Real betting, 1.2 by
Sunday". Target: live before the Pick'em lock, 2026-11-08 9 PM Pacific = 2026-11-09 05:00 UTC (the contest's
`lock_at` in the store). Release 1.1 (sign-in and Pick'em, Gambling still a tease) goes first.

## State when written (2026-11-05)
- Branch `live-gates`, HEAD 8c9854b (`git log --oneline -1`); feature work goes on its own branch, code review
  (`/code-review` against `next`), then into `next`, per CLAUDE.md.
- Read in code (researched): `site/app/bets.js` shows the draw view-only behind `PREVIEW` (`app/core.js`). It lists
  only weeks that have saved games (`Object.keys(weeks)` built from `library`), so no upcoming round appears and
  nothing is open to bet on today. Lines come from earlier weeks (`Bet.weeklyBets` in `site/bet.js`).
- Sign-in and membership: `site/app/account.js`, `supabase/functions/pickem-join`, table `leagues`. Model for the
  schema: `supabase/migrations/`, `docs/knowledge/pickem-service.md`.
- Guess: playoff rounds have fewer games than a regular week, so the regular-week lines (simulated totals) don't
  carry over as they are.

## Decisions
User, 2026-11-05 (the earlier ones are in BETTING_PROPS.md "Decided so far"):
1. **Stake:** one fixed stake, 10 points a bet, with an allowance that covers every bet. Right +10, wrong -10, void 0.
2. **Extras:** one lock, counting double won or lost. Long-shot payouts and the parlay box are not in 1.2.
3. **Bets:** the six drawn only.
4. **Rounds:** one slate for the whole playoffs, all rounds together, not a slate per round: "All of the rounds
   together, for the entire playoffs. Same lock as pickems. Bets may have to be rebalanced." So one lock pick in all,
   at the contest's `lock_at` (2026-11-09 05:00 UTC).
5. **Match length:** every playoff match is best of 3, so 22 to 33 games over the 11 matches.
6. **Rebalancing:** over / under lines scale to the playoff game count; simulate playoffs from the saved league games
   and the Nat Dex replay sample, and keep only bets landing about 35-65% either way. The six are drawn from those.
7. **Leaderboard:** place, name, score, right-wrong-void and the house's running total. Slips open to everyone after
   the lock, as Pick'em's brackets do.

## Steps
1. Get the answers to Needs you; write them dated under Decisions and update BETTING_PROPS.md "Decided so far".
2. Design the tables and row-level rules (migration in `supabase/migrations/`, modelled on Pick'em: membership via
   `leagues`, picks writable only before the round's lock, everyone's picks readable only after the lock or per the
   Pick'em rule; leaderboard readable by anyone). Apply through the Supabase MCP server and keep the file in step.
3. Rounds: make the draw work for an upcoming round with no saved games (not only `Object.keys(weeks)` from
   `library`), with lines per the answer to (4).
4. UI in `site/app/bets.js` (+ `site/bet.js`, `app/league.html`, `style.css` using tokens; read `docs/STYLE.md`):
   sign-in gate via `acct`, place/change picks until lock, lock countdown, the user's slip, leaderboard.
5. Settling tool like `tools/challonge_bracket.py --sql`: reads the saved replays/bracket, prints the SQL to run
   through the MCP server; a game with no replay voids its bet, stake back.
6. Tests: `tests/tests.js` (settling, lines, lock logic), `tests/test_tools.py` (drop `bets.js` from `PreviewOnly`
   when it goes live), `tests/test_style.py`.
7. Docs: CHANGELOG.md (Unreleased), `site/releases.json` entry for 1.2, FEATURES.md row "Betting with play money",
   BETTING_PROPS.md, REVIEW_QUEUE.md (a real sign-in and a real bet can only be checked by the user).
8. Code review on the branch against `next`, fix findings, merge into `next`, then release 1.2 per CLAUDE.md.

## Done when
- A signed-in Pinecord member can place bets on the open round and not after its lock; a non-member or signed-out
  visitor cannot (checked in a rolled-back transaction, as for Pick'em).
- Bets settle from the replays/bracket by the tool; the leaderboard shows what the user decided.
- Tests pass, the code review has no open findings, and 1.2 is live before 2026-11-09 05:00 UTC.
