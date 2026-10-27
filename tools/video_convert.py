"""Battle-log sentences (as the Showdown client prints them) -> protocol lines for site/parser.js.
Used by tools/video_to_replay.py. Showdown's English templates are turned into regexes; each matched message maps
to one protocol line. Spectator view: "Go! X" is the recording player's own side; "the opposing X" the other."""
import difflib, json, os, re

# client messages the 0.11.11 server package words differently or lacks (seen in recordings)
EXTRA = [("weather", "snowscape", "upkeep", "(The snow is blowing about!)")]
SLOT_RE = {"NUMBER": r"(\d+)", "PERCENTAGE": r"(\d+)%"}
STATS = {"attack": "atk", "defense": "def", "sp. atk": "spa", "sp. def": "spd", "speed": "spe",
         "accuracy": "accuracy", "evasiveness": "evasion"}
WEATHER_IDS = {"sandstorm": "Sandstorm", "sunnyday": "SunnyDay", "raindance": "RainDance", "hail": "Hail",
               "snowscape": "Snow", "snow": "Snow"}
STATUSES = {"brn", "par", "psn", "tox", "slp", "frz"}
SKIP_KEYS = {"name", "desc", "shortDesc", "statName", "statShortName", "weatherName"}
FRAGMENTS = {"pokemon", "opposingPokemon", "team", "opposingTeam", "party", "opposingParty"}  # parts of messages
# HP % for damage / healing the spectator log shows no number for (guesses from the game's fractions)
TRAP_MOVES = {"Bind", "Wrap", "Fire Spin", "Clamp", "Whirlpool", "Sand Tomb", "Magma Storm", "Infestation", "Snap Trap",
              "Thunder Cage"}
PASSIVE_PCT = {"psn": 12.5, "brn": 6.25, "Life Orb": 10, "Sandstorm": 6.25, "Hail": 6.25, "Spikes": 12.5,
               "Rocky Helmet": 16.7, "Rough Skin": 12.5, "Iron Barbs": 12.5, "Leech Seed": 12.5, "Salt Cure": 12.5,
               "Black Sludge": 12.5, "Mimikyu-Busted": 12.5}
HEAL_PCT = {"Leftovers": 6.25, "Black Sludge": 6.25, "Poison Heal": 12.5, "Sitrus Berry": 25, "default": 50}
TIMER_RE = re.compile(r"^.+ has \d+ seconds? left\W?$|^.+ turned on the timer\W?$|^.+ turned off the timer\W?$"
                      r"|time'?s up\b.*requested by", re.I)
# the end of a switch line wrapped onto its own line: "(Bronzong)!" or "Therian)!" after "... (Enamorus-"
WRAP_TAIL = re.compile(r"^\(?(?!the )[^()\s]+(?: [^()\s]+)?\)\W{0,2}[l'!]?$", re.I)
CHAT_RE = re.compile(r"^[^\s:()\[\]][^:()\[\]]{0,20}: \S")   # spectator chat "name: text"
ROCK_WEAK, ROCK_RESIST = {"Fire", "Ice", "Flying", "Bug"}, {"Fighting", "Ground", "Steel"}


def js_string(s):
    return json.loads('"' + re.sub(r"\\x([0-9A-Fa-f]{2})", r"\\u00\1", s) + '"')


def load_templates(tdir):
    """[(section, entry id, entry name, key, template)] from the pokemon-showdown text files."""
    out = []
    for kind in ("default", "moves", "abilities", "items"):
        text = open(os.path.join(tdir, kind + ".js"), encoding="utf-8").read()
        entries = re.split(r"\n  (\w+): \{\n", text)
        for eid, body in zip(entries[1::2], entries[2::2]):
            body = re.sub(r"\n    \w+: \{\n.*?\n    \},?", "", "\n" + body, flags=re.S)  # gen8: {...}: old wording
            keys = dict((k, js_string(v)) for k, v in re.findall(r'\n    (\w+): "((?:[^"\\]|\\.)*)"', body))
            name = keys.get("name") or keys.get("statName") or keys.get("weatherName") or eid
            sect = kind
            if kind == "default":
                sect = "weather" if "weatherName" in keys else "status" if eid in STATUSES else eid
            for k, v in keys.items():
                if k in SKIP_KEYS or v.startswith("#") or (kind == "default" and eid == "default" and k in FRAGMENTS):
                    continue
                out.append((sect, eid, name, k, v))
    by_id = {e: n for s, e, n, k, v in out}
    for sect, eid, key, v in EXTRA:
        out.append((sect, eid, by_id.get(eid, eid), key, v))
    return out


