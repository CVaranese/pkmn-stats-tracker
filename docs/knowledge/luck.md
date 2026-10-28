# Luck / RNG: odds and how the replay shows them

Sources: `smogon/pokemon-showdown` master, `data/conditions.ts` and `sim/battle-actions.ts`, read 2026-10-26
(**researched**); log strings from the 30-game Nat Dex corpus + fixtures (**tested** = seen in real logs).

## Cut-offs for the luck words (re-sampled 2026-10-28, tested: tests/luck-sample.html)
- 75 games (45 league, team sheets not used; 30 Nat Dex ladder from tests/corpus/). Player luck (own minus
  opponent's) per game: sd 1.40 league / 1.50 ladder, 1.44 both; |luck| median 1.17 / 1.00, 90th percentile 1.9 / 2.7.
  The old ±0.75 Fair (from 34 games) made most games Lucky or Unlucky. Now Fair within ±1.1, Very beyond ±2.25.
- A Pokémon's own luck per game: sd 0.43, |luck| median 0.08, 75th 0.21, 90th 0.8: heavy-tailed (one crit or miss
  decides it). ±0.25 / ±0.75 kept.
- Season (user 2026-10-28: a plain total mostly grew with games played; a count of lucky games didn't read well):
  first z = total / (sd per game × √games), replaced the same day by the spread from the rolls' own odds (below), games taken as independent. Words: Fair within ±0.67 (middle half of a normal),
  Very beyond ±1.64 (1 in 10). League after Week 8: z from −1.07 (weedinmyhonda) to +0.90 (Karm). **Guess:** the
  Pokémon z is rougher, its per-game luck being far from normal.

## Spread from our own odds (explored 2026-10-28, tests/luck-var.html; on the site the same day)
**Switched (user 2026-10-28):** season luck (Players, Pokémon tab, a player's Pokémon) = total / √(Σ variance), from
`luck_var` / `player_luck_var` that luck.js now puts on rows; words at ±0.67 / ±1.64 as before; tooltips give the
share of seasons it beats (normal CDF, `League.normalCdf`). Per-game words keep the raw cut-offs below (a game's z is
skewed for a Pokémon, and only 3 of 45 games moved). Re-run on the site's rows (scores rounded to 2 places): same
numbers, 19 of 128 Pokémon change word instead of 20, 0 of 12 players. "+1" in words: about one crit more than the odds.

Idea: every scored roll with chance p adds variance p(1−p) to its luck, so a game's (or a season's) expected spread
can be added up from the rolls instead of taken from a sampled sd; z = luck / √(variance).
- **Tested (code read + prototype):** every roll goes through `score()` in site/luck.js as a yes/no with its p, except
  the 2-5 hit count (`hitCountLuck`, scored P(fewer) − P(more): mean 0, variance 0.3025; Loaded Dice ±0.5, variance
  0.25). Rolls with more outcomes are already split into yes/no rolls: sleep is one roll per attempt with its
  conditional chance (1/3, then 1/2), Triple Axel / Population Bomb one accuracy roll per hit. No roll is weighted.
  The p isn't kept today: `scoreValue` gets only the result; adding variance is one more argument.
- **Researched (maths):** rolls are scored one after another, each with its chance given what happened before, so
  the luck total is a sum of zero-mean steps and the variances add even when rolls depend on each other (sleep turns,
  later hits). Player luck = own − opponent's, variance = both sides' sum.
- **Tested, 45 league games (site rows: sheets, Megas) + 30 corpus (no sheets):** the recount matches the site's
  player_luck in all 75. Expected sd per game from the odds 1.39 league / 1.36 corpus (sampled 1.42 / 1.50); one
  game's own sd ranges 0.72–2.32 (league). Σluck² / Σvariance 1.04 league, 1.21 corpus, 1.10 both (1 = odds right).
  Game z: sd 1.15, |z| < 0.67 in 41% (normal 50%), > 1.64 in 14% (normal 10%): a bit wider than the odds say.
  **Guess** why: items / abilities the log doesn't show give wrong p (corpus has no sheets and is wider), a game with
  few rolls is far from normal (one 1/24 crit = z 4.8), flinch counted for each pending hit; 75 games puts about
  ±0.08 on that sd.
- **Tested, Pokémon-games (678 with a roll):** z sd 1.04 but 80% within ±0.67: very skewed (most games are a few
  −1/24 no-crits, a few are one big crit). All Pokémon luck added up: −20.5 against a spread of 12.0 (−1.7 sd); the
  player scale can't show this (own − opponent's cancels it). **Guess:** some systematic under-scoring for the actor
  (unknown items / abilities), as crits came in under the expected count before (see Checked).
