"""The play-money bets' admin tool (Gambling tab, app/bets.js): the slate before the lock, the results after each round.
parser.js and bet.js do the counting, in headless Edge (tools/bets_page.html); no Node on this machine.

    python -I tools/bets.py fetch-sample [--pages 8]   recent Nat Dex replays into tests/corpus/ (gitignored)
    python -I tools/bets.py simulate                   how every bet would land over simulated playoffs
    python -I tools/bets.py slate                      draw the six, write the league's slate file, print its SQL
    python -I tools/bets.py settle                     where the bets stand from the saved games, print the SQL

Options: --league ppppp. Run the printed SQL through the Supabase MCP server (execute_sql). `settle` after each round:
python -I tools/challonge_bracket.py --sql first, so the bracket file knows who has won.
"""
import html
import http.server
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from functools import partial

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS = os.path.join(ROOT, "tests", "corpus")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
SHOWDOWN = "https://replay.pokemonshowdown.com/"
FORMAT = "gen9nationaldex"
SLATE_SIZE = 6


def league_settings(league_id):
    """A league's bets settings from site/leagues.json: {contest, slate}, slate the file under the league's folder."""
    with open(os.path.join(ROOT, "site", "leagues.json"), encoding="utf-8") as f:
        lg = next((x for x in json.load(f)["leagues"] if x["id"] == league_id), None)
    if not lg or not lg.get("bets"):
        sys.exit(f"{league_id}: no bets in site/leagues.json")
    return lg["bets"]


def text(v):
    """A SQL literal: text in quotes (a quote doubled), None as null."""
    return "null" if v is None else "'" + str(v).replace("'", "''") + "'"


def slate_sql(slate):
    """Upsert of the six bets into bet_props, leaving any outcome alone; bets no longer on the slate go."""
    c = slate["contest"]
    rows = ",\n  ".join(f"({text(c)}, {text(b['id'])}, {i}, {text(b['kind'])}, {'null' if b['line'] is None else b['line']})"
                        for i, b in enumerate(slate["bets"]))
    ids = ", ".join(text(b["id"]) for b in slate["bets"])
    return (f"delete from public.bet_props where contest_id = {text(c)} and bet_id not in ({ids});\n"
            "insert into public.bet_props (contest_id, bet_id, position, kind, line) values\n  " + rows +
            "\non conflict (contest_id, bet_id) do update set position = excluded.position, kind = excluded.kind, line = excluded.line;")


def settle_sql(result):
    """The bets' outcomes and details (null outcome: not settled yet, the detail is the count so far)."""
    return "\n".join(f"update public.bet_props set outcome = {text(b['outcome'])}, detail = {text(b['detail'] or None)} "
                     f"where contest_id = {text(result['contest'])} and bet_id = {text(b['id'])};" for b in result["bets"])


def dom_result(dom):
    """The JSON tools/bets_page.html left in #out."""
    m = re.search(r'<pre id="out">(.*?)</pre>', dom, re.S)
    if not m:
        raise ValueError("no result in the page")
    return json.loads(html.unescape(m.group(1)))


class Handler(http.server.SimpleHTTPRequestHandler):
    """The repo, plus /__sample: the replay files in tests/corpus/ (for the page, which can't list a folder)."""

    def do_GET(self):
        if self.path == "/__sample":
            names = sorted(n for n in os.listdir(CORPUS) if n.startswith(FORMAT) and n.endswith(".json")) if os.path.isdir(CORPUS) else []
            body = json.dumps(names).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, *args):
        pass


def run_page(mode, league):
    """tools/bets_page.html in headless Edge, against a server of its own; its result."""
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=ROOT))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_address[1]}/tools/bets_page.html?mode={mode}&league={league}"
    try:
        with tempfile.TemporaryDirectory(prefix="edge-bets-", ignore_cleanup_errors=True) as profile:
            # through the shell, into a file: Edge writes nothing to a pipe a process opened for it
            out = os.path.join(profile, "dom.html")
            subprocess.run(f'"{EDGE}" --headless=new --disable-gpu --user-data-dir="{profile}" '
                           f'--virtual-time-budget=600000 --dump-dom "{url}" > "{out}" 2>nul', shell=True, timeout=570)
            with open(out, encoding="utf-8", errors="replace") as f:
                dom = f.read()
    finally:
        server.shutdown()
    result = dom_result(dom)
    if "crash" in result:
        sys.exit("The page crashed: " + result["crash"])
    return result


def fetch_sample(pages):
    """Recent public replays of the format, each saved once. The search API gives a page at a time, newest first."""
    os.makedirs(CORPUS, exist_ok=True)
    get = lambda url: json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "replay-stats"}), timeout=30))
    before, saved = None, 0
    for _ in range(pages):
        found = get(f"{SHOWDOWN}search.json?format={FORMAT}" + (f"&before={before}" if before else ""))
        for r in found:
            path = os.path.join(CORPUS, r["id"] + ".json")
            if os.path.exists(path):
                continue
            body = get(f"{SHOWDOWN}{r['id']}.json")
            tmp = path + ".tmp"
            with open(tmp, "w", encoding="utf-8", newline="\n") as f:
                json.dump(body, f)
            os.replace(tmp, path)
            saved += 1
            time.sleep(0.1)
        if not found:
            break
        before = found[-1]["uploadtime"]
    print(f"{saved} new replays in {CORPUS}")


def table(result):
    print(f"{result['league_games']} league games, {result['ladder_games']} ladder games")
    print(f"{'bet':10} {'kind':4} {'line':>8} {'blend':>6} {'league':>6}")
    for b in sorted(result["bets"], key=lambda b: (b["kind"], b["id"])):
        print(f"{b['id']:10} {b['kind']:4} {'' if b['line'] is None else b['line']:>8} {b['rate']:>6.3f} {b['league_rate']:>6.3f}"
              f"{'' if b['near_even'] else '  lopsided'}")


def write_json(path, data):
    tmp = path + ".tmp"  # written in one step: a crash midway leaves the old file
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, path)


def main():
    args = sys.argv[1:]
    option = lambda name, default: args[args.index(name) + 1] if name in args else default
    league = option("--league", "ppppp")
    mode = args[0] if args else ""
    if mode == "fetch-sample":
        fetch_sample(int(option("--pages", "8")))
    elif mode == "simulate":
        table(run_page("simulate", league))
    elif mode == "slate":
        cfg = league_settings(league)
        result = run_page("simulate", league)
        table(result)
        bets = result["slate"]
        if len(bets) < SLATE_SIZE:
            sys.exit(f"Only {len(bets)} bets are close enough to 50/50; the slate needs {SLATE_SIZE}.")
        slate = {"contest": cfg["contest"], "league_games": result["league_games"], "ladder_games": result["ladder_games"], "bets": bets}
        path = os.path.join(ROOT, "site", league, *cfg["slate"].split("/"))
        write_json(path, slate)
        print(f"{len(bets)} bets -> {path}")
        print(slate_sql(slate))
    elif mode == "settle":
        result = run_page("settle", league)
        print(f"{result['games']} games saved, {result['missing']} with no replay, "
              f"{result['sets_decided']} of {result['sets_needed']} sets in, bracket "
              f"{'done' if result['bracket_done'] else 'still going'}: {'final' if result['ended'] else 'not over yet'}.")
        print(settle_sql(result))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    sys.exit(main())
