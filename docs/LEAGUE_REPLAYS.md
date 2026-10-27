# League replays

Every league replay link the user has given, so none get lost before they're in `site/games/`.
Add them with `python -I tools/add_game.py <link> --week "<week>"` (the `add-game` skill), in play order.

| Replay | Week | In site/games/ |
|---|---|---|
| https://replay.pokemonshowdown.com/gen9nationaldex-2684999355 | Week 3 (guess) | no |
| https://replay.pokemonshowdown.com/gen9nationaldex-2689027321 | Week 4 (guess) | no |
| https://replay.pokemonshowdown.com/gen9nationaldex-2693018008 | Week 5 (guess) | no |
| https://replay.pokemonshowdown.com/gen9nationaldex-2696941700 | Week 6 (guess) | no |
| https://replay.pokemonshowdown.com/gen9nationaldex-2705148353 | Week 8 (guess) | no |
| https://replay.pokemonshowdown.com/gen9nationaldex-2705157049 | Week 8 (guess) | no |

Weeks are guessed from the replay numbers: Showdown numbers battles in order, these step by about 4 million a
week, and test game 2705117998 was played 2026-10-26 (bracket round 8). Confirm each from the replay's date and
players against the bracket (Week N = Swiss round N) once downloaded. No replay given for week 7.

Given 2026-10-27 as "all the replays we have for the draft league to this date". Not downloaded that day:
Showdown's replay server was down (`tools/showdown_status.py`: Replays timed out, twice). A background retry
(every 5 min for 12 h) saves them to the session scratchpad as they come back; then add each with `--file`.

Bracket: https://challonge.com/peepeepeepeepiss, a Swiss tournament with 12 players, one round a week (round 1 done
2026-09-07/08, round 8 under way 2026-10-27). The web page refuses automated fetches (HTTP 403); the v1 API works
with the user's key, kept in `%USERPROFILE%\.challonge_key` (never in the repo). Bracket names are real names
(Karm, Joey, Peter...), not Showdown usernames, so a replay is matched to a match by date + who won, or the user
says who is who.

The three games in site/games/ before this (2705117998, 2705111047, 2705121899, labelled Week 1 / Week 2) were test
entries and were removed 2026-10-27. They stay as test fixtures and local mocks.
