"""Kill/death stats from Pokemon Showdown replays, written to CSV for spreadsheets.

Usage:
    python replay_stats.py <replay URLs, IDs, .json files, or a .txt file of links> [-o OUTDIR]

Writes:
    games.csv    one row per Pokemon per game (all 6 from team preview, with a "brought" flag)
    summary.csv  totals per player + Pokemon, sorted by kills

Kill rules (common draft-league conventions):
    direct   the Pokemon whose attack dealt the KO hit (spread moves can give 2 kills).
             Destiny Bond counts as a direct kill for the Destiny Bond user.
    passive  indirect damage credited to whoever caused it: burn/poison (who inflicted it),
             Leech Seed, Salt Cure, Curse, binding moves, hazards (who set them), weather
             (who set it), Rocky Helmet / Rough Skin / Iron Barbs, Perish Song.
    fallback if the KO's cause is the fainted Pokemon itself or its own team (recoil, Life Orb,
             confusion, own weather, an ally's spread move...), the last opposing Pokemon that
             damaged it gets a passive kill. If no opponent ever damaged it, nobody gets a kill.
    self-KO  Explosion / Memento / Final Gambit / Healing Wish: a death, no kill.
    forfeit  Pokemon left standing after a forfeit are not counted as deaths.
"""
import argparse
import csv
import json
import re
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

REPLAY_HOST = "https://replay.pokemonshowdown.com/"
CACHE_DIR = Path(__file__).parent / "replays"


# ---------- input ----------

def replay_id_from(text):
    """Turn a replay URL or ID into the replay ID ('format-12345'), or None."""
    text = text.strip()
    if not text or text.startswith("#"):
        return None
    text = text.split("?")[0].split("#")[0].rstrip("/")
    text = text.rsplit("/", 1)[-1]
    text = re.sub(r"\.(json|log)$", "", text)
    if re.fullmatch(r"[a-z0-9]+-\d+(-[a-z0-9]+)?", text):
        return text
    return None