def names(tdir, kind):
    return re.findall(r'\n    name: "([^"]+)"', open(os.path.join(tdir, kind + ".js"), encoding="utf-8").read())


def compile_templates(templates):
    comp = []
    for sect, eid, name, key, tpl in templates:
        for part in tpl.split("\n"):
            part = part.strip().replace("**", "").replace("é", "e")   # OCR reads "Pokémon" as "Pokemon"
            pieces = re.split(r"\[([A-Z]+)\]", part)
            if part.startswith("== Turn") or (len(pieces) == 1 and len(part) < 8):
                continue
            rx, slots, lit = "", [], 0
            for i, p in enumerate(pieces):
                if i % 2 == 0:
                    rx += re.escape(p)
                    lit += len(p)
                else:
                    rx += SLOT_RE.get(p, r"(.+?)")
                    slots.append(p)
            comp.append((lit, re.compile("^" + rx + "$", re.I), slots, (sect, eid, name, key)))
    comp.sort(key=lambda c: -c[0])  # the most specific wording first
    return comp


def variants(t):
    """The line as read, then with common OCR slips undone."""
    t = re.sub(r"[^\x20-\x7e]", "", t).strip()
    t2 = t.replace("VV", "W")
    t2 = re.sub(r"\b(doesn|can|isn|wasn|didn|won) t\b", r"\1't", t2)   # apostrophe not read
    if re.match(r"^\(.+'s .+\)$", t2) and "lost" not in t2:  # "[X's Ability]" read with round brackets
        t2 = "[" + t2[1:-1] + "]"
    if t2.startswith("["):
        t2 = re.sub(r"^\[(.+?)\s?is ", r"[\1's ", t2)
    if t2.endswith(")") and not t2.startswith("(") and "(" not in t2:   # "(" of "(X lost N%...)" not read
        t2 = "(" + t2
    t2 = re.sub(r"lost (?!100 )(\d{1,2})00 of", r"lost \1% of", t2)   # "6600": "%" read as "00" (usually "0/0")
    if re.match(r"^\(.+ lost \d+% of its health$", t2):   # "!)" at the end not read
        t2 += "!)"
    # a damage line garbled around the number ("10<t 0% ot its", "lost 70% of itfi health"): rebuild it
    m = re.match(r"^\W*(.+?)\s+(?:lost|lo[s5<]t|10[s5<]t|105t)\s+(\d{1,3})\s*%.*heal", t2)
    if m and not re.search(r"lost \d+% of its health", t2):
        t2 = f"({m.group(1)} lost {m.group(2)}% of its health!)"
    for base in dict.fromkeys([t, t2]):
        yield base
        yield re.sub(r"[l'I1|i]$", "!", base)
        yield base + "!"
        yield re.sub(r"'(?=[a-z])", "", base)


def match(comp, text, fuzzy=False):
    for v in variants(text):
        for lit, rx, slots, info in comp:
            m = rx.match(v)
            if m:
                return info, dict(zip(slots, m.groups()))
    return fuzzy_match(comp, text) if fuzzy else (None, None)


def fuzzy_match(comp, text):
    """Last resort for garbled lines: a template with no slots, or "[SLOT] literal ending", read at 80%+ alike."""
    t = re.sub(r"[^\x20-\x7e]", "", text).strip()
    best, found = 0.8, (None, None)
    for lit, rx, slots, info in comp:
        pieces = re.split(r"\((?:\\d\+|\.\+\?)\)", rx.pattern[1:-1])
        pieces = [re.sub(r"\\(.)", r"\1", p) for p in pieces]
        if not slots:
            r = difflib.SequenceMatcher(None, t.lower(), pieces[0].lower()).ratio()
            if r > best:
                best, found = r, (info, {})
        elif len(slots) == 1 and pieces[0] == "" and len(pieces[1]) >= 6:
            suffix = pieces[1]
            for k in range(max(1, len(t) - len(suffix) - 2), min(len(t), len(t) - len(suffix) + 3)):
                r = difflib.SequenceMatcher(None, t[k:].lower(), suffix.lower()).ratio()
                if r > best:
                    best, found = r, (info, {slots[0]: t[:k]})
    return found


