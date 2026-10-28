"""Rebuild a Showdown replay from a YouTube recording of the battle page (a pilot; see docs/knowledge/video-recordings.md).

    python -I tools/video_to_replay.py <video.mp4> <work_dir> --id video-<youtube id> --length <seconds> [--url <link>]

Steps, each cached in work_dir (delete a file to redo that step):
  1. log/*.png + log.jsonl     crops of the text log panel every 5 s, OCR'd by tools/ocr_frames.ps1
  2. scene/*.png + scene.jsonl the battle scene's message box every 0.5 s over the last 40 s of the battle
                               (the log's final lines scroll below the frame; the box shows them)
  3. merged.txt                one ordered battle log, voted turn by turn across every frame that shows it
  4. <id>.json + report.txt    protocol log for site/parser.js, and every line that didn't convert

Templates: Showdown's English messages (pokemon-showdown 0.11.11 dist/data/text/{default,moves,abilities,items}.js),
downloaded from jsDelivr into --templates (default <work_dir>/../pstext) on first use and read as text, never run.
Move / Pokédex data from site/data/. Check the result with tools/video_check.html.
Get the video with yt-dlp -f 136 (720p H.264, no ffmpeg needed).'
"""
import argparse, collections, difflib, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LOG_BOX, SCENE_BOX = "686,56,594,664", "110,398,480,48"
FILTER = "grayscale(1) contrast(2)"  # 4x + contrast read every "lost N%" on the test frames; 2x-3x dropped some


# ---------------------------------------------------------------- 1-2. frames and OCR

def grab(video, out_dir, times, box, jsonl, filt=FILTER):
    if os.path.exists(jsonl):
        return
    subprocess.run([sys.executable, "-I", os.path.join(HERE, "video_frames.py"), video, out_dir,
                    "--times", ",".join(f"{t:g}" for t in times), "--box", box, "--scale", "4",
                    f"--filter={filt}"], check=True)
    subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
                    os.path.join(HERE, "ocr_frames.ps1"), out_dir, jsonl], check=True)


def load_frames(jsonl):
    frames = collections.OrderedDict()
    with open(jsonl, encoding="utf-8") as f:
        for line in f:
            o = json.loads(line)
            frames.setdefault(o["frame"], []).append(o)
    for f in frames:
        frames[f].sort(key=lambda o: (o["y"], o["x"]))
    return frames


def frame_time(name):
    return int(name[1:]) / 10


# ---------------------------------------------------------------- 3. merge

TURN = re.compile(r"^Turn\s*(\d[\d ]*)$")


def clean(text):
    t = text.strip()
    t = re.sub(r"(\d+)\s*0/0", r"\1%", t)          # OCR reads "%" as "0/0": "130/0" -> "13%"
    t = re.sub(r"^Go[l1I|]\s", "Go! ", t)
    t = re.sub(r"^Gol\b", "Go!", t)
    return t


def log_lines(frame):
    """Lines of one log crop, top to bottom, without UI noise. Line height in the 4x crop is about 70 px."""
    out = []
    for o in frame:
        t = clean(o["text"])
        if o["y"] < 90 or o["x"] > 1500:             # cut-off top line, "N users", "Battle Options"
            continue
        if re.fullmatch(r"\d+ users?", t) or len(t) < 3:
            continue
        if out and abs(o["y"] - out[-1][0]) < 25:     # OCR split one visual line in two
            out[-1] = (out[-1][0], out[-1][1] + " " + t)
            continue
        out.append((o["y"], t))
    return [t for _, t in out]


