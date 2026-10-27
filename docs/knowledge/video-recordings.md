# League match videos (YouTube live recordings)

- **Tested** (2026-10-27, https://youtu.be/9STJZ-Xvmj8, "PPPPP Week 7 Sneez Vs Karm", 13.6 min): a live
  spectator recording of the Showdown battle page, with webcams over the top bar. The right half is Showdown's text
  battle log, readable at 720p: turn headers, "X used Move!", "(X lost 34% of its health!)", "fainted!",
  items and abilities as they're revealed ("Weakness Policy", "[… Clear Body]"), nicknames with species on switch-in
  ("Go! short king (Slowking-Galar)!"), team preview lists and the format rules. The battle side shows HP bars with %.
- **Tested**: in this video the battle is a replay being played back (Pause / Skip turn buttons), shown twice: 0:00-8:00
  and again 8:05-9:57, then the stream cuts to the draft sheet. The end of the log (the last faint, "won the battle")
  scrolls below the frame; the scene's message box (720p box x 110-590, y 398-446) shows it.
- **Tested**: download with yt-dlp (`-f 136`, 720p H.264 video only, 52 MB here; no ffmpeg needed). Frames: headless
  Edge playing the file from a local server that supports HTTP Range (Python's `http.server` doesn't, so `<video>`
  can't seek), on the real clock (seeking never finishes under `--virtual-time-budget`).
- **Tested**: Showdown names seen: "pee nation" (Eric's draft pool) vs "chicken parm karm".

## Pipeline (pilot, 2026-10-27): `tools/video_to_replay.py`

`python -I tools/video_to_replay.py <video.mp4> <work_dir> --id video-<youtube id> --length <seconds> --url <link>`
writes `<work_dir>/<id>.json` (a replay `site/parser.js` reads) and `report.txt` (vote counts per turn, unparsed
lines, every guessed HP number). Check it with `tools/video_check.html?replay=<path>` (serve the repo root). Pieces:
`tools/video_frames.py` + `video_grab.html` (crops via headless Edge, POSTed to the script's own server, no
screenshots), `tools/ocr_frames.ps1` (Windows OCR to JSONL), `tools/video_convert.py` (sentences to protocol).

- **Tested**: OCR on the log crop (720p box x 686-1280, y 56-720). Drawn at 4x with `grayscale(1) contrast(2)` it read
  27 of 27 "lost N%" numbers on 15 test frames; 2x / 3x without the filter read 24 of 28, 3x with it 25. OCR reads
  "%" as "0/0" ("130/0" = 13%, "80/0" = 8%), "!" at line ends as "l", "i" or "'", "W" as "VV", "Go!" as "Gol", and
  "[X's Ability]" as "(X's Ability)". The fixes are in `clean()` / `variants()`.
- **Tested**: frames every 5 s (164 frames) gave 6-34 readings of every turn; all readings of each complete turn had
  the same line count, so voting per line between "Turn N" headers was enough (no fuzzy alignment needed). The
  replay shown twice doubled the readings. Grab 20 s + OCR 22 s; the whole run is 48 s and gives the same log twice.
- **Tested**: Showdown's English templates (pokemon-showdown 0.11.11 `dist/data/text/*.js` on jsDelivr) turned into
  regexes matched every line of this game, plus one client wording the package lacks: "(The snow is blowing about!)"
  (`EXTRA` in video_convert.py). Garbled lines ("EVIL fainte&…") fall back to 80%-alike fuzzy matching.
- **Tested**: the client prints "lost N%" only for a move's hit. Poison, Toxic and Life Orb damage show no number, so
  those are estimated (1/8, n/16, 1/10) and listed in report.txt. An early version credited Earthquake's "lost 13%"
  to the poison line after it.
- **Tested**: Regenerator's heal on switching out is invisible in a spectator log. Without it Slowking-Galar would
  have been at 0% before it moved; the converter now adds 33% for any species that can have Regenerator (a guess when
  the ability isn't revealed) and flags any Pokémon that moves at 0%.
- **Tested**: result for this game: 16 turns, 146 protocol lines, 0 unparsed. parser.js: Metagross 5 direct kills
  (Gliscor, Slowking-Galar, Ninetales-Alola, Weavile by Heavy Slam, Arctozolt by Earthquake), 5 pee nation faints,
  "pee nation forfeited." with Charizard alive, chicken parm karm won (matches Challonge). Metagross ends at 7%, the
  same as the HP bar on screen.
- **Tested** (2026-10-27, https://youtu.be/OA6m3wXIO6s, "PPPPP Week 1 Pikmon vs Dox", 15 min, streamed by
  PeterPikmon): a different layout. The browser isn't full screen and a damage-calc panel sits on the right; the log
  is at x 638-1028, y 120-720 (narrower, so smaller text) in Showdown's dark theme; the message box at x 234-564,
  y 328-388. The battle room is a tab in the main client ("National Dex: drxonge vs PeterPikmon", "3 users", a
  "Battle timer is ON (requested by PeterPikmon)" line) with playback buttons (Pause, First turn, Prev turn, Skip
  turn, Skip to end) at 5:00. **Guess**: the live room being played back (instant replay or rewound), not a saved
  replay page; whether it was ever uploaded is unknown.
  Only 720p at 268 kbps (format 136; the HLS format 232 lists ~1 Mbps but downloads as 34 MB MPEG-TS).
- **Tested**: Windows OCR can't read this log. At scale 1.5-4, with or without `invert(1)`, contrast 2 or 4, a crop
  of four lines that is easy to read by eye gives at most "Ftyqon used Sint Impression!" and never a "lost N%"
  number. The crop boxes and filter are now options (`--log-box`, `--scene-box`, `--filter`). Skipped for now (the
  user doesn't think the replay is still on Showdown); ways left: read the frames by eye, or try Tesseract.
- **Guess**: other league videos may differ: a live battle instead of a replay, another streamer's layout (the crop
  boxes are fixed numbers), spectator chat in the log ("peterpikmon: g2g" sat in team preview here), moves and
  messages this game didn't have. Check every new video's report.txt; expect a few rules per new message type.
