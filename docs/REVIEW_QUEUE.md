# Review queue

Things only a person can check. Remove an item once checked.

- [ ] "Copy for Google Sheets" then paste into a Sheet: columns land in separate cells, accented names (Pokémon) look right. (Clipboard needs a real click, so this wasn't tested headless.)
- [ ] "Download CSV" opens correctly in Excel / imports into Sheets.
- [ ] Light mode looks right (only dark mode was screenshotted), and the page is usable on a phone.
- [ ] "Copy share link" (now next to Clear) gives a link that reopens with the same replays.
- [ ] A private replay link (ending in `...pw`) loads. Not tested; no private replay available.
- [ ] Team sheets: open "Team sheets", add a real Pokepaste link of a league team and its replay, press Get stats. Max HP / item / ability / moves appear in Per game, the box says "used for <player> in N games". (Pokepaste loading is tested; matching it to a real game of that team is not yet.) Also check the new boxes look right in light and dark mode and on a phone.
- [ ] Damage columns: load a league replay with both teams' sheets. Leaderboard shows Dealt % / Taken % / Dealt HP / Taken HP; Per game shows them after Deaths. Check the wider tables still fit (scroll) on a phone and in light/dark mode, and that the numbers look plausible against the replay. Rules text ("How kills and damage are counted") reads clearly.
- [ ] Per game table: new "Ended by" and "Turns" columns after Won. Load a forfeit and a timer-loss replay (e.g. gen9nationaldex-2705113160, gen9nationaldex-2705121899) and check they read "forfeit" / "timer" and the table still fits on a phone.
- [ ] Hazard columns: load a game with rocks / Spikes and a Defog or Rapid Spin (e.g. gen9nationaldex-2705111047, gen9nationaldex-2705117998). Leaderboard and Per game show Hazard % / KOs / set / removed (and Hazard turns in Per game); numbers look right against the replay. The tables are wider again: check phone and light/dark mode. The new "Hazards" line under "How kills and damage are counted" reads clearly.
- [ ] Copy share link with a Pokepaste sheet added: the link reopens with the sheet box filled in.
- [ ] Healing / switch columns and the Hidden Zoroark notice: load gen9nationaldex-2705117998 (Kingambit Healed 19%, Zamazenta 31%, Tapu Koko 1 pivot). Check the even wider tables on a phone and in light/dark mode, the new rules lines read clearly, and the Hidden Zoroark notice box (bordered, under the links) looks right. No real replay with a hidden Zoroark is available; the notice was only checked by tests.
- [ ] Luck columns: Get stats on a few Nat Dex replays; the 12 new columns (Crits … Player luck) fit the tables, Luck isn't blank (move data loaded), and the new "Luck counts" / "Luck score" notes read clearly.
