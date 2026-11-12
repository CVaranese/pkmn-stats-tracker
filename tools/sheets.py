"""List a league's saved team sheets in its game library.

A sheet is a file site/<league>/mock/<game id>-<player>.txt (the paste, kept as given) or <game id>-<player>.fix.txt
(hand-made sets); the site only reads the ones index.json lists per game ("sheets", "fixes"). After saving sheet
files, this adds the missing names to index.json, so no file is saved and never shown.

    python -I tools/sheets.py --league ppppp           add what's missing, print each addition
    python -I tools/sheets.py --league ppppp --check   change nothing; exit 1 if a file isn't listed, a listed sheet
                                                       has no file, or a file belongs to no saved game

<player> is the player's Showdown name in lowercase letters and digits only ("pee nation" -> peenation).
tests/test_tools.py runs problems() for every league.
"""
import argparse
import json
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"


def to_id(name):
    return re.sub(r"[^a-z0-9]", "", name.lower())


def scan(league):
    """(index, files): the league's index.json and {(game id, "sheets" | "fixes"): [player, ...]} from mock/.
    A file name is split at the longest game id it starts with (ids hold dashes: video-97fk-1fdrai-g2)."""
    index = json.loads((SITE / league / "games" / "index.json").read_text(encoding="utf-8"))
    ids = sorted((g["id"] for g in index["games"]), key=len, reverse=True)
    files, strays = {}, []
    for f in sorted((SITE / league / "mock").glob("*.txt")):
        kind = "fixes" if f.name.endswith(".fix.txt") else "sheets"
        stem = f.name[:-len(".fix.txt" if kind == "fixes" else ".txt")]
        gid = next((i for i in ids if stem.startswith(i + "-")), None)
        if gid is None:
            strays.append(f.name)
        else:
            files.setdefault((gid, kind), []).append(stem[len(gid) + 1:])
    return index, files, strays


def problems(league):
    """What --check reports: one line each."""
    index, files, strays = scan(league)
    out = [f"{league}/mock/{name}: no saved game with that id" for name in strays]
    for g in index["games"]:
        players = {to_id(p) for p in g["players"]}
        for kind in ("sheets", "fixes"):
            listed, saved = g.get(kind, []), files.get((g["id"], kind), [])
            out += [f"{g['id']}: {kind} lists {p} but mock/ has no file" for p in listed if p not in saved]
            out += [f"{g['id']}: mock/ has a {kind} file for {p}, not listed in index.json" for p in saved if p not in listed]
            out += [f"{g['id']}: {kind} file for {p}, who isn't a player of that game ({', '.join(g['players'])})"
                    for p in saved if to_id(p) not in players]
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--league", required=True)
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    if args.check:
        found = problems(args.league)
        print("\n".join(found) or "sheets: every file is listed and every listed sheet has its file")
        sys.exit(1 if found else 0)
    index, files, _ = scan(args.league)
    added = 0
    for g in index["games"]:
        for kind in ("sheets", "fixes"):
            new = [p for p in files.get((g["id"], kind), []) if p not in g.get(kind, [])]
            if new:
                g[kind] = g.get(kind, []) + new
                added += len(new)
                print(f"{g['id']} ({g['week']}): {kind} + {', '.join(new)}")
    if added:
        import add_game  # its atomic write: a crash mid-write can't leave half an index
        add_game.write_atomic(SITE / args.league / "games" / "index.json", json.dumps(index, ensure_ascii=False, indent=1) + "\n")
    left = problems(args.league)
    print(f"{added} added" + (f"; still wrong:\n" + "\n".join(left) if left else ""))
    sys.exit(1 if left else 0)


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    main()
