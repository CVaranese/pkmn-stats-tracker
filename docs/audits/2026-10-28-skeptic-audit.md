# Skeptic's audit, 2026-10-28

A second reviewer, against `main` at `a1ea026`. I don't take the first audit (`2026-10-28-audit.md`) on trust. That
audit checked whether the **numbers** add up, and they do: I re-ran `tests/audit.html` (374 kills + 3 self-KOs =
377 deaths, 45 games, 514 brought) and the test page (229/229 PASS). It didn't look at whether the **code** is
something you can keep changing safely. That's what this audit covers.

Severity: **high** = can give wrong numbers or lose data now, or blocks a group of users. **medium** = makes the
next bug likely or hides it. **low** = cleanup.

Method: I read `site/app.js`, `site/parser.js` (structure, loaders, output), `bet.js`, the loaders in `teams.js` /
`luck.js` / `illusion.js`, and `tests/audit.html`. A second pass covered `tools/*.py`, `index.html`, `watch.html`,
`style.css` and `tests/tests.js`. I checked its main claims myself (marked *checked*). Anything I didn't check in
the code is marked *guess*.

## A. Structure and state

**S1. `parseBattle` is one 740-line function with ~45 mutable locals.** `parser.js:145-885`. The main loop
(`parser.js:431-797`) is a single if / else-if chain with 75 `cmd === "…"` comparisons, and its state lives in maps
declared at `parser.js:149-230` (`statusSrc`, `effectSrc`, `lastOppHit`, `pendingKo`, `hazardSrc`, `delayedSrc`,
`healWishSrc`, `statusOf`, `itemOf`, `abilityOf`, `sleepOf`…). No object owns any of that state's lifetime, so
nothing ever clears it. The first audit's #1 is a direct result: `effectSrc` gets set at `parser.js:671` and is never
deleted anywhere (*checked*: the only writes are 332, 337 and 671, all `set` / `moveKey`). *Why it matters:* every new
kill rule goes into the same function, next to state it can silently reuse. *Severity:* high (for maintainability:
229 tests cover the behaviour today). *Fix:* no rewrite. Do it step by step: (1) give each Pokémon one state record,
`monState(key)` = `{status, statusSrc, item, ability, sleep, effects}`, and clear `effects` when the effect ends or
the Pokémon faints. (2) Move one `cmd` group at a time into a `HANDLERS` table (`HANDLERS["-damage"] = (parts, tags)
=> …`), with the tests run after each move.

**S2. `app.js` is a 1613-line IIFE with ~20 module-level `let`s, and its caches are cleared by hand.**
`rows`, `view`, `sort`, `mode`, `library`, `fantasyRows`, `draft`, `leagueRows`, `players`, `mons`, `mockPool`,
`watching`, `watchId`, `detailed`, `showResults`, `playerPicked`, `monPicked`… any function can reassign any of
them. Clearing the derived caches is spread out: `pickZoroark` (`app.js:341-349`) nulls four caches by name. The
first review's finding #1 was one of those caches being forgotten. *Severity:* medium. *Fix:* (1) add one
`invalidateLeague()` that resets every cache built from the library, and call it from `pickZoroark` and anywhere
else that changes picks or the draft. (2) Split `app.js` by tab into plain script files (`games.js`, `players.js`,
`mons.js`, `gambling.js`, `main.js`) that share one small `App` object. No build step is needed: they're `<script>`
tags, as today.

**S3. Startup code runs from the middle of the file, before ~700 lines of declarations.** `app.js:858-874`
(`setMode(...)` at 873) runs while `LEAGUE_TAGS` (1057), `LUCK_STEPS` (1088), `detailed` (1213), `MOCK_SHEETS`
(1408) and `mockSheets` (1422) are still in their temporal dead zone. It only works because every path from
`setMode` hits an `await` first (`run` 877, `renderGambling` 465, `renderPlayers` / `renderMons` through
`loadLeague` 437; *checked*). `var TOUCH` at `app.js:1583` is the workaround, and its comment says why: "var:
render() may run before this line". *Severity:* medium (a synchronous call added to `setMode` throws a
ReferenceError at load). *Fix:* move lines 858-874 to the end of the IIFE and make `TOUCH` a `const`.

**S4. Seven hand-written "load once" caches behave four different ways.**

