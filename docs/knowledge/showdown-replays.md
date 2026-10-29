# Showdown replays: what we know

## Fetching
- **Tested:** `https://replay.pokemonshowdown.com/<id>.json` returns `id, format, players, log, uploadtime, views, formatid, rating, private, password`. `.log` gives the log only.
- **Tested:** missing or unsaved replays return HTTP 404 with an empty body (e.g. `gen9championsvgc2026regmb-2691890619`).
- **Tested (2026-10-26):** the replay server sends `Access-Control-Allow-Origin` echoing the request origin (checked with `Origin: https://example.github.io`) for both `<id>.json` and `search.json`, so a GitHub Pages site can fetch replays from the browser with no backend. Confirmed end to end: `site/` served from `http://127.0.0.1:8765` in headless Edge fetched 3 live replays and got the 404 for the missing one.
- **Tested:** `search.json?format=<formatid>` lists recent replays (newest first); `&user=<name>` filters by player, `&before=<uploadtime>` pages back.
- **Tested:** bo3 formats have their own IDs (`gen9championsvgc2026regmbbo3-...`); each game in a set is a separate replay. Game logs carry `|uhtml|bestof|...Game N...` and a `|uhtml|next|` link to the next game. The bestof line links "a best-of-3" to `/game-bestof3-<format>-<id>` (relative: in our replay player it pointed at our own site, a 404); `https://replay.pokemonshowdown.com/game-bestof3-...` is "Replay Not Found" too (tested 2026-10-28), so site/watch.html drops that link and keeps the words.

## Game dates (user, 2026-10-28)
- **From the user:** the site shows no dates, only the week ("too detailed, don't want things tracked too much"). `index.json` keeps one date per game, its week's Sunday (`week_sunday` in `tools/add_game.py`), only for ordering; never a more exact day or time.
- **From the user:** league games are played on the game day, typically Sunday 9pm Pacific; dates on the site are that day, not the upload day. `uploadtime` is Unix seconds, so a Sunday-night replay is Monday in UTC: `tools/add_game.py` (`pacific_date`) and `site/parser.js` convert to US Pacific. Stream videos have no save time; they're dated the Sunday before the upload (`--date`).

## Log format (pipe-delimited, see SIM-PROTOCOL.md in smogon/pokemon-showdown)
- **Tested:** identifiers are `p1a: Nickname`; Ally Switch (`|swap|`) changes the slot letter, so key Pokémon by side + nickname, not slot.
- **Tested:** the KO line is `|-damage|<mon>|0 fnt` and `|faint|` can come several lines later (after Mummy, Spicy Spray, Rough Skin, Life Orb lines), so attribute on the damage line.
- **Tested:** direct damage has no `[from]` tag and follows the attacker's `|move|` line. Indirect damage has `[from] <effect>` and often `[of] <source>`.
- **Tested:** Spicy Spray burn arrives as `|-status|X|brn|[from] ability: Spicy Spray|[of] <scovillain>`, and that burn can KO after the Scovillain faints (replay `gen9championsvgc2026regmbbo3-2685575238`).
- **Tested:** recoil is `[from] Recoil` with no `[of]` (replay `gen9randombattle-2704944065`).
- **Tested:** Random Battles have no `|poke|` team-preview lines; Pokémon that never switch in don't appear in the log at all.
- **Tested:** HP is `NN/100` in public VGC replays, but exact HP (`188/312`) in the random-battle replay checked.
- **Guess (not seen in a real replay yet):** exact formats of Destiny Bond, Perish Song, Future Sight, Leech Seed, hazard and weather KOs follow SIM-PROTOCOL.md; covered only by hand-written test logs.

