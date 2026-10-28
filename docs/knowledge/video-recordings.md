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
- **Tested** (2026-10-27, Week 3 Zololab vs Bad Bully, OQAm2AwTtBc): Week 1 layout (default `--log-box`). The message
  box moves: mid-game it's a taller box at y 430-500 (move name + effect lines), at the win it's y 405-440
  (`--scene-box 40,400,560,50` caught it; the lower box read the Download replay buttons). The box went from the
  last hit ("lost 100%") straight to the win with no "fainted!": the converter now adds the faint for an active
  Pokémon at 0 HP at the win (listed in report.txt).
- **Tested**: after ~15 downloads in a day YouTube answered yt-dlp with "Sign in to confirm you're not a bot" for
  downloads and metadata alike, and `--sleep-requests 3` didn't help.
- **Tested**: past the bot check with the user's Firefox YouTube sign-in: `--cookies-from-browser firefox`. Signed in,
  YouTube only lists formats once its JavaScript challenge is solved: `pip install "yt-dlp[default]" deno` in the
  yt-dlp venv (deno.exe lands in its Scripts folder; put that folder on PATH). Then `-f 136` works again.
  YouTube Premium's own "Download" in the browser is no use: it stores the video in encrypted pieces in the
  browser's site storage, playable only by YouTube's player.
- **Tested** (Week 3, 5 videos): the log can move mid-stream (Cloudburst vs PotatoesAreYum: ~25 px further left
  before 8:00, then a side panel appears); a box too tight cut the first letters ("Irn 6") and turns 0-8 went
  MISSING. `--log-box 650,56,560,664` covered both. Timer wording "has 25 seconds left this turn." and
  "Battle timer is now OFF." / "(requested by X)" are dropped now. Box readings stop at the first "Download replay"
  button when no win line was read. Two endings had to be filled by hand: the stream jumped to the instant replay
  (Sneez vs Fingy, turn 43) and the box window started after the last turn (Cloudburst vs PotatoesAreYum).
- **Tested**: headless Edge launched from Git Bash returned empty `--dump-dom` output late in the session (even for
  a plain page) while the same command worked from PowerShell.
- **Tested** (Week 4 playlist PLOM0N8ucrccY, 5 videos, not yet added): four streams cut to a playback from turn 1
  within ~5 s of the last turn header (Zololab vs DEJIME 9:37, PotatoesAreYum vs Bad Bully 9:05, Dox vs Cloudburst
  15:20, Big Large vs Fingy 19:40), and no "won the battle" was read in the log or the message box, so the last KO
  and the winner are missing. The box window now ends where the log restarts (top turn drops by more than 3) and
  runs up to 60 s past the last header otherwise. Pikmon vs Sneez read badly (56 unconverted lines: "hearth",
  "opposjnq"); its winner line was read ("PeterPikmon won").
- **Tested** (2026-10-27): three games turned out to have Showdown replays after all; the video conversions match
  the replays exactly on every Pokémon's kills, deaths and the winner (Week 1 DEJIME vs Fingy, Sneez vs Zololab
  including the hand-filled Future Sight KO, Week 2 PotatoesAreYum vs Zololab). HP numbers weren't compared.
- **Tested** (2026-10-27, Week 5 playlist PLV29dBZQCWjY, 5 videos): four layouts. Pikmon vs Fingy is dark theme with
  a narrow log (`--log-box 880,40,400,680 --filter "invert(1) grayscale(1) contrast(2)"`) and read well this time
  (the Week 1 dark video's text was smaller). Zololab vs Karm `--log-box 580,56,540,664`, Dox vs PotatoesAreYum
  `--log-box 820,60,460,660`; the other two the default box. Message box at the win: `--scene-box 110,395,480,50`
  for the default-box layout (y 360-430 missed it).
- **Tested**: a narrow log wraps "Battle started between X and" / "Y!" onto two lines and the players came out
  blank; `video_convert.py` now joins them. Other slips fixed by hand: "U-" for U-turn (wrapped), a species glued
  onto a nickname on the switch line ("Mr Goon Samurott-Hisui"), "Metagrossr", team preview "Metapod" for
  Metagross and "Enamorus" for a wrapped "Enamorus-Therian", a timer line read as the Pokémon using a move, a
  nickname OCR can't read ("===D~~~", Dox's Enamorus: its switch-in, hits and faint were rebuilt from the frames),
  "Basculegion-F)! Go! Fish-F (" (a wrapped switch, unparsed, so the Pokémon had no species), and an unparsed
  "(X lost 48% of its health')" that left a KO looking passive. Real nicknames that look like slips: "<",
  "Booster Energy" (a Brute Bonnet), "Latinos (Maga)", "of Bethlehem".
