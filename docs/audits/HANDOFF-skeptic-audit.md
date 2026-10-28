# Handoff: skeptical code audit + debate

Paste this into a new Claude Code session in `D:\git_repos\showdown-replay-stats`.

## Background
Showdown Replay Stats: a static site in `site/` that reads Pokémon Showdown replays for one draft league (Pinecord)
and shows kills, damage, MVPs and luck per Pokémon and player. On 2026-10-28 one session:
- added a Pokémon tab and made Megas their own Pokémon (as the draft does)
- ran a consistency audit over all 45 saved league games (`tests/audit.html`)
- reviewed the code twice

All of it is written up in `docs/audits/2026-10-28-audit.md`. The first review's fixes are committed (`a1ea026`).
The 17 findings from the full-site review are NOT fixed, deliberately: the user wants a second, skeptical opinion
and a point-by-point debate first, then will decide. The ten stream-video games with errors are marked in
`site/games/index.json` (`known_errors`), not rebuilt (the user's call).

## Task
Write two documents. Change no code, data or other docs. Don't commit; the user reviews the results.

**Read first:** `CLAUDE.md`, `docs/STYLE.md`, `docs/audits/2026-10-28-audit.md`. The code is `site/` (`app.js`
~1600 lines, `parser.js` ~1160, `teams.js`, `luck.js`, `illusion.js`, `bet.js`, `index.html`, `style.css`,
`watch.html`), plus `tests/tests.js` and `tools/*.py`.

**Step 1 — the skeptic's audit: `docs/audits/2026-10-28-skeptic-audit.md`.** Write it as a different reviewer:
critical and skeptical, there to make sure the code is clean, up to standard and follows good coding practices.
That reviewer doesn't trust the first audit and looks at what it skipped:
- structure and size (a 1600-line IIFE in `app.js`, global mutable state, module boundaries)
- naming, duplication, dead code, comments that drift from the code
- error handling (swallowed catches), async/race safety, magic numbers and hard-coded data (`MOCK_SHEETS`,
  `LEAGUE_TAGS`, the Challonge URL)
- testability (DOM-bound logic in `app.js` has no tests) and test coverage gaps
- accessibility, security (innerHTML, CSV export, iframe sources), performance, consistency with `docs/STYLE.md`
- the Python tools

Each item needs `file:line`, what's wrong, why it matters, a severity (high / medium / low) and the concrete fix.
Read the code itself; don't restate the first audit's findings unless the skeptic disagrees with how they were rated
or fixed. Real issues, not padding.

**Step 2 — the debate: `docs/audits/2026-10-28-debate.md`.** Go through the skeptic's items one by one and argue
them as the original reviewer, who knows the project's context:
- a static GitHub Pages site for one draft league, no build step, no Node on the dev machine, tests run in
  headless Edge
- a user who prefers plain readable code and short changes
- replays rounded to whole %, stream-video games rebuilt by screen reading

For each item, record:
- the skeptic's claim
- the rebuttal or concession, with evidence (quote lines, `file:line`)
- the skeptic's reply
- a verdict: **agree, fix** / **agree, later** / **disagree, keep as is** / **needs the user's call**

End with a table: item, verdict, effort (S/M/L), and the items both sides agree to fix first.

**Ground rules:** be honest on both sides: concede when the skeptic is right, push back with evidence when it
isn't. Mark anything not verified in the code as a guess. To check a claim, use `CLAUDE.md`'s commands (server
`python -m http.server 8765 --bind 127.0.0.1` from the repo root; the `test` skill).

**Done when** both files exist and the final message lists their paths with a 5-line summary: item counts per
verdict, and the top 3 items to fix.
