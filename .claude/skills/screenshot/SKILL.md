---
name: screenshot
description: Screenshot the locally served site (headless Edge) and send it to the user, so changes can be seen without pushing. Use after any change to site/ the user should see, or when the user asks to see the page.
---

# Screenshot the local site

1. Run the script (it starts the local server if needed and prints the PNG path last):
   ```
   & .claude/skills/screenshot/shot.ps1 -Replays gen9nationaldex-2705117998 -Name one-game -OutDir <scratchpad>
   ```
   Params: `-Replays id1,id2` (ids from `site/mock/`; 1 id opens One game, 2+ open Playoffs), `-Theme dark|light`,
   `-Width` / `-Height` (default 1400 x 2200), `-Page tests/`, `-Query online`, `-Name`, `-OutDir`.
   Always pass the session scratchpad as `-OutDir`.
2. Look at the PNG yourself (Read) before sending: check the change is visible and nothing is broken (blank page,
   "Showdown is down", missing replay). Fix or retake rather than send a bad one.
3. Send it with SendUserFile (`display: "render"`), caption: tab, game, theme, width. For several views
   (e.g. dark + light) send them in one call.

Limits:
- No true phone width (headless Edge clamps narrow windows); say so if asked about mobile.
- No hover (tooltips), clicks, taps or clipboard. The Gambling tab can't be opened from the URL.
  For those, use Claude in Chrome on `http://127.0.0.1:8765/site/`.
- Local mode only loads replays saved in `site/mock/`.
