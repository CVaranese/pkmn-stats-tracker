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
| https://replay.pokemonshowdown.com/gen9nationaldex-2705438906 | Week 8 (2026-10-27, PotatoesAreYum won vs Big Large; week from date and replay ID next to the other Week 8 games) | yes, 2026-10-27 (both sheets full) |
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
last KO missing (the stream cut to a replay). Pikmon vs Sneez (ktYq3NES_GM): OCR too poor; added 2026-10-27 from the user's 16 screenshots of the log (turns 1-24, then pee nation forfeited; Peter won round 4 on Challonge). Karm vs Nezergy
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
(21:50-28:40); only the second is in: the first was illegal and the set was replayed (user, 2026-10-27). Pikmon vs Karm (efjkWhTidmM): OCR too
poor (dark theme, small text, 190 unconverted lines over 47 turns); added 2026-10-27 from the user's screenshots of
the log (turns 1-46, turn 47 told in words), PeterPikmon won; not yet checked against Challonge round 6. Big Large vs Nezergy and Dox vs
Zololab have replays.

Week 7 (playlist PLZdfOlhvaGgA, uploaded 2026-10-21; added 2026-10-27): Bad Bully vs Nezergy (eCis5-Ls6i0), Big Large
vs Zololab (IYsf4aQc3jQ), Pikmon vs PotatoesAreYum (ek4VkZvwnY0), Dox vs Fingy (pq9jWAX63Pc), DEJIME vs Cloudburst
(s2ZnFx4iR1M) are in site/games/ from their videos, every winner matching Challonge round 7. The Pikmon vs
PotatoesAreYum stream shows the live battle id gen9nationaldex-2701939365 in the address bar; it isn't uploaded (404).
Sneez vs Karm (9STJZ-Xvmj8) was already in.

## Super Champions League (site/scl/games/, added 2026-10-28)

From the user's Discord paste of the league's replay channel (2026-06-29 to 2026-10-02): 155 games in
site/scl/games/, every link in the paste that loads. Weeks 1-8: the league sheet's Data tab schedule (Week / C1 / C2
columns); every scheduled pair has its set, and every replay's two players match its pair. Weeks 9-11 aren't on the
sheet (12 coaches, 11 opponents each, 8 weeks scheduled): the 18 pairs not on it split into three rounds where each
coach plays once in exactly one way, used with the user's OK; Week 9 = Aargab-Kirbyhat, Dox-Leaf, Soop-Ryan,
Matt-benito, Sean-Lieby, Fayz-Saltyswede; Week 10 = Kirbyhat-Ryan, Soop-Lieby, Sean-Fayz, Matt-Leaf,
Saltyswede-benito, Aargab-Dox; Week 11 = Dox-Kirbyhat, Fayz-Aargab, Leaf-Ryan, Matt-Soop, Sean-Saltyswede,
Lieby-benito.

Playoffs (Soop's bracket post, 09-21; second paste from the user, 2026-10-28): seeds 1 Fayz (bye), 2 Mattio, 3 Kirbyhat,
4 Aargab, 5 Saltyswede, 6 Soop, 7 Ryan. Playoffs R1: Ryan 2-0 Mattio, Soop 2-0 Kirbyhat, Aargab 2-1 Saltyswede (only
game 3 posted, 2688929438). Semifinals: Fayz 2-0 Ryan, Aargab 2-1 Soop. Third place: Ryan 2-0 Soop. Finals: Aargab 2-0
Fayz (Fayz's game 3 link 2699096769 is 404).

Checked 2026-10-28 (165 games, 69 sets): every game's two players are its pair; no set has a game after it was won;
Weeks 1-8 results match the sheet's Schedule scores except three. Week 3 Soop vs Kirbyhat: sheet 2-1, the one Kirbyhat
win wasn't posted. Week 3 Leaf vs Fayz and Week 6 Lieby vs Aargab: the replays give Fayz 2-1 and Aargab 2-1, the sheet
the reverse (sheet entered the wrong way round?). tests/audit.html?league=scl: kills, winners, turns, MVPs and team
preview all hold. Its FAILs were Pokémon off the coach's current roster: free-agent moves, now in draft.json `trades`
from the user's paste of the Discord posts (Soop after Week 1, Aargab and Mattio after Week 2, Dox twice after Week 3,
Leaf after Week 6, past the Week 5 deadline but on the sheet's roster). Every dropped Pokémon was last used before its
week and every pickup first appears after it; the audit counts a trade's dropped Pokémon as drafted, and passes.

Showdown names: AnimaSean0724 = Sean, Fayz Sharpie = Fayz, yungsmokey = Mattio, Leafeon Main? = Leaf, Philly Turtles
= Saltyswede, Tijerben000 = benito, aargab11 = Aargab, Ryan Regirocks = RyanGab, Liebynight01 = Lieby, soupy36 = Soop,
kirbyhat5 = Kirbyhat, doxsego = Dox.

Not in (no replay):
- Fayz's third link is 404 in every set he posted (2-0 sets, so there was no game 3): 2642940767, 2648498993,
  2657458699, 2662470763, 2664601299, 2668554697, 2673621399, 2679658199, 2691890619.
- Week 5 Lieby vs Dox: Dox posted battle-room links (bo3-2658025100, -2658030120), not replays; Discord has an
  attachment of game 2 (Gen9ChampionsVGC2026RegMBBo3-2026-07-31-liebynight01-doxsego.html) and Dox's kills by hand.
- Week 9 Dox vs Leaf, Week 10 Aargab vs Dox ("aargab11 2-0 dox", screens closed), Week 11 Matt vs Soop (played on
  Champions, Matt 2-0, recording too big): no replay posted.
- Week 3 Soop vs Kirbyhat: the sheet says 2-1 but only Soop's two wins were posted.
## Team sheets

Saved in `site/mock/<game id>-<player>.txt`; each game lists its players' sheets in `site/games/index.json` (`sheets`).
- Week 8 PeterPikmon vs weedinmyhonda, Week 8 ElkGBigLarge vs potatoesareyum: both sheets, from the user.
- doxsego's own sheets (from the user), matched to games by team: Weeks 1-6. On the Week 2 sheet (vs weedinmyhonda) the opponent is "Bah Booey"; the
  Week 6 sheet's "Week 7" label was a typo.
- potatoesareyum, Week 7 vs peterpikmon.
- FingerStripes (Fingy), from the user 2026-10-28: Weeks 1-7 saved and matched (all 6 Pokémon each). Week 1 (vs DEJIME,
  2676843288): the sheet had Jirachi but the game brought Suicune; user: swap in what the game shows, so the Suicune set
  is only that (Nightwing, shiny, Leftovers, Pressure, Calm Mind / Substitute / Ice Beam; no EVs line, so its max HP
  is a guess). Nothing else in that game contradicts the sheet. Held in `docs/sheets-pending/`: Week 8 vs Karm (no
  Week 8 Fingy vs Karm game saved yet).
