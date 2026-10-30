# Handoff: report cards (2026-10-29)

Paste this into a new Claude Code session in `D:\git_repos\showdown-replay-stats` and say "do the report cards handoff".

## Before anything
- Read `CLAUDE.md` (branches, release steps, commands) and `docs/STYLE.md` (before any page change).
- **Ask the user first** which report card they mean, and design the grading with them before building (a mockup
  with real numbers helps; the user picks from options). Don't guess the scheme.
- One feature, finished properly: feature branch from `next` → build → `/code-review` on the branch → fixes on the
  branch → merge into `next` → push. Nothing into `main`. (User 2026-10-29: too much went onto `next` unreviewed in
  one day; slower and checked is the goal.)
- Missing data or config: fill it in or ask, never build around it, and add a check so the gap can't return.

## What "report cards" could be (docs/FEATURES.md)
1. **Draft report card** (idea, 2026-10-27): per player, each drafted Pokémon with games brought, fantasy points,
   points per cost; best pick and biggest bust. Much of this is already on the Draft tab (`site/app/draft.js`: tier,
   cost, games, wins, KOs, fantasy points, points per cost, "best value"). What a report card adds is the verdict:
   a grade and a short reading of the draft.
2. **Draft grades** (user, 2026-10-29): grade each player's draft twice. Before the season, from the picks alone
   (tiers, coverage, cost: not designed; a grade from picks alone is opinion-heavy, so ask what it should weigh).
   After results, from fantasy points, wins, KOs per pick.
3. **In-game performance grades** (user, 2026-10-29): grade how a player played a game, not just the result, e.g.
   from MVP scores, damage traded, luck taken out, switches. Not designed.

## What's there to build on
- Per game, per Pokémon rows: `site/parser.js` `gameRows` (kills, deaths, damage, healing, luck, switches,
  `mvp_score`, turn-by-turn `timeline`...). Season maths: `site/league.js` (standings, `seasonLuck`, `awards`,
  `moreAwards`, `monSets`...). Draft and fantasy: `site/bet.js` (`draftPool`, `fantasy`, `pickCost`, trades).
- Draft data: `site/<league>/games/draft.json` (Pinecord: tiers and costs; Super Champions: per-Pokémon prices).
- Luck has a fair scale per player and per Pokémon (`League.seasonLuck`); "luck taken out" means a result judged
  with the luck z removed. A player's luck is theirs minus their opponent's (mirrored in a game), so use it per season.
- Pure maths goes in a no-DOM module (`league.js` / `bet.js`) with tests in `tests/tests.js`; the page code in
  `site/app/`. Pages: `python -I tools/build_pages.py` after `site/app/league.html` changes.

## Done means
- `python -I tests/test_tools.py` OK and the `test` skill PASS on the branch; screenshots dark, light, phone (the
  `screenshot` skill) sent to the user; CHANGELOG.md line under Unreleased; `docs/FEATURES.md` row updated; a
  `docs/REVIEW_QUEUE.md` entry for what only the user can check.
- Reviewed with `/code-review`, findings fixed, merged into `next`, pushed.

## Also pending (not this feature)
- `next` has 41 commits with no code review yet (2026-10-29's work); the user will schedule a review before 1.1.
- Release 1.1 (playoffs, around 2026-11-09): the review list (`docs/REVIEW_QUEUE.md`) first.
