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
