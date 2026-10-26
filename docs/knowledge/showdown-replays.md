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

## Hosting / Node
- **Tested (2026-10-26):** the project itself uses no Node and no npm packages; the only Node is inside GitHub's own Pages actions, run on GitHub's servers. Older majors (`checkout@v4`, `configure-pages@v5`, `deploy-pages@v4`) run on Node 20 (end of life April 2026); current majors (`checkout@v7.0.1`, `configure-pages@v6.0.0`, `deploy-pages@v5.0.1`) declare `using: node24`. `upload-pages-artifact@v5.0.0` is a composite action wrapping `upload-artifact@v7.0.0`. Workflow pins these by commit SHA; Dependabot (`.github/dependabot.yml`) proposes updates monthly.

## Kill rules (decided with the user, 2026-10-26)
Direct = attacker that landed the KO hit (spread moves can earn 2; Destiny Bond counts as direct). Passive = indirect damage credited to its cause. If the cause is the victim itself or its own side (recoil, Life Orb, confusion, ally hit, own weather), the last opponent that damaged it gets a passive kill; no such opponent → no kill. Explosion/Memento etc.: death, no kill. Forfeit: survivors are not deaths.
