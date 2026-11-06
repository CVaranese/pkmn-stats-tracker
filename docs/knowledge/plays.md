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

- Brilliant plays' lines (tested unless marked):
  - Destiny Bond: `|-singlemove|<user>|Destiny Bond`; when it pays, `|faint|<user>`, `|-activate|<user>|move: Destiny Bond`,
    `|faint|<attacker>` (Week 4, Iron Valiant takes Gholdengo).
  - Mirror Coat KO: `|move|<user>|Mirror Coat|<foe>`, `|-damage|<foe>|0 fnt`, `|faint|<foe>` (Week 5).
  - Pursuit on a switch: `|-activate|<switcher>|move: Pursuit`, then `|move|<user>|Pursuit|<switcher>|[from] move: Pursuit`
    (video rebuilds leave out the `[from]`), then its damage and faint. 5 Pursuits in Pinecord's games, one KO'd a switch.
  - Encore: `|-start|<foe>|Encore` (video rebuilds: `move: Encore`); it locks the foe's last `|move|`. Ting-Lu's Whirlwind
    (corpus) came right after the Encore in the same turn.
  - Taunt: `|-start|<foe>|move: Taunt`, later `|cant|<foe>|move: Taunt|<move>` (Chilly Reception, Trick Room).
  - Haze: `|-clearallboost` with no Pokémon; Clear Smog: `|-clearboost|<foe>` (guess, none seen). Boosts: `|-boost|` /
    `|-unboost|<mon>|<stat>|<n>`, gone on a switch or drag. Phazing: `|drag|<position>|<details>|<hp>` right after the move.
  - Trick: `|-activate|<user>|move: Trick|[of] <foe>`, `|-item|<foe>|Choice Specs|[from] move: Trick`, then the user's new
    item. Video rebuilds have no `-item` lines, so a Trick there shows no item and doesn't count.
  - Focus Sash: `|-enditem|<mon>|Focus Sash` (video rebuilds: `|-end|<mon>|item: Focus Sash`), then `|-damage|<mon>|1/100`;
    a Sash knocked off has `[from] move: Knock Off`. Sturdy: `|-ability|<mon>|Sturdy` before `|-damage|<mon>|1/100` (Week 4,
    Donphan; corpus, Ogerpon-Cornerstone). `-activate ... ability: Sturdy` is read too (guess).
  - Perish Song: `|-fieldstart|move: Perish Song` after the move. A faint to it: `|-start|<mon>|perish0` then `|faint|<mon>`
    (guess: in no saved game; the one Pinecord Perish Song, a video rebuild, shows no count).

## Rules (decisions)
- Good: a Pokémon switched in this turn takes a hit that's resisted or does nothing. An attack is super effective on
  the Pokémon switching in and wouldn't have been on the one leaving (types only, Freeze-Dry on Water; needs Showdown's
  move and Pokédex data).
- Bad: a Pokémon switched in this turn takes a super-effective hit. A chosen move into a Pokémon already on the field
  that it can't affect, when the reason is its types or an ability already seen this game (Levitate always counts:
  nearly every Levitate Pokémon has only it). A chosen move that fails (not the cases above).
- One call per move (the first effect). Counts per player: good reads, misplays, brilliant plays; no grade yet.
- Brilliant (user 2026-10-29): an unexpected or narrow play, counted only when the log shows its payoff. Destiny Bond takes
  the attacker down; Counter / Mirror Coat / Metal Burst / Comeuppance KOs; Pursuit KOs the Pokémon switching out; Encore
  locks a status move (or a move that had just failed: DEJIME's Thunderclap) and the foe's next action is to switch or use
  it again; Taunt stops a status move (one call per Taunt); Haze / Clear Smog / Roar / Whirlwind / Dragon Tail / Circle
  Throw takes away +2 or more (raised stages added up: Dragon Dance's +1 / +1 is +2); Trick / Switcheroo puts a Choice
  item on a foe whose next action is a status move or a switch (an attack first ends it); a foe faints to Perish Song; a
  Pokémon that lived on Focus Sash / Sturdy KOs a foe with its own move before it faints or leaves. Priority KOs are left
  out. A KO is the move's own `-damage|<foe>|0 fnt` (no `[from]`), so a faint to sand or poison at the end of the turn
  isn't the last move's. Perish Song: the count is the singer's who started it (a second song doesn't restart it).
  Status moves come from Showdown's move data: without it, Encore counts only a failed move, Trick only a switch.
  A brilliant play is good: true but counted apart from good reads.

## Known gaps (guess)
- Can't tell a deliberate sacrifice, a double switch, or a switch with no better option from a mistake.
- A hidden Zoroark's immunities (Zoroark-Hisui, Ghost, under Illusion) would read as the attacker's misplay.
- Missed KOs (a move that would have finished the target) need a damage calc: not done.
- Survey, 48 Pinecord games: 284 calls (144 resisted switch-ins, 34 immune switch-ins, 32 predicted switches,
  49 super-effective switch-ins, 20 failed moves, 5 moves into an immunity); 0 to 7 good reads and 0 to 5 misplays a
  player a game.
- Survey, brilliant (2026-10-29): 13 in the 48 Pinecord games (6 Encore, 2 Taunt, 1 each Destiny Bond, Mirror Coat,
  Pursuit, Haze, Sturdy); none from Roar (the foe had no boosts), Trick (video rebuilds, no item shown) or Perish Song (no
  count shown). 12 in the 30-game corpus (4 Haze, 3 Roar, 2 Sash / Sturdy, Taunt, Encore, Pursuit). 4 of the 6 Encores
  are in video rebuilds.
