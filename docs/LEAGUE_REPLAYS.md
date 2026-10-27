# League replays

Every league replay link the user has given, so none get lost before they're in `site/games/`.
Add them with `python -I tools/add_game.py <link> --week "<week>"` (the `add-game` skill), in play order.

| Replay | Week | In site/games/ |
|---|---|---|
| https://replay.pokemonshowdown.com/gen9nationaldex-2705148353 | ? | no |
| https://replay.pokemonshowdown.com/gen9nationaldex-2696941700 | ? | no |
| https://replay.pokemonshowdown.com/gen9nationaldex-2693018008 | ? | no |
| https://replay.pokemonshowdown.com/gen9nationaldex-2689027321 | ? | no |
| https://replay.pokemonshowdown.com/gen9nationaldex-2684999355 | ? | no |
| https://replay.pokemonshowdown.com/gen9nationaldex-2705157049 | ? | no |

Given 2026-10-27 as "all the replays we have for the draft league to this date". Not downloaded that day:
Showdown's replay server was down (`tools/showdown_status.py`: Replays timed out, twice). A background retry
(every 5 min for 12 h) saves them to the session scratchpad as they come back; then add each with `--file`.

Weeks: the bracket is https://challonge.com/peepeepeepeepiss. Challonge refuses automated fetches (HTTP 403), so the
weeks have to come from the user or from opening it in their browser.

The three games in site/games/ before this (2705117998, 2705111047, 2705121899, labelled Week 1 / Week 2) were test
entries and were removed 2026-10-27. They stay as test fixtures and local mocks.