def sections(lines):
    """Split one frame's lines at "Turn N" headers. Returns (complete {turn: lines}, head (turn, lines) | None,
    tail (turn, lines) | None). Turn 0 is everything from "Battle started" to "Turn 1"."""
    marks = []
    for i, t in enumerate(lines):
        m = TURN.match(t)
        if m:
            marks.append((i, int(m.group(1).replace(" ", ""))))
        elif t.startswith("Battle started between"):
            marks.append((i, 0))
    complete, head, tail = {}, None, None
    for (i, n), (j, n2) in zip(marks, marks[1:]):
        if n2 == n + 1:
            complete[n] = lines[i + 1:j] if n else lines[i:j]
    if marks:
        i, n = marks[-1]
        head = (n, lines[i + 1:] if n else lines[i:])
        if marks[0][1] > 0:
            tail = (marks[0][1] - 1, lines[:marks[0][0]])
    return complete, head, tail


def vote(cands, score):
    """Consensus of several readings of one turn: most common length, then per line the best-scoring of the
    most common variants."""
    lens = collections.Counter(len(c) for c in cands)
    n = max(lens, key=lambda k: (lens[k], k))
    same = [c for c in cands if len(c) == n]
    out = []
    for i in range(n):
        cnt = collections.Counter(c[i] for c in same)
        out.append(max(cnt, key=lambda v: (score(v), cnt[v])))
    return out, len(same)


def vote_prefix(cands, score):
    """For the last turn (never complete in a log crop): line by line while at least 2 readings reach that far."""
    out, i = [], 0
    while True:
        here = [c[i] for c in cands if len(c) > i]
        if len(here) < 2:
            return out
        cnt = collections.Counter(here)
        out.append(max(cnt, key=lambda v: (score(v), cnt[v])))
        i += 1


def scene_messages(frames):
    """Message-box readings in time order, one entry per change; wrapped lines joined."""
    out = []
    for f, obs in frames.items():
        rows = []   # OCR splits a line at wide gaps, pieces at slightly different y: group by centre, then x
        for o in sorted(obs, key=lambda o: o["y"] + o["h"] / 2):
            c = o["y"] + o["h"] / 2
            if rows and abs(c - rows[-1][0]) < 20:
                rows[-1][1].append(o)
            else:
                rows.append((c, [o]))
        lines, cur = [], ""
        for _, row in rows:
            t = clean(" ".join(o["text"] for o in sorted(row, key=lambda o: o["x"])))
            cur = (cur + " " + t).strip()
            if re.search(r"[!.)\]']$|\.\.\.$", t):
                lines.append(cur)
                cur = ""
        if cur:
            lines.append(cur)
        for t in lines:
            if not out or out[-1] != t:
                if t not in out[-3:]:
                    out.append(t)
    return out


def drop_tooltip(lines, move_names, score):
    """A move tooltip (hovered move button) drawn over the log: "Barb Barrage POISON", then its description.
    Drops that line and up to 3 following lines that match no message; True if anything was dropped."""
    for i, t in enumerate(lines):
        m = re.match(r"^(.+?)\s+[A-Z]{4}", t)
        if (m and m.group(1).lower() in move_names) or re.search(r"Base power|Accuracy\s+PP", t, re.I):
            j = i + 1
            while j < len(lines) and j <= i + 3 and not score(lines[j])[0] and not TURN.match(lines[j]):
                j += 1
            del lines[i:j]
            drop_tooltip(lines, move_names, score)
            return True
    return False