- **Tested, season words (normal cut-offs ±0.67 / ±1.64 on both scales):** Players: 0 of 12 change (z sd 0.68 over 12
  players; players' spreads differ, 11.6–19.2 variance over 7–8 games, but not enough to move a word yet). Pokémon tab
  (same rows as a player's Pokémon, each Pokémon has one owner): 20 of 128 change, e.g. Enamorus Lucky → Very lucky
  (4 games, variance 0.16: few rolls, so +0.83 is a lot), Hydrapple Lucky → Fair (variance 2.07: many rolls), Metagross
  Very unlucky → Unlucky. New Pokémon z sd 1.02, 66% Fair, 11% beyond ±1.64. Per game (league, old raw ±1.1 / ±2.25
  vs z ±0.67 / ±1.64): 3 of 45 change.

## Odds (gen 9)
- **Researched:** full paralysis 1/4 per move attempt (`par.onBeforeMove`, priority 1).
- **Researched:** sleep lasts `random(2, 5)` = 2, 3 or 4 "time", one used per move attempt; it wakes when time
  hits 0. So 1, 2 or 3 `cant slp` turns, each 1/3. Chance to wake on attempt 2 = 1/3, attempt 3 = 1/2, attempt 4
  = 1 (attempt 1 never wakes). Rest sets a fixed 2 turns (no luck). Early Bird uses 2 time per attempt.
- **Researched:** freeze thaws 1/5 per attempt; moves with the `defrost` flag thaw the user (not luck).
- **Researched:** confusion self-hit 33/100 per attempt (`-activate|X|confusion` is the check; a hit adds
  `-damage|X|..|[from] confusion`). Confusion running out logs `-end`, no check.
- **Researched:** order of `onBeforeMove` checks: sleep/freeze (10), flinch (8), confusion (3), paralysis (1). So a
  flinched Pokemon doesn't roll confusion or paralysis; a confusion self-hit stops the paralysis roll.
- **Researched:** crit chance by stage, gen 7+: `[0, 24, 8, 2, 1]` → stage 1 (normal) 1/24, 2 = 1/8, 3 = 1/2, 4+ =
  always. moves.json `critRatio` is the stage (missing = 1). +2 Focus Energy, +1 Super Luck / Scope Lens / Razor
  Claw, +2 Leek / Lucky Punch on their users. `willCrit` moves always crit. Fixed-damage moves (Seismic Toss, Super
  Fang...) return before the crit roll. Battle Armor / Shell Armor / Lucky Chant cancel crits.
- **Researched:** accuracy step order: semi-invulnerable, TryHit (Protect, Magic Bounce), type immunity, other
  immunity, then accuracy. So a Protected or immune target has no accuracy roll. Accuracy × stage multiplier
  ((3+s)/3 or 3/(3−s), s = user accuracy − target evasion, clamped ±6). Toxic used by a Poison type can't miss
  (gen 8+). OHKO moves use their own formula (banned in Nat Dex by OHKO Clause; not scored).
- **Researched:** `multiaccuracy` moves (Triple Axel, Population Bomb) roll again for each hit after the first.
- **Researched:** secondaries roll `random(100) < chance` per target after the hit; a target already statused or
  immune fails silently, so those rolls can't be seen. Serene Grace doubles chance; Sheer Force removes them;
  Shield Dust / Covert Cloak on the target remove them.
- **Researched (data/moves.ts):** Hurricane / Thunder can't miss in rain and are 50% in sun (by the target's
  effective weather, so its Utility Umbrella cancels it); the Storm moves can't miss in rain; Blizzard can't miss in
  hail / Snowscape. Psych Up logs `-copyboost|<user>|<target>` (the user gets the target's boosts).
- **Guess (well known, not re-read):** No Guard (either side)
  makes moves never miss. Compound Eyes ×1.3, Hustle ×0.8 (physical), Victory Star ×1.1, Wide Lens ×1.1, Zoom Lens
  ×1.2 if the target moved first, Bright Powder ×0.9, Sand Veil / Snow Cloak ×0.8 in their weather, Wonder Skin
  makes status moves 50%, Gravity ×5/3.

## Log strings (tested)
- `|-crit|<target>` comes before that target's `-damage` (or Substitute) line.
- `|-miss|<user>|<target>`; the `|move|` line also gets `[miss]` (single-target).
- `|cant|X|par`, `|cant|X|slp`, `|cant|X|flinch`; wake-up `|-curestatus|X|slp|[msg]`.
- Substitute hits: `|-activate|X|move: Substitute|[damage]`, broken: `|-end|X|Substitute`.
- `|-fail|<user>` = the move failed before any roll (Sucker Punch...); `|-fail|<target>|tox` = the target was
  already statused (accuracy already rolled).
- 30 games had 22 crits, 19 misses, 6 full paras, 9 sleep turns, 4 flinches: about 2–3 luck events a game.

## Scoring rule (decided with the user, 2026-10-26)
Each roll scores outcome − expectation for the Pokemon it favours: a good result with chance p = +(1−p), a bad
one = −(1−q) where q is the chance of that bad result. A 70% move hitting = +0.3, missing = −0.7; a normal hit =
−1/24, a crit = +23/24. Over many games average luck sums to about 0.

What's scored: accuracy, crits (every damaging hit), status / flinch secondaries, full paralysis, sleep wake-ups,
thawing, confusion self-hits, and multi-hit moves. Not scored (yet): stat-change secondaries, confusion secondaries
(Hurricane), ability procs (Static, Flame Body, Poison Touch), Tri Attack, Quick Claw, damage rolls.

Multi-hit (decided with the user, 2026-10-26):
- 2-5 hit moves (35/35/15/15): the hit count scores P(fewer hits) - P(more): 2 = -0.65, 3 = +0.05, 4 = +0.55,
  5 = +0.85 (averages 0). Loaded Dice (4 or 5, 50/50): -0.5 / +0.5. Skill Link: no roll. No roll when the target
  or the user fainted before the last hit (count cut short).
- Triple Axel / Triple Kick / Population Bomb: one accuracy roll per hit; **researched**: the miss that ends them
  early isn't logged (`break` with no `-miss`), so fewer hits than the maximum with both still standing = a miss.
  Skill Link / Loaded Dice make them check once.
- Both need the user's item known (log or sheet): Loaded Dice is common on exactly these moves and never shows.
  With an unknown item only the first accuracy roll counts.

Unknown abilities (decided with the user, 2026-10-26): an ability is known from the log, a team sheet (not after
Mega Evolution), or a species with one ability (Megas). Otherwise each roll is worked out for every ability the
species can have (pokedex.json `abilities`), for both sides, and skipped unless they all give the same odds. Mold
Breaker / Teravolt / Turboblaze ignore the target's ability. **Tested** (30 corpus games, no sheets): total luck
-10.7 with the check vs -9.1 without; 17 hit-count rolls and 5 Triple Axel / Population Bomb uses, all needing a
sheet for the multi-hit part.

## Key moments (rules set with the user, 2026-10-28)
`Luck.keyMoments` picks scored rolls whose outcome had a 34% chance or less: a crit that KO'd (one that didn't
"made no difference", user 2026-10-28; a crit KO a normal hit would also have scored still counts: no damage
calc), a miss of a move with 80%+ to hit (user 2026-10-28), any Hydro Pump miss whatever the odds (a league joke), a status / flinch secondary that landed (30% or less),
full paralysis, a confusion self-hit, thawing, waking on the 2nd sleep turn. The same Pokémon fully paralyzed on
back-to-back turns is one moment (chances multiplied). Over 10 in a game: the 10 least likely, kept in turn order.
Each roll carries `turn` (parser.js `snap` / `self`). Multi-hit counts aren't moments (no single chance).

## Known blind spots (guess-level impact)
- Items count only when the log reveals them or a team sheet gives them (else: none). An unrevealed Scope Lens or
  Covert Cloak still mis-scores a roll. Abilities: see above (rolls an unknown ability could change are skipped).
- A flinch roll only counts when the target tried to move later that turn (else the result can't be seen).
- When several pending hits could have caused one flinch (doubles, multi-hit), each counts as the flinch.
- Lock-On / Mind Reader / Glaive Rush, Micle Berry, Cloud Nine / Air Lock, Tangled Feet aren't modelled.

## Checked (tested, 2026-10-26)
- On 29 corpus games with live moves.json / pokedex.json, the parser's counts match a grep of the logs: 22 crits,
  18 misses, 4 full paras, 9 sleep turns, 3 flinches, 1 confusion self-hit. About 667 crit rolls and 753 accuracy
  rolls; luck summed over all Pokemon was -6.1 (crits came in a bit under the ~28 expected). Player luck per game
  ranged -3.05 to +3.05.
