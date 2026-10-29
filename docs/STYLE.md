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

- **League themes**: `style.css`'s `:root` is the default theme, for any league without its own: three palettes
  after starters on `html[data-palette]` (Blastoise = plain `:root`, Charizard, Venusaur; `PALETTES` in
  tools/build_pages.py), picked by the viewer with `.palette-pick` (one gen5 sprite button per palette, header top right, the picked one
  outlined in `--accent`; under the intro below 600px); a league's default is `palette` in
  `site/leagues.json`. Each sets every token light and dark, and `--stripe` is two of its colours. A league's own colours go in `site/<league>/theme.css` (named by `theme_css` in
  `site/leagues.json`), redefining the same tokens, light and dark; `--stripe` / `--stripe-box` are the line under the
  header and along the Gambling box. Pinecord's (`site/ppppp/theme.css`) is the banner's mint tiles and striped floor.
  Never use a colour in a rule that a theme can't change: add a token.

## Controls (use these; add a new one only when none fits, and add it to `tests/style.html`)
- **Button**: plain `button` (surface, 1px border, 6px radius). `button.primary` once per form, for the main action
  (Get stats). `button.small` for secondary actions in toolbars and table rows (Stats, Watch, Close).
- **On/off option**: a button whose label says what pressing it does next ("Show results" / "Hide results",
  "Hide links and sheets" / "Show links and sheets"), with `aria-pressed`. No checkboxes, switches or sliders.
- **Main tabs** (`.modes`): one row under the header, the selected tab outlined in `--outline` and joined to the
  panel. For whole views only (Main viewer, Games, Players, Pokémon, Draft, Fantasy, Gambling).
  On phones the same tabs in a row that scrolls sideways, never re-styled as boxes (user 2026-10-28: a 3 × 2 grid of
  boxed tabs looked "too standard and AI generated").
- **Sub-tabs** (`.tabs`): small joined buttons, selected one filled with `--accent`. For switching a table's view.
  Regular season / Playoffs / Both (`.tabs.stage-pick`) sits before each week picker.
- **Player picker** (`.draft-tabs`, Draft): separate buttons with a 6px gap, the picked one filled with `--accent`; they wrap on
  a computer and become one sideways-scrolling row on phones (faded on the right like the main tabs). Joined sub-tabs
  looked bad once they wrapped (user, 2026-10-28).
- **Select**: plain `select` inside `label.inline` ("Player [Everyone ▾]").
- **Table**: inside `.table-wrap` (2px outline, 8px radius), striped rows, numbers right-aligned in tabular figures,
  sortable headers with ▲▼, `title` on headers for explanations. A sortable header's label, and the first cell of a
  row that opens details below the table, sit in a `button.cell-btn` (looks like the text, focus ring for the
  keyboard); the selected row has `aria-current`.
- **Badge**: `.badge` (Lost) / `.badge.win` (Won): small, square-ish (3px radius), next to a name.
- **Mega / Z tag**: `.mark.mega`, `.mark.z`, on the bottom edge of a sprite.
- **Move type tag**: `.type-chip.t-<type>` before a move's name in move lists: the type's first three letters
  (FIR, WAT, DRA) on its colour (the games' usual colours, dark text except Fighting / Poison / Ghost / Dragon / Dark),
  a fixed width so names line up; then the plain name and a muted P / S / – (physical / special / status). The colour
  stays on the small tag only: a whole name on its type colour clashed (user, 2026-10-28).
- **Sprites**: `sprite(name, folders, size)` in app/core.js; sizes `tiny` 40px (lists), `small` 52px (team strip),
  `big` 96px (MVP). Pixel art stays pixelated (`image-rendering: pixelated`); never stretch or blur it.
- **Luck**: the die (1–5 pips) plus a word, never a number alone.
- **Line chart** (`.momentum`, Main viewer): a card like the team cards, a legend above (line samples + names), the
  chart drawn at its real pixel width (text stays 12px), the winner's line `--accent`, the other `--text` dashed (so
  colour is never the only difference), a readout line under it for the turn under the pointer (no hover-only info).
- **Name links** (`.season-link`): a player or Pokémon name that opens its season looks like the text around it with a faint
  underline in `--border` (so it reads as clickable on phones too), the accent on hover (user 2026-10-28: no blue underlined links for names). Real links (a replay,
  Challonge) stay link-styled.
- **Sections**: `h2.section-title` (18px). Collapsible extras are `details` with a bold `summary`.
- **Notes**: `.hint` for help text (muted, 14px, max 80 characters wide); `.errors` / `.warnings` lists.

## Phones (see docs/knowledge/mobile.md)
- Inputs, textareas and selects are 16px on phones (iPhone zooms in under that). Never block zoom.
- Tap targets 44px tall on touch screens (`@media (pointer: coarse)`), small buttons 40px.
- No information only in a `title`: phones show titles through the tap tip (`.tap-tip`), so keep titles short.
  Table headers: on touch screens the first tap shows the explanation, a second tap on the same header sorts.
- Hover styles go inside `@media (hover: hover)`.
- Anything in a row must still fit at 320px wide: stack it under `max-width: 600px` instead of scrolling sideways
  (only big data tables scroll, inside `.table-wrap`).

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
