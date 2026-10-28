"""Write site/games/records.json: each league player's win-loss record from the Challonge bracket, under the
bracket's names (the user OK'd showing these, 2026-10-27).

Needs the Challonge API v1 key in ~/.challonge_key.

    python -I tools/challonge_records.py
"""
import json
import os
import sys
import urllib.request
from datetime import date

SLUG = "peepeepeepeepiss"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "site", "games", "records.json")


def main():
    with open(os.path.expanduser("~/.challonge_key"), encoding="utf-8") as f:
        key = f.read().strip()
    url = (f"https://api.challonge.com/v1/tournaments/{SLUG}.json?api_key={key}"
           "&include_matches=1&include_participants=1")
    req = urllib.request.Request(url, headers={"User-Agent": "replay-stats"})
    with urllib.request.urlopen(req, timeout=30) as r:
        t = json.load(r)["tournament"]
    bracket = {p["participant"]["id"]: p["participant"]["name"].strip() for p in t["participants"]}
    rec = {pid: [0, 0] for pid in bracket}
    for m in (m["match"] for m in t["matches"]):
        # unfinished, a bye (no loser) or a removed participant: not a result
        if m["state"] != "complete" or m["winner_id"] not in rec or m["loser_id"] not in rec:
            continue
        rec[m["winner_id"]][0] += 1
        rec[m["loser_id"]][1] += 1
    players = [{"name": bracket[pid], "wins": w, "losses": l} for pid, (w, l) in rec.items()]
    players.sort(key=lambda p: (-p["wins"], p["losses"], p["name"].lower()))
    out = {"source": f"https://challonge.com/{SLUG}", "updated": date.today().isoformat(),
           "players": players}
    tmp = OUT + ".tmp"  # written in one step: a crash midway leaves the old records
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, OUT)
    print(f"{len(players)} players written -> {OUT}")


if __name__ == "__main__":
    sys.exit(main())
