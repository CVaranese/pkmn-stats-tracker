"""Write each league's page (site/<id>/index.html) and the landing page (site/index.html) from the templates in
site/app/ (league.html, landing.html) and the leagues in site/leagues.json.

GitHub Pages serves files as they are, so each league gets its own small copy of the page; the scripts, styles,
data and sprites stay shared (one folder up, through the page's <base>). Re-run after editing a template or
site/leagues.json, or adding a league:

    python -I tools/build_pages.py          # write the pages
    python -I tools/build_pages.py --check  # exit 1 if a page is out of date (tests/test_tools.py runs this)
"""
import html
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")
# the default theme's palettes (style.css, html data-palette), for a league without theme_css; the first is the default
PALETTES = ["blastoise", "charizard", "venusaur"]


def load_leagues():
    with open(os.path.join(SITE, "leagues.json"), encoding="utf-8") as f:
        return json.load(f)


def games_in(league_id):
    """How many games the league's library holds (0 when it has none yet)."""
    try:
        with open(os.path.join(SITE, league_id, "games", "index.json"), encoding="utf-8") as f:
            return len(json.load(f).get("games", []))
    except FileNotFoundError:
        return 0


def load_releases():
    """site/releases.json's releases, newest first (What's new on the league list, the version in each footer)."""
    with open(os.path.join(SITE, "releases.json"), encoding="utf-8") as f:
        return json.load(f)["releases"]


def fill(template, values):
    for key, value in values.items():
        template = template.replace("{{" + key + "}}", value)
    if "{{" in template:
        raise ValueError("template placeholder left unfilled: " + template[template.index("{{"):][:40])
    return template


def league_page(template, cfg, lg):
    e = lambda s: html.escape(s, quote=True)
    url = cfg["site_url"] + lg["id"] + "/"
    banner = og_image = ""
    if lg.get("banner"):
        b = lg["banner"]
        banner = (f'      <img class="banner" src="{e(lg["id"])}/{e(b["src"])}" width="{b["width"]}" height="{b["height"]}"\n'
                  f'        alt="{e(b["alt"])}">\n')
        # egg: an unmarked link over one spot of the banner (box in % of the image) to the preview of the next
        # version (site/next/, from the next branch); for visitors who look closely, so nothing points at it
        if b.get("egg"):
            g = b["egg"]
            box = f'left:{g["left"]}%;top:{g["top"]}%;width:{g["width"]}%;height:{g["height"]}%'
            banner = (f'      <div class="banner-box">\n  {banner}'
                      f'        <a class="egg" href="{e(cfg["site_url"] + "next/" + lg["id"] + "/")}" style="{box}" '
                      f'title="{e(g["title"])}" aria-label="{e(g["title"])}"></a>\n      </div>\n')
    if lg.get("preview"):
        p = lg["preview"]
        og_image = (f'  <meta property="og:image" content="{e(url + p["src"])}">\n'
                    f'  <meta property="og:image:width" content="{p["width"]}">\n'
                    f'  <meta property="og:image:height" content="{p["height"]}">\n'
                    f'  <meta property="og:image:alt" content="{e(p["alt"])}">\n')
    # what the page's scripts need (app/core.js LEAGUE); "</" can't end the script early
    page_info = {k: lg.get(k, "") for k in ("id", "name", "short", "tag", "format", "format_name")}
    page_info["brackets"] = lg.get("brackets", [])
    page_info["best_of"] = lg.get("best_of", 0)
    page_info["set_points"] = lg.get("set_points")
    page_info["palette"] = "" if lg.get("theme_css") else lg.get("palette", PALETTES[0])
    league_json = json.dumps(page_info, ensure_ascii=False).replace("</", "<\\/")
    # the league's own theme (its tokens over style.css's default theme), when it has one
    theme_css = f'  <link rel="stylesheet" href="{e(lg["id"])}/{e(lg["theme_css"])}">\n' if lg.get("theme_css") else ""
    # no theme of its own: the viewer picks a palette (style.css), set before the page draws so it doesn't flash;
    # ?palette=charizard shows one without saving it (screenshots)
    palette_script = palette_picker = ""
    if not lg.get("theme_css"):
        palette_script = ("  <script>try { const p = new URLSearchParams(location.search).get(\"palette\") || "
                          "localStorage.getItem(\"replay-kill-tracker." + lg["id"] + ".palette\") || "
                          "window.LEAGUE.palette; if (p) document.documentElement.dataset.palette = p; } catch (e) { "
                          "document.documentElement.dataset.palette = window.LEAGUE.palette; }</script>\n")
        # the header's top right: one sprite button per palette (app/startup.js marks the picked one)
        buttons = "".join(f'<button type="button" data-palette="{p}" aria-pressed="false" title="{p.title()} theme">'
                          f'<img src="sprites/gen5/{p}.png" width="48" height="48" alt="{p.title()}"></button>' for p in PALETTES)
        palette_picker = f'      <div class="palette-pick" id="palette" role="group" aria-label="Theme">{buttons}</div>\n'
    version = "v" + load_releases()[0]["version"]
    return fill(template, {"version": e(version), "palette_script": palette_script, "palette_picker": palette_picker,
                           "theme_css": theme_css, "title": e(lg["title"]), "description": e(lg["description"]), "name": e(lg["name"]),
                           "url": e(url), "og_image": og_image, "theme": e(lg.get("theme", "#2f5d9e")),
                           "league_json": league_json, "banner": banner, "lede": e(lg["lede"])})


