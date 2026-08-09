# Browser tests

Six Playwright suites that drive the real game in a real browser — 111 checks
across boot, the mobile HUD, the assist system, costumes, PvE and sprites.

These are **developer tests only**. The game itself still needs no npm, no build
step and no dependencies; nothing here is shipped or loaded by the game.

## Running them

```bash
npm install -D playwright        # only for these tests
npx playwright install chromium

node tests/browser/serve.js &    # serves the repo as a GitHub Pages project site
node tests/browser/browser-test.mjs
node tests/browser/hud.mjs
node tests/browser/assist.mjs
node tests/browser/costume.mjs
node tests/browser/pve.mjs
node tests/browser/sprite2.mjs
```

`serve.js` mimics a GitHub Pages **project** site: everything is served under
`/Ninja-Universe-Fighters/`, so an absolute-root path that would 404 in
production fails here too.

Environment variables, all optional:

| | |
|---|---|
| `NUF_TEST_PORT` | server port (default 8099) |
| `NUF_TEST_OUT` | where screenshots land (default `tests/browser/output/`, git-ignored) |
| `NUF_CHROMIUM` | explicit Chromium binary, for sandboxes that pre-install one |

## Writing a stable test here

The AI opponent fights for real for the whole run. By the time a later test
executes, a round may have been taken and the match may be sitting in a round
transition or the next round's intro — and during those phases the engine
deliberately refuses to advance a fighter's action and re-centres the camera.

Two rules follow, and both were learned by debugging real flakes:

1. **Get to a known state first.** Call `readyForFight(page)` before asserting
   on combat. It heals both fighters and polls for the fight phase. Polling for
   a condition is a race; `waitForTimeout` is a guess.
2. **Never assert on a transient.** The camera lerps at `dt * 7.5`, so it needs
   40–60 frames to close a large gap and how far it has to travel depends on
   what ran before. Step until the thing you care about is true, with a budget,
   and fail if the budget runs out — do not step a fixed count and hope.

If a test goes intermittent, find the state that differs between runs. Do not
loosen the assertion: the assertion is usually right and the setup is usually
wrong.
