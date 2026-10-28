"""Which moves each Pokemon can learn, for spotting a hidden Zoroark (a "Donphan" using Shadow Ball).
Reads Showdown's dist/data/learnsets.js and pokedex.js (pokemon-showdown npm package) as text, like
showdown_data.py. Every generation and source counts (National Dex allows past-generation moves), and a
Pokemon also gets its pre-evolutions' moves. A form with no list of its own uses its base species'.
Smeargle (Sketch) is "*": any move. Writes {id: "move1 move2 ..."}.
Usage: python -I tools/learnsets.py learnsets.js pokedex.js site/data/learnsets.json"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from showdown_data import load

def toid(s): return re.sub(r"[^a-z0-9]", "", (s or "").lower())

if __name__ == "__main__":
    learn_js, dex_js, dst = sys.argv[1], sys.argv[2], sys.argv[3]
    learnsets = {k: set((v.get("learnset") or {}).keys()) for k, v in load(learn_js, "Learnsets").items()}
    dex = load(dex_js, "Pokedex")

    def own(sid, seen=()):
        """Moves of one species: its own list, else its base form's; plus its pre-evolution's."""
        if sid in seen or sid not in dex: return set()
        d = dex[sid]
        moves = set(learnsets.get(sid) or ())
        if not moves:
            for base in (d.get("changesFrom"), d.get("baseSpecies")):
                if base and toid(base) != sid:
                    moves = own(toid(base), seen + (sid,))
                    if moves: break
        if d.get("prevo"): moves |= own(toid(d["prevo"]), seen + (sid,))
        return moves

    out = {}
    for sid in dex:
        moves = own(sid)
        if "sketch" in moves: out[sid] = "*"
        elif moves: out[sid] = " ".join(sorted(moves))
    with open(dst, "w", encoding="utf-8") as f: json.dump(out, f, separators=(",", ":"))
    print(dst, len(out), "species,", os.path.getsize(dst) // 1024, "KB")
