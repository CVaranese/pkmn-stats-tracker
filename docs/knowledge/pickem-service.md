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

## Design (not built or tested)
- **Guess**: the browser uses only the project URL and the publishable/anon key, which are safe to publish because
  row-level security protects the data. The `service_role` key never goes in the site or the repo. Proposed tables:
  - `people`: Discord user id, Discord name.
  - `picks`: person, match, picked winner; a policy allows insert/update only for the signed-in person's own rows
    and only before the lock time.
  - `results`: match, winner; written only by the admin (e.g. from Challonge, with a local tool holding the service
    key outside the repo).
  - `points`: a view over picks + results, so nobody can edit them. A later points ledger for bets would key to
    `people`.

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
