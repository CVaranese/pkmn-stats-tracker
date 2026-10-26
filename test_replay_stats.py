"""Synthetic logs for the passive / edge-case kill rules. Run: python test_replay_stats.py"""
from replay_stats import parse_battle

HEAD = """|player|p1|Alice|
|player|p2|Bob|
|switch|p1a: Burner|Sableye, L50|100/100
|switch|p1b: Rocker|Hippowdon, L50|100/100
|switch|p2a: Victim|Garchomp, L50|100/100
|switch|p2b: Other|Amoonguss, L50|100/100
|turn|1
"""

CASES = {
    # (log body, expected list of (killer, kind, victim))
    "burn credited to Will-O-Wisp user": ("""
|move|p1a: Burner|Will-O-Wisp|p2a: Victim
|-status|p2a: Victim|brn
|upkeep
|turn|2
|-damage|p2a: Victim|0 fnt|[from] brn
|faint|p2a: Victim
""", [("p1: Burner", "passive", "p2: Victim")]),
    "stealth rock credited to setter": ("""
|move|p1b: Rocker|Stealth Rock|p2a: Victim
|-sidestart|p2: Bob|move: Stealth Rock
|turn|2
|switch|p2a: Third|Charizard, L50|10/100
|-damage|p2a: Third|0 fnt|[from] Stealth Rock
|faint|p2a: Third
""", [("p1: Rocker", "passive", "p2: Third")]),
    "sandstorm credited to Sand Stream user": ("""
|-weather|Sandstorm|[from] ability: Sand Stream|[of] p1b: Rocker
|upkeep
|-damage|p2b: Other|0 fnt|[from] Sandstorm
|faint|p2b: Other
""", [("p1: Rocker", "passive", "p2: Other")]),
    "life orb recoil -> last opposing attacker": ("""
|move|p1a: Burner|Foul Play|p2a: Victim
|-damage|p2a: Victim|5/100
|turn|2
|move|p2a: Victim|Earthquake|p1b: Rocker
|-damage|p1b: Rocker|50/100
|-damage|p2a: Victim|0 fnt|[from] item: Life Orb
|faint|p2a: Victim
""", [("p1: Burner", "passive", "p2: Victim")]),
    "ally spread move -> last opposing attacker": ("""
|move|p1b: Rocker|Earthquake|p2a: Victim|[spread] p2a,p2b
|-damage|p2b: Other|40/100
|turn|2
|move|p2a: Victim|Earthquake|p1a: Burner|[spread] p1a,p1b,p2b
|-damage|p2b: Other|0 fnt
|faint|p2b: Other
""", [("p1: Rocker", "passive", "p2: Other")]),
    "rocky helmet": ("""
|move|p2a: Victim|Dragon Claw|p1b: Rocker
|-damage|p1b: Rocker|60/100
|-damage|p2a: Victim|0 fnt|[from] item: Rocky Helmet|[of] p1b: Rocker
|faint|p2a: Victim
""", [("p1: Rocker", "passive", "p2: Victim")]),
    "destiny bond is a direct kill": ("""
|move|p1a: Burner|Destiny Bond|p1a: Burner
|-singlemove|p1a: Burner|Destiny Bond
|move|p2a: Victim|Dragon Claw|p1a: Burner
|-damage|p1a: Burner|0 fnt
|faint|p1a: Burner
|-activate|p1a: Burner|move: Destiny Bond
|faint|p2a: Victim
""", [("p2: Victim", "direct", "p1: Burner"), ("p1: Burner", "direct", "p2: Victim")]),
    "explosion: deaths, no kill for the user": ("""
|move|p2b: Other|Explosion|p1a: Burner|[spread] p1a,p1b
|-damage|p1a: Burner|0 fnt
|-damage|p1b: Rocker|40/100
|faint|p1a: Burner
|faint|p2b: Other
""", [("p2: Other", "direct", "p1: Burner"), (None, "none", "p2: Other")]),
    "leech seed": ("""
|move|p2b: Other|Leech Seed|p1b: Rocker
|-start|p1b: Rocker|move: Leech Seed
|upkeep
|-damage|p1b: Rocker|0 fnt|[from] Leech Seed|[of] p2b: Other
|faint|p1b: Rocker
""", [("p2: Other", "passive", "p1: Rocker")]),
    "toxic spikes poison on switch-in": ("""
|move|p1a: Burner|Toxic Spikes|p2a: Victim
|-sidestart|p2: Bob|move: Toxic Spikes
|turn|2
|switch|p2a: Third|Charizard, L50|5/100
|-status|p2a: Third|psn
|upkeep
|-damage|p2a: Third|0 fnt|[from] psn
|faint|p2a: Third
""", [("p1: Burner", "passive", "p2: Third")]),
}

failed = 0
for name, (body, expected) in CASES.items():
    got = parse_battle(HEAD + body.strip("\n"))["kills"]
    ok = got == expected
    failed += not ok
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"\n   expected {expected}\n   got      {got}"))
print(f"\n{len(CASES) - failed}/{len(CASES)} passed")
