"""Mark the next branch's copy of the site (site/next/ when published) as a preview: every page gets a noindex tag,
"Preview · " before its title and a strip at the top linking back to the live site. Only the index.html pages
(league list, league pages): watch.html plays inside a frame on them, and app/*.html are templates. Run by pages.yml.

    python3 mark_preview.py <folder>
"""
import pathlib
import re
import sys

STRIP = ('<div style="background:var(--accent);color:var(--accent-text);font:600 14px/1.4 system-ui,sans-serif;'
         'text-align:center;padding:6px 16px">Preview of the next version: things may break or change. '
         '<a href="/pkmn-stats-tracker/" style="color:inherit">Back to the live site</a></div>')


def mark(page):
    t = page.read_text(encoding="utf-8")
    t = t.replace("<head>", '<head>\n  <meta name="robots" content="noindex">', 1)
    t = re.sub(r"<title>", "<title>Preview · ", t, count=1)
    t = re.sub(r"(<body[^>]*>)", r"\1\n" + STRIP.replace("\\", "\\\\"), t, count=1)
    page.write_text(t, encoding="utf-8")


def main(argv):
    root = pathlib.Path(argv[1])
    pages = sorted(root.rglob("index.html"))
    for p in pages:
        mark(p)
    print(f"marked {len(pages)} pages in {root}")


if __name__ == "__main__":
    main(sys.argv)
