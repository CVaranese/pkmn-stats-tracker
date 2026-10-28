"""List what looks misread in the games rebuilt from stream videos (site/games/video-*.json), so they can be fixed by hand.
    python -I tools/audit_video_games.py            # writes docs/VIDEO_GAMES_AUDIT.md
    python -I tools/audit_video_games.py --stdout   # prints it instead
Checks only the log itself (no video): names that never came onto the field, moves Showdown doesn't have, a hit with
no move before it, "0 fnt" with no faint, HP that goes up with no heal, a hit count that doesn't match the hits,
an Aftermath with nobody fainting, chip damage that didn't lower HP, and a turn where a side did nothing.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAMES = os.path.join(ROOT, "site", "games")
OUT = os.path.join(ROOT, "docs", "VIDEO_GAMES_AUDIT.md")


def to_id(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def ident(s):
    """'p1a: Garfield' -> ('p1', 'Garfield'); None for anything else."""
    m = re.match(r"^(p[12])[a-c]: ?(.*)$", s or "")  # a position letter: "p1: name" is the player (a side condition)
    return (m.group(1), m.group(2).strip()) if m else None


def hp_of(s):
    m = re.match(r"^(\d+)/\d+", s or "")
    return 0 if (s or "").startswith("0") else (int(m.group(1)) if m else None)


def audit(log, moves, regen):
    """[(turn, line number, what)] for one log."""
    lines = log.split("\n")
    out = []
    on_field = set()           # (side, name) that switched in at some point
    for l in lines:
        p = l.split("|")
        if len(p) > 3 and p[1] in ("switch", "drag", "replace"):
            i = ident(p[2])
            if i:
                on_field.add(i)
    turn = 0
    hp = {}                    # (side, name) -> last HP seen
    active = {}                # side -> (side, name)
    acted = set()              # sides that did something this turn
    since_move = None          # the |move| line in force: (actor, target) or None after a turn / switch
    hits = {}                  # target -> damage lines since the last move
    zero = {}                  # (side, name) -> line number of a "0 fnt" not yet followed by |faint|
    last_faint_line = -9
    for n, l in enumerate(lines, 1):
        p = l.split("|")
        if len(p) < 2:
            continue
        cmd = p[1]
        if cmd == "turn":
            if turn > 0:
                for side in ("p1", "p2"):
                    if side in active and side not in acted:
                        out.append((turn, n, f"{side} ({active[side][1]}) did nothing this turn: a move or 'can't move' line may be missing"))
            turn = int(p[2]) if p[2].isdigit() else turn + 1
            acted = set()
            since_move = None
            continue
        who = ident(p[2]) if len(p) > 2 else None
        if who and who not in on_field and cmd not in ("player", "poke", "teamsize"):
            out.append((turn, n, f"names a Pokémon that never came onto the field ({who[0]}: '{who[1]}'): misread name, its effect is lost: `{l}`"))
        if cmd in ("switch", "drag", "replace") and who:
            new = hp_of(p[4]) if len(p) > 4 else None
            if who in zero and new:
                out.append((turn, zero.pop(who), f"{who[1]} goes to 0 ('0 fnt') with no faint and comes back at {new}% (line {n}): the HP is misread"))
                hp[who] = new
            sp = to_id(p[3].split(",")[0]) if len(p) > 3 else ""
            if who in hp and new is not None and hp[who] is not None and new > hp[who] + 1 and sp not in regen:
                out.append((turn, n, f"{who[1]} comes back at {new}% but left at {hp[who]}% (no heal logged; Regenerator?)"))
            if new is not None:
                hp[who] = new
            if who[1] == "":
                out.append((turn, n, f"{p[3].split(',')[0]} has no name on the field: `{l}`"))
            active[who[0]] = who
            if cmd == "switch" and turn > 0 and not any(k == who for k in zero):
                acted.add(who[0])
            since_move = None
        elif cmd == "move" and who:
            acted.add(who[0])
            if to_id(p[3]) not in moves:
                out.append((turn, n, f"move '{p[3]}' isn't a Showdown move: misread"))
            since_move = (who, ident(p[4]) if len(p) > 4 else None)
            hits = {}
        elif cmd == "cant" and who:
            acted.add(who[0])
        elif cmd in ("-damage", "-heal") and who:
            tags = " ".join(p[4:])
            new = hp_of(p[3]) if len(p) > 3 else None
            old = hp.get(who)
            if cmd == "-damage" and "[from]" not in tags:
                if since_move is None:
                    out.append((turn, n, f"{who[1]} loses HP with no move before it: the attack line is missing or misread"))
                hits[who] = hits.get(who, 0) + 1
            if cmd == "-damage" and "[from]" in tags and new is not None and old is not None and new >= old and new > 0:
                out.append((turn, n, f"{who[1]} takes '{tags.split('[from]')[1].split('|')[0].strip()}' damage but stays at {new}%: the HP is misread"))
            if "ability: Aftermath" in tags and n - last_faint_line > 3:
                out.append((turn, n, f"Aftermath with nobody fainting just before: probably Rough Skin / Iron Barbs misread"))
            if new == 0 and (p[3] or "").startswith("0"):
                zero[who] = n
            if new is not None:
                hp[who] = new
        elif cmd == "-hitcount" and who:
            want = int(p[3]) if len(p) > 3 and p[3].isdigit() else None
            got = hits.get(who, 0)
            if want is not None and got != want:
                out.append((turn, n, f"says hit {want} times but {got} hit lines on {who[1]}: hits missing"))
        elif cmd == "faint" and who:
            zero.pop(who, None)
            last_faint_line = n
    for who, n in zero.items():
        out.append((None, n, f"{who[1]} goes to 0 ('0 fnt') but never faints: a misread HP"))
    return sorted(out, key=lambda x: (x[1]))


def main():
    moves = set(json.load(open(os.path.join(ROOT, "site", "data", "moves.json"), encoding="utf-8")))
    dex = json.load(open(os.path.join(ROOT, "site", "data", "pokedex.json"), encoding="utf-8"))
    # Regenerator heals a third on switching out with no log line: coming back higher is real for these
    regen = {k for k, v in dex.items() if "Regenerator" in (v.get("abilities") or {}).values()}
    games = json.load(open(os.path.join(GAMES, "index.json"), encoding="utf-8"))["games"]
    order = {g["id"]: i for i, g in enumerate(games)}
    vids = sorted((g for g in games if g["id"].startswith("video-")), key=lambda g: (int(re.sub(r"\D", "", g["week"]) or 0), order[g["id"]]))
    md = ["# Video-rebuilt games: what to fix by hand", "",
          "Made by `python -I tools/audit_video_games.py` from the logs alone (no video). Each line gives the turn, the",
          "log line number (in the game's `site/games/<id>.json` `log`, counting from 1) and what looks wrong. Some are",
          "real (a turn spent recharging, a Pokémon that can't move with no line for it), so check each against the video.",
          "Coming back with more HP is only flagged for Pokémon that can't have Regenerator. Re-run after fixing.", ""]
    total = 0
    for g in vids:
        rep = json.load(open(os.path.join(GAMES, g["id"] + ".json"), encoding="utf-8"))
        issues = audit(rep["log"], moves, regen)
        total += len(issues)
        md.append(f"## {g['week']}: {' vs '.join(g['players'])} (`{g['id']}`, {g.get('turns', '?')} turns)")
        if g.get("video"):
            md.append(f"Video: {g['video']}")
        if g.get("known_errors"):
            md.append(f"Already noted on the site: {g['known_errors']}")
        md.append("")
        md += [f"- [ ] Turn {t if t is not None else '?'}, line {n}: {what}" for t, n, what in issues] or ["- Nothing found."]
        md.append("")
    md.insert(5, f"{len(vids)} games, {total} things to check.\n")
    text = "\n".join(md)
    if "--stdout" in sys.argv:
        sys.stdout.write(text)
    else:
        open(OUT, "w", encoding="utf-8").write(text)
        print(f"{len(vids)} games, {total} issues -> {OUT}")


if __name__ == "__main__":
    main()