class Converter:
    def __init__(self, comp, dex, moves, items, abilities):
        self.comp, self.moves = comp, moves
        self.species = {v["name"]: v for v in dex.values()}
        self.move_names = [m["name"] for m in moves.values()]
        self.items, self.abilities = items, abilities
        self.out, self.unparsed, self.guessed, self.dropped = [], [], [], []
        self.players, self.own = ["", ""], 0   # own: index of the player whose side says "Go!"
        self.nicks = {"p1": {}, "p2": {}}      # nick -> species
        self.active = {"p1": None, "p2": None}
        self.hp, self.toxic, self.status = {}, {}, {}
        self.last_mover = None

    # -- names
    def close(self, name, pool, cutoff=0.6):
        if name in pool:
            return name
        m = difflib.get_close_matches(name, list(pool), 1, cutoff)
        return m[0] if m else None

    def own_side(self):
        return f"p{self.own + 1}"

    def foe(self, side):
        return "p2" if side == "p1" else "p1"

    def mon(self, text):
        """'the opposing Metagross' / 'short king' -> ('p2', 'Metagross')"""
        # "The" misread: "e opposing", "lhe opposinq", "I he opposing", "-l he"
        t = re.sub(r"^\W*(?:[tli1|]\s?he\s+o\S*|h?e\s+opp\S*)\s+", "", text.strip(), flags=re.I)
        side = self.foe(self.own_side()) if t != text.strip() else self.own_side()
        nick = self.close(t, self.nicks[side], 0.5) or t
        return side, nick

    def ref(self, side, nick):
        return f"{side}a: {nick}"

    def emit(self, *parts):
        self.out.append("|" + "|".join(str(p) for p in parts))

    def hp_str(self, key):
        v = self.hp.get(key, 100)
        return "0 fnt" if v <= 0 else f"{max(1, round(v))}/100"

    # -- HP
    def damage(self, side, nick, pct, frm=None, of=None):
        key = (side, nick)
        self.last_damage = pct
        self.hp[key] = self.hp.get(key, 100) - pct
        self.emit(*(["-damage", self.ref(side, nick), self.hp_str(key)] + (["[from] " + frm] if frm else [])
                    + (["[of] " + of] if of else [])))

    def heal(self, side, nick, pct, frm=None):
        key = (side, nick)
        self.hp[key] = min(100, self.hp.get(key, 100) + pct)
        self.emit(*(["-heal", self.ref(side, nick), self.hp_str(key)] + (["[from] " + frm] if frm else [])))

    def passive_pct(self, side, nick, cause):
        if cause in TRAP_MOVES:
            return 12.5
        if cause == "psn" and self.status.get((side, nick)) == "tox":
            n = self.toxic.get((side, nick), 0) + 1
            self.toxic[(side, nick)] = n
            return 6.25 * n
        if cause == "Stealth Rock":
            types = set(self.species.get(self.nicks[side].get(nick, nick), {}).get("types", []))
            return 12.5 * 2 ** (len(types & ROCK_WEAK) - len(types & ROCK_RESIST))
        return PASSIVE_PCT.get(cause, 0)

    # -- the log
    def convert(self, preview, turns):
        events = []
        for n, ls in enumerate(turns):
            if n:
                events.append(("turn", n))
            events += [("text", t) for t in ls]
        for kind, t in events:
            m = kind == "text" and re.match(r"Battle started between (.+) and (.+?)\W?$", t)
            if m:
                self.players = [m.group(1).strip(), re.sub(r"[il']$", "", m.group(2).strip())]
                break
        for kind, t in events:
            m = kind == "text" and re.match(r"(.+?) (sent out|withdrew) ", t)
            if m and self.close(m.group(1), self.players, 0.5):
                self.own = 1 - self.players.index(self.close(m.group(1), self.players, 0.5))
                break
        self.emit("gametype", "singles")
        for i, p in enumerate(self.players):
            self.emit("player", f"p{i + 1}", p, "")
        self.emit("gen", 9)
        self.emit("tier", "[Gen 9] National Dex")
        self.emit("clearpoke")
        for i, team in enumerate([l for l in preview if l.count(" / ") >= 2][:2]):
            for sp in team.split(" / "):
                name = self.close(sp.strip(), self.species, 0.5)
                if name:
                    self.emit("poke", f"p{i + 1}", name, "")
                else:
                    self.unparsed.append(("team preview", sp))
        self.emit("teampreview")
        self.emit("start")
        pending = None   # a "lost N%" line, emitted when the next line comes
        joined = []   # a long line wrapped in the log panel: two pieces that only match together
        for kind, t in events:
            prev = joined[-1][1] if joined and joined[-1][0] == "text" else ""
            if kind == "text" and WRAP_TAIL.match(t) and re.search(r"sent out |^Go! ", prev) and not re.search(r"\)\W*[l'i]?\W*$", prev):
                joined[-1] = ("text", prev + ("" if prev.endswith("-") else " ") + t)
            elif (kind == "text" and joined and joined[-1][0] == "text" and not match(self.comp, joined[-1][1])[0]
                    and not match(self.comp, t)[0] and match(self.comp, joined[-1][1] + " " + t)[0]):
                joined[-1] = ("text", joined[-1][1] + " " + t)
            else:
                joined.append((kind, t))
        events = joined
        for kind, t in events:
            if kind == "turn":
                self.flush(pending); pending = None
                self.emit("turn", t)
                continue
            m = re.match(r"(.+) forfeited\.?$", t)
            if m:
                self.flush(pending); pending = None
                self.emit("-message", (self.close(m.group(1), self.players, 0.5) or m.group(1)) + " forfeited.")
                continue
            if TIMER_RE.match(t):
                self.dropped.append(("timer", t))
                continue
            info, slots = match(self.comp, t, fuzzy=True)
            if not info:
                self.flush(pending); pending = None
                if CHAT_RE.match(t):
                    self.dropped.append(("chat", t))
                else:
                    self.unparsed.append(("no template", t))
                continue
            sect, eid, name, key = info
            if (sect, key) == ("default", "damagePercentage"):
                self.flush(pending)
                side, nick = self.mon(slots["POKEMON"])
                pending = (side, nick, int(slots["PERCENTAGE"]))
                continue
            # a "lost N%" line is always the move's hit: the client prints no number for poison, Life Orb...
            cause = self.cause(sect, eid, name, key, slots)
            self.flush(pending); pending = None
            if cause:
                side, nick, frm, of = cause
                pct = self.passive_pct(side, nick, frm.split(": ")[-1])
                self.guessed.append(f"{nick} hurt by {frm}: {pct}% (no number shown)")
                self.damage(side, nick, pct, frm, of)
                continue
            try:
                self.event(sect, eid, name, key, slots, t)
            except (KeyError, TypeError, ValueError) as e:
                self.unparsed.append((f"{sect}.{eid}.{key} failed ({e!r})", t))
        self.flush(pending)

    def flush(self, pending):
        if pending:
            self.damage(*pending)

    def cause(self, sect, eid, name, key, s):
        """A passive-damage line -> (side, nick, [from] text, [of] text or None)."""
        if (sect, key) == ("default", "damageFromItem"):
            return self.mon(s["POKEMON"]) + ("item: " + (self.close(s["ITEM"], self.items) or s["ITEM"]), None)
        if (sect, key) == ("default", "damageFromPartialTrapping"):   # Magma Storm, Fire Spin...: 1/8, no number shown
            side, nick = self.mon(s["POKEMON"])
            move = s["MOVE"].strip()
            mid = re.sub(r"[^a-z0-9]", "", move.lower())
            user = next((l.split("|")[2] for l in reversed(self.out) if l.startswith("|move|")
                         and re.sub(r"[^a-z0-9]", "", l.split("|")[3].lower()) == mid
                         and not l.split("|")[2].startswith(side)), None)
            return side, nick, "move: " + move, user
        if (sect, key) == ("default", "damageFromPokemon"):
            return self.mon(s["POKEMON"]) + ("item: " + (self.close(s["ITEM"], self.items) or s["ITEM"]),
                                             self.ref(*self.mon(s["SOURCE"])))
        if key != "damage" or "POKEMON" not in s:
            return None
        side, nick = self.mon(s["POKEMON"])
        if (sect, eid) == ("default", "default") and self.out[-1].endswith("|Mimikyu-Busted"):
            return side, nick, "pokemon: Mimikyu-Busted", None   # "(X was hurt!)" after the disguise breaks
        frm = {"status": eid, "weather": WEATHER_IDS.get(eid, name), "recoil": "Recoil", "confusion": "confusion",
               "items": "item: " + name, "abilities": "ability: " + name}.get(sect, name)
        return side, nick, frm, None

    def event(self, sect, eid, name, key, s, text):
        P = lambda k="POKEMON": self.mon(s[k])
        foe_active = lambda: self.ref(self.foe(self.last_mover[0]), self.active[self.foe(self.last_mover[0])])
        if sect == "default":
            if key in ("startBattle", "switchOut", "switchOutOwn"):
                return
            if key == "clearAllBoost":   # Haze
                return self.emit("-clearallboost")
            if key == "winBattle":
                # the last KO's "fainted!" can scroll by unread (the box went from the hit to the win)
                for side, nick in self.active.items():
                    if nick and self.hp.get((side, nick), 100) <= 0 and f"|faint|{self.ref(side, nick)}" not in self.out:
                        self.guessed.append(f"{nick} at 0 HP at the win: faint added")
                        self.emit("faint", self.ref(side, nick))
                return self.emit("win", self.close(s["TRAINER"], self.players, 0.5) or s["TRAINER"])
            if key in ("switchIn", "switchInOwn"):
                side = self.own_side() if key == "switchInOwn" else self.foe(self.own_side())
                return self.switch(side, s["FULLNAME"])
            if key == "faint":
                side, nick = P()
                if self.hp.get((side, nick), 100) > 0:   # its damage line wasn't read: the last hit was the KO
                    for i in range(len(self.out) - 1, -1, -1):
                        parts = self.out[i].split("|")
                        if parts[1] == "-damage" and parts[2] == self.ref(side, nick):
                            parts[3] = "0 fnt"
                            self.out[i] = "|".join(parts)
                            if self.hp.get((side, nick)) >= 1:   # under 1%: rounding in the estimates
                                self.guessed.append(f"{nick} fainted at {self.hp.get((side, nick)):.0f}%: last hit set to 0")
                            break
                    self.hp[(side, nick)] = 0
                return self.emit("faint", self.ref(side, nick))
            if key == "move":
                side, nick = P()
                if self.hp.get((side, nick), 100) <= 0:
                    self.unparsed.append(("CHECK: moved at 0 HP, a damage % is wrong", text))
                    self.hp[(side, nick)] = 1
                mv = self.close(s["MOVE"], self.move_names) or s["MOVE"]
                tgt = self.moves.get(re.sub(r"[^a-z0-9]", "", mv.lower()), {}).get("target", "normal")
                foe = self.foe(side)
                target = self.ref(side, nick) if tgt in ("self", "allySide", "allies", "adjacentAllyOrSelf") \
                    else self.ref(foe, self.active[foe]) if self.active[foe] and tgt != "all" else ""
                self.last_mover = (side, nick)
                return self.emit("move", self.ref(side, nick), mv, target)
            if key == "abilityActivation":
                side, nick = P()
                return self.emit("-ability", self.ref(side, nick), self.close(s["ABILITY"], self.abilities) or s["ABILITY"])
            if (key.startswith("boost") or key.startswith("unboost")) and "STAT" in s and "ITEM" not in s:
                side, nick = P()
                d = re.search(r"\d", key)
                return self.emit("-boost" if key.startswith("boost") else "-unboost", self.ref(side, nick),
                                 STATS.get(s["STAT"].lower().strip(), s["STAT"]), int(d.group()) if d else 1)
            if key in ("superEffective", "resisted", "crit", "immuneNoPokemon"):
                cmd = {"superEffective": "-supereffective", "resisted": "-resisted", "crit": "-crit",
                       "immuneNoPokemon": "-immune"}[key]
                return self.emit(cmd, foe_active())
            if key == "immune":
                return self.emit("-immune", self.ref(*P()))
            if key in ("miss", "missNoPokemon"):
                return self.emit("-miss", self.ref(*self.last_mover), foe_active())
            if key == "fail":
                return self.emit("-fail", self.ref(*self.last_mover))
            if key == "heal":
                side, nick = P()
                prev = self.out[-1].split("|")
                src = prev[3] if len(prev) > 3 and prev[1] == "-ability" else None
                return self.heal(side, nick, HEAL_PCT.get(src, HEAL_PCT["default"]), "ability: " + src if src else None)
            if key in ("boostFromItem", "boost2FromItem", "boost3FromItem", "unboostFromItem", "unboost2FromItem"):
                d = re.search(r"\d", key)
                return self.emit("-boost" if key.startswith("boost") else "-unboost", self.ref(*P()),
                                 STATS.get(s["STAT"].lower().strip(), s["STAT"]), int(d.group()) if d else 1,
                                 "[from] item: " + (self.close(s["ITEM"], self.items) or s["ITEM"]))
            if key in ("removeItem", "eatItem", "activateItem"):
                return self.emit("-enditem", self.ref(*P()), self.close(s["ITEM"], self.items) or s["ITEM"])
            if key in ("hitCount", "hitCountSingular"):
                return self.emit("-hitcount", foe_active(), s.get("NUMBER", "1"))
            if key in ("mega", "megaNoItem"):
                side, nick = P()
                item = self.close(s.get("ITEM", ""), self.items) or s.get("ITEM", "")
                return self.emit("-mega", self.ref(side, nick), self.nicks[side].get(nick, nick), item)
            if key == "transformMega":
                side, nick = P()
                m = re.match(r"^(.+?) ([XY])$", s["SPECIES"].strip())
                sp = f"{m.group(1)}-Mega-{m.group(2)}" if m else s["SPECIES"].strip() + "-Mega"
                sp = self.close(sp, self.species, 0.8) or sp
                self.nicks[side][nick] = sp
                return self.emit("detailschange", self.ref(side, nick), sp)
            if key == "zPower":
                return self.emit("-zpower", self.ref(*P()))
            if key == "zEffect":
                return
            if key == "healFromEffect":
                side, nick = P()
                eff = self.close(s["EFFECT"], self.items) or s["EFFECT"]
                pct = HEAL_PCT.get(eff, HEAL_PCT["default"])
                self.guessed.append(f"{nick} healed by {eff}: {pct}% (no number shown)")
                return self.heal(side, nick, pct, "item: " + eff if eff in self.items else None)
        elif sect == "status":
            ref = self.ref(*P())
            if key.startswith("start"):
                self.status[P()] = eid
            elif key == "end":
                self.status.pop(P(), None)
            if key.startswith("startFrom") and "ITEM" in s:
                return self.emit("-status", ref, eid, "[from] item: " + (self.close(s["ITEM"], self.items) or s["ITEM"]))
            cmd = {"start": ("-status", ref, eid), "end": ("-curestatus", ref, eid, "[msg]"), "cant": ("cant", ref, eid)}
            if key in cmd:
                return self.emit(*cmd[key])
        elif sect == "weather":
            w = WEATHER_IDS.get(eid, name)
            if key == "start":
                prev = self.out[-1].split("|")
                if len(prev) > 3 and prev[1] == "-ability":
                    return self.emit("-weather", w, "[from] ability: " + prev[3], "[of] " + prev[2])
                return self.emit("-weather", w)
            if key in ("upkeep", "end"):
                return self.emit("-weather", w, "[upkeep]") if key == "upkeep" else self.emit("-weather", "none")
        elif sect.endswith("terrain") and key in ("start", "end"):
            name = sect[:-7].title() + " Terrain"   # default.js has no name for these
            if key == "end":
                return self.emit("-fieldend", "move: " + name)
            prev = self.out[-1].split("|")
            if len(prev) > 3 and prev[1] == "-ability":
                return self.emit("-fieldstart", "move: " + name, "[from] ability: " + prev[3], "[of] " + prev[2])
            return self.emit("-fieldstart", "move: " + name)
        elif sect == "unboost" and key.startswith("fail"):
            return self.emit("-fail", self.ref(*P()), "unboost")
        elif sect in ("flinch", "recharge"):
            return self.emit("cant", self.ref(*P()), sect)
        elif sect == "confusion" and key in ("start", "activate", "end"):
            return self.emit("-" + key, self.ref(*P()), "confusion")
        elif sect == "confusion" and key == "startFromFatigue":   # Outrage / Petal Dance ending
            return self.emit("-start", self.ref(*P()), "confusion", "[fatigue]")
        elif sect == "drain" and key == "heal":
            # Half the damage just dealt; the target's % stands in for the user's (max HP differ), so a guess.
            side, nick = P("SOURCE" if "SOURCE" in s else "POKEMON")
            pct = round(getattr(self, "last_damage", 0) / 2, 1)
            self.guessed.append(f"{nick} drained: +{pct}% (half the target's loss)")
            return self.heal(side, nick, pct, "drain")
        elif sect in ("moves", "abilities", "items"):
            label = {"moves": "move: ", "abilities": "ability: ", "items": "item: "}[sect] + name
            if (eid, key) == ("wish", "heal"):   # "X's wish came true!": heals whoever is in on X's side
                side = self.mon(s["NICKNAME"])[0]
                return self.heal(side, self.active[side], HEAL_PCT["default"], label)
            if eid == "substitute" and key == "fail":   # not enough HP left to make one
                return self.emit("-fail", self.ref(*self.last_mover), label)
            if (eid, key) == ("disguise", "transform"):
                side, nick = P()
                self.nicks[side][nick] = "Mimikyu-Busted"
                return self.emit("detailschange", self.ref(side, nick), "Mimikyu-Busted")
            if key == "block" and "POKEMON" not in s:   # "Its disguise served it as a decoy!": the move's target
                return self.emit("-activate", foe_active(), label)
            if key == "activate" and "POKEMON" not in s:   # "Tidying up complete!": the user
                return self.emit("-activate", self.ref(*self.last_mover), label)
            if "TEAM" in s and key in ("start", "end"):
                side = self.foe(self.own_side()) if "opposing" in s["TEAM"].lower() else self.own_side()
                return self.emit("-sidestart" if key == "start" else "-sideend",
                                 f"{side}: {self.players[int(side[1]) - 1]}", label)
            if key == "removeItem" and "POKEMON" in s:
                parts = ["-enditem", self.ref(*P()), self.close(s.get("ITEM", ""), self.items) or s.get("ITEM", ""),
                         "[from] " + label]
                return self.emit(*(parts + (["[of] " + self.ref(*P("SOURCE"))] if "SOURCE" in s else [])))
            if key == "heal" and "POKEMON" in s:
                side, nick = P()
                return self.heal(side, nick, HEAL_PCT.get(name, HEAL_PCT["default"]), label)
            if "POKEMON" in s:
                return self.emit({"start": "-start", "end": "-end"}.get(key, "-activate"), self.ref(*P()), label)
            if key in ("start", "end"):
                return self.emit("-fieldstart" if key == "start" else "-fieldend", label)
        if key == "block" and "POKEMON" in s:   # "X is protected by the Electric Terrain!"
            return self.emit("-activate", self.ref(*P()), "move: " + name)
        self.unparsed.append((f"no rule for {sect}.{eid}.{key}", text))

    def switch(self, side, full):
        out = self.active[side]
        if out and self.hp.get((side, out), 100) > 0:
            abilities = set(self.species.get(self.nicks[side].get(out), {}).get("abilities", {}).values())
            if "Regenerator" in abilities and self.hp.get((side, out), 100) < 100:   # not in a spectator log
                self.hp[(side, out)] = min(100, self.hp[(side, out)] + 100 / 3)
                self.guessed.append(f"{out} switched out: +33% (can have Regenerator)")
        m = re.match(r"^(.*?)\s*\(([^()]+?)(?:\)\W*[li]?|\W*)$", full)   # ")!" may be cut off
        nick, sp = (m.group(1), m.group(2)) if m else (re.sub(r"\W+$", "", full),) * 2
        sp = re.sub(r"(?<=[A-Za-z])I", "l", sp)   # "NinetaIes-AIoIa": OCR reads l as I
        # a form name the dex lacks ("Maushold-Three" is plain "Maushold") -> its base species, before a loose match
        sp = self.close(sp, self.species, 0.85) or self.close(sp.rsplit("-", 1)[0], self.species, 0.8) \
            or self.close(sp, self.species, 0.5) or sp
        known = self.close(nick, self.nicks[side], 0.8)
        nick = known or nick
        self.nicks[side].setdefault(nick, sp)
        self.active[side] = nick
        self.toxic.pop((side, nick), None)
        self.emit("switch", self.ref(side, nick), self.nicks[side][nick], self.hp_str((side, nick)))
