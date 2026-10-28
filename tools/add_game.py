"""Add a league game to the site's game library.

Saves the replay's JSON as site/games/<id>.json and adds a line to site/games/index.json
(players, winner, date and turns read from the replay). Running it again for the same game
updates its labels instead of adding it twice.

    python tools/add_game.py https://replay.pokemonshowdown.com/gen9nationaldex-123 --week "Week 3"
    python tools/add_game.py gen9nationaldex-123 --week "Playoffs R1" --note "Game 2"

A game rebuilt from its YouTube stream (tools/video_to_replay.py) has no Showdown replay: give the video link
and the rebuilt JSON. It's stored as video-<youtube id, lowercase>, dated by --date (the stream's day).

    python tools/add_game.py https://youtu.be/d1nX5QVh-CA --file video-d1nX5QVh-CA.json --week "Week 2" --date 2026-09-14
"""
import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

GAMES = Path(__file__).resolve().parent.parent / "site" / "games"
INDEX = GAMES / "index.json"
REPLAY_HOST = "https://replay.pokemonshowdown.com/"
SAVED = [GAMES.parent / "mock", GAMES.parent.parent / "tests" / "fixtures"]


def replay_id(text):
    m = re.search(r"(?:youtu\.be/|[?&]v=)([\w-]{11})", text)
    if m:   # a stream video: the site's ids are lowercase
        return "video-" + m.group(1).lower()
    m = re.search(r"([a-z0-9]+-\d+(?:-[a-z0-9]+pw)?)/?(?:\.json|\.log)?\s*$", text.strip().split("?")[0])
    if not m:
        sys.exit(f"Not a replay link or id: {text}")
    return m.group(1)


def fetch(rid):
    req = urllib.request.Request(REPLAY_HOST + rid + ".json", headers={"User-Agent": "showdown-replay-stats"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.load(resp)
    except (urllib.error.URLError, TimeoutError) as e:
        # Showdown down: a copy already saved in the repo will do
        for saved in SAVED:
            if (saved / (rid + ".json")).exists():
                print(f"Showdown didn't answer ({e}); using {saved.name}/{rid}.json")
                return json.loads((saved / (rid + ".json")).read_text(encoding="utf-8"))
        if getattr(e, "code", None) == 404:
            sys.exit(f"{rid}: not found (deleted, private, or never saved)")
        sys.exit(f"{rid}: Showdown didn't answer ({e}). Try again later, or pass --file with a saved copy.")


def summary(replay):
    log = replay["log"]
    win = re.search(r"^\|win\|(.*)$", log, re.M)
    turns = re.findall(r"^\|turn\|(\d+)$", log, re.M)
    # team preview: |poke|p1|Garchomp, L50, M|item; a form not shown until battle is "Zamazenta-*"
    teams = [[m.removesuffix("-*") for m in re.findall(rf"^\|poke\|{side}\|([^,|]+)", log, re.M)] for side in ("p1", "p2")]
    return {
        "players": replay["players"][:2],
        "teams": teams,
        "winner": win.group(1) if win else "",
        "date": datetime.fromtimestamp(replay["uploadtime"], timezone.utc).strftime("%Y-%m-%d"),
        "turns": int(turns[-1]) if turns else 0,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("replay", help="replay link or id")
    ap.add_argument("--week", required=True, help='label to group by, e.g. "Week 3" or "Playoffs R1"')
    ap.add_argument("--league", default="pinecord")
    ap.add_argument("--note", default="")
    ap.add_argument("--file", help="a saved copy of the replay's .json, when Showdown is down; for a video, the rebuilt one")
    ap.add_argument("--date", help="YYYY-MM-DD, for a game with no upload time (a video's stream day)")
    args = ap.parse_args()

    rid = replay_id(args.replay)
    copy = GAMES / (rid + ".json")
    if rid.startswith("video-") and not args.file and not copy.exists():
        sys.exit("A video game needs --file with the JSON from tools/video_to_replay.py")
    if args.file:
        replay = json.loads(Path(args.file).read_text(encoding="utf-8"))
        if rid.startswith("video-"):
            replay["id"] = rid
        if not replay.get("uploadtime"):
            if not args.date:
                sys.exit("This game has no upload time: pass --date YYYY-MM-DD")
            replay["uploadtime"] = int(datetime.strptime(args.date, "%Y-%m-%d").replace(hour=12, tzinfo=timezone.utc).timestamp())
        GAMES.mkdir(parents=True, exist_ok=True)
        copy.write_text(json.dumps(replay, ensure_ascii=False), encoding="utf-8")
    elif copy.exists():
        replay = json.loads(copy.read_text(encoding="utf-8"))
    else:
        replay = fetch(rid)
        GAMES.mkdir(parents=True, exist_ok=True)
        copy.write_text(json.dumps(replay, ensure_ascii=False), encoding="utf-8")

    index = json.loads(INDEX.read_text(encoding="utf-8")) if INDEX.exists() else {"games": []}
    entry = {"id": rid, "league": args.league, "week": args.week, **summary(replay), "note": args.note}
    if replay.get("video"):   # rebuilt from the stream: Watch plays the video; HP / damage numbers are partly estimated
        entry["video"] = replay["video"]
        entry["note"] = args.note or "Stream video"  # short: details go in note_detail (the Games row tooltip)
    games = index["games"]
    old = next((i for i, g in enumerate(games) if g["id"] == rid), None)
    if old is None:
        games.append(entry)
    else:
        # hidden-Zoroark picks, the misread lines of a stream video and the hover note stay on a relabel
        for k in ("illusion", "known_errors", "note_detail"):
            if k in games[old]: entry[k] = games[old][k]
        if "known_errors" in entry and not args.note: entry["note"] = games[old]["note"]
        games[old] = entry
    INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    vs = " vs ".join(entry["players"])
    print(f"{'Updated' if old is not None else 'Added'} {rid}: {args.week}, {vs}, winner {entry['winner'] or '?'}, "
          f"{entry['turns']} turns, {entry['date']}")


if __name__ == "__main__":
    main()
