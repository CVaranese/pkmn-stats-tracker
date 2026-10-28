# League replays

Every league replay link the user has given, so none get lost before they're in `site/games/`.
Add them with `python -I tools/add_game.py <link> --week "<week>"` (the `add-game` skill), in play order.

| Replay | Week | In site/games/ |
|---|---|---|
| https://replay.pokemonshowdown.com/gen9nationaldex-2684999355 | Week 3 | yes |
| https://replay.pokemonshowdown.com/gen9nationaldex-2689027321 | Week 4 | yes |
| https://replay.pokemonshowdown.com/gen9nationaldex-2693018008 | Week 5 | yes |
| https://replay.pokemonshowdown.com/gen9nationaldex-2696941700 | Week 6 | yes |
| https://replay.pokemonshowdown.com/gen9nationaldex-2705148353 | Week 8 | yes |
| https://replay.pokemonshowdown.com/gen9nationaldex-2705157049 | Week 8 | yes |
| https://replay.pokemonshowdown.com/gen9nationaldex-2677227914 | Week 1 (2026-09-07, Nezergy won; matches round 1 of the bracket) | yes, 2026-10-27 (sprites for Aron, Bronzong, Lycanroc, Enamorus-Therian, Houndstone still to save: Showdown down) |

Weeks confirmed 2026-10-27 from each replay's date and winner against the bracket (Week N = Swiss round N).
No replay given for weeks 1, 2 or 7.

## Stream videos (no replay; rebuilt with tools/video_to_replay.py)

Playlists: Week 1 https://youtube.com/playlist?list=PLe1tROU59cYo, Week 2 https://www.youtube.com/playlist?list=PLc3TezsXgkoE, Week 3 https://www.youtube.com/playlist?list=PLGJlQdSaplkQ.

| Video | Week | Match | In site/games/ |
|---|---|---|---|
| https://youtu.be/9STJZ-Xvmj8 | Week 7 | Sneez vs Karm | yes, 2026-10-27 |
| https://youtu.be/7RgyqzI7yNI | Week 1 | DEJIME vs Fingy | replaced by replay 2676843288 (found 2026-10-27) |
| https://youtu.be/ff5WImD_i3k | Week 1 | Bad Bully vs Big Large | yes, 2026-10-27 |
| https://youtu.be/OA6m3wXIO6s | Week 1 | Pikmon vs Dox | replay 2676850166 found 2026-10-27, in site/games/ |
| https://youtu.be/0ML97b25TdI | Week 1 | PotatoesAreYum vs Nezergy | has a replay (2677227914) |
| https://youtu.be/XmltgmaqObg | Week 1 | Sneez vs Zololab | replaced by replay 2677236487 (the Future Sight guess was right) |
| https://youtu.be/d5iVr2s_7dE | Week 1 | Cloudburst vs Karm | yes, 2026-10-27 |
| https://youtu.be/d1nX5QVh-CA | Week 2 | Sneez vs Nezergy | yes, 2026-10-27 |
| https://youtu.be/yytUZXI96hg | Week 2 | Cloudburst vs Fingy | yes, 2026-10-27 |
| https://youtu.be/dk3Loza-MK4 | Week 2 | PotatoesAreYum vs Zololab | replaced by replay 2680876325 |
| https://youtu.be/Yj0PgVbcblI | Week 2 | DEJIME vs Karm | yes, 2026-10-27 (Kingambit faints twice: Revival Blessing) |
| https://youtu.be/JJaCbPX4g2E | Week 2 | Pikmon vs Big Large | yes, 2026-10-27 (dark theme read with invert) |
| https://youtu.be/4fACABLYaoc | Week 2 | Bad Bully vs Dox | yes, 2026-10-27 (small text garbled; HP numbers rougher) |
| https://youtu.be/27AboXcD_Hk | Week 3 | Pikmon vs Nezergy | has a replay (2684999355) |
| https://youtu.be/OQAm2AwTtBc | Week 3 | Zololab vs Bad Bully | yes, 2026-10-27 |
| https://youtu.be/BGMHhByBbaM | Week 3 | Big Large vs Karm | yes, 2026-10-27 (ElkG forfeited) |
| https://youtu.be/I21S40QI4EM | Week 3 | Dox vs DEJIME | yes, 2026-10-27 |
| https://youtu.be/UFfx_QuquZw | Week 3 | Cloudburst vs PotatoesAreYum | yes, 2026-10-27 (last KO hand-filled from the message box) |
| https://youtu.be/mqDA-Z2vZ9E | Week 3 | Sneez vs Fingy | yes, 2026-10-27 (turn 43 hand-filled from the video) |

