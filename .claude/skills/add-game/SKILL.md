---
name: add-game
description: Add league games to the site's game library (site/<league>/games/) from Showdown replay links, with a week label. Use when the user gives league replay links to save, or asks to relabel a stored game.
---

# Add games to the library

First run `python -I tools/showdown_status.py`: if Replays is DOWN, say so and use `--file` / saved copies
instead of waiting on timeouts.

For each replay (link or id):
```
python -I tools/add_game.py <link> --league <id> --week "Week 3" [--set "QF Karm-Joey"] [--note "Game 2"]
```
- `--league` is required: a league id from `site/leagues.json` (`ppppp`, `scl`). Ask the user if the links could be from either league. A new league: add it to `site/leagues.json`, then `python -I tools/build_pages.py`.
- `--set "<label>"` puts the game in a set (best of three, playoff series): every game with the same label is one set. Use it for playoff series and whenever a pair played more than one set in a week. The Super Champions League (`best_of` 3 in `site/leagues.json`) groups a week's games between the same two players by itself; the Games tab marks a group that can't be one set ("May be two sets"): label those.
- `--week` is required and is the group shown in the Games tab ("Week 3", "Playoffs R1", "Finals"). Ask the user
  if they didn't say; never guess a week.
- Running it again for the same game updates its labels (no duplicate). Games show newest-added first within a week,
  and weeks in the order they were first added (latest on top), so add them in play order.
- Showdown down: the script falls back to a copy in `site/<league>/mock/` or `tests/fixtures/`, else stops with a message;
  `--file <saved.json>` uses a copy the user downloaded.
- Check each printed line (players, winner, turns) looks right, run the `test` skill and `.claude/skills/test/run-audit.ps1` (every saved game: PASS, or FAIL lines to fix before committing; with `-All` the lines worth a look, e.g. a stream game's misread HP), take a `screenshot` with
  `-Query tab=games`, then commit `site/<league>/games/` and `site/index.html` (game count on the league list) with a message listing the games added.
