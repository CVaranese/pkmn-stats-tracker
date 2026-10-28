"""Save Showdown's animated sprite (sprites/ani/<id>.gif) for every Pokemon that has a saved gen5 copy in
site/sprites/gen5/, into site/sprites/ani/. The One game MVP card uses them in local mode and when Showdown's
sprite server is down. Skips ones already saved; prints the ones Showdown has no animated sprite for.

    python -I tools/save_ani_sprites.py
"""
import pathlib
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
GEN5 = ROOT / "site" / "sprites" / "gen5"
ANI = ROOT / "site" / "sprites" / "ani"
URL = "https://play.pokemonshowdown.com/sprites/ani/{}.gif"


def main():
    ANI.mkdir(exist_ok=True)
    saved, missing = 0, []
    for png in sorted(GEN5.glob("*.png")):
        out = ANI / (png.stem + ".gif")
        if out.exists():
            continue
        req = urllib.request.Request(URL.format(png.stem), headers={"User-Agent": "showdown-replay-stats"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = r.read()
        except urllib.error.HTTPError as e:
            missing.append(f"{png.stem} (HTTP {e.code})")
            continue
        if not data.startswith(b"GIF"):
            missing.append(f"{png.stem} (not a GIF)")
            continue
        out.write_bytes(data)
        saved += 1
    print(f"saved {saved}, already had {len(list(ANI.glob('*.gif'))) - saved}, no animated sprite: {len(missing)}")
    for m in missing:
        print("  " + m)


if __name__ == "__main__":
    sys.exit(main())
