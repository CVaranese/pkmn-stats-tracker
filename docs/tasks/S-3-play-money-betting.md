# S-3: Real play-money betting on the Gambling tab (release 1.2)

**Status:** blocked (waiting on the user's five decisions)
**Needs you:** Answer in docs/BETTING_PROPS.md terms: (1) stake and allowance (leaning one fixed stake per bet, not settled), and which of long-shot payouts, weekly lock, parlay box are in 1.2; (2) bet on the six drawn only, or more; (3) which playoff rounds, and each round's lock time; (4) lines for a playoff round, which has fewer games than a regular week; (5) what the leaderboard shows.
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
None yet. Open questions are in Needs you; the earlier ones are in BETTING_PROPS.md "Decided so far".

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
