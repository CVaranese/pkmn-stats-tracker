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
- **Tested** (2026-10-27, https://youtu.be/ff5WImD_i3k, "PPPPP Week 1 Bad Bully vs Big Large", 9.9 min, streamed
  by PeterPikmon): light theme, full screen. The log is where `LOG_BOX` says; the message box is higher (x 110-590,
  y 344-420, `--scene-box 110,344,480,76`). A live battle: at the win the client shows "Instant replay / Download
  replay / Upload and share replay", then the streamer started the instant replay, so the end-of-video message box
  showed turn 1 again. The pipeline now stops message-box lines at "won the battle", and drops box re-readings (the
  same line in other case, or a line with the next one joined on).
- **Tested**: new wordings in this game: "Its disguise served it as a decoy!" (no Pokémon named: the move's target),
  "[X]'s disguise was busted!" then "(X was hurt!)" (1/8, `Mimikyu-Busted`), "Tidying up complete!", "The Pokemon was
  hit 5 times!" (OCR drops the é; templates now match without it), "sent out Maushold (Maushold-Three)" (the dex has
  plain "Maushold" for that form; the loose match had picked Maushold-Four).
- **Tested**: result: 27 turns, 209 protocol lines, 2 unparsed (garbled re-readings of lines also read correctly).
  parser.js: ElkG Big Large won by KO (Mamoswine's Ice Shard on Latios, turn 27); 6 weedinmyhonda faints, 3 ElkG
  faints, every faint and killer matching the log text. Mamoswine ends at 15%, same as its HP bar. Run time 35 s.
- **Guess**: other league videos may differ: a live battle instead of a replay, another streamer's layout (the crop
  boxes are fixed numbers), spectator chat in the log ("peterpikmon: g2g" sat in team preview here), moves and
  messages this game didn't have. Check every new video's report.txt; expect a few rules per new message type.
- **Tested** (2026-10-27, playlist PLe1tROU59cYo, Week 1): three more light-theme full-screen videos with the
  Bad Bully layout (`--scene-box 110,344,480,76`): DEJIME vs Fingy (7RgyqzI7yNI; DEJIME17 vs FingerStripes),
  Cloudburst vs Karm (d5iVr2s_7dE; azpmCloudburst vs chicken parm karm), Sneez vs Zololab (XmltgmaqObg, 40 min;
  pee nation vs zololab). Every faint, killer and winner matches the video text. 34 s, 53 s and ~10 min per run.
- **Tested**: a seek in the 40-min file never fired `seeked` at 2:20 and the grab sat until its 25-min overall
  timeout. `video_grab.html` now gives each seek 8 s, retries 0.5 s later, then skips the frame.
- **Tested**: in Sneez vs Zololab the log panel never scrolled past "Pecharunt used Hex" and the old message-box
  window (40 s before the *last* frame with the top turn header) only saw the win. The window now starts where the
  last turn header first shows (capped at 200 s). The box still showed only "Pecharunt fainted!" then the win;
  the Future Sight landing that KO'd it (Slowking, turn 54) was added by hand (a guess from timing and typing).
  The box line replaces the log's last line only when it starts with it or matches > 0.8 ("Pecharunt used Hex"
  matched "Pecharunt fainted!" at 0.65).
- **Tested**: new wordings and slips: "[X] had its energy drained!" (`[SOURCE]`; heal guessed at half the target's
  loss), "became confused due to fatigue", "Ninetales-AIoIa" (l read as I; species now fixed), a switch line cut
  before ")!" ("Go! Diancie (Diancie-Mega"), a cut "(Latios lost 42% of its health" (now completed). Team
  preview "Marv'lle" matched Marill instead of Mawile (fixed by hand; the preview match has no check against the
  Pokémon later sent out). "The opposing is exerting its pressure!" (name dropped) made a bogus p1 mon (removed by hand).
- **Tested** (2026-10-27, Week 2 playlist PLc3TezsXgkoE, all 6 converted): four streams have the log further right
  (`--log-box 752,56,488,664 --scene-box 126,440,500,46`); Pikmon vs Big Large is dark theme and read fine with
  `--filter "invert(1) grayscale(1) contrast(2)" --log-box 740,56,500,664 --scene-box 124,480,480,40` (the Week 1
  dark video was a narrower, smaller log); Bad Bully vs Dox (`--log-box 662,56,560,664 --scene-box 116,384,480,44`)
  is zoomed out, so its small-font lines (damage numbers, item / ability notes) OCR badly; kills still came out
  right after the fixes below. Its stream ends in the lobby: the win is only in the message box.
- **Tested**: Edge's decoder wedged in 3 of 6 long files (no seek finishes, not even on a new `<video>`).
  `video_frames.py` now ends Edge when no frame arrives for 30 s and starts a new one from the next frame
  (one 5-s frame lost each time). Runs took 1.5-3 min per game after that.
- **Tested**: new rules: switch lines wrapped onto a second line ("(Bronzong)!", "Therian)!"), Wish, Haze,
  substitute fail, Electric Terrain block, partial-trap damage (Magma Storm, 1/8, credited to its user through
  `[of]`), "6600" = 66%, a damage line garbled around the number rebuilt from "<name> lost N% ... health",
  "The" read as "e" / "lhe" / "I he", "doesn t". Revival Blessing: a Pokémon can faint twice (DEJIME vs Karm).
