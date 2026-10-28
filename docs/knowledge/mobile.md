# Mobile web standards (phone use of the site)

The league mostly opens the site on phones (iPhone Safari at least). Standards to check UI changes against:

- **Researched** (WCAG 2.2, 2.5.8 Target Size Minimum): tap targets at least 24 × 24 CSS px, or spaced so a 24 px
  circle around each doesn't touch another; links inside a sentence are exempt.
- **Researched** (web.dev "Accessible tap targets"): aim for about 48 × 48 px, with about 8 px between targets.
  Apple's HIG says 44 × 44 pt (from memory; the HIG page didn't load as text).
- **Researched** (WCAG 2.2, 1.4.10 Reflow): everything works at 320 CSS px wide with no sideways scrolling, except
  data tables (which may scroll inside their box); headings, inputs and buttons around them are not exempt.
- **Researched** (MDN `@media (hover)`): phones can't hover. Never put information only in a hover tooltip
  (`title`); put hover styles under `@media (hover: hover)` so they don't "stick" after a tap.
- **Researched** (widely known WebKit behaviour, no official doc found): iPhone Safari zooms the page when you tap
  into an input, textarea or select whose font size is under 16 px. Fix by using 16 px on phones, not by
  blocking zoom (`user-scalable=no` breaks accessibility).
- **Tested**: headless Edge won't make a window narrower than about 500 px, so screenshots can't show a true phone
  width. Phone checks go on docs/REVIEW_QUEUE.md.

## Audit 2026-10-27 (site/style.css, site/index.html)
Already fine: viewport meta (`width=device-width, initial-scale=1`, zoom allowed), header stacks under 600 px,
tables scroll inside `.table-wrap`, `theme-color`, focus outlines.
Found (sizes worked out from the CSS, not measured on a phone):
1. Inputs 13 px, selects 15 px → iPhone zooms when tapping the replay link, team sheet or the filters.
2. Small buttons (Watch, Stats, Copy YouTube title…) ≈ 29 px tall, regular buttons ≈ 38 px, `details` summaries
   (Bracket, Team sheets, How each column is counted, Watch the battle) ≈ 22 px tall: under 44–48, the summaries
   under WCAG's 24.
3. Hover-only info: column explanations (`th[title]`), luck score number, Performance breakdown, move-list help,
   sprite names. Invisible on phones.
4. Sticky hover styles on buttons, sprite slots and game rows (no `@media (hover: hover)`).
5. Main tabs need ≈ 425 px; at 320–375 px they wrap ("One game" on two lines) or overflow.
6. Games list: two teams of six 40 px sprites side by side ≈ 520 px before date / note / buttons, so the row
   scrolls sideways and Watch / Stats are off screen.
7. Team card move rows: fixed columns leave the move name ≈ 20 px at 320 px and ≈ 90 px at 390 px.
Fixed the same day (CSS under `max-width: 600px`, `pointer: coarse` and `hover: hover`; the tap tip in app/core.js):
all 7, with the tab row at 14px / 8px padding (≈ 300px wide, so 320px is borderline). Not seen on a real phone yet.
Not checked: Copy for Google Sheets / Copy share link (clipboard) and Download CSV on iPhone Safari.
