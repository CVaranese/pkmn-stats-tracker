"""Tests for the pure parts of tools/add_game.py. Run: python -I tests/test_tools.py"""
import importlib.util
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


if __name__ == "__main__":
    unittest.main()
