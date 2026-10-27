# Feature list

Focus format: **[Gen 9] National Dex** (singles), e.g. https://psim.us/r/gen9nationaldex-2705121899.
Feasibility notes come from 30 recent Nat Dex replays (2026-10-26) plus `docs/knowledge/replay-contents.md`.

Status: `todo` · `in progress` · `done`. Source: **user** = asked for, **idea** = brainstormed, not yet agreed.

## Nat Dex facts that shape these features
- Singles, team preview of 6, everyone brings 6. No Tera (Terastal Clause). Mega Evolution and Z-moves are common (Megas in most of the 30 games, Z-moves in about half).
- **HP is shown as a percentage** (`HP Percentage Mod`), so all damage/healing is in % of max HP unless we get team sheets.
- Ladder replays carry each player's rating in the `|player|` line; league games (unrated) won't.
- Games often end early: in 30 games, 12 forfeits and 2 timer losses (recounted 2026-10-26; was 10) (`lost due to inactivity`).
- Illusion (Zoroark / Zoroark-Hisui) appears in real games.

## Bugs / correctness first
| Status | Item | Notes |
|---|---|---|
| done | **Illusion breaks attribution** | Replay `gen9nationaldex-2705111047`: Zoroark-Hisui disguised as Gardevoir. Fixed: the parser tracks each stay on the field separately and re-assigns the disguised one on `|replace|`. Tested with that replay and a made-up log. A disguise that never breaks can't be detected. The old Python CLI still has this bug. |
| in progress | **Hidden Zoroark: flag and let the user decide** | When a team has Zoroark / Zoroark-Hisui at team preview but its disguise never breaks, stats may sit on the wrong Pokémon. (1) Flag those games in the results. (2) Auto-hint: a "Gardevoir" using a move Gardevoir can't learn but Zoroark can (learnsets from Showdown's data) is almost certainly Zoroark; also a Pokémon being in two places in the team's history. (3) Let the user pick which stays on the field were Zoroark (list each stint with its turns), and save that choice with the replay. Requested 2026-10-26. (1) done 2026-10-26: games listed under the links box and `hidden_zoroark` per row, only when fewer Pokémon were seen than brought (`|teamsize|`). (2) and (3) todo. |
| done | Record how the game ended | `end_reason` (normal / forfeit / timer / tie / unfinished) and `turns` per game row and in exports; filter in the spreadsheet. No on-page filter (user's call, 2026-10-26). |

## Requested features
| Status | Feature | Source | Possible from replays? | Notes |
|---|---|---|---|---|
| in progress | **Luck / RNG score + highlights** | user | Yes, with Showdown's move data | Observable events: crits (`-crit`), misses (`-miss`), full paralysis (`cant par`), sleep turns (`cant slp`), flinches, secondary effects proccing (e.g. Scald burn), confusion self-hits, Focus Sash / Sturdy saves, Quick Claw / Custap, multi-hit counts. Fair "luck score": compare each roll with its odds (a 70% Hurricane that hits = +0.3 luck, a miss = −0.7), summed per player. Odds come from `play.pokemonshowdown.com/data/moves.json` (accuracy, secondary chance; **tested**: a browser page is allowed to fetch it). Highlights: "crit KO", "missed 70% move", "fully paralyzed 2 turns in a row". Damage-roll luck (high vs low roll) needs team sheets + a damage calculator: later. Score + counts done 2026-10-26 (user picked: counts + score, status/flinch secondaries, common modifiers, every normal hit = -1/24): Crits / Crits taken, Misses / Dodged, Full paras, Sleep turns, Flinched, Hit itself, Effects landed, Luck, Luck against, Player luck. Rules in `docs/knowledge/luck.md`. Still todo: highlights, stat-change / confusion secondaries, ability procs, damage rolls. Added same day: multi-hit luck (hit count, per-hit accuracy) and skipping rolls an unknown ability could change. |
| done | **Damage dealt / taken, in raw HP** | user | Yes, with team sheets | Done 2026-10-26: % always, raw HP when the target's team has a sheet (leaderboard HP totals blank unless every game in the row has one). Self-inflicted damage = taken, no dealer; Substitute hits count 0; Disguise bust goes to the attacker (user's choices). Idea: exact-HP replays (`188/312`) already give max HP without a sheet. User wants HP numbers, not %. Needs each player's team sheet (Pokepaste / Showdown export) for the **target's** max HP: computed from base HP (`play.pokemonshowdown.com/data/pokedex.json`), HP EVs, IVs and level (nature doesn't affect HP). Damage per hit = HP-% drop × target max HP. Caveat: public replays round HP to whole %, so each hit is accurate only to about ±1% of max HP (≈ ±4 HP on a 400 HP Pokémon); totals over a game are close but not exact. Same credit rules as kills (direct + indirect), capped at remaining HP so overkill doesn't count. Without a sheet for a team, fall back to % for that team. |
| done | **Healing done** | user | Yes, in % | `-heal` lines: Leftovers (most common by far), Recover-style moves, Wish, drain, Poison Heal, Black Sludge, Grassy Terrain, berries. Split self-healing vs healing given (Wish). Done 2026-10-26: Healed % / Heal given %, HP with sheets. Regenerator isn't in the log, so not counted. |
| done | **Hazard damage** | user | Yes | `[from] Stealth Rock` / `Spikes` damage credited to whoever set them (already tracked for kills). Also: hazards set, removed (Defog / Rapid Spin / Court Change), turns hazards were up. Done 2026-10-26: Hazard % / HP, Hazard KOs, Hazards set, Hazards removed per Pokémon, Hazard turns per player; Court Change hands the swapped hazards to its user. |
| done | **Number of switches** | user | Yes | Split into: voluntary switches, pivots (U-turn, Flip Turn, Volt Switch, Parting Shot, Teleport), replacing a fainted Pokémon, forced out (Roar / Whirlwind / Dragon Tail / Red Card, `|drag|`). Done 2026-10-26: counted on the Pokémon that left (Switches / Pivots / Forced out, incl. Eject Button and Emergency Exit), plus In after KO on the replacement. |
| todo | **Time taken** | user | Partly | Every replay has turn timestamps → game length and average seconds per turn. Per-player time only exists when the battle timer is on (`X has N seconds left`), so it's partial. |
| todo | **Revealed vs unrevealed info** | user | Yes | Per player: Pokémon never sent out (of 6), moves revealed per Pokémon (out of 4), items and abilities revealed. A "how much did you give away" score. |

## More features (agreed 2026-10-26)
| Status | Feature | Notes |
|---|---|---|
| done | Team sheet import | Pokepaste link or pasted Showdown export, one box per team. Matched to a side when all 6 team-preview Pokémon are on the sheet; adds Max HP (from `pokedex.json` base HP + EVs/IVs/level), item, ability, moves to the per-game table. Pokepaste links go into share links (`&t=`); pasted text is kept in the browser only. Used by raw-HP damage. Idea: read `|showteam|` (open team sheets) from the replay itself when present. |
| done | MVP per game | Weighted score from kills, damage, healing, survival. User: "great". Done 2026-10-26 (user picked: one per team, proposed weights): MVP score = dealt%/100 + kills + 0.5 x healed%/100 (self + given) + 0.5 if it survived; Team MVP = top brought score per team (ties: kills, then damage). Leaderboard: MVPs, MVP score / game. Ideas: tune weights after real games, count damage taken for walls, whole-game MVP. |
| done | Mega / Z-move usage | Which Pokémon Mega Evolved / used a Z-move, which Z-move, on which turn, win rate when used. Nat Dex specific. Done 2026-10-26: Mega / Mega turn, Z-move / Z turn per game; Megas, Mega wins, Z-moves, Z wins in the leaderboard (win rate = wins / count in the sheet). Primal Reversion / Ultra Burst not counted (banned in Nat Dex OU). |
| todo | KO matrix | Which Pokémon KO'd which most often across a season. |
| todo | Leads | Lead Pokémon per player and lead matchup win rate. |
| done | Survival | Turns on field, alive at the end, KO'd the turn it came in. Done 2026-10-26: Turns on field (turns it started on the field), Survived, KO'd before moving (fainted in a stay before acting; covers being outsped right after replacing a KO'd teammate, which "same turn" would miss). |
| todo | Status inflicted | Burns / paralysis / toxic / sleep spread, and damage done through them. |
| todo | Momentum | Turn-by-turn "Pokémon remaining" / total HP chart per game. |
| todo | Head-to-head | Player vs player records across the season. |
| todo | Season view | Combine many replays, filter by week / player, standings table. |
| done | Team summary (one game) | Requested 2026-10-26: a card per team above the table, MVP card with damage dealt / taken etc., team info, sprites. Done 2026-10-26: only shown when one replay is loaded; Showdown sprites (gen5 for the team strip, ani → dex → gen5 for the MVP), initials if a sprite fails. |
| done | Column tooltips | Requested 2026-10-26: hovering a column name explains it. Done 2026-10-26 (`title` on each header, also on the team-summary stats). |
| done | League theme | Requested 2026-10-26: colours, logo or background from the league banner. Done 2026-10-26: banner in the header (`site/img/pinecord-banner.webp`), tiled wall background, cream panels, striped-floor divider, light and dark. |
| done | One game / Several games tabs | Requested 2026-10-26: focus on one game, with a tab for a collection (playoffs ~2026-11-09). Done 2026-10-26. |
| todo | Several leagues, each with its own theme | User 2026-10-26: another section with a different theme later, unsure how: separate links or a league selector. Suggestion: one config per league (name, banner, colours) picked by the link (`?league=pinecord` or `/pinecord/`), so each league shares its own link and there's no selector to explain. |
| todo | Animated sprites in the local version | The live site shows Showdown's animated sprite for the selected Pokémon; the local version only has the still gen5 copies in `site/sprites/gen5/`. Save `sprites/ani/<id>.gif` for the saved games when there's time (slow download). |
| todo | YouTube title button (for Pikmon) | Requested 2026-10-27: a button that writes a video title for the loaded game (players, result, standout Pokémon). Format to agree with Pikmon. |
| todo | Thumbnail info button (for Fingy) | Requested 2026-10-27: a button that gathers what a thumbnail needs (players, teams / sprites, result, MVPs), ready to copy. Which fields: ask Fingy. |
| in progress | Game library per league | Requested 2026-10-27: store and group games so they can be browsed per league, with labels (week, playoffs, players). User picked (2026-10-27): a file in the repo that we add to (`tools/add_game.py`), a saved copy of every replay, and a replay player. Done 2026-10-27: `site/games/index.json` + copies, Games tab (by week, player / week filter, Stats / Watch), Watch the battle via Showdown's replay-embed.js in `site/watch.html`. Spoiler-free by default (2026-10-27): no winner / turns until "Show results", team-preview sprites per game, Watch plays in the Games tab. `tools/showdown_status.py` checks Showdown before fetching. Todo: the real league games, several leagues (the `league` field is stored but not shown yet), team sheets saved per game. |
| todo | Player stats | Requested 2026-10-27: a page per player across their games, including all of their drafted Pokémon (also ones they never brought). Needs the draft lists. |
| in progress | Gambling / sportsbook | Requested 2026-10-27: betting on league games. Placeholder Gambling tab added 2026-10-27 (next to One game / Playoffs); rules, odds and settling from replays to design. |
| todo | Readability of the tables | User 2026-10-26: "hard to read", open to suggestions. Ideas: column groups (Kills / Damage / Healing / Switches / Luck / Survival) to show or hide, Player + Pokémon columns that stay put while scrolling sideways, dim zeros, a colour per player. |

## Done
- Kills (direct / passive) and deaths per Pokémon, wins, brought vs not.
- Damage dealt / taken in % and, with team sheets, raw HP.
