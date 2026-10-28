"""Write site/data/smogon_hp.json: for each Pokemon, whether its common Nat Dex sets put EVs in HP.

    python -I tools/smogon_hp.py [--month 2026-09] [--format gen9nationaldex-1630]

Reads Smogon's monthly usage stats (chaos JSON, "Spreads" = "Nature:hp/atk/def/spa/spd/spe" -> weight)
and keeps, per species ID, hp: 252 when spreads with 128+ HP EVs carry most of the weight, else 0
(HP investment is nearly always all or nothing), plus share: that weight's fraction, for the tooltip.
Used by the site's max-HP guess for teams without a sheet.
"""
import argparse
import json
import re
import urllib.request
from pathlib import Path

STATS = "https://www.smogon.com/stats/"
OUT = Path(__file__).resolve().parent.parent / "site" / "data" / "smogon_hp.json"


def get(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def to_id(name):
    return re.sub(r"[^a-z0-9]", "", name.lower())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--month", help="YYYY-MM (default: newest)")
    ap.add_argument("--format", default="gen9nationaldex-1630")
    args = ap.parse_args()
    month = args.month or re.findall(r'href="(\d{4}-\d{2})/"', get(STATS).decode())[-1]
    data = json.loads(get(f"{STATS}{month}/chaos/{args.format}.json"))
    out = {}
    for name, mon in data["data"].items():
        spreads = mon.get("Spreads") or {}
        total = sum(spreads.values())
        if not total:
            continue
        invested = sum(w for s, w in spreads.items() if int(s.split(":")[1].split("/")[0]) >= 128)
        share = invested / total
        out[to_id(name)] = {"hp": 252 if share >= 0.5 else 0, "share": round(share, 2)}
    OUT.write_text(json.dumps({"source": f"{STATS}{month}/chaos/{args.format}.json", "mons": out},
                              separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
    print(f"{len(out)} Pokemon from {month} {args.format} -> {OUT}")


if __name__ == "__main__":
    main()
