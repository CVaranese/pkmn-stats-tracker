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


class LeagueFormats(unittest.TestCase):
    """Every league in site/leagues.json names its Showdown format, and its saved replays are that format (a
    best-of-three replay's id adds bo3): the page is tailored by it (which bets show, ...)."""
    def test_each_league_has_its_format(self):
        root = Path(__file__).resolve().parent.parent
        leagues = json.loads((root / "site" / "leagues.json").read_text(encoding="utf-8"))["leagues"]
        for lg in leagues:
            fmt = lg.get("format", "")
            self.assertRegex(fmt, r"^gen\d+[a-z0-9]+$", f"{lg['id']}: format id missing or not a Showdown id")
            wrong = []
            for f in sorted((root / "site" / lg["id"] / "games").glob("*.json")):
                if f.name in ("index.json", "draft.json", "records.json"):
                    continue
                got = json.loads(f.read_text(encoding="utf-8")).get("formatid")
                if got and got not in (fmt, fmt + "bo3"):
                    wrong.append(f"{f.name}: {got}")
            self.assertEqual(wrong, [], f"{lg['id']}: replays of another format than {fmt}")


class DiscordSettings(unittest.TestCase):
    """site/leagues.json: Pick'em needs the league's Discord sign-in (discord: server name, numeric server id), and a
    league with one needs the site's store (supabase); the page gets them as LEAGUE.discord (app/account.js)."""
    def test_discord_settings(self):
        bp = load("tools/build_pages.py")
        cfg = bp.load_leagues()
        pages = bp.pages()
        for lg in cfg["leagues"]:
            d = lg.get("discord")
            if lg.get("pickem"):
                self.assertTrue(d, f"{lg['id']}: pickem without discord")
            info = json.loads(re.search(r"window\.LEAGUE = (.*);</script>", pages[os.path.join(bp.SITE, lg["id"], "index.html")]).group(1))
            if not d:
                self.assertIsNone(info["discord"], f"{lg['id']}: no Discord, no sign-in")
                continue
            self.assertTrue(d.get("server"), f"{lg['id']}: discord.server (its name) missing")
            self.assertRegex(d.get("guild", ""), r"^\d{17,20}$", f"{lg['id']}: discord.guild is a Discord server id")
            self.assertRegex(cfg["supabase"]["url"], r"^https://[a-z0-9]+\.supabase\.co$")
            self.assertTrue(cfg["supabase"]["key"].startswith("sb_publishable_"), "only the publishable key goes in the page")
            self.assertEqual(info["discord"]["guild"], d["guild"])
            self.assertEqual(info["discord"]["supabase"], cfg["supabase"])
        self.assertTrue(any(lg.get("discord") for lg in cfg["leagues"]), "Pinecord keeps its sign-in")
        self.assertFalse(any((lg.get("pickem") or {}).keys() & {"supabase_url", "supabase_key", "server"} for lg in cfg["leagues"]),
                         "the store and server moved out of pickem")


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


class ChallongeBracket(unittest.TestCase):
    """tools/challonge_bracket.py on a 6-player single elimination: two first-round matches, the top two seeds wait."""
    @staticmethod
    def tournament(winner_a=None):
        ps = [{"participant": {"id": 100 + s, "seed": s, "name": f" P{s} "}} for s in range(1, 7)]

        def m(mid, ident, rnd, order, p1=None, p2=None, pre1=None, pre2=None, winner=None):
            return {"match": {"id": mid, "identifier": ident, "round": rnd, "suggested_play_order": order,
                              "player1_id": p1, "player2_id": p2, "player1_prereq_match_id": pre1,
                              "player2_prereq_match_id": pre2, "player1_is_prereq_match_loser": False,
                              "player2_is_prereq_match_loser": False,
                              "state": "complete" if winner else "open", "winner_id": winner}}
        return {"participants": ps, "matches": [
            m(5, "E", 3, 5, pre1=3, pre2=4), m(1, "A", 1, 1, 104, 105, winner=winner_a), m(2, "B", 1, 2, 103, 106),
            m(3, "C", 2, 3, p1=101, pre2=1), m(4, "D", 2, 4, p1=102, pre2=2)]}

    def test_bracket(self):
        cb = load("tools/challonge_bracket.py")
        b = cb.bracket(self.tournament(winner_a=105), "slug", "ppppp-2026-playoffs")
        self.assertEqual(cb.settings("ppppp")[1], "ppppp-2026-playoffs", "contest id from site/leagues.json")
        self.assertTrue(cb.settings("ppppp")[2].replace("\\", "/").endswith("site/ppppp/games/playoffs.json"))
        self.assertEqual([r["name"] for r in b["rounds"]], ["Quarterfinals", "Semifinals", "Final"])
        self.assertEqual([r["points"] for r in b["rounds"]], [1, 2, 4])
        self.assertEqual(b["players"][0], {"seed": 1, "name": "P1"})
        self.assertEqual([m["id"] for m in b["matches"]], ["A", "B", "C", "D", "E"])
        a, _, c, _, e = b["matches"]
        self.assertEqual((a["p1"], a["p2"], a["winner"]), ({"seed": 4}, {"seed": 5}, 5))
        self.assertEqual((c["p1"], c["p2"], c["winner"]), ({"seed": 1}, {"from": "A"}, None))
        self.assertEqual((e["p1"], e["p2"]), ({"from": "C"}, {"from": "D"}))
        self.assertIn("('ppppp-2026-playoffs', 'A', 1, 1, 5, 4, null, 5, null)", cb.sql(b))
        self.assertIn("('ppppp-2026-playoffs', 'C', 2, 2, null, 1, null, null, 'A')", cb.sql(b))
        self.assertIn("('ppppp-2026-playoffs', 'E', 3, 4, null, null, 'C', null, 'D')", cb.sql(b))

    def test_saved_bracket_is_complete(self):
        """site/ppppp/games/playoffs.json: every match has two sides, each from a seed or an earlier match."""
        b = json.loads((Path(__file__).resolve().parent.parent / "site/ppppp/games/playoffs.json").read_text("utf-8"))
        ids, seeds = [m["id"] for m in b["matches"]], {p["seed"] for p in b["players"]}
        for i, m in enumerate(b["matches"]):
            for side in (m["p1"], m["p2"]):
                self.assertTrue(side.get("seed") in seeds or side.get("from") in ids[:i], (m["id"], side))
        self.assertEqual(len(b["matches"]), len(b["players"]) - 1, "single elimination: one match fewer than players")


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


class PreviewOnly(unittest.TestCase):
    """Features not released stay behind PREVIEW (app/core.js). Drop a line here when its feature goes live."""
    def test_held_back_features_are_behind_the_gate(self):
        app = Path(__file__).resolve().parent.parent / "site/app"
        for name, wanted in {
            "core.js": '...(PREVIEW ? ["awards"] : [])',     # Awards: no ?tab=awards or saved tab without it
            "awards.js": "if (PREVIEW) document.querySelector",  # Awards: the tab's button
            "league.html": '<button data-mode="awards" type="button" hidden>',
            "draft.js": "const CARDS_ON = PREVIEW &&",       # report cards
            "main.js": "if (PREVIEW && loaded.length === 1)",  # reads and misplays
            "bets.js": "const BETS_ON = PREVIEW &&",         # weekly bets
        }.items():
            self.assertIn(wanted, (app / name).read_text("utf-8"), name)


if __name__ == "__main__":
    unittest.main()
