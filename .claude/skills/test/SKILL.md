---
name: test
description: Run the parser / site test page (tests/index.html) headless in Edge and report PASS, FAIL with the failing tests, or CRASH. Use after any change to site/*.js or tests/, and before committing.
---

# Run the tests

```
& .claude/skills/test/run-tests.ps1
```

It starts the local server if needed. First line is the page title (`PASS`, `FAIL (n)`, `CRASH`), then the
"n/m passed" count, then each failing test with its detail.

- Report the result with the count, e.g. "Tests: PASS 212/212".
- On FAIL: read the failing test in `tests/tests.js` and the code it covers before changing anything. Never change
  an expected value to make a test pass unless the user agrees the old expectation was wrong.
- "NO TITLE" means the page didn't load: check the server answers on 8765.
- "library snapshot" FAIL: a saved league game counts differently than when `tests/snapshot.json` was written.
  If it comes from a rule change the user agreed to, check a few of the listed numbers against the replay, then
  `& .claude/skills/test/write-snapshot.ps1` and show the user `git diff tests/snapshot.json` before committing.
  Otherwise it's a bug. Games added since the snapshot don't fail; the add-game skill rewrites it.
