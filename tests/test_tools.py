"""Tests for the pure parts of tools/add_game.py and tools/set_illusion.py, that tools/build_pages.py's pages are up to
date (and the banner egg), .github/workflows/mark_preview.py, and that releases are recorded (CHANGELOG, releases.json, tags). Run: python -I tests/test_tools.py"""
import contextlib
import importlib.util
import io
import json
import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

# loaded from its path: python -I keeps tools/ off the import path
_spec = importlib.util.spec_from_file_location("add_game", Path(__file__).resolve().parent.parent / "tools" / "add_game.py")
add_game = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(add_game)


class ReplayId(unittest.TestCase):
    def test_links_and_ids(self):
        rid = "gen9nationaldex-2705438906"
        for text in (rid, "https://replay.pokemonshowdown.com/" + rid, "https://replay.pokemonshowdown.com/" + rid + "/",
                     "https://replay.pokemonshowdown.com/" + rid + ".json", "https://replay.pokemonshowdown.com/" + rid + "?p2",
                     "  " + rid + "  "):
            self.assertEqual(add_game.replay_id(text), rid, text)

    def test_private_replay_keeps_its_password(self):
        self.assertEqual(add_game.replay_id("https://replay.pokemonshowdown.com/gen9ou-123-abc1pw"), "gen9ou-123-abc1pw")

    def test_stream_video_is_a_lowercase_video_id(self):
        self.assertEqual(add_game.replay_id("https://youtu.be/CKLxgWZL3HM"), "video-cklxgwzl3hm")
        self.assertEqual(add_game.replay_id("https://www.youtube.com/watch?v=CKLxgWZL3HM&t=5"), "video-cklxgwzl3hm")

    def test_not_a_replay_exits(self):
        with self.assertRaises(SystemExit):
            add_game.replay_id("https://example.com/hello")
        with self.assertRaises(SystemExit):
            add_game.replay_id("../../etc/passwd")


class Summary(unittest.TestCase):
    LOG = "\n".join([
        "|player|p1|Ann|", "|player|p2|Bob|", "|poke|p1|Garchomp, L50, M|", "|poke|p1|Zamazenta-*|",
        "|poke|p2|Toxapex, F|", "|start", "|turn|1", "|turn|2", "|turn|12", "|win|Bob",
    ])

    def test_summary(self):
        s = add_game.summary({"log": self.LOG, "players": ["Ann", "Bob"], "uploadtime": 1791374400})
        self.assertEqual(s, {"players": ["Ann", "Bob"], "teams": [["Garchomp", "Zamazenta"], ["Toxapex"]],
                             "winner": "Bob", "date": "2026-10-04", "turns": 12})

    def test_pacific_date(self):
        # Sunday 2026-10-25 9pm PDT is Monday 04:00 UTC; Sunday 2026-11-08 9pm PST is Monday 05:00 UTC
        self.assertEqual(add_game.pacific_date(1792987200), "2026-10-25")
        self.assertEqual(add_game.pacific_date(1794200400), "2026-11-08")
        # DST ends 2026-11-01 at 09:00 UTC: an hour before is still PDT (1:00), at it PST (1:00 again)
        self.assertEqual(add_game.pacific_date(1793523600 - 3600), "2026-11-01")
        self.assertEqual(add_game.pacific_date(1793523600), "2026-11-01")
        # DST starts 2026-03-08 at 10:00 UTC; 06:00 UTC that day is still Saturday night PST
        self.assertEqual(add_game.pacific_date(1772949600), "2026-03-07")

    def test_week_sunday(self):
        self.assertEqual([add_game.week_sunday(d) for d in ("2026-10-25", "2026-10-26", "2026-10-31")], ["2026-10-25"] * 3)

    def test_unfinished_game(self):
        s = add_game.summary({"log": "|player|p1|Ann|\n|turn|1", "players": ["Ann", "Bob"], "uploadtime": 0})
        self.assertEqual((s["winner"], s["turns"]), ("", 1))



class Pages(unittest.TestCase):
    def test_league_pages_up_to_date(self):
        """site/index.html and site/<league>/index.html match their templates (tools/build_pages.py)."""
        spec = importlib.util.spec_from_file_location("build_pages", Path(__file__).resolve().parent.parent / "tools" / "build_pages.py")
        build_pages = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(build_pages)
        self.assertEqual(build_pages.main(["--check"]), 0, "run python -I tools/build_pages.py")


