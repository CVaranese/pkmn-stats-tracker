"""Write a league's Pick'em bracket file (site/<league>/<pickem.bracket>, e.g. site/ppppp/games/playoffs.json): the
playoff bracket from Challonge (players by seed, each match's round and where its two players come from, winners once
played). The league's pickem settings and its newest Challonge bracket (brackets[0]) come from site/leagues.json.

Needs the Challonge API v1 key in ~/.challonge_key. With --sql it also prints the SQL that copies the bracket's
matches and winners into the Pick'em store (Supabase table pickem_matches), which scores the picks and gives the page
its winners; run that in the Supabase SQL editor or through the Supabase MCP server after each round.

    python -I tools/challonge_bracket.py [--league ppppp] [--sql]
"""
import json
import os
import sys
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POINTS = {1: 1, 2: 2, 3: 4, 4: 8}  # a right pick per round (user 2026-11-02)


def settings(league_id):
    """(Challonge slug, contest id, output path) for a league with pickem in site/leagues.json."""
    with open(os.path.join(ROOT, "site", "leagues.json"), encoding="utf-8") as f:
        lg = next((x for x in json.load(f)["leagues"] if x["id"] == league_id), None)
    if not lg or not lg.get("pickem") or not lg.get("brackets"):
        sys.exit(f"{league_id}: no pickem / brackets in site/leagues.json")
    pk = lg["pickem"]
    return lg["brackets"][0]["slug"], pk["contest"], os.path.join(ROOT, "site", league_id, *pk["bracket"].split("/"))


def round_names(last):
    """Names by round number, counted back from the final."""
    names = {last: "Final", last - 1: "Semifinals", last - 2: "Quarterfinals"}
    return {r: names.get(r, f"Round {r}") for r in range(1, last + 1)}


def bracket(t, slug, contest):
    """The file's contents from the API's tournament (pure, tested)."""
    seed = {p["participant"]["id"]: p["participant"]["seed"] for p in t["participants"]}
    players = sorted(({"seed": p["participant"]["seed"], "name": p["participant"]["name"].strip()}
                      for p in t["participants"]), key=lambda p: p["seed"])
    ms = [m["match"] for m in t["matches"]]
    ident = {m["id"]: m["identifier"] for m in ms}
    last = max(m["round"] for m in ms)
    names = round_names(last)

    def side(m, n):
        if m[f"player{n}_prereq_match_id"]:
            if m[f"player{n}_is_prereq_match_loser"]:
                raise ValueError(f"match {m['identifier']}: a loser's slot (only single elimination is drawn)")
            return {"from": ident[m[f"player{n}_prereq_match_id"]]}
        return {"seed": seed[m[f"player{n}_id"]]} if m[f"player{n}_id"] else {}

    matches = []
    for m in sorted(ms, key=lambda m: (m["round"], m["suggested_play_order"] or 0)):
        if m["round"] < 1:
            raise ValueError(f"match {m['identifier']}: round {m['round']} (only single elimination is drawn)")
        done = m["state"] == "complete" and m["winner_id"] in seed
        matches.append({"id": m["identifier"], "round": m["round"], "p1": side(m, 1), "p2": side(m, 2),
                        "winner": seed[m["winner_id"]] if done else None})
    return {"source": f"https://challonge.com/{slug}", "contest": contest, "updated": date.today().isoformat(),
            "rounds": [{"round": r, "name": names[r], "points": POINTS.get(r, 0)} for r in range(1, last + 1)],
            "players": players, "matches": matches}


def sql(b):
    """Upsert of the matches (round, points, winner, where each side comes from) into pickem_matches: the store scores
    a pick only when that player reaches the match through the person's own earlier picks."""
    pts = {r["round"]: r["points"] for r in b["rounds"]}
    val = lambda v: "null" if v is None else (f"'{v}'" if isinstance(v, str) else str(v))
    rows = ",\n  ".join("(" + ", ".join(val(v) for v in (
        b["contest"], m["id"], m["round"], pts[m["round"]], m["winner"],
        m["p1"].get("seed"), m["p1"].get("from"), m["p2"].get("seed"), m["p2"].get("from"))) + ")" for m in b["matches"])
    cols = ("round", "points", "winner", "p1_seed", "p1_from", "p2_seed", "p2_from")
    return ("insert into public.pickem_matches (contest_id, match_id, " + ", ".join(cols) + ") values\n  " + rows +
            "\non conflict (contest_id, match_id) do update set " +
            ", ".join(f"{c} = excluded.{c}" for c in cols) + ";")


def main():
    league = sys.argv[sys.argv.index("--league") + 1] if "--league" in sys.argv else "ppppp"
    slug, contest, out = settings(league)
    with open(os.path.expanduser("~/.challonge_key"), encoding="utf-8") as f:
        key = f.read().strip()
    url = (f"https://api.challonge.com/v1/tournaments/{slug}.json?api_key={key}"
           "&include_matches=1&include_participants=1")
    req = urllib.request.Request(url, headers={"User-Agent": "replay-stats"})
    with urllib.request.urlopen(req, timeout=30) as r:
        b = bracket(json.load(r)["tournament"], slug, contest)
    tmp = out + ".tmp"  # written in one step: a crash midway leaves the old file
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(b, f, indent=1, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, out)
    won = sum(m["winner"] is not None for m in b["matches"])
    print(f"{len(b['matches'])} matches ({won} played), {len(b['players'])} players -> {out}")
    if "--sql" in sys.argv:
        print(sql(b))


if __name__ == "__main__":
    sys.exit(main())