def merge(log_frames, scene_frames, score, move_names=()):
    complete = collections.defaultdict(list)
    heads = collections.defaultdict(list)
    preview = []
    skipped = 0
    for f, obs in log_frames.items():
        lines = log_lines(obs)
        skipped += drop_tooltip(lines, move_names, score)
        c, head, _ = sections(lines)
        for n, ls in c.items():
            complete[n].append(ls)
        if head:
            heads[head[0]].append(head[1])
        if any(t.startswith("Battle started") for t in lines) and not preview:
            preview = lines[:[i for i, t in enumerate(lines) if t.startswith("Battle started")][0]]
    last = max(list(complete) + list(heads))
    turns, notes = [], [f"{skipped} log frames had a move tooltip over the log (its lines dropped)"] if skipped else []
    for n in range(last + 1):
        if n in complete:
            ls, k = vote(complete[n], score)
            notes.append(f"turn {n}: {k}/{len(complete[n])} readings agree on {len(ls)} lines")
        elif n in heads:
            ls = vote_prefix(heads[n], score)
            notes.append(f"turn {n}: no complete reading; {len(ls)} lines from {len(heads[n])} partial ones")
        else:
            ls = []
            notes.append(f"turn {n}: MISSING")
        turns.append(ls)
    # the end of the last turn: message-box readings after the last line the log showed
    msgs = scene_messages(scene_frames) if scene_frames else []
    won = next((i for i, t in enumerate(msgs) if "won the battle" in t), None)
    msgs = msgs[:won + 1] if won is not None else msgs   # after the win the streamer may start the instant replay
    over = next((i for i, t in enumerate(msgs) if re.match(r"^(Download re|Instant replay|Upload and share)", t)), None)
    msgs = msgs[:over] if over is not None and won is None else msgs   # the end-of-battle buttons: the box missed the win
    prev = turns[-1] or (turns[-2] if len(turns) > 1 else [])   # last turn's header at the bottom, no lines yet
    if msgs and prev:
        key = prev[-1]
        ratio = [difflib.SequenceMatcher(None, m, key).ratio() for m in msgs]
        best = max(i for i, r in enumerate(ratio) if r >= max(ratio) - 0.05)   # the latest of the best matches
        stem = key.rstrip("!l'i ").lower()
        # a cut-off line is the start of the box's reading ("Pecharunt used Hex" is not "Pecharunt fainted!")
        same = ratio[best] > 0.8 or (ratio[best] > 0.6 and msgs[best].lower().startswith(stem))
        if same or "won the battle" in msgs[-1]:
            if same:
                prev[-1] = msgs[best]   # the box's reading of the log's last (often cut-off) line
            extra = msgs[best + 1:] if same else msgs   # no match: the box only caught the turn's end
            stop = next((i for i, t in enumerate(extra) if re.search(r"won the battle|^Battle started", t)), len(extra) - 1)
            extra = [t for t in extra[:stop + 1] if not t.startswith("Battle started")]
            kept = [prev[-1]]
            for t in extra:   # the box re-read: a line again in other case, or a line with the next one joined on
                base = next((k for k in kept[-3:] if t.lower().startswith(k.lower().rstrip("!l'") + " ")), None)
                t = t[len(base.rstrip("!l'")):].strip() if base else t
                if not any(difflib.SequenceMatcher(None, t.lower(), k.lower()).ratio() > 0.85 for k in kept[-3:]):
                    kept.append(t)
            extra = kept[1:]
            turns[-1] += extra
            notes.append(f"turn {last}: +{len(extra)} lines from the message box")
    return preview, turns, notes


# ---------------------------------------------------------------- main

