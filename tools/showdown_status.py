"""Quick check of the Pokemon Showdown services the site uses, before waiting on their timeouts.

    python -I tools/showdown_status.py

Asks each one in parallel with a short time limit and prints UP / DOWN per service.
Exit code 0 when everything answered, 1 otherwise.
"""
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

TIMEOUT = 6
PLAY = "https://play.pokemonshowdown.com/"
CHECKS = [
    ("Replays (stats, add_game.py)", "https://replay.pokemonshowdown.com/gen9nationaldex-2705157049.json"),
    ("Move data (luck)", PLAY + "data/moves.json"),
    ("Pokedex data (max HP)", PLAY + "data/pokedex.json"),
    ("Sprites", PLAY + "sprites/gen5/pikachu.png"),
    ("Replay player: battle.js", PLAY + "js/battle.js?a7"),
    ("Replay player: battledata.js", PLAY + "js/battledata.js?a7"),
    ("Replay player: moves.js", PLAY + "data/moves.js?a7"),
]


def check(url):
    start = time.monotonic()
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "showdown-replay-stats"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            status = resp.status
    except urllib.error.HTTPError as e:
        status = e.code
    except Exception as e:  # timeout, refused, DNS
        return False, f"no answer ({type(e).__name__})", time.monotonic() - start
    took = time.monotonic() - start
    # 5xx (Cloudflare's 52x) means the site behind it is down
    return status < 500, f"HTTP {status}", took


def main():
    with ThreadPoolExecutor(len(CHECKS)) as pool:
        results = list(pool.map(lambda c: check(c[1]), CHECKS))
    for (name, _), (up, why, took) in zip(CHECKS, results):
        print(f"{'UP  ' if up else 'DOWN'}  {name:30} {why}, {took:.1f} s")
    down = [name for (name, _), (up, _, _) in zip(CHECKS, results) if not up]
    print("All up." if not down else f"{len(down)} of {len(CHECKS)} down.")
    sys.exit(1 if down else 0)


if __name__ == "__main__":
    main()
