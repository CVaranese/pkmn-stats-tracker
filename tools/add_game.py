"""Add a league game to the site's game library.

Saves the replay's JSON as site/<league>/games/<id>.json and adds a line to site/<league>/games/index.json
(players, winner, date and turns read from the replay). Running it again for the same game
updates its labels instead of adding it twice. --league is a league id from site/leagues.json. --set labels the set
(best of three, playoff series) a game belongs to; a league with best_of in site/leagues.json groups unlabelled games
of a week between the same two players by itself, and the Games tab flags a group that can't be one set.

    python tools/add_game.py https://replay.pokemonshowdown.com/gen9nationaldex-123 --league ppppp --week "Week 3"
    python tools/add_game.py gen9nationaldex-123 --league ppppp --week "Playoffs R1" --note "Game 2"

A game rebuilt from its YouTube stream (tools/video_to_replay.py) has no Showdown replay: give the video link
and the rebuilt JSON. It's stored as video-<youtube id, lowercase>, dated by --date: the day the game was played
(league games are Sundays at 9pm Pacific, usually the Sunday before the video went up), not the upload day.

    python tools/add_game.py https://youtu.be/d1nX5QVh-CA --file video-d1nX5QVh-CA.json --league ppppp --week "Week 2" --date 2026-09-13

A game's date is its week's Sunday (the Sunday on or before the day it was played, in Pacific time: a replay saved
Sunday 9pm Pacific is Monday in UTC). The site shows only the week; the date orders games.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"
GAMES = INDEX = None  # site/<league>/games/ and its index.json, set by main() from --league


def write_atomic(path, text):
    """Write a file in one step: a crash or Ctrl-C midway leaves the old file, never half of the new one."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)
REPLAY_HOST = "https://replay.pokemonshowdown.com/"
SAVED = [SITE.parent / "tests" / "fixtures"]  # + the league's mock/, set by main()


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
        if isinstance(e, urllib.error.HTTPError) and e.code < 500:
            sys.exit(f"{rid}: not found (deleted, private, or never saved)" if e.code == 404 else f"{rid}: HTTP {e.code}")
        # Showdown down: a copy already saved in the repo will do
        for saved in SAVED:
            if (saved / (rid + ".json")).exists():
                print(f"Showdown didn't answer ({e}); using {saved.name}/{rid}.json")
                return json.loads((saved / (rid + ".json")).read_text(encoding="utf-8"))
        sys.exit(f"{rid}: Showdown didn't answer ({e}). Try again later, or pass --file with a saved copy.")


def pacific_date(ts):
    """YYYY-MM-DD of a Unix time in US Pacific time (league games are Sunday 9pm Pacific). DST from the second
    Sunday of March to the first Sunday of November, both at 2am local (US rules since 2007); no tz database needed."""
    utc = datetime.fromtimestamp(ts, timezone.utc)

    def sunday(month, nth):  # the nth Sunday of that month
        first = datetime(utc.year, month, 1, tzinfo=timezone.utc)
        return first + timedelta(days=(6 - first.weekday()) % 7 + 7 * (nth - 1))
    dst = sunday(3, 2) + timedelta(hours=10) <= utc < sunday(11, 1) + timedelta(hours=9)
    return (utc - timedelta(hours=7 if dst else 8)).strftime("%Y-%m-%d")


def week_sunday(day):
    """The Sunday on or before a YYYY-MM-DD day: a game's date is its week's Sunday, never more exact (user 2026-10-28)."""
    d = datetime.strptime(day, "%Y-%m-%d")
    return (d - timedelta(days=(d.weekday() + 1) % 7)).strftime("%Y-%m-%d")


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
        "date": week_sunday(pacific_date(replay["uploadtime"])),
        "turns": int(turns[-1]) if turns else 0,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("replay", help="replay link or id")
    ap.add_argument("--week", required=True, help='label to group by, e.g. "Week 3" or "Playoffs R1"')
    ap.add_argument("--league", required=True, help="league id from site/leagues.json, e.g. ppppp")
    ap.add_argument("--note", default="")
    ap.add_argument("--set", help='the set (best of three, playoff series) it belongs to: games with the same label are one set, e.g. "QF Karm-Joey"')
    ap.add_argument("--file", help="a saved copy of the replay's .json, when Showdown is down; for a video, the rebuilt one")
    ap.add_argument("--date", help="YYYY-MM-DD, for a game with no upload time (a video): the day it was played, not the upload day")
    args = ap.parse_args()
    global GAMES, INDEX
    leagues = [lg["id"] for lg in json.loads((SITE / "leagues.json").read_text(encoding="utf-8"))["leagues"]]
    if args.league not in leagues:
        sys.exit(f"Unknown league {args.league!r}: one of {', '.join(leagues)} (site/leagues.json)")
    GAMES = SITE / args.league / "games"
    INDEX = GAMES / "index.json"
    SAVED.insert(0, SITE / args.league / "mock")

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
        write_atomic(copy, json.dumps(replay, ensure_ascii=False))
    elif copy.exists():
        replay = json.loads(copy.read_text(encoding="utf-8"))
    else:
        replay = fetch(rid)
        GAMES.mkdir(parents=True, exist_ok=True)
        write_atomic(copy, json.dumps(replay, ensure_ascii=False))

    index = json.loads(INDEX.read_text(encoding="utf-8")) if INDEX.exists() else {"games": []}
    entry = {"id": rid, "league": args.league, "week": args.week, **summary(replay), "note": args.note}
    if args.set:
        entry["set"] = args.set
    if replay.get("video"):   # rebuilt from the stream: Watch plays the video; HP / damage numbers are partly estimated
        entry["video"] = replay["video"]
        entry["note"] = args.note or "Stream video"  # short: details go in note_detail (the Games row tooltip)
    games = index["games"]
    old = next((i for i, g in enumerate(games) if g["id"] == rid), None)
    if old is None:
        games.append(entry)
    else:
        # everything the new entry doesn't set stays on a relabel (hidden-Zoroark picks, a stream video's misread
        # lines, the hover note, team sheets...)
        for k, v in games[old].items():
            entry.setdefault(k, v)
        if "known_errors" in entry and not args.note: entry["note"] = games[old]["note"]
        games[old] = entry
    write_atomic(INDEX, json.dumps(index, ensure_ascii=False, indent=1) + "\n")
    vs = " vs ".join(entry["players"])
    print(f"{'Updated' if old is not None else 'Added'} {rid}: {args.week}, {vs}, winner {entry['winner'] or '?'}, "
          f"{entry['turns']} turns, {entry['date']}")
    # the landing page shows each league's game count
    subprocess.run([sys.executable, "-I", str(SITE.parent / "tools" / "build_pages.py")], check=False)


if __name__ == "__main__":
    main()
