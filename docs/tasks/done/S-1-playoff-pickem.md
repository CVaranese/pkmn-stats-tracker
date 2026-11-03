# S-1: Pick'em for Pinecord's playoffs

**Status:** open
**Links:** [FEATURES.md Pick'em row](../../FEATURES.md), [BETTING_PROPS.md](../../BETTING_PROPS.md), [challonge.md](../../knowledge/challonge.md)

## Goal
League `ppppp` only. A visitor fills out the whole playoff bracket, a winner for every match, before the playoffs
start (around 2026-11-09). Each right pick earns points, more in later rounds; the best bracket wins. User
2026-11-02: "it will just be filling out all of the matches in the playoffs bracket". Bracket picks only: no other
bets, no per-game props.

## State when written (2026-11-02)
- Branch `next`, HEAD 7ed4bfb.
- Tested (docs/knowledge/challonge.md lines 18-21): the playoffs are the Challonge tournament `peepeepeepeepisspiss`,
  already under `brackets` in `site/leagues.json`. Single elimination, 12 players, no third-place match. Round 1 has
  four matches (seeds 5-12), the top four wait in round 2; 11 matches in all.
- `tools/challonge_records.py` already reads the Challonge API.
- Related, separate: BETTING_PROPS.md "Bracket (playoffs)" (~line 131) and the play-money betting row in FEATURES.md
  (blocked on a login / storage service). Memory "gambling-tease-only": the site must not name or confirm upcoming
  betting features, so Pick'em text stays apart from the Gambling tab's teaser.

## Decisions
- 2026-11-02, user: picks live in a hosted store with a login (picked over a share link and a Google Form). This is
  the same kind of store the play-money betting row in FEATURES.md is waiting on, so pick a service both can share.
  Not researched yet (needs a docs/knowledge note): free-tier limits, Discord login, and calling it from a static
  GitHub Pages site. The user doesn't want heavy tracking (memory "week-not-date"), so store as little as possible.
- 2026-11-02, user: points per right pick are 1 / 2 / 4 / 8 for round 1 / quarterfinals / semis / final.
- 2026-11-02, user: the page is laid out like a tournament bracket, rounds as columns with lines joining each match
  to the next. A pick is made by clicking a player in a match, and that winner moves on into the next round's slot.
  On phones the bracket needs its own design: scroll sideways by round, or one round at a time (docs/STYLE.md phone
  rules).
- 2026-11-02, user: store each person's Discord name, their picks and their points, with future bets in mind.
  Design the tables so bets can be added later (a person table, then picks and later a points ledger keyed to it),
  but put nothing about bets on the site (memory "gambling-tease-only").
- 2026-11-02, user: picks lock Sunday 9 PM California time. Read as Sunday 2026-11-08 21:00 PST (UTC-8; daylight
  time ended 2026-11-01), which is 2026-11-09 05:00 UTC. The store enforces the lock (a write policy on the time),
  not only the page.
- 2026-11-02, session: Supabase is recommended over Firebase, since Discord login is built into Supabase and Firebase
  would need a paid plan for it. Comparison in docs/knowledge/pickem-service.md. Points must not be writable by
  visitors: compute them in the database from picks + results (a view), with results written only by the admin.
- 2026-11-02, user: only members of the league's Discord server can enter. Plan (session): sign in with the
  `identify guilds` scopes. A Supabase Edge Function takes the visitor's Discord token, asks Discord for their
  servers, and checks that the token's user is the signed-in one. If they're in the league server, it writes a
  members row using the service key. The picks write policy then requires that row. A page-only check isn't enough,
  because the page can be edited. Fallback if the function proves hard: an allowlist of Discord user ids the admin
  fills in.
- 2026-11-02, user: everyone can see the leaderboard (Discord names and points); signing in is only needed to pick.
  Other people's full brackets can be opened only after the lock. The name shown is the Discord global display name
  (username when there is none). Equal points share a place; no tiebreak.

## Progress
- 2026-11-02: the user made the Supabase project (ref `djwfayvdytvvdcecsnqa`, URL
  `https://djwfayvdytvvdcecsnqa.supabase.co`). The Supabase MCP server is in `.mcp.json` (project scope, no secrets
  in it) and is not signed in yet. The optional `npx skills add supabase/agent-skills` was skipped because Node
  isn't installed on this machine.
- 2026-11-02, user: Discord provider, secret and redirect URLs done in the dashboards; Supabase MCP signed in from a
  terminal session. The desktop session that wrote this had no Supabase tools (the MCP list loads when a session
  starts), so building with them needs a new session.
- 2026-11-02, user gave the values the site needs. Both are public by design: the publishable key is meant for
  browser code, and row-level security protects the data.
  - Project URL: `https://djwfayvdytvvdcecsnqa.supabase.co`
  - Publishable key: `sb_publishable_Sf5HjDa6fwjdNWx2oHGNqw_KtH-RKEm`
  - League Discord server ID (for the membership check): `879895025062936576`
  - Discord application client ID: `1567001265010118787`
  - The client secret is only in the Supabase dashboard, never in the repo.
- 2026-11-02, session (branch `pickem`): built steps 2-6. `tools/challonge_bracket.py` → `site/ppppp/games/playoffs.json`
  (tested). `League.pickemClean / pickemSlots / pickemScore / pickemRanks` (5 tests; site tests 347/347). Supabase:
  3 migrations (`supabase/migrations/`) and the `pickem-join` function, deployed; rules tested in SQL with made-up
  users (member saves, non-member refused, locked after `lock_at`, picks hidden until the lock, hedged picks score 0).
  The Pick'em tab (`site/app/pickem.js`), checked by screenshot (dark 1400px, light 360px) and a click run (picks move
  on, an earlier change drops later picks). Not tested: a real Discord sign-in (review queue). Left: step 7.

