# Showdown Replay Stats

Static web page (GitHub Pages) that reads Pokémon Showdown replays and counts kills/deaths per Pokémon for spreadsheets. Singles and doubles.

## Layout
- `site/` — everything that gets published: `index.html`, `style.css`, `app.js` (page logic), `parser.js` (log parsing + kill rules, no DOM, also loadable from Node), `teams.js` (team sheet parsing, sheet-to-game matching, max HP; no DOM), `luck.js` (luck score from the rolls parser.js records, with Showdown move data; no DOM), `illusion.js` (which stays on the field a hidden Zoroark could have been: learnsets, HP / status carry-over; no DOM; `site/data/learnsets.json` from `python -I tools/learnsets.py`).
- `site/games/` — the league's game library: `index.json` (id, league, week, players, winner, date, turns, note: two or three words so Games rows stay one line, note_detail: the longer story, shown on hover) and a saved copy of each replay. Add games with `python -I tools/add_game.py <link> --week "Week 3"` (the `add-game` skill). `site/watch.html` is the replay player (Showdown's replay-embed.js, in a frame on Main viewer).
- `tests/` — `index.html` + `tests.js` run the parser against real replays in `tests/fixtures/` (hand-counted expectations) and synthetic logs for rules no real replay covers yet.
- `.github/workflows/pages.yml` — deploys only `site/` on pushes to `main`.
- `replay_stats.py`, `test_replay_stats.py` — the original Python CLI. Not kept in sync with `site/parser.js`.

## Commands
- Serve locally: `python -m http.server 8765 --bind 127.0.0.1` from the repo root, then open `http://127.0.0.1:8765/site/` and `http://127.0.0.1:8765/tests/` (fetching fixtures needs http, not file://).
- Served from 127.0.0.1 / localhost, the site never contacts Showdown (`RS.setLocalOnly`, set in `app.js`): only replays saved in `site/games/` load (team sheets for them in `site/mock/<id>-<player>.txt`), move / Pokédex data come from `site/data/` (regenerate from the pokemon-showdown npm package, see docs/knowledge/showdown-replays.md); `site/data/smogon_hp.json` (HP investment per Pokémon for guessed max HP) comes from `python -I tools/smogon_hp.py`, newest month by default, sprites only from `site/sprites/` (gen5 pixel + ani animated; after adding a game with new Pokémon, run `python -I tools/save_ani_sprites.py`). `?online` turns it off. To drop local mode: remove the `localOnly` block in `fetchChecked` and the `LOCAL` lines in app.js, then `site/data/`. The tests page doesn't turn this on.
- Run tests headless (no Node installed on this machine; Edge is):
  `msedge --headless=new --disable-gpu --user-data-dir=%TEMP%\edge-headless-rs --virtual-time-budget=15000 --dump-dom http://127.0.0.1:8765/tests/index.html`
  The page title is `PASS`, `FAIL (n)` or `CRASH`. `msedge` isn't on PATH in PowerShell: use `& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"`.
  Shortcut: the `test` skill (`.claude/skills/test/run-tests.ps1`) starts the server and prints the result with failing tests.
- Hidden Zoroark picks (admin only): try them with the Move buttons on the local site, then `python -I tools/set_illusion.py <game id> <p1|p2> <n,n|none|auto>` writes them to `site/games/index.json`.
- Is Showdown up? `python -I tools/showdown_status.py` (about 6 s, UP / DOWN per service: replays, move / Pokédex data, sprites, replay-player scripts). Run it before anything that fetches from Showdown instead of waiting on timeouts.
- Screenshots of the local site: the `screenshot` skill (`.claude/skills/screenshot/shot.ps1`), then send the PNG to the user. The user often works remotely; show changes this way instead of pushing.
- `tests/corpus/` (gitignored): 30 recent Nat Dex replays for surveys and smoke tests; re-download with `search.json?format=gen9nationaldex`.
- A new real fixture: save `https://replay.pokemonshowdown.com/<id>.json` into `tests/fixtures/`, count kills by hand from the log, then add it to `REAL` in `tests/tests.js`.

## Project docs
- Style guide: `docs/STYLE.md` — read it before any `site/*.html|css` change. Its samples page is `tests/style.html` (screenshot it, dark and light, next to any new control).
- Feature list / roadmap: `docs/FEATURES.md` — keep it current (status, new ideas). Focus format is gen9nationaldex.
- Changelog: `CHANGELOG.md` (under Unreleased).
- Knowledge: `docs/knowledge/` — replay format facts and kill-rule decisions, marked tested / researched / guess.
- Review list: `docs/REVIEW_QUEUE.md` — things only the user can check.
- League replays: `docs/LEAGUE_REPLAYS.md` — every link the user gave, its week, and whether it's in `site/games/` yet.

## Rules enforced by `.claude/habits.json`
- Force-push is blocked unless `--force-with-lease`.
- `.py` edits get a `py_compile` syntax check.
- Reminder: `site/` edits need a CHANGELOG.md line.
- Reminder: Showdown/Smogon research needs a note in docs/knowledge/.
- Reminder: `site/*.html|css` edits need a docs/REVIEW_QUEUE.md entry.
