"""Write site/scl/games/draft.json from the Super Champions League's Google Sheet (its Rosters tab).

The sheet is public: this downloads it as .xlsx (about 20 MB, it holds images) and reads it with the standard
library. Rosters lays coaches out side by side, five columns each (coach name, then Pokémon in the next column and
its price two further right), in blocks of rows; the team name sits two rows above the coach. Prices are per
Pokémon (no tiers), so each pick is {"pokemon", "cost"}. Re-run when the sheet changes; aliases (a coach's Showdown
names) and trades already in draft.json are kept.

    python -I tools/scl_draft.py                 # download the sheet
    python -I tools/scl_draft.py --file my.xlsx  # a copy downloaded by hand
"""
import argparse
import io
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "site", "scl", "games", "draft.json")
SHEET = "https://docs.google.com/spreadsheets/d/1CEIN3FnnvwqTNz5BjlU4-Lz8bG8aBd4X8sxeDKrK3_8/export?format=xlsx"
M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
# the sheet's spellings -> Showdown's (checked against site/data/pokedex.json; any other unknown name is printed)
FIXES = {"Starapter-Mega": "Staraptor-Mega", "Lycanroc-Night": "Lycanroc-Midnight"}


def col_number(letters):
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n


def read_sheet(xlsx, name):
    """{(row, column number): text} for one tab; empty cells and the sheet's 'None' text left out."""
    z = zipfile.ZipFile(xlsx)
    strings = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(M + "si"):
            strings.append("".join(t.text or "" for t in si.iter(M + "t")))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    sheet = next((s for s in ET.fromstring(z.read("xl/workbook.xml")).find(M + "sheets") if s.get("name") == name), None)
    if sheet is None:
        sys.exit(f"No {name!r} tab in the sheet")
    target = rels[sheet.get(R + "id")].lstrip("/")
    cells = {}
    for c in ET.fromstring(z.read(target if target.startswith("xl/") else "xl/" + target)).iter(M + "c"):
        kind, v = c.get("t"), c.find(M + "v")
        if kind == "inlineStr":
            text = "".join(t.text or "" for t in c.iter(M + "t"))
        elif v is None:
            continue
        else:
            text = strings[int(v.text)] if kind == "s" else v.text
        text = (text or "").strip()
        if text and text != "None":
            m = re.match(r"([A-Z]+)(\d+)", c.get("r"))
            cells[(int(m.group(2)), col_number(m.group(1)))] = text
    return cells


def number(text):
    try:
        return int(float(text))
    except (TypeError, ValueError):
        return None


def rosters(cells):
    """[(coach, team name, [{pokemon, cost}])] in sheet order."""
    out = []
    for (row, col), coach in sorted(cells.items()):
        # a coach: a name with a Pokémon and its price on the next row, one and three columns to the right
        if (col - 2) % 5 or number(coach) is not None:
            continue
        if not cells.get((row + 1, col + 1)) or number(cells.get((row + 1, col + 3))) is None:
            continue
        picks, r = [], row + 1
        while cells.get((r, col + 1)) and number(cells.get((r, col + 3))) is not None:
            name = cells[(r, col + 1)]
            picks.append({"pokemon": FIXES.get(name, name), "cost": number(cells[(r, col + 3)])})
            r += 1
        out.append((coach, cells.get((row - 2, col), ""), picks))
    return out


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--file", help="the sheet as .xlsx, instead of downloading it")
    args = ap.parse_args(argv)
    if args.file:
        xlsx = args.file
    else:
        req = urllib.request.Request(SHEET, headers={"User-Agent": "showdown-replay-stats"})
        with urllib.request.urlopen(req, timeout=120) as r:
            xlsx = io.BytesIO(r.read())
    found = rosters(read_sheet(xlsx, "Rosters"))
    if not found:
        sys.exit("No rosters found: has the Rosters tab's layout changed?")
    old = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            old = json.load(f)
    draft = {
        "note": "From the league's Google Sheet, Rosters tab (tools/scl_draft.py). Prices are per Pokémon, "
                "budget 100 for 9 to 11 Pokémon. aliases: other Showdown names a coach used -> their name here.",
        "aliases": old.get("aliases", {}),
        "costs": {},
        "teams": {coach: team for coach, team, _ in found if team},
        "players": {coach: picks for coach, _, picks in found},
        "trades": old.get("trades", {}),
    }
    tmp = OUT + ".tmp"  # written in one step: a crash midway leaves the old draft
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(draft, f, ensure_ascii=False, indent=1)
        f.write("\n")
    os.replace(tmp, OUT)
    with open(os.path.join(ROOT, "site", "data", "pokedex.json"), encoding="utf-8") as f:
        known = {re.sub(r"[^a-z0-9]", "", v.get("name", k).lower()) for k, v in json.load(f).items()}
    for coach, team, picks in found:
        for p in picks:
            if re.sub(r"[^a-z0-9]", "", p["pokemon"].lower()) not in known:
                print(f"  not a Showdown name: {p['pokemon']} ({coach}); add it to FIXES")
        print(f"{coach}{' (' + team + ')' if team else ''}: {len(picks)} Pokémon, {sum(p['cost'] for p in picks)} points")


if __name__ == "__main__":
    main(sys.argv[1:])
