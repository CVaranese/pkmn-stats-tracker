# Showdown Replay Stats

Static web page (GitHub Pages) that reads Pokémon Showdown replays and counts kills/deaths per Pokémon for spreadsheets. Singles and doubles.

## Layout
- `site/` — everything that gets published: `index.html`, `style.css`, `app.js` (page logic), `parser.js` (log parsing + kill rules, no DOM, also loadable from Node), `teams.js` (team sheet parsing, sheet-to-game matching, max HP; no DOM).
- `tests/` — `index.html` + `tests.js` run the parser against real replays in `tests/fixtures/` (hand-counted expectations) and synthetic logs for rules no real replay covers yet.
- `.github/workflows/pages.yml` — deploys only `site/` on pushes to `main`.
- `replay_stats.py`, `test_replay_stats.py` — the original Python CLI. Not kept in sync with `site/parser.js`.

## Commands
- Serve locally: `python -m http.server 8765 --bind 127.0.0.1` from the repo root, then open `http://127.0.0.1:8765/site/` and `http://127.0.0.1:8765/tests/` (fetching fixtures needs http, not file://).
- Run tests headless (no Node installed on this machine; Edge is):
  `msedge --headless=new --disable-gpu --user-data-dir=%TEMP%\edge-headless-rs --virtual-time-budget=15000 --dump-dom http://127.0.0.1:8765/tests/index.html`
  The page title is `PASS`, `FAIL (n)` or `CRASH`.
- `tests/corpus/` (gitignored): 30 recent Nat Dex replays for surveys and smoke tests; re-download with `search.json?format=gen9nationaldex`.
- A new real fixture: save `https://replay.pokemonshowdown.com/<id>.json` into `tests/fixtures/`, count kills by hand from the log, then add it to `REAL` in `tests/tests.js`.

## Project docs
- Feature list / roadmap: `docs/FEATURES.md` — keep it current (status, new ideas). Focus format is gen9nationaldex.
- Changelog: `CHANGELOG.md` (under Unreleased).
- Knowledge: `docs/knowledge/` — replay format facts and kill-rule decisions, marked tested / researched / guess.
- Review list: `docs/REVIEW_QUEUE.md` — things only the user can check.

## Rules enforced by `.claude/habits.json`
- Force-push is blocked unless `--force-with-lease`.
- `.py` edits get a `py_compile` syntax check.
- Reminder: `site/` edits need a CHANGELOG.md line.
- Reminder: Showdown/Smogon research needs a note in docs/knowledge/.
- Reminder: `site/*.html|css` edits need a docs/REVIEW_QUEUE.md entry.
