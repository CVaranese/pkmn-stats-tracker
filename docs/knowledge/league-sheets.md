# League Google Sheets

- **tested** 2026-10-28: a sheet shared by link downloads without a login as
  `https://docs.google.com/spreadsheets/d/<id>/export?format=xlsx` (every tab; Super Champions League's is about 20 MB because
  it holds images). Python's standard library reads it (zipfile + xml): `tools/scl_draft.py`.
- Super Champions League's sheet (tabs: Rules, Data, Draft Board, Rosters, Schedule, Standings, Pokemon Leaderboard, Links):
  - Rosters: coaches side by side, five columns each (name; Pokémon one column right; price three right), two
    blocks of rows; the team name is two rows above the coach. 12 coaches, 9 Pokémon each, budget 100.
  - Schedule: weeks 1–8, each match a Bo3 set (games won per side). Standings: set record and points
    (2-0 = 3, 2-1 = 2, 1-2 = 1). Links holds Serebii icon links only: **no replay links** in the sheet.
  - Names differ between tabs (Mattio / Mattioli, Ryangab / RyanGab) and some Pokémon are misspelt
    (Starapter-Mega): the user says parts may be wrong.
