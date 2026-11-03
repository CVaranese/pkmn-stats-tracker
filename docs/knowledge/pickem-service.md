# Pick'em store: Supabase vs Firebase

Used in: [task S-1](../tasks/S-1-playoff-pickem.md). Research of 2026-11-02.

## Supabase free plan
- **Researched** (supabase.com/pricing.md, 2026-11-02 search): the free plan gives 50,000 monthly active users, a
  500 MB database, 5 GB egress and 1 GB file storage, with at most 2 active projects. Free projects are paused after
  1 week of inactivity; API requests and database queries count as activity. A paused project keeps its data but
  stays offline until someone restores it by hand from the dashboard. For the site: a project left alone between
  seasons will pause and needs a restore before the next use.

## Discord login
- **Researched** (supabase.com/docs/guides/auth/social-sign-in/auth-discord,
  supabase.com/docs/reference/javascript/auth-signinwithoauth): Discord is a built-in Supabase Auth provider. Make a
  Discord application (Discord Developer Portal), set its OAuth2 redirect to
  `https://<project-ref>.supabase.co/auth/v1/callback`, then enable Discord under Authentication > Providers in the
  Supabase dashboard with the client ID and secret. In the browser:
  `supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo } })`. The `redirectTo` URL must be on
  the project's redirect allow list (Authentication > URL Configuration).
- **Researched** (dev.to/burhanuday/firebase-authentication-with-a-third-party-0auth-provider-c37 and the Firebase
  functions-samples repos; not official Firebase docs, may be dated): Firebase Auth has no built-in Discord
  provider. It needs a custom-token flow: a Cloud Function does the OAuth exchange and mints a token with the Admin
  SDK. Calling external services from Cloud Functions needs the paid Blaze plan.

## Decision
- **Decision** (session 2026-11-02, task S-1): use Supabase. Reasons: built-in Discord login on the free plan, and
  Postgres row-level security can enforce the pick lock and keep visitors from writing points.

## As built (2026-11-02, branch `pickem`)
The SQL is in `supabase/migrations/` (applied through the Supabase MCP server; the files are the record), the
membership function in `supabase/functions/pickem-join/`, the page in `site/app/pickem.js`.
- Tables: `people` (auth user id, Discord id, display name), `guild_members` (Discord server id, person), `contests`
  (id, league, server, `lock_at`), `pickem_matches` (round, points, winner seed, where each side comes from),
  `picks` (person, contest, match, seed). A later points ledger for bets keys to `people`.
- **Tested** (SQL as made-up users, rolled back): a server member's pick saves; a non-member's is refused by
  row-level security; nothing saves after `lock_at`; anonymous visitors read 0 picks before the lock and all after;
  people can't rename themselves (no update grant on `people`); `pickem_leaderboard` is callable signed out.
- **Tested**: a pick scores only when that player reaches the match through the person's own earlier picks
  (recursive check in `pickem_leaderboard`, same rule as `League.pickemClean`), so a hedged bracket (seed 9 in round
  1, seed 8 in the next round) scored 0.
- **Tested**: the policies' helper checks live in a `private` schema the API doesn't expose; the Supabase security
  advisor's only warning left is `pickem_leaderboard` being callable signed out, which is on purpose (public
  leaderboard, user 2026-11-02).
- **Researched** (supabase.com/docs/guides/getting-started/migrating-to-new-api-keys): the new `sb_publishable_` /
  `sb_secret_` keys aren't JWTs. An Edge Function's built-in `verify_jwt` only understands the legacy keys, so
  `pickem-join` is deployed with it off and checks the session itself (`auth.getUser` on the Authorization header).
  Functions get the secret key as `SUPABASE_SECRET_KEYS` (JSON, `default`).
- **Tested**: `pickem-join` answers 401 to a call with no session, and its CORS allows the local site. A real Discord
  sign-in through it is not tested yet (needs a Discord account; review queue).
- **Tested** (the project's `/auth/v1/authorize`, 2026-11-02): the sign-in asks Discord for `email identify guilds`;
  Supabase adds `email` itself, so Auth's users list keeps each person's email (our tables don't).
- **Guess** (supabase-js behaviour): Discord's token (`provider_token`) is in the session only after a fresh sign-in,
  so the page calls `pickem-join` then, and later visits read the stored membership row.
- Results: `python -I tools/challonge_bracket.py --sql` writes `site/ppppp/games/playoffs.json` and prints the upsert
  for `pickem_matches`; run it in the SQL editor or through the MCP server after each round.

## Setup steps (only the user can do these)
1. Make a Supabase account and a free project.
2. Discord Developer Portal: New Application, then OAuth2, add the redirect from above, copy the Client ID and
   Client Secret.
3. Supabase: Authentication > Providers > Discord, turn on, paste the ID and secret.
4. Supabase: Authentication > URL Configuration, add the live GitHub Pages URL, its `/next/` preview and
   `http://127.0.0.1:8765/` to the redirect allow list.
5. Give the session the Project URL and the publishable/anon key (Project Settings > API).

Sources: https://supabase.com/pricing.md, https://supabase.com/docs/guides/auth/social-sign-in/auth-discord,
https://supabase.com/docs/reference/javascript/auth-signinwithoauth,
https://dev.to/burhanuday/firebase-authentication-with-a-third-party-0auth-provider-c37
