---
name: accessibility-review
description: Check a site change (or a whole tab) for accessibility against docs/STYLE.md and WCAG 2.1 AA - contrast in every theme, phones (tap size, no title-only info, 320px), keyboard and screen-reader basics - and report what fails, what passes and what wasn't checked. Use before a site/*.html|css|js UI change goes on the review queue, after adding a control, or when the user asks "is this accessible?" / "check a11y".
---

# Accessibility review

Adapted from Anthropic's `design` plugin (`accessibility-review`, github.com/anthropics/knowledge-work-plugins,
Apache-2.0), rewritten for this site: its rules are in `docs/STYLE.md` (Colours, Controls, Phones), so check against
those first and WCAG where STYLE.md says nothing.

Scope: the changed files (`git diff next --stat -- site/`), or the tab the user names.

## 1. Contrast (a script: numbers, not eyeballing)
- `python -I tests/test_style.py` must say OK. It checks text / muted / accent on bg, surface, row-alt and band,
  accent-text on accent, errors, the outline and the type chips, in every theme (three palettes and each league's
  theme.css, light and dark), plus no colour written outside the tokens.
- `python -I tests/test_style.py --table` gives every ratio. A new colour pairing the test doesn't cover (a token used
  as text on a new background): add it to `PAIRS` there, don't judge it by eye.
- A miss is a finding for the user. Don't retune a palette colour or add to `KNOWN` without asking.

## 2. Static checks (grep / read the changed code)
| Check | Rule |
|---|---|
| Information only in `title` or on hover | STYLE.md Phones: titles short, the same thing visible or in the tap tip; hover styles inside `@media (hover: hover)` |
| Tap targets | 44px tall under `@media (pointer: coarse)`, small buttons 40px |
| Inputs | font `--fs-input` (16px+); every input / select has a visible label (`label.inline`) |
| On/off buttons, tabs, selected rows | `aria-pressed`, `aria-current`; label says what pressing does next |
| Clickable text that isn't a link | a `button` (`button.cell-btn`), never a `div` / `td` with a click handler |
| Focus | the focus ring is never removed (`outline: none` without a replacement) |
| Colour as the only difference | lines, badges, states also differ by text, shape or dash (STYLE.md line chart) |
| Images | sprites and banners have `alt` (the Pokémon's / league's name); decorative ones `alt=""` |
| Live updates | text that changes after a click (status, results) sits in an `aria-live` region |

## 3. Look at it (the `screenshot` skill)
- Dark and light (`-Theme light`), and a palette (`-Query palette=venusaur`) when the change touches colour.
- Phone: `-Page tests/phone.html -Query "w=320&league=ppppp&tab=..."`: nothing cut off or scrolling sideways
  outside `.table-wrap` (WCAG reflow; 320px is also roughly the page at 400% zoom).
- Read each PNG once, cropped to the change.

## 4. What this can't check
Headless Edge has no keyboard, hover, taps or screen reader. Tab order, focus traps, what a screen reader says and
how a tap feels go on `docs/REVIEW_QUEUE.md` (or to Claude in Chrome for keyboard, if connected), never "passed".

## Report
```
Accessibility: <scope>, <themes / widths checked>
| Finding | Where | Rule (STYLE.md / WCAG x.x.x) | Severity | Fix |
Passed: <checks that passed, one line>
Not checked: <keyboard / screen reader / ... and where it went>
```
Severity: blocks use (can't read, can't reach, can't tap) > harder than it should be > polish. Fix clear breaches of
STYLE.md in the same change; anything that changes the look or a palette, ask first.
