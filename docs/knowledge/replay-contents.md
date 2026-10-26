# What's in a Showdown replay

Survey of the 5 replays in `tests/fixtures/` (4 VGC doubles incl. one bo3 game, 1 Random Battle singles), 2026-10-26.
"Seen" = how many of the 5 replays contain it. Everything here is **tested** (seen in these files) unless marked otherwise.
Full protocol reference: `SIM-PROTOCOL.md` in smogon/pokemon-showdown.

## The JSON wrapper (`<id>.json`)

| Field | Example | Notes |
|---|---|---|
| `id`, `formatid`, `format` | `gen9randombattle-2704944065`, `[Gen 9] Random Battle` | |
| `players` | `["Stolemyusername", "Blattur"]` | p1, p2 |
| `uploadtime` | `1793035915` | Unix seconds |
| `rating` | `1782` | Only on rated ladder games; `null` for the VGC/bo3 ones |
| `views`, `private`, `password` | | |
| `log` | | The battle log, below |
| `inputlog` | | **Only in 1/5** (the rated random battle). Every choice each player submitted, plus pre-game ratings: `>player p1 {"name":...,"rating":1757}`, `>p2 move wavecrash terastallize`, `>p1 switch 4` |

## Battle log line types

### Match setup
| Line | Seen | What it gives |
|---|---|---|
| `\|player\|p1\|name\|avatar\|` | 5/5 | Player names and avatars |
| `\|gametype\|doubles` | 5/5 | singles / doubles |
| `\|gen\|9`, `\|tier\|...`, `\|rule\|...` | 5/5 | Format and clauses |
| `\|rated\|` | 1/5 | Rated ladder game |
| `\|poke\|p1\|Blaziken, L50, F\|` | 4/5 | Team preview: all 6 per side (none in Random Battles) |
| `\|teamsize\|p1\|4` | 5/5 | How many each side brings |
| `\|showteam\|p1\|...` | 1/5 | **Open team sheets**: full sets for all 6 (item, ability, 4 moves, nature, gender, level). Only when both players accept OTS (the other VGC games say "rejected open team sheets") |
| `\|uhtml\|bestof\|...Game 2 of a best-of-3...` | 4/5 | Bo3: game number and the set's ID (`game-bestof3-...-2688661098`) |

### Each turn
| Line | Seen | What it gives |
|---|---|---|
| `\|turn\|N` | 5/5 | Turn count |
| `\|t:\|1790514829` | 5/5 | Timestamps (turn timing, game length: these games ran 148–573 s, 5–19 turns) |
| `\|switch\|p1a: Nick\|Species, L50, F\|100/100` | 5/5 | Leads (first switches), switch-ins, nickname → species, HP on entry |
| `\|move\|p1a: X\|Move\|p2b: Y` | 5/5 | Every move used, by whom, on whom; `[spread]`, `[miss]`, `[still]`, `[from] lockedmove` / Sleep Talk |
| `\|cant\|p2b: X\|flinch` | 3/5 | Turns lost to flinch / sleep / paralysis |
| `\|-damage\|X\|87/100` | 5/5 | HP after each hit (% in VGC public replays, exact HP in the random battle); `[from]` for indirect damage |
| `\|-heal\|X\|...\|[from] item: Leftovers` | 4/5 | Healing and its source |
| `\|-supereffective\|`, `\|-resisted\|`, `\|-immune\|`, `\|-crit\|`, `\|-miss\|`, `\|-fail\|` | 2–5/5 | Hit quality |
| `\|-hitcount\|X\|3` | 1/5 | Multi-hit count |
| `\|-boost\|` / `\|-unboost\|X\|atk\|1` | 4/5 | Stat changes (Intimidate, Dragon Dance...) |
| `\|-status\|X\|brn` | 4/5 | Burn / paralysis / sleep etc., with `[from]`/`[of]` source |
| `\|-weather\|SunnyDay\|[from] ability: Drought\|[of] ...` | 3/5 | Weather setter and duration (`[upkeep]` each turn) |
| `\|-activate\|X\|move: Protect\|` | 5/5 | Protect blocks, Mummy, Destiny Bond, confusion... |
| `\|-singleturn\|X\|Protect` | 5/5 | Protect / Follow Me etc. used |
| `\|-start\|` / `\|-end\|X\|Substitute` | 1/5 | Substitute, confusion, Leech Seed, Perish count |
| `\|-ability\|X\|Intimidate\|boost` | 4/5 | Abilities revealed |
| `\|-item\|`, `\|-enditem\|X\|Focus Sash` | 1–3/5 | Items revealed or consumed (Frisk, berries, Sash, Knock Off) |
| `\|-mega\|X\|Gyarados\|Gyaradosite`, `\|detailschange\|` | 4/5 | Mega Evolution (who, when) |
| `\|-terastallize\|X\|Dragon` | 1/5 | Tera (who, which type, when) |
| `\|swap\|...\|[from] move: Ally Switch` | 2/5 | Ally Switch |
| `\|faint\|X` | 5/5 | KOs |
| `\|upkeep\|` | 5/5 | End-of-turn marker |

### Result and room noise
| Line | Seen | What it gives |
|---|---|---|
| `\|win\|name` | 5/5 | Winner |
| `-message ... forfeited` | 0/5 | Forfeit (**researched**, from the protocol docs; not in these fixtures) |
| `\|c\|☆name\|gl hf` | 5/5 | Chat |
| `\|j\|` / `\|l\|`, `\|inactive\|` | 3–5/5 | Spectators joining/leaving, timer warnings |

## Feature ideas this data supports
- **Already used:** kills, deaths, wins, brought vs not, team preview.
- **Usage / team building:** bring rate (picked vs previewed), lead pairs (first two switches), win rate per Pokémon, per lead pair, per team core.
- **Mega / Tera:** who Mega Evolved or Terastallized, what Tera type, on which turn, win rate when used.
- **Damage:** damage dealt and taken per Pokémon (sum of HP-% drops it caused), damage per turn on field, healing done.
- **Moves:** move usage per Pokémon, Protect/Fake Out frequency, crit and miss counts ("luck" stats: crits landed vs received, misses, flinches, full paras).
- **Survival:** turns on field, survived-to-end, KO'd on first turn out.
- **Matchups:** head-to-head records between players, Pokémon-vs-Pokémon KO table (who KOs whom most).
- **Sets (only with open team sheets):** items, abilities, moves, natures per Pokémon.
- **Bo3 sets:** group games into sets by the bestof ID; set wins, game 1 vs games 2–3 adjustments.
- **Pace:** game length in turns and minutes.
- **Ratings (ladder games only):** pre-game Elo per player from `inputlog`, rating trend over time.

## Limits
- Pokémon that were never sent out reveal nothing (no items/moves) unless open team sheets are on.
- HP is a percentage in public VGC replays, so damage stats are in % of max HP, not raw HP.
- `inputlog` and `rating` are missing from these non-ladder VGC replays; don't build features that need them for league play.
- **Guess:** Illusion (Zoroark) shows up as the disguised Pokémon until `|replace|`; not in any fixture yet.
