---
name: screenshot
description: Screenshot the locally served site (headless Edge) and send it to the user, so changes can be seen without pushing. Use after any change to site/ the user should see, or when the user asks to see the page.
---

# Screenshot the local site

1. Run the script (it starts the local server if needed and prints the PNG path last):
   ```
   & .claude/skills/screenshot/shot.ps1 -Replays gen9nationaldex-2705157049 -Name one-game -OutDir <scratchpad>
   ```
   Params: `-Replays id1,id2` (ids from `site/<league>/games/`; `-Page site/scl/` for another league, `-Page site/` for the league list; 1 id opens Main viewer, 2+ open the games added up; `-Query tab=players` opens Players), `-Theme dark|light`,
   `-Width` / `-Height` (default 1400 x 2200), `-Page tests/`, `-Query online`, `-Name`, `-OutDir`.
   Always pass the session scratchpad as `-OutDir`.
2. Look at the PNG yourself (Read) before sending: check the change is visible and nothing is broken (blank page,
   "Showdown is down", missing replay). Fix or retake rather than send a bad one.
3. Send it with SendUserFile (`display: "render"`), caption: tab, game, theme, width. For several views
   (e.g. dark + light) send them in one call.

Limits:
- No true phone width (headless Edge clamps narrow windows). For a phone-width look, frame the site:
  `-Page tests/phone.html -Query "w=360&league=ppppp&tab=fantasy" -Width 600 -Height 1400` (w = frame width, league = which league page; other params go to the site).
- No hover (tooltips), clicks, taps or clipboard. Every tab opens from the URL (`-Query tab=fantasy`, `tab=gamble`, `tab=mons&mon=Garchomp`, `tab=players&player=<key>`).
  For those, use Claude in Chrome on `http://127.0.0.1:8765/site/ppppp/`.
- Local mode only loads replays saved in `site/<league>/games/` (the league libraries).
