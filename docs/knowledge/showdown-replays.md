# Showdown replays: what we know

## Fetching
- **Tested:** `https://replay.pokemonshowdown.com/<id>.json` returns `id, format, players, log, uploadtime, views, formatid, rating, private, password`. `.log` gives the log only.
- **Tested:** missing or unsaved replays return HTTP 404 with an empty body (e.g. `gen9championsvgc2026regmb-2691890619`).
- **Tested (2026-10-26):** the replay server sends `Access-Control-Allow-Origin` echoing the request origin (checked with `Origin: https://example.github.io`) for both `<id>.json` and `search.json`, so a GitHub Pages site can fetch replays from the browser with no backend. Confirmed end to end: `site/` served from `http://127.0.0.1:8765` in headless Edge fetched 3 live replays and got the 404 for the missing one.
- **Tested:** `search.json?format=<formatid>` lists recent replays (newest first); `&user=<name>` filters by player, `&before=<uploadtime>` pages back.
- **Tested:** bo3 formats have their own IDs (`gen9championsvgc2026regmbbo3-...`); each game in a set is a separate replay. Game logs carry `|uhtml|bestof|...Game N...` and a `|uhtml|next|` link to the next game.

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
Direct = attacker that landed the KO hit (spread moves can earn 2; Destiny Bond counts as direct). Passive = indirect damage credited to its cause. If the cause is the victim itself or its own side (recoil, Life Orb, confusion, ally hit, own weather), the last opponent that damaged it gets a passive kill; no such opponent → no kill. Explosion/Memento etc.: death, no kill. Forfeit: survivors are not deaths.

## Entry hazards (2026-10-26)
- **Tested** (30 Nat Dex corpus replays): set as `|-sidestart|p2: Name|move: Stealth Rock` (Stealth Rock, Toxic Spikes, Sticky Web carry `move: `; Spikes is plain `Spikes`), one line per layer, right after the setter's `|move|`. 37 set in 30 games: 25 Stealth Rock, 8 Spikes, 2 Toxic Spikes, 2 Sticky Web.
- **Tested:** removal is `|-sideend|p1: Name|Stealth Rock|[from] move: Defog|[of] p1a: Mon` (Rapid Spin the same). Gen 9 Defog clears both sides, so 2 of 20 removals were a Defog clearing the user's own team's hazards from the opponent's side; those don't count as "removed".
- **Tested:** Court Change is `|move|...|Court Change` then `|-swapsideconditions` (no arguments) and `|-activate|...|move: Court Change`. 1 corpus game. Decision (user, 2026-10-26): the swapped hazards count as the Court Change user's.
- **Guess:** Mortal Spin and Tidy Up use the same `[from] move: X|[of]` form as Rapid Spin; not seen in the corpus.
- Decision: hazard turns = turns that ended with any entry hazard on the opponent's side, plus the turn the game ended in.
