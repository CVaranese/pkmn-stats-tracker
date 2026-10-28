"""Set which stays on the field were a hidden Zoroark in a league game (admin's pick), in site/games/index.json.
Stays are numbered per side as the site lists them (1 = the lead, then each switch-in). The site counts them
for Zoroark instead of the Pokemon it copied; with no pick it uses only the stays it can prove.
Usage: python -I tools/set_illusion.py <game id> <p1|p2> <n,n,...|none|auto>
  none: nothing was Zoroark (overrides proven stays); auto: remove the pick, back to proven stays."""
import json, os, sys
from pathlib import Path

INDEX = Path(__file__).resolve().parent.parent / "site" / "games" / "index.json"


def write_atomic(path, text):
    """Write a file in one step: a crash or Ctrl-C midway leaves the old file, never half of the new one."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)

if __name__ == "__main__":
    if len(sys.argv) != 4 or sys.argv[2] not in ("p1", "p2"):
        sys.exit(__doc__)
    gid, side, pick = sys.argv[1:]
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    game = next((g for g in index["games"] if g["id"] == gid), None)
    if game is None:
        sys.exit(f"{gid} isn't in the game library")
    picks = game.get("illusion", {})
    if pick == "auto":
        picks.pop(side, None)
    else:
        picks[side] = [] if pick == "none" else sorted({int(n) for n in pick.split(",")})
    if picks: game["illusion"] = picks
    else: game.pop("illusion", None)
    write_atomic(INDEX, json.dumps(index, ensure_ascii=False, indent=1) + "\n")
    print(f"{gid} {side}: {picks.get(side, 'auto (proven stays only)')}")
