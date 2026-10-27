# League match videos (YouTube live recordings)

- **Tested** (2026-10-27, https://youtu.be/9STJZ-Xvmj8, "PPPPP Week 7 Sneez Vs Karm", 13.6 min): a live
  spectator recording of the Showdown battle page, with webcams over the top bar. The right half is Showdown's text
  battle log, readable at 720p: turn headers, "X used Move!", "(X lost 34% of its health!)", "fainted!",
  items and abilities as they're revealed ("Weakness Policy", "[… Clear Body]"), nicknames with species on switch-in
  ("Go! short king (Slowking-Galar)!"), team preview lists and the format rules. The battle side shows HP bars with %.
- **Tested**: the log panel holds about 5 turns at a time and scrolls as the battle goes, so frames every ~10-15 s
  should overlap enough to cover every line. After the battle the stream shows other things (the draft sheet at 10:40).
- **Tested**: download with yt-dlp (`-f 136`, 720p H.264 video only, 52 MB here; no ffmpeg needed). Frames: headless
  Edge playing the file from a local server that supports HTTP Range (Python's `http.server` doesn't, so `<video>`
  can't seek), on the real clock (seeking never finishes under `--virtual-time-budget`).
- **Guess**: text-to-protocol conversion is feasible because Showdown's messages are templates, but the recorded log
  is the spectator's: no exact HP numbers, no hidden-information lines. Windows' built-in OCR (Windows.Media.Ocr from
  PowerShell) may read the panel crops without installing anything; not tried.
- **Tested**: Showdown names seen: "pee nation" (Eric's draft pool) vs "chicken parm karm".
