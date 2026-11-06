"""Colour checks on the stylesheets (docs/STYLE.md): every theme's text and controls reach WCAG AA contrast, and no
colour is written into a rule outside the tokens and the fixed colours STYLE.md allows.

    python -I tests/test_style.py           # the checks
    python -I tests/test_style.py --table   # every pair's ratio in every theme (for the accessibility-review skill)
"""
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
DARK = "prefers-color-scheme: dark"

# (foreground, background, minimum): AA is 4.5 for text under 18px (all the site's small text), 3 for the thick outline
TEXT_PAIRS = [(fg, bg, 4.5) for fg in ("--text", "--muted", "--accent") for bg in ("--bg", "--surface", "--row-alt", "--band")]
PAIRS = TEXT_PAIRS + [
    ("--accent-text", "--accent", 4.5),   # primary button, selected sub-tab, Won badge
    ("--error", "--error-bg", 4.5),       # error lists
    ("--error", "--surface", 4.5),
    ("--outline", "--bg", 3),             # the black pixel outline around panels and tables
]
# Misses found when this check was written (2026-11-02), waiting on the user (docs/REVIEW_QUEUE.md). The test fails
# on any other miss, and on one of these once it's fixed, so the list stays current: remove a line when it passes.
KNOWN = {
    "venusaur light: --accent on --row-alt",   # 4.50, just under
    "venusaur light: --accent on --band",      # 4.23
    "blastoise dark: --outline on --bg",       # 1.16: the dark "black outline" barely shows on the dark panel
    "charizard dark: --outline on --bg",       # 1.14
    "venusaur dark: --outline on --bg",        # 1.18
    "ppppp dark: --outline on --bg",           # 1.27
}
HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(")


def rules(css):
    """Each declaration as (media, selector, property, value); comments dropped, @media nesting kept."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out, stack, buf = [], [], ""
    for ch in css:
        if ch == "{":
            stack.append(buf.strip())
            buf = ""
        elif ch == "}":
            decls = buf
            buf = ""
            if stack:
                sel = stack.pop()
                media = " ".join(s for s in stack if s.startswith("@media"))
                for d in decls.split(";"):
                    if ":" in d:
                        prop, val = d.split(":", 1)
                        out.append((media, sel, prop.strip(), val.strip()))
        elif ch == ";" and not stack:
            buf = ""
        else:
            buf += ch
    return out


def tokens(decls, selector, dark):
    """The custom properties a selector sets, the dark-mode block applied over the light one when dark."""
    light = {p: v for m, s, p, v in decls if s == selector and DARK not in m and p.startswith("--")}
    if not dark:
        return light
    return {**light, **{p: v for m, s, p, v in decls if s == selector and DARK in m and p.startswith("--")}}


def themes():
    """Every theme a page can show: {name: {token: value}}. Palettes (html data-palette) only on leagues without a
    theme.css (tools/build_pages.py); a palette selector outranks plain :root, so it sits on top of the dark :root."""
    base = rules((SITE / "style.css").read_text(encoding="utf-8"))
    palettes = sorted({m.group(1) for _, s, _, _ in base for m in [re.match(r':root\[data-palette="(\w+)"\]', s)] if m})
    out = {}
    for dark in (False, True):
        mode = "dark" if dark else "light"
        root = tokens(base, ":root", dark)
        out[f"blastoise {mode}"] = root
        for p in palettes:
            out[f"{p} {mode}"] = {**root, **tokens(base, f':root[data-palette="{p}"]', dark)}
        for lg in json.loads((SITE / "leagues.json").read_text(encoding="utf-8"))["leagues"]:
            if lg.get("theme_css"):
                own = rules((SITE / lg["id"] / lg["theme_css"]).read_text(encoding="utf-8"))
                out[f"{lg['id']} {mode}"] = {**root, **tokens(own, ":root", dark)}
    return out


def rgb(hexcode):
    h = hexcode.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def contrast(a, b):
    def lum(c):
        r, g, bl = (x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in rgb(c))
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl
    hi, lo = sorted((lum(a), lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def type_chips():
    """(type, chip colour, text colour) for every .t-<type> tag; text is .type-chip's unless the type sets its own."""
    decls = rules((SITE / "style.css").read_text(encoding="utf-8"))
    default = next(v for _, s, p, v in decls if s == ".type-chip" and p == "color")
    chips = {}
    for _, s, p, v in decls:
        m = re.fullmatch(r"\.t-(\w+)", s)
        if m:
            chips.setdefault(m.group(1), {"color": default})[p.replace("--chip", "chip")] = v
    return [(t, c["chip"], c["color"]) for t, c in sorted(chips.items())]


class Contrast(unittest.TestCase):
    def test_theme_pairs_reach_aa(self):
        bad, fixed = [], set(KNOWN)
        for name, tok in themes().items():
            for fg, bg, need in PAIRS:
                if fg in tok and bg in tok:
                    key = f"{name}: {fg} on {bg}"
                    r = contrast(tok[fg], tok[bg])
                    if r < need:
                        fixed.discard(key)
                        if key not in KNOWN:
                            bad.append(f"{key} {r:.2f} (needs {need})")
        self.assertEqual(bad, [], "new contrast misses")
        self.assertEqual(sorted(fixed), [], "these pass now: remove them from KNOWN")

    def test_type_chips_reach_aa(self):
        bad = [f".t-{t}: {fg} on {chip} {contrast(fg, chip):.2f}" for t, chip, fg in type_chips()
               if contrast(fg, chip) < 4.5]
        self.assertEqual(bad, [])


class ColourTokens(unittest.TestCase):
    # STYLE.md's fixed colours: type tags (.type-chip text, .t-<type>), and masks (black = keep, not a colour shown)
    ALLOWED = (re.compile(r"\.type-chip$|\.t-\w+$"), re.compile(r"(-webkit-)?mask-image$"))

    def test_colours_come_from_tokens(self):
        bad = []
        for path in [SITE / "style.css", *SITE.glob("*/theme.css")]:
            for media, sel, prop, val in rules(path.read_text(encoding="utf-8")):
                if prop.startswith("--") or not HEX.search(val):
                    continue
                if self.ALLOWED[0].search(sel) or self.ALLOWED[1].match(prop):
                    continue
                bad.append(f"{path.relative_to(ROOT)}: {sel} {{ {prop}: {val} }}")
        self.assertEqual(bad, [], "use a token (docs/STYLE.md), or add one light and dark")


def table():
    for name, tok in themes().items():
        print(name)
        for fg, bg, need in PAIRS:
            if fg in tok and bg in tok:
                r = contrast(tok[fg], tok[bg])
                print(f"  {fg:>13} on {bg:<10} {r:5.2f}  {'ok' if r >= need else 'LOW'} (needs {need})")
    print("type chips")
    for t, chip, fg in type_chips():
        r = contrast(fg, chip)
        print(f"  .t-{t:<9} {r:5.2f}  {'ok' if r >= 4.5 else 'LOW'}")


if __name__ == "__main__":
    if "--table" in sys.argv:
        table()
    else:
        unittest.main()
