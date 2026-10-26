# Changelog

## Unreleased
- Web page (`site/`) for GitHub Pages: paste replay links, get a kill/death leaderboard per player + Pokémon (or per Pokémon) and a per-game table; sortable columns, player filter.
- Copy for Google Sheets (tab-separated) and Download CSV, both exporting the current view.
- Shareable links: `?r=id1,id2,...` opens the page with those replays loaded; "Copy share link" button.
- Parser ported from Python to JavaScript (`site/parser.js`) with the same draft-league kill rules; supports singles, doubles, Random Battles (no team preview), bo3 game replays, smogtours and private (`...pw`) replay IDs.
- Failed replays (404, private, unreadable) are listed by ID instead of stopping the run.
- Fix: Zoroark's Illusion no longer mis-credits stats. When the disguise breaks, kills, the KO on Zoroark and status it inflicted while disguised move from the copied Pokémon to Zoroark; the copied Pokémon keeps its own stats. (A disguise that never breaks still can't be detected.)
