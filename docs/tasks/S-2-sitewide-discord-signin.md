# S-2: Discord sign-in on every tab, not only Pick'em

**Status:** blocked (placement and scope questions for the user)
**Needs you:** (1) Where does the sign-in / signed-in-as control sit: header top right, or the tab row? (2) Does it show on every league page, or only leagues with Discord (the Super Champions League has no Discord server configured)? (3) Does the Discord membership check stay per contest (Pick'em) or become per league?
**Links:** [S-1 Pick'em](S-1-playoff-pickem.md), [FEATURES.md play-money betting row](../FEATURES.md)

## Goal
Sign in with Discord once and be signed in on every tab of a league page. One control on each tab shows "Sign in" or
"Signed in as <name>" (with sign out). One shared Supabase client and session; Pick'em (and later features) read it
instead of starting their own. User request 2026-11-02: "discord sign in is site-wide instead of just this pickems
page". The control must not hint at betting features (memory "gambling-tease-only").

## State when written (2026-11-02)
- Branch `next`, HEAD b06144d (`git log --oneline -1`).
- Tested/built in S-1: the sign-in lives only in `site/app/pickem.js` (`pkLoadLib` loads supabase-js lazily, `pkStart`,
  `pkJoin`, `pkAccount`), on the Pick'em tab, league `ppppp`.
- Membership check: Supabase Edge Function `supabase/functions/pickem-join` (writes `people` + `guild_members`).
- Config: `site/leagues.json` `pickem` (`supabase_url`, `supabase_key`). Supabase project `djwfayvdytvvdcecsnqa`.
  Notes: `docs/knowledge/pickem-service.md`.
- Untracked at the time: `supabase/migrations/20261103030339_pickem_service_role_grants.sql` (S-1's, not this task's).

## Steps
1. Get the answers to Needs you.
2. Move the Supabase client, lazy library load and session handling out of `pickem.js` into a shared script
   (`site/app/account.js`, or `core.js`), loaded by `app/league.html` before the tab scripts.
3. Move the Supabase settings in `site/leagues.json` from `pickem` to the league or site level (per the answers);
   update `tools/build_pages.py` and `tests/test_tools.py` if they read the old keys.
4. Add the control to the header or tab row (per the answer) in `app/league.html`, styled in `site/style.css` using
   existing tokens (read `docs/STYLE.md`; run `tests/test_style.py`; phone layout). Neutral wording, no betting hint.
5. Make `pickem.js` use the shared session; keep the join/membership call working (per the answer on scope).
6. Rebuild pages (`python -I tools/build_pages.py`), run the tests, screenshot dark and light, desktop and phone.
7. CHANGELOG.md line under Unreleased, REVIEW_QUEUE.md entry (a real Discord sign-in can only be checked by the
   user), update FEATURES.md if the login row changes.

## Done when
- Signing in on any tab shows the signed-in state on all tabs after a reload, with one shared client.
- Pick'em works unchanged for a signed-in member.
- Leagues without Discord behave as decided (no broken control).
- Tests pass and the code review on the branch against `next` has no open findings.
