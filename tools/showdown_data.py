"""Read a JS object literal (Showdown's dist/data/*.js) as data without running it.
Function values and method shorthands are skipped. Usage: jsdata.py moves.js pokedex.js outdir"""
import json, os, re, sys

class P:
    def __init__(self, s, i): self.s, self.i = s, i

    def ws(self):
        s = self.s
        while True:
            m = re.compile(r"\s+").match(s, self.i)
            if m: self.i = m.end(); continue
            if s.startswith("//", self.i): self.i = s.index("\n", self.i); continue
            if s.startswith("/*", self.i): self.i = s.index("*/", self.i) + 2; continue
            return

    def peek(self): self.ws(); return self.s[self.i]

    def string(self):
        q = self.s[self.i]; j = self.i + 1; out = []
        while self.s[j] != q:
            if self.s[j] == "\\":
                n = 6 if self.s[j + 1] == "u" else 2
                out.append(json.loads('"' + self.s[j:j + n] + '"') if self.s[j + 1] in 'nrt"\\/bfu' else self.s[j + 1]); j += n
            else: out.append(self.s[j]); j += 1
        self.i = j + 1
        return "".join(out)

    def skip_balanced(self, open_, close):
        """Skip from an opening bracket to its match, ignoring brackets in strings, templates and comments."""
        depth, s, j = 0, self.s, self.i
        while True:
            c = s[j]
            if c in "\"'`":
                j += 1
                while s[j] != c: j += 2 if s[j] == "\\" else 1
            elif s.startswith("//", j): j = s.index("\n", j)
            elif s.startswith("/*", j): j = s.index("*/", j) + 1
            elif c == open_: depth += 1
            elif c == close:
                depth -= 1
                if depth == 0: self.i = j + 1; return
            j += 1

    def skip_function(self):
        self.ws()
        if self.s.startswith("async", self.i): self.i += 5; self.ws()
        if self.s.startswith("function", self.i):
            self.i += 8; self.ws()
            while self.s[self.i] != "(": self.i += 1
        if self.s[self.i] == "(": self.skip_balanced("(", ")")
        else:
            while re.match(r"[\w$]", self.s[self.i]): self.i += 1
        self.ws()
        if self.s.startswith("=>", self.i): self.i += 2; self.ws()
        if self.s[self.i] == "{": self.skip_balanced("{", "}")
        else:  # arrow with an expression body: up to the next , or } at depth 0
            depth = 0
            while depth or self.s[self.i] not in ",}":
                if self.s[self.i] in "([{": depth += 1
                elif self.s[self.i] in ")]}": depth -= 1
                self.i += 1
        return SKIP

    def value(self):
        c = self.peek()
        if c == "{": return self.obj()
        if c == "[": return self.arr()
        if c in "\"'": return self.string()
        m = re.compile(r"-?\d+(\.\d+)?(e-?\d+)?").match(self.s, self.i)
        if m:
            self.i = m.end(); self.ws()
            if self.s[self.i] == "/":  # 1 / 3 style fractions
                self.i += 1; d = self.value(); return float(m.group()) / d
            return float(m.group()) if any(x in m.group() for x in ".e") else int(m.group())
        if re.compile(r"(async\s+)?function\b|\(").match(self.s, self.i) or re.compile(r"[\w$]+\s*=>").match(self.s, self.i):
            return self.skip_function()
        m = re.compile(r"[\w$.]+").match(self.s, self.i)
        self.i = m.end()
        return {"true": True, "false": False, "null": None}.get(m.group(), SKIP)

    def key(self):
        c = self.peek()
        if c in "\"'": return self.string()
        if c == "[": self.skip_balanced("[", "]"); return None  # computed key
        m = re.compile(r"[\w$]+").match(self.s, self.i); self.i = m.end(); return m.group()

    def obj(self):
        self.i += 1; out = {}
        while self.peek() != "}":
            if self.s.startswith("...", self.i): self.i += 3; self.value()
            else:
                start = self.i
                k = self.key()
                if k in ("get", "set", "async") and self.peek() not in ":(,}": k = self.key()
                c = self.peek()
                if c == ":": self.i += 1; v = self.value()
                elif c == "(": self.i = start; self.key(); v = self.skip_function() if True else None
                else: v = SKIP
                if k is not None and v is not SKIP: out[k] = v
            if self.peek() == ",": self.i += 1
        self.i += 1
        return out

    def arr(self):
        self.i += 1; out = []
        while self.peek() != "]":
            v = self.value()
            if v is not SKIP: out.append(v)
            if self.peek() == ",": self.i += 1
        self.i += 1
        return out

SKIP = object()

def load(path, name):
    s = open(path, encoding="utf-8").read()
    m = re.search(r"\bconst " + name + r"\s*=\s*", s)
    return P(s, m.end()).value()

def pick(o, keys): return {k: o[k] for k in keys if k in o}

MK = ["num", "name", "type", "category", "basePower", "accuracy", "critRatio", "willCrit", "damage", "ohko",
      "multihit", "multiaccuracy", "ignoreAccuracy", "ignoreEvasion", "secondary", "secondaries", "target", "priority", "isNonstandard"]
DK = ["num", "name", "types", "baseStats", "abilities", "baseSpecies", "forme", "isNonstandard"]

if __name__ == "__main__":
    moves, dex, out = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(out, exist_ok=True)
    for src, name, keys, dst in ((moves, "Moves", MK, "moves.json"), (dex, "Pokedex", DK, "pokedex.json")):
        data = {k: pick(v, keys) for k, v in load(src, name).items()}
        if name == "Pokedex":  # cosmetic forms (Gastrodon-East...) have no stats of their own
            for v in data.values():
                base = data.get(re.sub(r"[^a-z0-9]", "", (v.get("baseSpecies") or "").lower()))
                if "baseStats" not in v and base:
                    for f in ("types", "baseStats", "abilities", "num"): v.setdefault(f, base.get(f))
        p = os.path.join(out, dst)
        with open(p, "w", encoding="utf-8") as f: json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
        print(dst, len(data), "entries,", os.path.getsize(p) // 1024, "KB")