- **Tested**: endings. Pikmon vs Fingy: the Discord stream ended ~10 s after the win and restarted on a replay, so
  the box window missed it; the last turn (Excadrill Earthquake on Iron Moth) and the win were read by eye from
  frames at 819-821 s. Dox vs PotatoesAreYum: the box was empty for the last move; frames at 955 s show "Booster
  Energy used Sucker Punch" on Azelf (-100%) then the win. DEJIME vs Big Large: the box reading joined two lines
  into the move ("Surfl (Pie lost 42%...)") and the turn 28 header was missing. Bad Bully vs Sneez: the box read
  the last two turns twice (the streamer stepped back), so turns 16-17 were rebuilt from the clean readings.
  Revival Blessing again (DEJIME's Pawmot, twice): 8 faints on one side is right.
- **Guess**: HP numbers in these five are as rough as before (hazards, Sandstorm, Black Sludge estimated); kills,
  deaths and winners were each checked against the video text or frames.
- **Tested** (2026-10-27, Weeks 6 and 7, 9 videos): seven in the default layout (`--scene-box 110,395,480,50`).
  Pikmon vs PotatoesAreYum is dark theme in a windowed browser with tabs and bookmarks (`--log-box 880,215,400,505
  --filter "invert(1) grayscale(1) contrast(2)"`); its narrow log wraps move names ("Volt / Switch!", "Play / Rough!",
  "Trick / Room!") and the converter doesn't join those, so merged.txt was fixed by hand and converted again. Pikmon vs
  Karm (dark, log at x 590-1070 next to a damage calc) gave 190 unconverted lines over 47 turns and is left out, like
  Week 4's Pikmon vs Sneez.
- **Tested**: a video can hold two games. Cloudburst vs Bad Bully: a forfeit at team preview (1:15, another team),
  a played-back game weedinmyhonda won (3:20-11:30), then the live game azpmCloudburst won (21:50-28:40). The first
  game was illegal and the set was replayed (user, 2026-10-27), so only the live game was converted: `video_to_replay.py --start 1300 --length 1719`
  (new `--start`; `--length` doubles as where to stop).
- **Tested**: frame grabs while a conversion runs need their own Edge profile and port: `TEMP=<other dir>` and
  `video_frames.py --port 8781` (both use `%TEMP%\edge-headless-frames`; sharing it gave 0 PNGs).
- **Tested**: slips fixed by hand this time: a mon fainted twice from a message-box re-reading, a switch-in with the
  next line glued on ("Hawlucha)l Pointed stones dug into ..."), a nickname read as the species ("That's Rough
  Buddy"), "Zygarde" for Zygarde-10%, "POI Pot" for Pol Pot, "Appa ate Momol" for "Appa ate Momo!", an unparsed
  damage line that made a Poltergeist KO look like Stealth Rock, a U-turn switch-in never read (Great Tusk, rebuilt
  from the frame), and a Rocky Helmet KO with no `[of]` (credited to the wrong Pokémon until added). "Mega Charizard"
  with the X cut off became Mega-Y; `video_convert.py` now takes X / Y from the "Charizardite X" line before it.
- **Tested**: endings: four turns past the last header were read from the message box or frames (Sneez vs DEJIME
  forfeit after Close Combat KO'd Weavile at 56%, Bad Bully vs Nezergy, Dox vs Fingy, DEJIME vs Cloudburst's Dual
  Wingbeat then Zapdos to Stealth Rock). Pikmon vs PotatoesAreYum's win line sits behind the Download replay buttons.
- **Guess**: HP numbers in these eight are as rough as before; kills, deaths and winners were each checked.
- **Tested** (2026-10-27, Week 4 Pikmon vs Sneez, https://youtu.be/ktYq3NES_GM): when OCR fails, the user pastes
  screenshots of the battle log panel (16 images covered 24 turns) and Claude types the protocol log from them by eye
  (script kept outside the repo, then `add_game.py --file`). The "lost N%" lines and faints are exact. HP after
  Stealth Rock / sand / Poison Heal / Life Orb / Rocky Helmet isn't printed and was fitted to the next "lost N%" line
  (guess, within a few %). Leads come from turn 1's "withdrew" lines. Hits printed with no "Pointed stones" line on
  switch-in mean Heavy-Duty Boots (Golisopod here; not recorded as an item). Parser result matched the counts worked
  out by hand before running it (kills 3/1/1 vs 3/1/1, 5 deaths each).
- **Tested** (2026-10-27, Week 6 Karm vs Pikmon, https://youtu.be/efjkWhTidmM): same screenshot method, 47 turns from
  34 images plus the last turn told in words. Regenerator (Hydrapple) heals a third on switch-out with no log line;
  without it Hydrapple's HP went to 0 by turn 24, so it was added on every switch-out (guess-level HP, fitted to the
  next "lost N%" line). A Pokemon never "caught in a sticky web" while grounded (Fezandipiti) has Heavy-Duty Boots;
  not recorded. Parser result matched the hand count (Karm 1/1 kills with 6 deaths, Pikmon Excadrill 4, Ogerpon 1,
  Samurott-H 1, 2 deaths).
