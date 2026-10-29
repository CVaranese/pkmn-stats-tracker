# Weekly bet pool (draft, 2026-10-29)

A large pool of props; each week a few are drawn at random (from the week's name, so everyone sees the same ones).
Not on the site: the Gambling tab only teases until betting is built (play money, a shared store and a login are
still undecided: `docs/FEATURES.md`, "Betting with play money"). Every prop settles from what the parser already
counts, named in the last column (row fields from `parser.js` `gameRows`, summed over the week's saved games unless it
says otherwise). Lines (the "3.5" in over / under) would come from the season so far, so they move week to week;
the numbers below are placeholders.

Kinds: **O/U** over / under a line, **Y/N** yes or no, **Pick** one of a list (a player, a Pokémon, a game).

## Luck and RNG
| Prop | Kind | Settles from |
|---|---|---|
| Crits this week: over / under 9.5 | O/U | `crits` |
| A crit lands the KO in some game | Y/N | key moments (`Luck.keyMoments`: crit + KO) |
| Moves missed this week: over / under 7.5 | O/U | `misses` |
| A move of 90% accuracy or better misses | Y/N | rolls (`r.kind` hit, chance >= 0.9, missed) |
| A Pokémon is fully paralyzed twice in one game | Y/N | `full_paras` >= 2 on a row |
| Turns spent asleep this week: over / under 4.5 | O/U | `sleep_turns` |
| A Pokémon wakes up on its first sleeping turn | Y/N | rolls (sleep, woke turn 1) |
| Someone hurts itself in its confusion | Y/N | `confusion_hits` |
| Flinches this week: over / under 1.5 | O/U | `flinched` |
| Secondary effects landed (burns, freezes, stat drops...): over / under 6.5 | O/U | `procs` |
| A freeze happens | Y/N | statuses (frz) in the log |
| Luckiest Pokémon of the week is on the winning side of its game | Y/N | `luck`, `won` |
| The week's biggest luck swing happens in a playoff game (playoff weeks) | Y/N | `player_luck` per game |

## KOs and damage
| Prop | Kind | Settles from |
|---|---|---|
| KOs this week: over / under 40.5 | O/U | `kills` |
| A single Pokémon gets 4 or more KOs in a game | Y/N | `kills` on a row |
| Most KOs of the week: pick the Pokémon | Pick | `kills` |
| Most damage of the week: pick the player | Pick | `damage_dealt_pct` per team |
| A Pokémon is KO'd before it moves | Y/N | `ko_before_moving` |
| Pokémon KO'd before moving this week: over / under 5.5 | O/U | `ko_before_moving` |
| A KO from burn, poison or hazards | Y/N | `passive_kills` |
| A hazard KO | Y/N | `hazard_kills` |
| A self-KO (Explosion, Memento, Final Gambit...) | Y/N | `self_kos` |
| First KO of a game (pick a game): pick the side | Pick | turn strip timeline, first `faint` |
| First KO comes before turn 4 in game X | Y/N | timeline |
| A team loses its lead Pokémon first | Y/N | timeline (first `in` at turn 0, first `faint`) |
| A Pokémon takes over 300% damage and survives | Y/N | `damage_taken_pct`, `survived` |

## Hazards, status and support
| Prop | Kind | Settles from |
|---|---|---|
| Hazards set this week: over / under 10.5 | O/U | `hazards_set` |
| Hazards cleared this week: over / under 4.5 | O/U | `hazards_removed` |
| A game where hazards stay up for 15+ turns | Y/N | `hazard_turns` |
| Statuses inflicted this week: over / under 12.5 | O/U | `statuses_inflicted` |
| Healing this week: over / under 800% | O/U | `healing_pct` + `healing_given_pct` |
| A Pokémon heals more than it took | Y/N | `healing_pct` vs `damage_taken_pct` |
| A Wish / Heal Bell / Healing Wish is used | Y/N | `healing_given_pct` > 0, cures in the log |

## Switching and play style
| Prop | Kind | Settles from |
|---|---|---|
| Switches this week: over / under 60.5 | O/U | `switches` |
| One player makes 10+ switches in a game | Y/N | `switches` per team |
| Pivots (U-turn, Volt Switch, Flip Turn...): over / under 15.5 | O/U | `pivots` |
| A Pokémon is forced out (Roar, Whirlwind, Dragon Tail, Red Card) | Y/N | `forced_out` |
| A Pokémon stays in for 10+ turns straight | Y/N | turn strip timeline |
| A brought Pokémon never comes in | Y/N | `brought`, `turns_on_field` 0 |
| Least info shown by a player: under 35% | Y/N | `info_revealed_pct` |

## Megas, Z-moves and teams
| Prop | Kind | Settles from |
|---|---|---|
| Mega Evolutions this week: over / under 5.5 | O/U | `mega` |
| A Z-move is used | Y/N | `z_move` |
| A Z-move gets a KO | Y/N | `move_stats` (z, kos) |
| The Mega of the week's top Pokémon wins its game | Y/N | `mega`, `mvp`, `won` |
| A team wins without its Mega ever coming in | Y/N | `mega` 0, team with a Mega at team preview |
| A drafted Pokémon is brought for the first time this season | Y/N | draft + rows |
| A traded-in Pokémon gets a KO | Y/N | `draft.json` trades + `kills` |

## How games end
| Prop | Kind | Settles from |
|---|---|---|
| Longest game: over / under 40.5 turns | O/U | `turns` |
| Shortest played-out game: under 15.5 turns | Y/N | `turns`, `end_reason` |
| A forfeit this week | Y/N | `end_reason` forfeit |
| A game ends on the timer | Y/N | `end_reason` timer |
| Someone turns the battle timer on | Y/N | `timer_on` |
| A 6–0 (winner loses no Pokémon) | Y/N | `deaths` per team |
| A 1–0 finish (winner down to its last Pokémon) | Y/N | `deaths` per team |
| A comeback from 30%+ behind on HP | Y/N | `momentum` |
| The team ahead at turn 10 wins | Y/N | `momentum` |
| Average turns per game: over / under 26.5 | O/U | `turns` |
| Longest game in minutes: over / under 25 | O/U | `game_seconds` |

## Sets and standings (Super Champions, best of 3)
| Prop | Kind | Settles from |
|---|---|---|
| Sets going to game 3 this week: over / under 2.5 | O/U | `League.setSlots` |
| A reverse sweep (lose game 1, win the set 2–1) | Y/N | sets |
| Every set ends 2–0 | Y/N | sets |
| The standings leader drops a game | Y/N | sets, standings |

## Player and Pokémon picks (one per week)
| Prop | Kind | Settles from |
|---|---|---|
| Top Pokémon of the week (Awards) | Pick | `League.awards` |
| Biggest comeback of the week | Pick | `League.awards` |
| Luckiest Pokémon of the week | Pick | `League.moreAwards` |
| Most hazard damage | Pick | `hazard_damage_pct` |
| Most switches | Pick | `switches` per team |
| Upset of the week: the player lower in the standings wins | Y/N per game | standings + `won` |

## New kinds of bet (after Dota 2's TI Battle Pass, from memory: season predictions, bracket, per-match questions)
More stats only make variants of the props above (the same count with another line); these are new shapes.

### Before the season / playoffs (locked once the first game is in; settle at the end)
| Prop | Kind | Settles from |
|---|---|---|
| League champion | Pick | bracket / standings |
| Top seed after the regular season | Pick | `League.standings` |
| Most-brought Pokémon of the season | Pick | `brought` |
| Season KO leader (Pokémon) | Pick | `kills` |
| Season KO leader (player) | Pick | `kills` per player |
| Pokémon with the best win rate (5+ games) | Pick | `wins_when_brought` / `games_brought` |
| Luckiest player of the season | Pick | `player_luck` season (fine over a season: many opponents) |
| A player goes unbeaten in the regular season | Y/N | standings |
| Total season KOs: over / under | O/U | `kills` |
| A drafted Pokémon never brought all season | Y/N | draft + `brought` |
| Most-used Mega of the season | Pick | `mega` |
| Highest single-game Performance of the season: over / under 8.5 | O/U | `mvp_score` |

### Bracket (playoffs)
| Prop | Kind | Settles from |
|---|---|---|
| Fill in the bracket: each round's winners (points per right pick, more for later rounds) | Pick ×n | Challonge / sets |
| Exact score of a set (2–0, 2–1, 1–2, 0–2) | Pick | sets |
| A lower seed reaches the final | Y/N | bracket |
| The final goes to game 3 | Y/N | sets |

### One game (picked from the week's games: "the featured game")
| Prop | Kind | Settles from |
|---|---|---|
| First KO (Dota's first blood): pick the side | Pick | timeline, first `faint` |
| First KO's turn: over / under 3.5 | O/U | timeline |
| Rampage: one Pokémon KOs 3+ in the game | Y/N | `kills` on a row |
| Who leads on HP after turn 5 | Pick | `momentum` |
| Lead change: the HP lead flips 2+ times | Y/N | `momentum` |
| The two leads trade KOs (both leads faint) | Y/N | timeline (both turn-0 `in`s `faint`) |
| Team MVP of the winner: pick from its team | Pick | `mvp` |
| Pokémon left for the winner: exactly 1 / 2 / 3+ | Pick | `deaths` per team |
| Total switches in the game: over / under 12.5 | O/U | `switches` |
| A Mega Evolves before turn 3 | Y/N | `mega_turn` |
| A Pokémon is hit by a move it resists (not effective) and still faints | Y/N | log `-resisted` + `faint` (needs a new count) |

### Running totals (count up all season, pay at the end)
| Prop | Kind | Settles from |
|---|---|---|
| Season crits pass 100 before the playoffs | Y/N | `crits` |
| Season forfeits: over / under 4.5 | O/U | `end_reason` |
| Every player brings a Mega at least once | Y/N | `mega` |
| A Pokémon reaches 15 season KOs | Y/N | `kills` |
| Total hazard KOs in the season: over / under 6.5 | O/U | `hazard_kills` |

## Weekly draw (to decide)
- How many props a week (e.g. 5), and whether every kind is in each draw (one O/U, one Y/N, one Pick...).
- Lines: last week's total, the season average, or rounded halfway so there's no push.
- Seeded by league + week, so the draw is the same for everyone and can be shown before the games.
- Settled only from saved replays: a game with no replay (index.json `missing`) can't settle a prop; a prop that
  depends on one is void, stake back.
