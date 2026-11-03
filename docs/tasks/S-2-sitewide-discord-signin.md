# S-2: Discord sign-in on every tab, not only Pick'em

**Status:** open
**Links:** [S-1 Pick'em](done/S-1-playoff-pickem.md), [FEATURES.md play-money betting row](../FEATURES.md)

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

## Decisions
- 2026-11-02, user: (1) the control sits in the header, top right (the user answered "yes" to "header top right, or
  the tab row?"; read as the first option, confirm when it's built). (2) Only on leagues with a Discord server set up
  (Pinecord now; not the Super Champions League). (3) The membership check is once per league, not per contest: the
  league's Discord server id belongs to the league's settings, and contests read it from there.

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

## Progress
- 2026-11-02, branch `signin` (4d26645, cdb76eb): steps 2-7 done. `site/app/account.js` (shared client, session,
  membership check, header control), `discord` per league + site-wide `supabase` in `site/leagues.json` (checked by
  `tests/test_tools.py` DiscordSettings), Pick'em reads `acct`. Tests PASS 347/347, test_tools / test_style OK.
  Screenshots signed out: dark 1400, light 1400 and 760, 360 phone; Super Champions has no sign-in. Code review on the
  branch against `next`: 5 findings, 3 fixed (header overlap at mid widths, serial store reads, live region); the
  redirect allow list is on the review queue.
- 2026-11-02, user OK: `supabase/migrations/20261103120000_leagues_discord.sql` applied (table `leagues` with the
  server id; the picks policy reads it) and `pickem-join` redeployed (version 2; servers from `leagues`). Checked:
  `leagues` reads publicly (1 row, ppppp), the function answers 401 unsigned, the existing member can still pick and a
  made-up user can't (`private.pickem_can_pick`, in a rolled-back transaction). Left: drop `contests.guild_id` in its
  own migration once `next` has this page (the page on `next` still reads it).

## Done when
- Signing in on any tab shows the signed-in state on all tabs after a reload, with one shared client.
- Pick'em works unchanged for a signed-in member.
- Leagues without Discord behave as decided (no broken control).
- Tests pass and the code review on the branch against `next` has no open findings.