def load(path):
    """A tool loaded from its path (python -I keeps tools/ off the import path)."""
    spec = importlib.util.spec_from_file_location(Path(path).stem, Path(__file__).resolve().parent.parent / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class BannerEgg(unittest.TestCase):
    """tools/build_pages.py: the hidden link to the preview sits only on a league whose banner has an egg."""
    def test_egg_links_to_that_leagues_preview(self):
        bp = load("tools/build_pages.py")
        cfg = bp.load_leagues()
        pages = bp.pages()
        for lg in cfg["leagues"]:
            page = pages[os.path.join(bp.SITE, lg["id"], "index.html")]
            eggs = re.findall(r'<a class="egg" href="([^"]+)" style="([^"]+)"', page)
            g = (lg.get("banner") or {}).get("egg")
            if not g:
                self.assertEqual(eggs, [], f"{lg['id']} has no egg")
                continue
            self.assertEqual(eggs, [(cfg["site_url"] + "next/" + lg["id"] + "/",
                                     f'left:{g["left"]}%;top:{g["top"]}%;width:{g["width"]}%;height:{g["height"]}%')])
        self.assertTrue(any((lg.get("banner") or {}).get("egg") for lg in cfg["leagues"]), "one league keeps the way in")
        self.assertNotIn('class="egg"', pages[os.path.join(bp.SITE, "index.html")], "the league list has no egg")


class MarkPreview(unittest.TestCase):
    """.github/workflows/mark_preview.py: index.html pages get noindex, a "Preview · " title and the strip; nothing else."""
    def test_marks_index_pages_only(self):
        mp = load(".github/workflows/mark_preview.py")
        page = "<!doctype html>\n<html>\n<head>\n  <title>Pinecord</title>\n</head>\n<body class=\"x\">\n  <p>hi</p>\n</body>\n</html>\n"
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            for rel in ["index.html", "ppppp/index.html", "watch.html", "app/league.html"]:
                (root / rel).parent.mkdir(parents=True, exist_ok=True)
                (root / rel).write_text(page, encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()):
                mp.main(["mark_preview.py", d])
            for rel in ["index.html", "ppppp/index.html"]:
                t = (root / rel).read_text(encoding="utf-8")
                self.assertEqual(t.count('<meta name="robots" content="noindex">'), 1, rel)
                self.assertLess(t.index("noindex"), t.index("</head>"), rel)
                self.assertIn("<title>Preview · Pinecord</title>", t, rel)
                self.assertTrue(t.split('<body class="x">\n', 1)[1].startswith(mp.STRIP), rel + ": strip right after <body>")
                self.assertIn('href="/pkmn-stats-tracker/"', t, rel + ": back to the live site")
            for rel in ["watch.html", "app/league.html"]:
                self.assertEqual((root / rel).read_text(encoding="utf-8"), page, rel + " untouched")

    def test_real_league_page(self):
        """The written Pinecord page, marked: still one title, one body, the egg kept."""
        mp, bp = load(".github/workflows/mark_preview.py"), load("tools/build_pages.py")
        text = bp.pages()[os.path.join(bp.SITE, "ppppp", "index.html")]
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "index.html").write_text(text, encoding="utf-8")
            mp.mark(Path(d) / "index.html")
            t = (Path(d) / "index.html").read_text(encoding="utf-8")
        self.assertEqual(len(re.findall(r"<title>Preview · ", t)), 1)
        self.assertEqual(t.count(mp.STRIP), 1)
        self.assertIn('class="egg"', t)


class SetIllusion(unittest.TestCase):
    """tools/set_illusion.py's set_pick: the hidden-Zoroark picks it writes into a game's index.json entry."""
    def setUp(self):
        self.si = load("tools/set_illusion.py")

    def test_picks(self):
        g = {"id": "x"}
        self.assertEqual(self.si.set_pick(g, "p1", "8,1,8"), {"p1": [1, 8]})
        self.assertEqual(g["illusion"], {"p1": [1, 8]}, "sorted, once each")
        self.si.set_pick(g, "p2", "none")
        self.assertEqual(g["illusion"], {"p1": [1, 8], "p2": []}, "none: nothing was Zoroark, kept as []")
        self.si.set_pick(g, "p1", "auto")
        self.assertEqual(g["illusion"], {"p2": []})
        self.si.set_pick(g, "p2", "auto")
        self.assertNotIn("illusion", g, "no picks left: the field goes")

    def test_bad_picks_leave_the_game(self):
        for pick in ["0", "1,x", "", "-2"]:
            g = {"id": "x", "illusion": {"p1": [3]}}
            with self.assertRaises(SystemExit, msg=pick):
                self.si.set_pick(g, "p1", pick)
            self.assertEqual(g["illusion"], {"p1": [3]}, pick)


class Releases(unittest.TestCase):
    """The release steps in CLAUDE.md: each version is a CHANGELOG.md heading, a site/releases.json entry and a git tag."""
    ROOT = Path(__file__).resolve().parent.parent

    def versions(self):
        log = (self.ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        heads = re.findall(r"^## (.+)$", log, re.M)
        rel = json.loads((self.ROOT / "site" / "releases.json").read_text(encoding="utf-8"))["releases"]
        return heads, [r["version"] for r in rel]

    def test_changelog_matches_releases(self):
        """CHANGELOG.md: Unreleased first, then one '## X.Y (date)' per release, newest first, the same as releases.json."""
        heads, rel = self.versions()
        self.assertEqual(heads[0], "Unreleased", "CHANGELOG.md starts with ## Unreleased")
        cut = [re.match(r"(\d+\.\d+(?:\.\d+)?) \(\d{4}-\d\d-\d\d\)$", h) for h in heads[1:]]
        self.assertTrue(all(cut), f"version headings look like '## 1.0 (2026-10-29)': {heads[1:]}")
        self.assertEqual([m.group(1) for m in cut], rel, "each release in site/releases.json has its CHANGELOG.md section")

    def test_releases_tagged(self):
        """Each release has its tag (v1.0); the newest one may not be tagged yet while it's being cut."""
        try:
            tags = subprocess.run(["git", "tag", "-l", "v*"], cwd=self.ROOT, capture_output=True, text=True, check=True).stdout.split()
        except (OSError, subprocess.CalledProcessError):
            self.skipTest("no git here")
        _, rel = self.versions()
        missing = [v for v in rel if "v" + v not in tags]
        self.assertEqual([v for v in rel[1:] if v in missing], [], "tag the old releases")
        if missing:
            self.skipTest(f"v{rel[0]} isn't tagged yet: git tag -a v{rel[0]} -m \"{rel[0]}\" on the release commit, then push it")


if __name__ == "__main__":
    unittest.main()
