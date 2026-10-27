# Style guide

The look comes from the league banner (`site/img/pinecord-banner.webp`): mint tiles, cream porcelain, black pixel
outlines, a striped floor. Everything is in `site/style.css`. **`tests/style.html`** shows every control below with
the real stylesheet; screenshot it (both themes) next to any new control before calling a UI change done.

## Colours (tokens on `:root`, redefined for dark mode)
| Token | Use |
|---|---|
| `--bg` | the main panel (cream / dark green) |
| `--surface` | inputs, buttons, tables, cards: anything sitting on the panel |
| `--text`, `--muted` | body text; secondary text, hints, labels under numbers |
| `--border` | thin 1px lines: inputs, buttons, table rows |
| `--outline` | the thick black "pixel" outline: 2–3px on panels, tables, cards, the selected main tab |
| `--accent`, `--accent-text` | the one highlight colour: primary button, selected sub-tab, Won badge, links, MVP label |
| `--row-alt` | every other table row, sprite backgrounds |
| `--band` | full-width bands that set a block apart (team summary, team totals) |
| `--porcelain` | the urinal colour; Z-move tag only |
| `--wall` | the tiled background behind the panel |
| `--error`, `--error-bg` | error lists and bad statuses only |

No new colours outside these tokens. Mega tag black (`#1c1c1a`), Z tag porcelain: those are the only fixed colours.

## Controls (use these; add a new one only when none fits, and add it to `tests/style.html`)
- **Button**: plain `button` (surface, 1px border, 6px radius). `button.primary` once per form, for the main action
  (Get stats). `button.small` for secondary actions in toolbars and table rows (Stats, Watch, Close).
- **On/off option**: a button whose label says what pressing it does next ("Show results" / "Hide results",
  "Hide links and sheets" / "Show links and sheets"), with `aria-pressed`. No checkboxes, switches or sliders.
- **Main tabs** (`.modes`): one row under the header, the selected tab outlined in `--outline` and joined to the
  panel. For whole views only (One game, Games, Playoffs, Gambling).
- **Sub-tabs** (`.tabs`): small joined buttons, selected one filled with `--accent`. For switching a table's view.
- **Select**: plain `select` inside `label.inline` ("Player [Everyone ▾]").
- **Table**: inside `.table-wrap` (2px outline, 8px radius), striped rows, numbers right-aligned in tabular figures,
  sortable headers with ▲▼, `title` on headers for explanations.
- **Badge**: `.badge` (Lost) / `.badge.win` (Won): small, square-ish (3px radius), next to a name.
- **Mega / Z tag**: `.mark.mega`, `.mark.z`, on the bottom edge of a sprite.
- **Sprites**: `sprite(name, folders, size)` in app.js; sizes `tiny` 40px (lists), `small` 52px (team strip),
  `big` 96px (MVP). Pixel art stays pixelated (`image-rendering: pixelated`); never stretch or blur it.
- **Luck**: the die (1–5 pips) plus a word, never a number alone.
- **Sections**: `h2.section-title` (18px). Collapsible extras are `details` with a bold `summary`.
- **Notes**: `.hint` for help text (muted, 14px, max 80 characters wide); `.errors` / `.warnings` lists.

## Rules
- No browser-default controls: every input must look like the ones above in both themes.
- Words in sentence case. No uppercase letter-spaced mini labels.
- No pill-shaped badges (fully rounded); badges and tags keep small square-ish corners.
- No emoji, no icon fonts for decoration. Symbols only where they carry meaning (▲▼ sort, the luck die).
- No gradients or blurred colour blobs, no glassy / frosted cards, no drop shadows for depth: depth comes from the
  black outline and the bands, like the banner.
- No grid of "stat tiles" as decoration: numbers go in tables, or in the team cards' plain number-over-label stats.
- No generic hero copy ("Unlock insights…"): say plainly what the page does, in the league's own words.
- Layout follows the content (what a player wants to see first), not a dashboard template.
- Reuse an existing class before adding one; a new class reuses the tokens.
- Ask the user before adding decoration (borders, ornaments, animations) that carries no information.
- Every UI change: screenshot dark and light (`screenshot` skill, `-Theme light`) and look at both before sending.