## Steps
1. Get the remaining answers above; write them under Decisions and drop Needs you.
2. A tool writes the bracket (matches, rounds, seeds, who feeds which match) from Challonge to a data file under
   `site/ppppp/`.
3. `site/league.js`: bracket maths (which picks are still possible, round of each match) and scoring by round, with
   tests in `tests/tests.js`. No DOM.
4. New tab `site/app/<tab>.js`, added to the tab list in `app/league.html`, then `python -I tools/build_pages.py`.
   Read `docs/STYLE.md` first; styles in `site/style.css`.
5. Storage and leaderboard as decided in step 1.
6. CHANGELOG.md line, `docs/REVIEW_QUEUE.md` entry, FEATURES.md row updated.
7. Work on a feature branch; `/code-review` against `next`, fix findings, then merge into `next`.

## Done when
- The picks page is drawn as a tournament bracket, and it works on a phone.
- A visitor signed in with Discord can pick a winner for all 11 matches, with later matches following their earlier
  picks, and can change picks until the lock.
- Picks lock at the decided time.
- Scoring by round matches the decided points, and tests cover it.
- The best bracket can be seen as decided in step 1.
- Nothing on the page names betting features.

## Resolution (2026-11-02)
Done on `next` (the /next/ preview), pushed 2026-11-02; it goes live on `main` with the next release (minor version 1.1, CLAUDE.md release steps; the CHANGELOG.md Unreleased lines cover it). Closed now at the user's request rather than held until the release.
- Commits (branch `pickem`, merged into `next`): 0aebd58 (Pick'em tab, bracket maths, Supabase store and membership function, Challonge bracket tool), 497ee83 (review fixes), bb3991f (Submit picks; service_role grants, the cause of the first sign-in's 500); merges b06144d and 704d8a7; pushed as 8bf4917.
- Evidence: site tests PASS 347/347 (5 new: pickemClean, pickemSlots, pickemScore x2, pickemRanks); `tests/test_tools.py` OK (ChallongeBracket); `tests/test_style.py` OK. Database rules tested in SQL with made-up users, rolled back: member saves, non-member refused, nothing saves after lock_at, anon reads no picks before the lock and all after, a hedged bracket scores 0. Supabase security advisor: only pickem_leaderboard callable signed out, on purpose. Real sign-in by the user 2026-11-02: people 1, guild_members 1, picks 11 in the store. Screenshots: dark 1400px, light 1400px with picks, light 360px phone. Migrations in `supabase/migrations/` (4 files), function in `supabase/functions/pickem-join/`.
- Review: /code-review (high) of next...pickem, 8 findings, all fixed in 497ee83: failed Discord check hid the bracket and Sign out button; a signed-out draft was drawn after the lock; clicks after the lock were silent; non-members who later join weren't told to sign in again; `?code=` stayed in the address; winners came from two sources (now the store only); the bracket tool's settings were duplicated (now read from site/leagues.json); pickemScore rebuilt a map per match. Design critique: no STYLE.md breaches; read-only picks now use aria-pressed + aria-disabled.
- Still open for others: REVIEW_QUEUE.md Pick'em item (is "Submit" the right word; is the email kept by Supabase Auth OK?); S-2 (site-wide sign-in) builds on this. After each playoff round: `python -I tools/challonge_bracket.py --sql`, then run the printed SQL (CLAUDE.md).