## Damage and HP (survey of 30 Nat Dex corpus replays + fixtures, 2026-10-26)
- **Tested:** `-damage` `[from]` tags seen: none (direct, 825), Stealth Rock 84, psn 69, brn 49, item: Life Orb 33, item: Rocky Helmet + `[of]` holder 28, ability: Rough Skin + `[of]` 25, Spikes 14, Recoil 4, move: Sand Tomb (`[partiallytrapped]`) 2, confusion 1, `pokemon: Mimikyu-Busted` 1.
- **Tested:** `|switch|` lines carry the HP the Pokémon comes in with (`66/100 brn`), including HP regained while out (Regenerator Amoonguss back at `93/100`), so each stay on the field starts from a known HP.
- **Tested:** Substitute: `|-start|X|Substitute` then `|-damage|X|75/100` with no `[from]` (the user's own move is resolving, so it reads as self-damage). A hit on the sub is `|-activate|X|Substitute|[damage]` with no HP line.
- **Tested:** Disguise (replay `gen9nationaldex-2705117998`): during the attacker's move, `|-activate|X|ability: Disguise`, `|-damage|X|100/100` (no change), `|detailschange|X|Mimikyu-Busted`, then `|-damage|X|88/100|[from] pokemon: Mimikyu-Busted` with no `[of]`.
- **Tested:** Pain Split is `|-sethp|X|47/100|[from] move: Pain Split|[silent]`, one line per side, no `-damage`.
- **Tested:** healing is `|-heal|X|26/100|[from] item: Sitrus Berry` (drain: `[from] drain|[of] <target>`).
- **Guess:** Salt Cure / Curse residual damage, and a Destiny Bond / Perish Song faint with no 0 HP `-damage` line first, follow SIM-PROTOCOL.md; only covered by hand-written test logs.
- **Guess (from memory of Showdown's code, not checked):** the shown % is rounded up (only 0 at 0 HP), which is why each hit is quoted as ±1% of max HP.
- **Decision (user, 2026-10-26):** damage is credited like kills; self-inflicted damage (recoil, Life Orb, confusion, Substitute cost, own weather, ally hits) counts as taken with no dealer; Substitute hits count 0 (no HP lost); the Disguise bust counts for the attacker that broke it. Also decided here (not asked): Pain Split lowering HP counts for its user; a faint with HP left counts that HP, credited like the kill (Destiny Bond user, Perish singer; Explosion user = no dealer).

## Hosting / Node
- **Tested (2026-10-26):** the project itself uses no Node and no npm packages; the only Node is inside GitHub's own Pages actions, run on GitHub's servers. Older majors (`checkout@v4`, `configure-pages@v5`, `deploy-pages@v4`) run on Node 20 (end of life April 2026); current majors (`checkout@v7.0.1`, `configure-pages@v6.0.0`, `deploy-pages@v5.0.1`) declare `using: node24`. `upload-pages-artifact@v5.0.0` is a composite action wrapping `upload-artifact@v7.0.0`. Workflow pins these by commit SHA; Dependabot (`.github/dependabot.yml`) proposes updates monthly.

## Kill rules (decided with the user, 2026-10-26)
Direct = attacker that landed the KO hit (spread moves can earn 2; Destiny Bond counts as direct). Passive = indirect damage credited to its cause. If the cause is its own side (confusion, ally hit, own weather), the last opponent that damaged it gets a passive kill; no such opponent → no kill. Recoil, Life Orb and the HP cut of Steel Beam / Mind Blown / Chloroblast, and Explosion/Memento etc.: death, no kill, counted in `self_kos`.
- **Decision (user, 2026-10-27):** recoil KOs (Life Orb counts as recoil) give nobody the kill, and a "Self KOs" column counts them (Explosion, Memento and the like included). Confusion, own weather and ally hits still credit the last opponent. Prompted by Week 7 DEJIME vs Cloudburst, where Archaludon's Steel Beam KO'd itself.
- **Guess:** the video converter writes Steel Beam's HP cut as `[from] Mind Blown` (the client's shared "cut its own HP" text); what a real replay writes for Steel Beam isn't checked, so `steelbeam` and `mindblown` are both treated as self-inflicted. Forfeit: survivors are not deaths.

## Entry hazards (2026-10-26)
- **Tested** (30 Nat Dex corpus replays): set as `|-sidestart|p2: Name|move: Stealth Rock` (Stealth Rock, Toxic Spikes, Sticky Web carry `move: `; Spikes is plain `Spikes`), one line per layer, right after the setter's `|move|`. 37 set in 30 games: 25 Stealth Rock, 8 Spikes, 2 Toxic Spikes, 2 Sticky Web.
- **Tested:** removal is `|-sideend|p1: Name|Stealth Rock|[from] move: Defog|[of] p1a: Mon` (Rapid Spin the same). Gen 9 Defog clears both sides, so 2 of 20 removals were a Defog clearing the user's own team's hazards from the opponent's side; those don't count as "removed".
- **Tested:** Court Change is `|move|...|Court Change` then `|-swapsideconditions` (no arguments) and `|-activate|...|move: Court Change`. 1 corpus game. Decision (user, 2026-10-26): the swapped hazards count as the Court Change user's.
- **Guess:** Mortal Spin and Tidy Up use the same `[from] move: X|[of]` form as Rapid Spin; not seen in the corpus.
- Decision: hazard turns = turns that ended with any entry hazard on the opponent's side, plus the turn the game ended in.

## Healing (2026-10-26)
- **Tested** (30 Nat Dex corpus replays, 322 `-heal` lines): 224 Leftovers, 41 untagged (Recover / Roost / Soft-Boiled: the move's user), 15 `[silent]`, 13 Poison Heal, 7 `[from] drain|[of] <the foe hit>`, 6 Sitrus Berry, 6 `[from] move: Wish|[wisher] <nickname>`, 5 Grassy Terrain, 4 Black Sludge, 1 `[from] move: Lunar Dance`.
- **Tested:** the `[silent]` heals are Rest (right after `-status|X|slp|[from] move: Rest`) and Terapagos' Tera Shift refilling HP after `detailschange` (not healing).
- **Researched** (Showdown `sim/battle.ts` `heal()`, master, 2026-10-26): a heal caused by a move is logged with no tag; Leech Seed and Rest heals are `[silent]`; drain is `[from] drain|[of] <source>`; other effects are `[from] <effect>` plus `[of] <source>` when the source isn't the healed Pokémon (so Water Absorb names the attacker, Hospitality the ally). Z-Memento / Z-Parting Shot: `-activate|<user>|healreplacement`, then `-heal|<replacement>|..|[from] move: Memento|[zeffect]` (`data/conditions.ts`).
- **Tested:** Regenerator logs no `-heal`; the regained HP only shows on the next `|switch|`. Not counted.
- Decision (not asked): Healed % = HP restored to itself; Heal given % = HP restored to a teammate (Wish, Healing Wish, Lunar Dance, Z-move heals, Heal Pulse and other heal moves on an ally, Hospitality). Water Absorb from an ally's Surf counts for the holder. Overheal doesn't count.

## Switches (2026-10-26)
- **Tested** (corpus): a pivot's incoming Pokémon carries the move, `|switch|p1a: X|..|100/100|[from] U-turn` (55 U-turn, 19 Flip Turn, 10 Volt Switch, 4 Parting Shot, 1 Teleport); plain switches have no tag. Roar / Whirlwind / Dragon Tail are `|drag|` (11). In 29 of 30 games, switch lines = these kinds + 2 leads exactly (the 30th has no switches at all).
- **Researched** (`sim/battle-actions.ts`, `data/items.ts`, `data/abilities.ts`): the `[from]` is the move that set the switch flag (so Baton Pass / Shed Tail are pivots too). Eject Button / Eject Pack log `-enditem|X|Eject Button` (Knocked Off has `[from] move: Knock Off`); Emergency Exit / Wimp Out log `-activate|X|ability: Emergency Exit`. Neither was seen in the corpus.
- Decision (not asked): counted on the Pokémon that left (Switches by choice / Pivots / Forced out); "In after KO" on the Pokémon that replaced a fainted one.

## Hidden Zoroark (2026-10-26)
- **Tested:** `|teamsize|p1|4` gives how many Pokémon a side brought (4 in VGC, 6 in Nat Dex).
- Decision (user, 2026-10-28): a side whose `|teamsize|` is at least its team preview (singles, 6 of 6) brought every one of them: a Pokémon that never came in still counts as played (a game, survived, 0 everything else). Bring 4 of 6 (VGC): only the ones that came in count, because the log never names the picks that stayed in the back (tested on the VGC fixtures: `|teamsize|p1|4` follows `|teampreview|4`, no list of picks).
- Decision (not asked): a side is flagged when Zoroark is at team preview, Zoroark never appears as itself, and fewer species were seen than brought. A Zoroark revealed once may still have hidden in another stint; that isn't flagged.

## Which stays were the hidden Zoroark (2026-10-28, site/illusion.js)
- **Tested:** `site/data/learnsets.json` comes from `dist/data/learnsets.js` + `pokedex.js` of the `pokemon-showdown` npm package 0.11.11 (jsdelivr), via `tools/learnsets.py`: every generation and source, plus pre-evolutions' moves, forms without a list use the base species', Smeargle is any move. 1500 species, 1.1 MB (119 KB gzipped). Spot checks: Donphan can't learn Shadow Ball or U-turn, Zoroark-Hisui can't learn Hidden Power, Stealth Rock or Earthquake but can learn Shadow Ball and U-turn; Zeraora learns Hidden Power.
- **Tested** (gen9nationaldex-2696941700, nezergy): a disguised Zoroark-Hisui came in as "Donphan" at 100%, got burned, left at 89% brn, and came back as "Donphan" at 89% brn: the switch line shows Zoroark's own HP and status. The real Donphan's first switch-in showed 100%.
- **Researched** (`dist/data/abilities.js` 0.11.11, `illusion`): `onDamagingHit` ends Illusion with `|replace|` + `|-end|...|Illusion`, so a stay hit by a move with no `|replace|` wasn't Zoroark (a hit on a Substitute isn't a damaging hit: guess from how Substitute works, not checked). `onFaint` just clears the disguise, no `|replace|`: a disguised Zoroark that faints to burn or hazards stays hidden in the log, so a faint doesn't rule a stay out. `onBeforeSwitchIn` copies the last Pokémon after Zoroark in the party that hasn't fainted; party order isn't in the log, so illusion.js doesn't use it.
- Decision (not asked): stays proven to be Zoroark (the only reading where HP, status and moves add up) are moved to it without asking. Decision (user, 2026-10-28): other picks are the league admin's, rolled out with `tools/set_illusion.py` (index.json `illusion`, overrides proven stays); only the local site shows the Move buttons.

## Sprites (team summary, 2026-10-26)
- **Tested:** `https://play.pokemonshowdown.com/sprites/gen5/<id>.png` and `ani/<id>.gif` loaded for all 12
  Pokémon of gen9nationaldex-2705117998 (Iron Crown, Tapu Koko, Zamazenta, Kingambit… included).
- **Guess (from Showdown's naming):** `<id>` = species ID, plus `-` + form ID for forms: `urshifu-rapidstrike`,
  `necrozma-dawnwings`, `latios-mega`. Names whose hyphen is part of the species have none: `hooh`, `porygonz`,
  `kommoo`, `chienpao`, `nidoranf`. Only the gen9nationaldex-2705117998 team was checked; `app/core.js` falls back to
  initials when a sprite fails.
- **Tested:** team preview can show `Zamazenta-*` while plain `Zamazenta` is sent out, so `-*` must also match the
  base form, not only `Zamazenta-Crowned`.
- **Tested (2026-10-27):** all 62 ids missing from `site/sprites/gen5/` downloaded with the `spriteId` rule, none
  failed, including `aegislash-blade`, `enamorus-therian`, `sinistcha-masterpiece`, `keldeo-resolute`, `basculegion-f`,
  `charizard-megax`. To refill: collect species from `site/ppppp/games/` teams and switch/detailschange lines, fetch the missing.
- **Tested (2026-10-28):** the Super Champions League's games (Champions VGC) needed 64 more; 60 saved (gen5 and ani),
  but `dragalge-mega`, `eelektross-mega`, `pyroar-mega` and `staraptor-mega` (Megas new in Champions) are 404 in
  `sprites/gen5/`, so they show initials. The replay JSON API answers 403 to Python's default User-Agent; any
  User-Agent header (add_game.py sends `showdown-replay-stats`) gets 200.

## Offline move / Pokédex data (2026-10-26)
- **Tested:** `site/data/moves.json` and `pokedex.json` were made from the `pokemon-showdown` npm package 0.11.11
  (`dist/data/moves.js`, `dist/data/pokedex.js` on cdn.jsdelivr.net, published 2026-07-28), read as text by `tools/showdown_data.py`, a Python
  script (functions skipped, the JS isn't run) and trimmed to the fields luck.js / teams.js read. Spot checks:
  Thunder 70% acc / 30% par, Scale Shot 2-5 hits, Triple Axel multiaccuracy, Seismic Toss `damage: "level"`,
  base HP Garchomp 108, Blissey 255, Shedinja 1, Zamazenta-Crowned 92. Luck on 2705117998 matched the live site.
- **Tested:** cosmetic forms (Gastrodon-East, Burmy-Sandy…) have no stats in pokedex.js; filled from the base species.
- **Guess:** the live `play.pokemonshowdown.com/data/moves.json` is built from the same server data, so field
  names match; not compared side by side (Showdown was down).

## Luck score spread (2026-10-26, 30-game corpus + 4 Nat Dex fixtures)
- **Tested:** player luck (own minus opponent's) over 68 player-games: p10 -2.51, p25 -0.92, median 0, p75 0.87, p90 1.85, range ±3.05.
  Pokémon luck over 352 brought Pokémon: p10 -0.34, p25 -0.12, median -0.04, p75 0, p90 0.20, range -2.08..1.88.
  Used for the word cut-offs in app/core.js (`LUCK_STEPS`).
- **Tested:** all 164 species in the corpus and fixtures have a gen5 sprite at the id app.js (now `League.spriteId`) builds (all returned 200).

## Replay player embed (2026-10-27)
- **Researched (read the script):** `https://play.pokemonshowdown.com/js/replay-embed.js` (MIT, "can also be used by third parties to embed PS replays") plays a battle from a log on any page. It reads the log from `<script type="text/plain" class="battle-log-data">`, uses an existing `.wrapper` (with `.battle`, `.battle-log`, `.replay-controls`, `.replay-controls-2`) or appends one, and starts on `window.onload` (`Replays.init()`). It pulls jQuery, `battle.js`, data files, CSS and sprites from play.pokemonshowdown.com, so it only works while Showdown is up. Downloaded replay HTML files use the same script.
- **Guess (built, not yet seen playing):** `site/watch.html` sets its own `window.onload` after the script (overriding the embed's), waits for the saved log, inserts it, then calls `Replays.init()`; the log can come in after the page loaded. Running it in an iframe keeps Showdown's jQuery and CSS off the main page.
- **Tested (2026-10-27, during an outage):** with Showdown half down, `battledata.js` (which defines `BattleTextParser`) timed out while `battle.js` loaded, so `Replays.init()` threw "BattleTextParser is not a constructor"; watch.html shows its "Showdown may be down" message. The embed also loads `teambuilder-tables.js` (about 15 MB), so the player is only loaded when Watch is opened.