Given 2026-10-27 as "all the replays we have for the draft league to this date". Not downloaded that day:
Showdown's replay server was down (`tools/showdown_status.py`: Replays timed out, twice). A background retry
saved them later that day; added with `--file`.

Bracket: https://challonge.com/peepeepeepeepiss, a Swiss tournament with 12 players, one round a week (round 1 done
2026-09-07/08, round 8 under way 2026-10-27). The web page refuses automated fetches (HTTP 403); the v1 API works
with the user's key, kept in `%USERPROFILE%\.challonge_key` (never in the repo). Bracket names are real names
(Karm, Joey, Peter...), not Showdown usernames, so a replay is matched to a match by date + who won, or the user
says who is who.

The three games in site/games/ before this (2705117998, 2705111047, 2705121899, labelled Week 1 / Week 2) were test
entries. The user asked to keep them for trying the site while Showdown is down: they're under week "Samples" with
the note "Test game, not league".

## Replays found on Showdown's search (2026-10-27)

`search.json?user=<name>` for every league Showdown name, matched to Challonge pairings: five league games were
saved after all and are in site/games/: 2676843288 (R1 DEJIME vs Fingy), 2676850166 (R1 Dox vs Pikmon),
2677236487 (R1 Zololab vs Sneez), 2680876325 (R2 Zololab vs PotatoesAreYum), 2696935281 (R6 Zololab vs Dox).
Bracket pairings found with dates long before their round (practice): 2678643274 Fingy vs Sneez (09-10, R3 pair),
2680364125 / 2680371180 Sneez vs Pikmon (09-13, R4 pair), 2684486357 Fingy vs Pikmon (09-20, R5 pair). Not added.

Week 4 (playlist PLOM0N8ucrccY, stream 2026-09-29): Zololab vs DEJIME, PotatoesAreYum vs Bad Bully, Dox vs
Cloudburst, Big Large vs Fingy are in site/games/ from their videos with the winner from Challonge round 4 and the
last KO missing (the stream cut to a replay). Pikmon vs Sneez (ktYq3NES_GM) not added: OCR too poor. Karm vs Nezergy
has a replay (2689027321).

Week 5 (playlist PLV29dBZQCWjY, uploaded 2026-10-07; added 2026-10-27): Pikmon vs Fingy (CKLxgWZL3HM), Dox vs
PotatoesAreYum (vXg51MJkSSw), Zololab vs Karm (oPUD2yUnQrs), Bad Bully vs Sneez (4n49BQ2LQsY), DEJIME vs Big Large
(xcoo3llJSpM) are in site/games/ from their videos, every winner matching Challonge round 5 and the last KO read
from the video (four were added by hand from frames, see docs/knowledge/video-recordings.md). Cloudburst vs
Nezergy (E7IuvY-7OBU) has a replay (2693018008).

Week 6 (playlist PLO8Z8KH9KMh8, uploaded 2026-10-13; added 2026-10-27): Cloudburst vs Bad Bully (-ZRRN-yi98U), Sneez
vs DEJIME (D-SnlPgNt04), PotatoesAreYum vs Fingy (FiVtP9WAcTA) are in site/games/ from their videos, every winner
matching Challonge round 6 and every KO checked against the video. The Cloudburst vs Bad Bully video holds two full
games with the same teams: a played-back one weedinmyhonda won (3:20-11:30) and the live one azpmCloudburst won
(21:50-28:40); only the second is in, since the bracket gives Cloudburst the win. Pikmon vs Karm (efjkWhTidmM) not
added: OCR too poor (dark theme, small text, 190 unconverted lines over 47 turns). Big Large vs Nezergy and Dox vs
Zololab have replays.

Week 7 (playlist PLZdfOlhvaGgA, uploaded 2026-10-21; added 2026-10-27): Bad Bully vs Nezergy (eCis5-Ls6i0), Big Large
vs Zololab (IYsf4aQc3jQ), Pikmon vs PotatoesAreYum (ek4VkZvwnY0), Dox vs Fingy (pq9jWAX63Pc), DEJIME vs Cloudburst
(s2ZnFx4iR1M) are in site/games/ from their videos, every winner matching Challonge round 7. The Pikmon vs
PotatoesAreYum stream shows the live battle id gen9nationaldex-2701939365 in the address bar; it isn't uploaded (404).
Sneez vs Karm (9STJZ-Xvmj8) was already in.