def main():
    sys.path.insert(0, HERE)
    import video_convert as vc
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("work")
    ap.add_argument("--id", required=True)
    ap.add_argument("--templates", help="folder with default.js moves.js abilities.js items.js")
    ap.add_argument("--url", default="")
    ap.add_argument("--length", type=float, required=True, help="video length in seconds (or where to stop reading)")
    ap.add_argument("--start", type=float, default=0, help="where to start reading, for a video with an earlier game")
    ap.add_argument("--log-box", default=LOG_BOX, help="x,y,w,h of the battle log in the 1280x720 frame")
    ap.add_argument("--scene-box", default=SCENE_BOX, help="x,y,w,h of the scene's message box")
    ap.add_argument("--filter", default=FILTER, help="CSS filter before OCR; add invert(1) for a dark theme")
    args = ap.parse_args()
    os.makedirs(args.work, exist_ok=True)
    w = lambda *p: os.path.join(args.work, *p)
    args.templates = args.templates or os.path.join(os.path.dirname(os.path.abspath(args.work)), "pstext")
    os.makedirs(args.templates, exist_ok=True)
    for kind in ("default", "moves", "abilities", "items"):
        dest = os.path.join(args.templates, kind + ".js")
        if not os.path.exists(dest):
            import urllib.request
            url = f"https://cdn.jsdelivr.net/npm/pokemon-showdown@0.11.11/dist/data/text/{kind}.js"
            with urllib.request.urlopen(url, timeout=60) as resp, open(dest, "wb") as f:
                f.write(resp.read())

    grab(args.video, w("log"), [t * 5 for t in range(int(args.start // 5), int(args.length // 5) + 1)], args.log_box, w("log.jsonl"), args.filter)
    log_frames = load_frames(w("log.jsonl"))
    best, first, end = -1, 0, 0   # the highest turn header: the first and last frame showing it
    for f, obs in sorted(log_frames.items(), key=lambda kv: frame_time(kv[0])):
        for o in obs:
            m = TURN.match(clean(o["text"]))
            if m and int(m.group(1).replace(" ", "")) >= best:
                n = int(m.group(1).replace(" ", ""))
                first = frame_time(f) if n > best else first
                best, end = n, frame_time(f)
    # the last turn plays out after its header first shows; by the last frame the box may already show the win
    start = max(0, min(end - 40, first))
    stop = min(end + 60, start + 240)   # a long last turn scrolls its header out of the log well before the win
    # the streamer often plays the battle back from turn 1 right after: stop where the log restarts
    top = {}
    for f, obs in log_frames.items():
        ns = [int(m.group(1).replace(" ", "")) for o in obs for m in [TURN.match(clean(o["text"]))] if m]
        if ns:
            top[frame_time(f)] = max(ns)
    restart = min((t for t, n in top.items() if t > end and n < best - 3), default=None)
    if restart is not None:
        stop = min(stop, restart)
    scene_times = [t for t in (round(start + i * 0.5, 1) for i in range(int((stop - start) * 2) + 1)) if t <= args.length]
    grab(args.video, w("scene"), scene_times, args.scene_box, w("scene.jsonl"), args.filter)
    scene_frames = load_frames(w("scene.jsonl"))

    comp = vc.compile_templates(vc.load_templates(args.templates))
    score = lambda v: (vc.match(comp, v)[0] is not None, "%" in v or "lost" not in v)
    with open(os.path.join(ROOT, "site", "data", "moves.json"), encoding="utf-8") as f:
        move_names = {m["name"].lower() for m in json.load(f).values()}
    preview, turns, notes = merge(log_frames, scene_frames, score, move_names)
    with open(w("merged.txt"), "w", encoding="utf-8") as f:
        f.write("".join(l + "\n" for l in preview))
        for n, ls in enumerate(turns):
            f.write(f"== Turn {n} ==\n" if n else "== Start ==\n")
            f.write("".join(l + "\n" for l in ls))

    data = lambda n: json.load(open(os.path.join(ROOT, "site", "data", n), encoding="utf-8"))
    conv = vc.Converter(comp, data("pokedex.json"), data("moves.json"),
                        vc.names(args.templates, "items"), vc.names(args.templates, "abilities"))
    conv.convert(preview, turns)
    replay = {"id": args.id, "format": "[Gen 9] National Dex", "players": conv.players,
              "log": "\n".join(conv.out) + "\n", "uploadtime": None, "formatid": "gen9nationaldex",
              "source": "video", "video": args.url}
    with open(w(args.id + ".json"), "w", encoding="utf-8") as f:
        json.dump(replay, f, ensure_ascii=False, indent=1)
    with open(w("report.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(notes) + "\n\nUNPARSED\n" + "".join(f"{why}: {t}\n" for why, t in conv.unparsed))
        f.write("\nGUESSED\n" + "".join(g + "\n" for g in conv.guessed))
        f.write("\nDROPPED (timer / chat)\n" + "".join(f"{why}: {t}\n" for why, t in conv.dropped))
    print(f"turns {len(turns) - 1}, protocol lines {len(conv.out)}, unparsed {len(conv.unparsed)}, "
          f"guessed {len(conv.guessed)}\n  {w(args.id + '.json')}\n  {w('report.txt')}")


if __name__ == "__main__":
    main()
