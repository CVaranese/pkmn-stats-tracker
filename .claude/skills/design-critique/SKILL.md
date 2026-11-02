---
name: design-critique
description: Critique a site view from screenshots against docs/STYLE.md - what a player sees first, hierarchy, consistency with the site's controls and rules, wording, phones - fix the clear breaches and leave only taste questions for the user. Use after a UI change and before adding its docs/REVIEW_QUEUE.md item, or when the user asks "how does this look?" / "review this design" / "critique this tab".
---

# Design critique

Adapted from Anthropic's `design` plugin (`design-critique` and `ux-copy`, github.com/anthropics/knowledge-work-plugins,
Apache-2.0), rewritten for this site. The aim is a shorter review queue: everything a rule decides gets fixed here,
and only what needs the user's eye goes to `docs/REVIEW_QUEUE.md`.

## 1. Screenshots (the `screenshot` skill)
Dark and light of the view, plus the phone frame (`-Page tests/phone.html -Query "w=360&..."`). For a new control,
also `tests/style.html` next to its neighbours. Read each PNG once; crop to the part that changed.

## 2. Look, in this order
1. **First look**: what draws the eye? It should be what a player opens this view for (STYLE.md: layout follows the
   content, not a dashboard template). Is the view's purpose clear without reading the hint?
2. **Hierarchy**: one reading order; section titles (`h2.section-title`) above their content; numbers in tables or
   number-over-label stats; nothing competing with the one `--accent` highlight.
3. **Consistency with STYLE.md**: the existing control used (button / small / primary, tabs vs sub-tabs vs player
   picker, badge, table in `.table-wrap`), tokens only, sentence case, square-ish corners (no pills), no emoji, no
   gradients / glass / shadows, no decorative stat tiles, no new decoration without asking.
4. **Wording**: plain and in the league's own words, no hero copy; a button says what pressing it does ("Show results"
   / "Hide results"); an empty state says what's missing and how it fills ("No games for Week 9 yet"); an error says
   what happened and what to do; the same thing has the same name on every tab.
5. **Phones**: the same view at 360px: stacks rather than scrolls sideways, tap targets, nothing only in a tooltip.
   Contrast and the rest of accessibility: the `accessibility-review` skill.

## 3. Act
- A clear breach of a STYLE.md rule: fix it in the same change, retake the shot.
- Taste (does this read well, is this the right place, is the wording right): don't decide it. Put it in the review
  queue item as a concrete question with the screenshot's view ("Is 'Not played' clear next to a 2-0 set?").

## Report
```
Design critique: <view>, <themes / widths>
First look: <what the eye lands on, and whether that's right>
| Finding | Where | Rule or reason | Fixed? |
Works well: <one or two things worth keeping>
For the user: <the taste questions, also in REVIEW_QUEUE.md>
```
