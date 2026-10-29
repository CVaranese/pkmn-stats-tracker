# Stream-video tools (archived 2026-10-29)

Retired: league games now come with Showdown replays, so no new game should need rebuilding from a stream video.
Kept in case one does. The 35 Pinecord games rebuilt this way (`site/ppppp/games/video-*.json`) stay in the
library and on the site as they are.

- `video_to_replay.py`: a YouTube stream recording -> a replay-like JSON (frames, OCR, Showdown's message templates).
  Uses `video_frames.py` (+ `video_grab.html`), `ocr_frames.ps1` (Windows OCR) and `video_convert.py`.
- `video_check.html`: the rebuilt game's stats, to compare with the video (serve the repo root).
- `audit_video_games.py`: rewrites `docs/VIDEO_GAMES_AUDIT.md`, what looks misread in each rebuilt log
  (35 games, 0 things to check at 2026-10-29). Re-run after fixing a rebuilt game by hand.

How it was done, and what the OCR gets wrong: `docs/knowledge/video-recordings.md`. Adding a rebuilt game:
`tools/add_game.py --file <rebuilt json>` (still supported).

Not run by any test or workflow; paths fixed for this folder on 2026-10-29 (the audit gave the same report).