| Loader | On failure |
|---|---|
| `libraryReady`, `app.js:182` | empty library for the visit, default HTTP cache |
| `loadDraft`, `app.js:421` | `draft = null` cached for the visit (first audit #11) |
| `loadMockPool`, `app.js:1423` | caches the result, not the promise: two calls at once both fetch and both push into `mockSheets` |
| `TS.loadSmogonHp`, `teams.js:210` | `null` cached for the visit |
| `TS.loadDex`, `LK.load`, `Illusion.loadLearnsets` | retried on the next run |

*Why it matters:* whether one network blip costs a reload depends on which loader it hit. *Severity:* medium.
*Effect of the `loadMockPool` race:* a guess. Duplicate entries in `mockSheets` give `TS.attachSheets` the same
sheet twice; I didn't confirm whether that changes a row. *Fix:* one `once(fn)` helper (in `parser.js`, next to
`fetchChecked`) that caches the promise and drops it on failure. Use it for all seven.

## B. Duplication, hard-coded data, drift

**S5. The same identity rules are written in several places.** There are five copies of `toID`: `bet.js:5`,
`illusion.js:20`, `luck.js:25`, `app.js:1240` (`moveList`'s `key`) and `parser.js:89-91` (`norm`). Draft-alias
resolution is written twice: `bet.js:29-30` (`drafted`) and `app.js:1463-1466` (`playerKey`), plus `shownName` at
`app.js:522-526`. The first audit's #3 (Gambling splits DEJIME17 / DEJIME) comes from this: `Bet.fantasy` and
`Bet.records` never got the alias rule that `app.js` has. *Severity:* medium. *Fix:* export
`Bet.playerKey(draft, name)` and use it in `bet.js` and `app.js`. Take `toID` from `TeamSheets`; `luck.js:302`
already reaches into `ReplayStats` the same way.

**S6. The tooltips hard-code numbers that already live in data files.** The draft costs ("OU 7, UUBL 6, UU 5…")
are typed out at `app.js:482-483` and `app.js:491`, while `games/draft.json` has a `costs` object that `bet.js:75`
reads. The scoring ("3 a KO, 1 per 100% damage, 1 for each game…") is typed out at `app.js:495`, while three lines
up (`app.js:481`) the same sentence is built from `Bet.SCORING`. *Why it matters:* change a cost or a weight and
the Gambling tab explains the old one. *Severity:* medium. *Fix:* build both strings from `draft.costs` and
`Bet.SCORING`.

**S7. The audit page has its own copy of site logic, so it can agree with itself while the site differs.**
`tests/audit.html:21-33` repeats the order in which `prepareIllusion` (`app.js:322-339`) applies picks: library
picks, else the stays it can prove. The copy leaves out the admin's local picks. It also has dead code:
`audit.html:53` `if (end === "normal" && !won && rows[0].teamsize && 0) {}` never runs. And it can't fail: the title
is always `DONE`, and the output has to be read by eye. *Severity:* medium. *Fix:* move "which stays count as
Zoroark" into `illusion.js` (`Illusion.picks(battle, libraryPicks, learn, dex)`) and call it from both places.
Delete line 53. Turn the three exact invariants (kills + self-KOs = deaths, winner / turns match `index.json`,
one MVP per team) into a `PASS` / `FAIL (n)` title, and run the page from the `add-game` skill after each new game.

**S8. The "expected, not bugs" list hides a data error.** The first audit puts every "taken > 100% + healed" line
down to Regenerator. One of them doesn't fit: `video-cklxgwzl3hm` (Week 5 FingerStripes v PeterPikmon),
"Samurott-Hisui: taken 125". Samurott-Hisui doesn't have Regenerator. The log shows it leaving at `75/100` (turn 8,
after poison) and switching back in at `100/100` on turn 10 (`|switch|p2a: Mr Goon|Samurott-Hisui|100/100`), with
no heal in between. That's a misread switch-in HP from the stream video. The game has no `known_errors` entry
(*checked*). *Severity:* medium (one game's numbers are off with no warning, and the list of exceptions is a
by-hand allow-list where the next misread will hide too). *Fix:* add it to `known_errors`. In the audit, flag any
switch-in whose HP is above the HP it last left with, unless there's a heal line between or the Pokémon has
Regenerator (then allow up to +34).

