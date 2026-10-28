# Challonge (the league bracket)

- **Tested** (2026-10-27): `https://challonge.com/<slug>` and its pages answer HTTP 403 to scripts (bot check).
  The `/module` page is Challonge's own embed and loads in an iframe on the Games tab (not yet checked in a browser).
- **Tested**: API v1 works with only the account's "API v1 key" (not the client ID / secret, which are for v2 OAuth):
  `GET https://api.challonge.com/v1/tournaments/<slug>.json?api_key=KEY&include_matches=1&include_participants=1`.
  It read the league's tournament, which the user doesn't own as far as we know. The key lives in
  `%USERPROFILE%\.challonge_key`, never in the repo or the site (the site is public).
- **Tested**: each match gives `round`, `player1_id` / `player2_id`, `winner_id`, `scores_csv` ("1-0"), `state`
  (`open` / `complete`), `completed_at`; `scheduled_time` is empty in this league. Participant `name` is whatever
  the organiser typed (real first names here), not a Showdown username.
- **Guess**: Showdown replay ids for gen9nationaldex rose about 4 million a week in Sep-Oct 2026 (ids are shared
  across all formats). Good enough to guess the week of a replay; confirm with its `uploadtime`.
- **Tested** (2026-10-27): the tournament is `swiss`, state `underway`, 12 participants; 47 of 48 round 1-8 matches
  complete. Each match also has `loser_id`. `tools/challonge_records.py` turns this into `site/ppppp/games/records.json`
  under the bracket's names (the user OK'd showing them on the site, 2026-10-27).

- **Tested** (2026-10-28): the Swiss (`peepeepeepeepiss`) is `complete`, 48 of 48 matches. The playoffs are a second
  tournament, `peepeepeepeepisspiss` ("Peter Pikmon's Pinecord Pokemon Pissfest Playoffs"): single elimination, 12
  players, no third-place match; round 1 is four matches (seeds 5-12), the top four wait in round 2; 11 matches in all.
  The API reads it with the same key.

## Draft sheet (Google Sheets)
- **Tested** (2026-10-27): the league draft sheet exports without sign-in (`/export?format=xlsx`, or one tab as CSV with
  `/gviz/tq?tqx=out:csv&sheet=<tab>`). Tabs: Rules, Draft table, New ZA Moves. Rules: 48 points, OU 7, UUBL 6, UU 5,
  RUBL 4, RU 3, NFE 2, LC 1; cost is the tier on draft day; 2 OU max, 1 Mega max.
- **Tested**: Draft table has one column per player (bracket first names) with the pool as one comma list; the tiers are
  only shown by where each sprite image sits (one row per tier). Text has typos ("Slither Wings", "Basulegion-Female").
- **Tested**: Showdown's natDexTier (pokemon-showdown 0.11.11 `formats-data.js`) matched the sheet's rows for all 141
  picks except Sableye-Mega, Rotom-Wash and Blacephalon (sheet: UUBL; data: UU). Found by comparing tier counts per row,
  then looking at the sprites.
- **Tested** (user, 2026-10-28): each Pokémon belongs to one player, and a Mega is its own pick: Latios is Zololab's,
  Latios-Mega weedinmyhonda's; Tyranitar PeterPikmon's, Tyranitar-Mega potatoesareyum's; Sableye pee nation's,
  Sableye-Mega FingerStripes'; Latias PeterPikmon's, Latias-Mega Nezergy's. Replay rows use the base name (Mega
  Evolution happens mid-game; team preview and switches before it show the base form), so the site renames each row
  after the player's drafted Mega, even in a game where it didn't Mega Evolve, else after the Mega it turned into
  (`mega_form`). Checked 2026-10-28: every Pokémon tab row is in its player's draft pool, except Sinistcha-Masterpiece
  (drafted as Sinistcha, a cosmetic form, left as is).
- **Tested** (user, 2026-10-27): 51 is right. After the 48-point draft a wheel gave everyone one random 3-point
  Pokémon, and after Week 4 each player could trade one in for a 3-point-or-less Pokémon. One pool totals 52; the user
  is checking it against the draft.
- **Researched**: cost is the tier on draft day (sheet rules), so later Smogon tier changes don't change it; the sheet's
  rows, not Showdown's current data, decide. All 36 team-preview Pokémon in the 6 saved games are in the sheet's pools.
