# Reads and misplays (site/plays.js)

Choices a replay's log alone shows were good or bad. A trial (user 2026-10-29): the user checks the calls by hand on
Main viewer before deciding to keep or remove it. No engine and no damage calc.

## Log facts (tested on Pinecord's saved games, 2026-10-29)
- An attack's effect follows its `|move|` line: `|-supereffective|<target>`, `|-resisted|<target>`, `|-immune|<target>`
  (with `[from] ability: X` for an ability immunity, e.g. Levitate), before the `|-damage|` line.
- `|-fail|<mon>` after a move: Sucker Punch / Thunderclap into a status move, a second Protect / Endure in a row, Fake Out
  after the first turn, Thunder Wave on a paralyzed Pokémon (`|-fail|<mon>|par`), Substitute without the HP
  (`move: Substitute`), Rest, weather already up. `|-fail|<mon>|unboost` is a stat drop blocked by the target (Defog,
  Parting Shot into Clear Body): not a mistake.
- `[notarget]` on a move: its target was already gone. `[from]lockedmove`: Outrage / Petal Dance continuing, not chosen.
- Encore: `|-start|<mon>|Encore` ... `|-end|<mon>|Encore`; the moves between aren't chosen (DEJIME's Raging Bolt,
  Week 8: Thunderclap failed on turn 17, Encored, failed three more times).
- Switches by choice come between `|turn|` and `|upkeep|` (a pivot's switch too); a replacement after a faint comes after
  `|upkeep|`, leads before `|turn|1`.

## Rules (decisions)
- Good: a Pokémon switched in this turn takes a hit that's resisted or does nothing. An attack is super effective on
  the Pokémon switching in and wouldn't have been on the one leaving (types only, Freeze-Dry on Water; needs Showdown's
  move and Pokédex data).
- Bad: a Pokémon switched in this turn takes a super-effective hit. A chosen move into a Pokémon already on the field
  that it can't affect, when the reason is its types or an ability already seen this game (Levitate always counts:
  nearly every Levitate Pokémon has only it). A chosen move that fails (not the cases above).
- One call per move (the first effect). Counts per player: good reads, misplays; no grade yet.

## Known gaps (guess)
- Can't tell a deliberate sacrifice, a double switch, or a switch with no better option from a mistake.
- A hidden Zoroark's immunities (Zoroark-Hisui, Ghost, under Illusion) would read as the attacker's misplay.
- Missed KOs (a move that would have finished the target) need a damage calc: not done.
- Survey, 48 Pinecord games: 284 calls (144 resisted switch-ins, 34 immune switch-ins, 32 predicted switches,
  49 super-effective switch-ins, 20 failed moves, 5 moves into an immunity); 0 to 7 good reads and 0 to 5 misplays a
  player a game.
