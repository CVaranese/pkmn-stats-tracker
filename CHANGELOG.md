# Changelog

## Unreleased
- Per game rows now say how the game ended (`end_reason`: normal, forfeit, timer, tie or unfinished) and how many turns it lasted, so short timer losses and forfeits can be filtered out in the spreadsheet. Shown as "Ended by" and "Turns" in the Per game table and its exports.
- Damage dealt and taken per Pokémon, in % of max HP, credited like kills (direct hits to the attacker; burn, hazards, weather, Leech Seed, Rocky Helmet and so on to their cause). Overkill doesn't count; self-inflicted damage (recoil, Life Orb, confusion, Substitute's cost) counts as taken with no dealer. With team sheets, also in raw HP (% × the target's max HP; about ±1% of max HP per hit, since replays round to whole %). New columns in the leaderboard, the Per game table and their exports.
- Team sheets (optional): add a Pokepaste link or a Showdown export per team. Each sheet is matched to every game where that team played (all six Pokémon at team preview) and adds Max HP, item, ability and moves to the Per game table and its exports. Pokepaste sheets are included in share links (`&t=`). Text copied straight off a Pokepaste page (with its ``` lines) works too.
- Web page (`site/`) for GitHub Pages: paste replay links, get a kill/death leaderboard per player + Pokémon (or per Pokémon) and a per-game table; sortable columns, player filter.
- Copy for Google Sheets (tab-separated) and Download CSV, both exporting the current view.
- Shareable links: `?r=id1,id2,...` opens the page with those replays loaded; "Copy share link" button.
- Parser ported from Python to JavaScript (`site/parser.js`) with the same draft-league kill rules; supports singles, doubles, Random Battles (no team preview), bo3 game replays, smogtours and private (`...pw`) replay IDs.
- Failed replays (404, private, unreadable) are listed by ID instead of stopping the run.
- Fix: Zoroark's Illusion no longer mis-credits stats. When the disguise breaks, kills, the KO on Zoroark and status it inflicted while disguised move from the copied Pokémon to Zoroark; the copied Pokémon keeps its own stats. (A disguise that never breaks still can't be detected.)