**S9. Data is hard-coded in code.** `MOCK_SHEETS` (`app.js:1408-1419`, first audit #12), `LEAGUE_TAGS`
(`app.js:1057`), the Challonge URL (`app.js:800`), the `SLUG` in `tools/challonge_records.py`, and the 300 HP
fallback in `app.js:687` (`: 300`, with no comment). *Severity:* low (one league, one season). I'd rate the first
audit's #12 a step higher than it did: a new sheet should be a file added under `site/mock/` plus an `index.json`
field (`sheets: ["doxsego"]`), not a code edit. *Fix:* move the sheet list and the league tag into `index.json`
(`league_tag`, per-game `sheets`), and put the Challonge URL in `records.json`.

## C. Error handling and async

**S10. Swallowed errors that change numbers without telling anyone.**
- `app.js:919` `prepareIllusion(r).catch(() => {})`: if it throws, `replay.illusion` is never set, so the admin's
  `index.json` picks aren't applied and a hidden Zoroark's KOs go to the Pokémon it copied. No notice is shown.
- `app.js:445` `catch (e) { return []; }`: a game drops out of the season totals. The status line does say "Counted
  n of m", so this one is half-reported.
- `app.js:1434` and `app.js:1484`: a missing `site/mock/*.txt` silently falls back to guessed max HP.
- `app.js:329`: learnsets that fail to load mean fewer Zoroark checks, silently.

*Severity:* medium. *Fix:* push a line to `errors` / the status for each of them ("Hidden Zoroark check failed for
<id>: <message>"). The `catch` that only means "storage blocked" is fine as it is.

**S11. `run()` has no `try / finally`.** `app.js:885` disables the Run button and `app.js:939` enables it again.
Anything that throws in between (`addMockSheets`, `applySheets`, `megaNames`, `renderZoroarks`) leaves the button
disabled until a reload. The first audit's #2 (runs not serialized) is the same function. *Severity:* medium.
*Fix:* a run counter (`const my = ++runSeq; … if (my !== runSeq) return;` before each render) plus `try { … }
finally { $("run").disabled = false; }`.

**S12. The fetch timeout only covers the headers.** `parser.js:1122-1125` races `fetchFn(url)` against the timer,
and `finally` clears the timer. `resp.json()` (`parser.js:1152`, `teams.js:201`, `luck.js:309`) then reads the body
with no limit. A server that sends headers and then stalls hangs that worker, and through S11 the Run button too.
*Severity:* low (*guess* on how often that happens). *Fix:* keep the timer running until the body is read: return
`await resp.json()` inside `fetchOnce`'s try, or abort in a `finally` after the read.

## D. Testability and tests

**S13. None of `app.js` is tested, and some of its logic is pure.** `tests/index.html` doesn't load `app.js`. Pure
or nearly pure functions trapped in the IIFE: `spriteId` (958), `navUrl` (157), `currentTable`'s column and sort
rules (1278-1314), `fillMaxHp` (1441), `playerKey` / `shownName`, `seasonMoves` (647), `dealtKey` (666),
`rowsDealt` / `amountStat` / `dealtText` (the four HP-or-% formatters, first audit #15), `megaNames`' ordering rule
(first audit #9). *Severity:* medium. *Fix:* move them into a no-DOM `league.js` (the same pattern as `bet.js`) and
test them. That also makes S2 smaller.

**S14. Coverage holes in the no-DOM modules.** *Checked* by grep in `tests.js`: `Luck.scoreGame` and
`Luck.topContributors` are only reached through `addLuck` (`luck.js:283`, `294`), with synthetic move data. No
real-replay luck expectation exists. `TS.toID` has no direct test. `TS.loadSmogonHp` / `TS.loadDex` failure paths
aren't tested (`fetchReplay`'s are, `tests.js:1176-1190`). There are no Python tests for `tools/`.
`test_replay_stats.py` only covers the old CLI. *Severity:* low. *Fix:* one real fixture with a hand-checked luck
total; unit tests for `add_game.replay_id` / `summary` (both pure).

## E. Accessibility

**S15. Players and Pokémon rows and every sortable header work with a mouse only.** `app.js:573-577` (Players
rows), `app.js:710-716` (Pokémon rows), `app.js:626-637` (`sortableTable` headers) and `app.js:1333` (results table
headers) all put `click` listeners on `<tr>` / `<th>`, with no `tabindex`, no button and no key handler (*checked*:
the only `keydown` in `app.js` is on `#one-link`). Keyboard users can't sort a table or open a player or Pokémon.
`aria-selected` on a plain `<tr>` (`app.js:587`, `714`) isn't announced. (The Games rows are fine: they hold real
Watch / Stats buttons.) *Severity:* high. *Fix:* put a `<button>` inside each header cell and in each row's name
cell, keep the row click as a shortcut, and use `aria-current` instead of `aria-selected`.

**S16. The tabs use the ARIA tab roles without the tab behaviour.** `index.html:33-39` and `index.html:171-173`
use `role="tablist"` / `role="tab"` with no `tabpanel`, no `aria-controls` and no arrow keys. A screen reader
announces "tab, 1 of 6" and then arrow keys do nothing. *Severity:* low. *Fix:* the cheaper option: drop the roles
and use `aria-current="page"` on plain buttons.

## F. Security

**S17. The first audit's #5 (CSV formulas) is rated right but scoped wrong.** The path the league actually uses is
**Copy for Sheets** (TSV, `app.js:1370` → `parser.js:1078`), and that path doesn't escape either. Showdown
nicknames are capped at 18 characters (*researched*, from memory of the client's limit; not re-checked today),
which limits what a formula can do. `=IMAGE("a.co/x")` still fits and calls out when the sheet opens. The more
likely failure is plain breakage: a nickname like `+2 Atk` or `-Kai-` becomes `#ERROR!`. *Severity:* medium. *Fix:*
in `toDelimited`, prefix a `'` to any cell starting with `= + - @` (tab or CR too), for both separators.

**S18. Third-party code and frames run with the site's privileges.** `watch.html:23` loads
`https://play.pokemonshowdown.com/js/replay-embed.js` unpinned and without SRI, on the site's own origin, where
`localStorage` holds saved sheets and links. The Challonge and YouTube iframes (`index.html:93`, `102`, `143`) have
no `sandbox` or `referrerpolicy`. *Severity:* low (Showdown is the trusted source for replays anyway, and nothing
secret is stored). *Fix:* `referrerpolicy="no-referrer"` and `loading="lazy"` on the three frames, plus `sandbox`
on the Challonge frame. Leave watch.html as it is, but write the risk down.

*Checked and fine:* `innerHTML` appears once (`app.js:1105`) and only takes numbers from `PIPS`. `replay_url` hrefs
are `REPLAY_HOST + id` or the library's own `video` field (`parser.js:928`). `watch.html` validates `?id=` before
building URLs. Replay ids can't escape their folder in `add_game.py` (regex-checked).

## G. Python tools

**S19. Writes to `site/games/index.json` aren't atomic.** `tools/add_game.py:117`, `tools/set_illusion.py:26`
(`INDEX.write_text(...)`), and the replay copies at `add_game.py:94`, `:100` (*checked*). A crash or Ctrl-C midway
leaves a truncated library. A half-written replay copy is then trusted on the next run. *Severity:* medium. *Fix:* a
shared `tools/common.py` with `write_atomic(path, text)` (write `.tmp`, then `os.replace`) and
`load_index()` / `save_index()`. Both scripts repeat the index path and dump format today.

**S20. `add_game.py` keeps relabelled fields through an allow-list.** On relabel it carries over
`("illusion", "known_errors", "note_detail")` only. Any field added later is dropped without a word.
*Severity:* medium. *Fix:* keep every existing key that the new entry doesn't set.

**S21. `add_game.py`'s fetch falls back to a saved copy on any `URLError`, 404 included.** `add_game.py:45`. A
deleted replay can be replaced by an old fixture, and the message blames Showdown. *Severity:* low. *Fix:* check
`HTTPError` first, and fall back only on network errors and 5xx.

**S22. Smaller tool issues.** `challonge_records.py:22` puts the API key in the URL (a traceback can print it),
and `:33` raises KeyError on a bye (`loser_id` null). `video_to_replay.py:254` uses `urlretrieve`, which has no
timeout. `set_illusion.py:23` has no input checks (`1,,3` gives a traceback, `0` is accepted). File handles are left
open in `video_to_replay.py:39`, `:284`. *Severity:* low. *Fix:* as listed. Key in a header, `rec.get`,
`urlopen(timeout=60)`, validate `n >= 1`, use `with` / `read_text`.

## Where I disagree with the first audit's ratings

| First audit | Its call | Mine |
|---|---|---|
| §3 #1 `effectSrc` | correctness, fix | Agree, and it's a symptom of S1. Fix the state ownership, not only this map. |
| §3 #2 `run()` race | correctness | Agree. Fix it together with S11 (same function, one change). |
| §3 #3 Gambling aliases | correctness | It's S5. Fix the shared helper, not one more copy in `bet.js`. |
| §3 #5 CSV | security | Medium, and the TSV path too (S17). |
| §3 #12 `MOCK_SHEETS` | altitude | One step higher (S9): it's data, and it's the only per-game data not in `index.json`. |
| §1 "Expected, not bugs" | Regenerator explains all | One isn't Regenerator (S8). |
| §2 #9 Mega naming order, skipped | skipped | Test it (S13). It's a rule about call order that nothing enforces. |