def load_replay(source):
    """Return the replay dict for a URL, ID or local .json path. Downloads are cached."""
    path = Path(source)
    if path.suffix == ".json" and path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    rid = replay_id_from(source)
    if rid is None:
        raise ValueError(f"not a replay URL or ID: {source}")
    CACHE_DIR.mkdir(exist_ok=True)
    cached = CACHE_DIR / f"{rid}.json"
    if cached.exists() and cached.stat().st_size > 0:
        return json.loads(cached.read_text(encoding="utf-8"))
    req = urllib.request.Request(REPLAY_HOST + rid + ".json",
                                 headers={"User-Agent": "replay-stats-script"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read().decode("utf-8")
    cached.write_text(data, encoding="utf-8")
    return json.loads(data)


def expand_sources(args):
    """A .txt argument is read as one link per line; anything else is passed through."""
    out = []
    for a in args:
        p = Path(a)
        if p.suffix == ".txt" and p.exists():
            out += [line.strip() for line in p.read_text(encoding="utf-8").splitlines()
                    if replay_id_from(line)]
        else:
            out.append(a)
    return out


# ---------- log parsing ----------

def mon_key(ident):
    """'p1a: Charizard' -> 'p1: Charizard' (drop the slot so Ally Switch doesn't matter)."""
    side_slot, _, name = ident.partition(": ")
    return f"{side_slot[:2]}: {name}"


def side_of(key):
    return key[:2]


def norm(effect):
    """'move: Leech Seed' / 'Leech Seed' / 'leechseed' -> 'leechseed'."""
    effect = re.sub(r"^(move|ability|item):\s*", "", effect.strip(), flags=re.I)
    return re.sub(r"[^a-z0-9]", "", effect.lower())


def tags_of(parts):
    """Collect '[from] X' / '[of] Y' style tags from a split protocol line."""
    tags = {}
    for p in parts:
        m = re.match(r"\[(\w+)\]\s*(.*)", p)
        if m:
            tags[m.group(1)] = m.group(2)
    return tags


def base_species(details):
    """'Charizard-Mega-Y, L50, F' -> 'Charizard'; 'Rotom-Fan, L50' -> 'Rotom-Fan'."""
    species = details.split(",")[0].strip()
    return re.sub(r"-Mega(-[XY])?$", "", species)


HAZARDS = {"stealthrock", "spikes", "toxicspikes", "gmaxsteelsurge", "steelsurge"}
WEATHERS = {"sandstorm", "hail", "snow"}
STATUS_DAMAGE = {"brn", "psn", "tox"}
DELAYED_MOVES = {"futuresight", "doomdesire"}


def parse_battle(log):
    players = {}            # 'p1' -> name
    preview = defaultdict(list)  # 'p1' -> species at team preview
    species = {}            # mon key -> species
    stats = defaultdict(lambda: {"direct": 0, "passive": 0, "deaths": 0})
    winner = None
    forfeited = False

    mover = None            # mon key of the Pokemon whose move is resolving
    status_src = {}         # mon key -> who inflicted its status
    effect_src = {}         # (mon key, effect) -> source mon (Leech Seed, Salt Cure, perish...)
    hazard_src = {}         # (side, hazard) -> setter
    weather_src = None
    delayed_src = {}        # (target side, effect) -> user of Future Sight / Doom Desire
    last_opp_hit = {}       # mon key -> last opposing mon that damaged it
    pending_ko = {}         # mon key -> (killer, kind), set on the 0 HP damage line
    destiny_bond = None     # mon key whose Destiny Bond triggered
    kills = []              # (killer or None, kind, victim) for checking

    def credit(target, source, kind):
        """Apply the 'source must be an opponent, else fall back' rule."""
        if source and side_of(source) != side_of(target):
            return source, kind
        fallback = last_opp_hit.get(target)
        return (fallback, "passive") if fallback else (None, "none")

    for line in log.splitlines():
        if not line.startswith("|"):
            continue
        parts = line.split("|")[1:]
        cmd = parts[0]
        tags = tags_of(parts)

        if cmd == "player" and len(parts) > 2 and parts[2]:
            players[parts[1]] = parts[2]
        elif cmd == "poke":
            preview[parts[1]].append(base_species(parts[2]))
        elif cmd in ("switch", "drag", "replace"):
            key = mon_key(parts[1])
            species.setdefault(key, base_species(parts[2]))
            mover = None
        elif cmd in ("turn", "upkeep"):
            mover = None
        elif cmd == "move":
            mover = mon_key(parts[1])
            move = norm(parts[2])
            if move in DELAYED_MOVES and len(parts) > 3 and parts[3]:
                delayed_src[(parts[3][:2], move)] = mover
        elif cmd == "-end" and len(parts) > 2 and norm(parts[2]) in DELAYED_MOVES:
            # Future Sight landing: the damage line that follows belongs to its user
            mover = delayed_src.get((parts[1][:2], norm(parts[2])))
        elif cmd == "-status":
            target = mon_key(parts[1])
            frm = tags.get("from", "")
            if "of" in tags:
                status_src[target] = mon_key(tags["of"])
            elif frm.startswith("item:"):
                status_src[target] = None          # Flame Orb / Toxic Orb: self-inflicted
            elif mover:
                status_src[target] = mover
            else:
                status_src[target] = hazard_src.get((side_of(target), "toxicspikes"))
        elif cmd == "-curestatus":
            status_src.pop(mon_key(parts[1]), None)
        elif cmd in ("-start", "-activate"):
            target = mon_key(parts[1])
            effect = norm(parts[2]) if len(parts) > 2 else ""
            if effect.startswith("perish"):
                effect = "perish"
            src = mon_key(tags["of"]) if "of" in tags else mover
            if cmd == "-activate" and effect == "destinybond":
                destiny_bond = target
            elif src:
                effect_src.setdefault((target, effect), src)
        elif cmd == "-sidestart":
            hazard_src[(parts[1][:2], norm(parts[2]))] = mover
        elif cmd == "-sideend":
            hazard_src.pop((parts[1][:2], norm(parts[2])), None)
        elif cmd == "-weather" and "upkeep" not in tags:
            if norm(parts[1]) == "none":
                weather_src = None
            else:
                weather_src = mon_key(tags["of"]) if "of" in tags else mover
        elif cmd == "-damage":
            target = mon_key(parts[1])
            if "from" not in tags:
                source, kind = mover, "direct"
            else:
                frm = norm(tags["from"])
                kind = "passive"
                if frm in STATUS_DAMAGE:
                    source = status_src.get(target)
                elif "of" in tags and mon_key(tags["of"]) != target:
                    source = mon_key(tags["of"])  # Leech Seed, Rocky Helmet, Rough Skin...
                elif frm in HAZARDS:
                    source = hazard_src.get((side_of(target), frm))
                elif frm in WEATHERS:
                    source = weather_src
                elif (target, frm) in effect_src:
                    source = effect_src[(target, frm)]  # Salt Cure, Curse, binding moves
                else:
                    source = None                # recoil, Life Orb, confusion, etc.
            if source and side_of(source) != side_of(target):
                last_opp_hit[target] = source
            if parts[2].startswith("0"):
                pending_ko[target] = credit(target, source, kind)
        elif cmd == "faint":
            victim = mon_key(parts[1])
            stats[victim]["deaths"] += 1
            if victim in pending_ko:
                killer, kind = pending_ko.pop(victim)
            elif destiny_bond and side_of(destiny_bond) != side_of(victim):
                killer, kind = destiny_bond, "direct"
            elif (victim, "perish") in effect_src:
                killer, kind = credit(victim, effect_src[(victim, "perish")], "passive")
            else:
                killer, kind = None, "none"          # Explosion, Memento, Final Gambit...
            if killer and kind in ("direct", "passive"):
                stats[killer][kind] += 1
            kills.append((killer, kind, victim))
        elif cmd == "-message" and "forfeited" in parts[1]:
            forfeited = True
        elif cmd == "win":
            winner = parts[1]
        if cmd == "turn":
            destiny_bond = None

    return {
        "players": players, "preview": preview, "species": species,
        "stats": stats, "winner": winner, "forfeited": forfeited, "kills": kills,
    }


# ---------- output ----------

GAME_FIELDS = ["replay_id", "date", "format", "player", "opponent", "won", "pokemon", "nickname",
               "brought", "kills", "direct_kills", "passive_kills", "deaths", "replay_url"]
SUMMARY_FIELDS = ["player", "pokemon", "games_brought", "wins_when_brought", "kills",
                  "direct_kills", "passive_kills", "deaths", "kills_per_game"]


def game_rows(replay):
    b = parse_battle(replay["log"])
    rid = replay["id"]
    date = ""
    if replay.get("uploadtime"):
        date = datetime.fromtimestamp(int(replay["uploadtime"]), timezone.utc).strftime("%Y-%m-%d")
    rows = []
    for side in ("p1", "p2"):
        player = b["players"].get(side, side)
        opponent = b["players"].get("p2" if side == "p1" else "p1", "")
        brought = {k: s for k, s in b["species"].items() if side_of(k) == side}
        seen = set()
        for sp in b["preview"][side] or sorted(set(brought.values())):
            keys = [k for k, s in brought.items() if s == sp or s.startswith(sp.rstrip("*"))]
            key = keys[0] if keys else None
            if key:
                seen.add(key)
            st = b["stats"].get(key, {"direct": 0, "passive": 0, "deaths": 0}) if key else \
                {"direct": 0, "passive": 0, "deaths": 0}
            rows.append({
                "replay_id": rid, "date": date, "format": replay.get("format", ""),
                "player": player, "opponent": opponent, "won": int(b["winner"] == player),
                "pokemon": brought.get(key, sp) if key else sp,
                "nickname": key.split(": ", 1)[1] if key else "",
                "brought": int(key is not None),
                "kills": st["direct"] + st["passive"], "direct_kills": st["direct"],
                "passive_kills": st["passive"], "deaths": st["deaths"],
                "replay_url": REPLAY_HOST + rid,
            })
        for key in brought.keys() - seen:  # no team preview match (shouldn't happen)
            st = b["stats"][key]
            rows.append({
                "replay_id": rid, "date": date, "format": replay.get("format", ""),
                "player": player, "opponent": opponent, "won": int(b["winner"] == player),
                "pokemon": brought[key], "nickname": key.split(": ", 1)[1], "brought": 1,
                "kills": st["direct"] + st["passive"], "direct_kills": st["direct"],
                "passive_kills": st["passive"], "deaths": st["deaths"],
                "replay_url": REPLAY_HOST + rid,
            })
    return rows


def summarize(rows):
    agg = {}
    for r in rows:
        if not r["brought"]:
            continue
        a = agg.setdefault((r["player"], r["pokemon"]), dict.fromkeys(SUMMARY_FIELDS, 0))
        a["player"], a["pokemon"] = r["player"], r["pokemon"]
        a["games_brought"] += 1
        a["wins_when_brought"] += r["won"]
        for f in ("kills", "direct_kills", "passive_kills", "deaths"):
            a[f] += r[f]
    out = list(agg.values())
    for a in out:
        a["kills_per_game"] = round(a["kills"] / a["games_brought"], 2)
    out.sort(key=lambda a: (-a["kills"], a["deaths"], a["player"].lower(), a["pokemon"]))
    return out


def write_csv(path, fields, rows):
    # utf-8-sig so Excel shows accents (Pokémon names, player names) correctly
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sources", nargs="+", help="replay URLs, IDs, .json files, or .txt files of links")
    ap.add_argument("-o", "--outdir", default=".", help="where to write games.csv and summary.csv")
    args = ap.parse_args()

    rows, failed = [], []
    seen_ids = set()
    for src in expand_sources(args.sources):
        try:
            replay = load_replay(src)
        except Exception as e:
            failed.append((src, e))
            continue
        if replay["id"] in seen_ids:
            continue
        seen_ids.add(replay["id"])
        rows += game_rows(replay)

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    summary = summarize(rows)
    write_csv(outdir / "games.csv", GAME_FIELDS, rows)
    write_csv(outdir / "summary.csv", SUMMARY_FIELDS, summary)

    print(f"Parsed {len(seen_ids)} replay(s) -> {outdir / 'games.csv'}, {outdir / 'summary.csv'}")
    for src, e in failed:
        print(f"  FAILED {src}: {e}", file=sys.stderr)
    print("\nTop killers:")
    for a in summary[:10]:
        print(f"  {a['kills']:>3} kills  {a['deaths']:>2} deaths  {a['pokemon']:<16} ({a['player']})")


if __name__ == "__main__":
    main()