def landing_page(template, cfg):
    e = lambda s: html.escape(s, quote=True)
    items = []
    for lg in cfg["leagues"]:
        n = games_in(lg["id"])
        games = f"{n} game{'' if n == 1 else 's'}" if n else "no games yet"
        img = ""
        if lg.get("banner"):
            b = lg["banner"]
            img = f'<img src="{e(lg["id"])}/{e(b["src"])}" width="{b["width"]}" height="{b["height"]}" alt="">'
        items.append(f'      <li><a href="{e(lg["id"])}/">{img}<span><strong>{e(lg["name"])}</strong>'
                     f'<span class="hint">{e(lg["format_name"])}, {games}</span></span></a></li>\n')
    news = []
    for r in load_releases():
        notes = "".join(f"<li>{e(n)}</li>" for n in r["notes"])
        news.append(f'      <h3>Version {e(r["version"])}: {e(r["title"])}</h3>\n      <ul>{notes}</ul>\n')
    return fill(template, {"url": e(cfg["site_url"]), "leagues": "".join(items), "releases": "".join(news)})


def pages():
    """{path: text} for every page this writes."""
    cfg = load_leagues()
    def read(name):
        with open(os.path.join(SITE, "app", name), encoding="utf-8") as f:
            return f.read()
    league_tpl = read("league.html")
    out = {os.path.join(SITE, "index.html"): landing_page(read("landing.html"), cfg)}
    for lg in cfg["leagues"]:
        out[os.path.join(SITE, lg["id"], "index.html")] = league_page(league_tpl, cfg, lg)
    return out


def main(argv):
    stale = []
    for path, text in pages().items():
        try:
            with open(path, encoding="utf-8", newline="") as f:
                # line endings don't count: a git checkout on Windows writes CRLF where this writes LF
                same = f.read().replace("\r\n", "\n") == text
        except FileNotFoundError:
            same = False
        if same:
            continue
        stale.append(os.path.relpath(path, ROOT))
        if "--check" not in argv:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(text)
    if "--check" in argv:
        if stale:
            print("out of date (run python -I tools/build_pages.py):", ", ".join(stale))
            return 1
        print("pages up to date")
        return 0
    print("wrote " + ", ".join(stale) if stale else "pages already up to date")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
