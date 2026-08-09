# Ninja Universe Fighters

An offline-capable, installable, mobile-first 2D ninja arena fighting game.
Vanilla HTML, CSS and JavaScript — **no framework, no build step, no backend, no
account, no npm required to play**. Open the GitHub Pages link on a phone, add it
to the Home Screen, and it runs like a native app, including with no connection.

---

## Contents

- [Play it](#play-it)
- [Install on an iPhone](#install-on-an-iphone-safari)
- [Install on Android](#install-on-android-chrome)
- [Publishing it yourself](#publishing-it-yourself)
- [Updating an installed copy](#updating-an-installed-copy)
- [Clearing an old service-worker cache](#clearing-an-old-service-worker-cache)
- [What is in the game](#what-is-in-the-game)
- [Controls](#controls)
- [Project structure](#project-structure)
- [Development](#development)
- [MUGEN import and audit pipeline](#mugen-import-and-audit-pipeline)
- [Assets and legal notes](#assets-and-legal-notes)
- [Known limitations](#known-limitations)

---

## Play it

Once GitHub Pages is enabled (see below), the game lives at:

```
https://<your-github-username>.github.io/Ninja-Universe-Fighters/
```

The game is designed for **landscape**. Hold the phone sideways — if you hold it
upright, an animated rotate-device overlay appears until you turn it back.

---

## Install on an iPhone (Safari)

1. Open the GitHub Pages URL above **in Safari**. (Chrome on iOS cannot add web
   apps to the Home Screen; it must be Safari.)
2. Wait for the loading bar to finish. The status line at the bottom of the
   loading screen will say **Offline play ready** once the game has cached
   itself.
3. Tap the **Share** button — the square with an arrow pointing up, in the
   Safari toolbar.
4. Scroll down the share sheet and tap **Add to Home Screen**.
5. Confirm the name (**Ninja Fighters**) and tap **Add**.
6. Close Safari. Launch the game from its new icon on your Home Screen.

It now opens in standalone full-screen mode with no browser chrome, and it will
start even in Airplane Mode.

> **Tip:** turn off Portrait Orientation Lock in Control Centre, or the game
> will not be able to rotate into landscape.

## Install on Android (Chrome)

1. Open the GitHub Pages URL in Chrome.
2. Either tap the **Install app** button that appears in the top-right of the
   main menu, or open the ⋮ menu and choose **Install app** / **Add to Home
   screen**.
3. Launch it from the app drawer or Home Screen.

---

## Publishing it yourself

### 1. Get the files into a GitHub repository

If you already have this repository cloned:

```bash
git add .
git commit -m "Add Ninja Universe Fighters"
git push
```

If you are starting from a download, create a repository named
`Ninja-Universe-Fighters` on GitHub, then:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/Ninja-Universe-Fighters.git
git push -u origin main
```

There is no build step. The files in the repository root *are* the game.

### 2. Enable GitHub Pages

1. Go to your repository on github.com.
2. Click **Settings**.
3. In the left sidebar, click **Pages**.
4. Under **Build and deployment → Source**, choose **Deploy from a branch**.
5. Set **Branch** to `main` and the folder to `/ (root)`.
6. Click **Save**.
7. Wait a minute, then refresh. Pages will show the live URL at the top.

That URL is what you open in Safari in the steps above.

> **Why every path in this project is relative:** GitHub Pages serves project
> sites from a subdirectory (`/Ninja-Universe-Fighters/`), so an absolute path
> like `/css/main.css` would 404. Every reference in the HTML, CSS, JavaScript,
> manifest and service worker is relative (`./…`), and `tests/github-pages-paths.js`
> fails if that ever regresses.

---

## Updating an installed copy

When you push a new version:

1. Bump `APP_VERSION` in `js/constants.js` **and** `CACHE_VERSION` in
   `service-worker.js` to the same number. (A test enforces that they match.)
2. Commit and push. GitHub Pages redeploys automatically.

On the player's device:

- Open the installed app **while online**. The service worker fetches the new
  version in the background.
- An **"A new version is available"** banner appears at the top. Tap **Update
  now** — the app reloads into the new version.
- If you do not tap it, the update applies the next time the app is fully
  closed and reopened.

Saves are never touched by an update. The save format is versioned separately
and migrated forward (see [Development](#development)).

## Clearing an old service-worker cache

If an update does not appear, or something is behaving oddly after a deploy:

**From inside the game (easiest):**
Settings → **Save data** tab → **Clear offline cache** → reload the app.
This does not affect your save.

**From Safari on iOS:**
Settings app → Safari → Advanced → Website Data → find the site → swipe to
delete. Then delete the Home Screen icon and re-add it.

**From Chrome on desktop (for debugging):**
DevTools → Application → Service Workers → **Unregister**, then Application →
Storage → **Clear site data**.

---

## What is in the game

| | |
|---|---|
| Roster entries | **110** unique fighters, one card each |
| Hand-authored complete move sets | **20** |
| Abilities | **530** (362 hand-authored, 168 clearly-labelled archetype templates) |
| Mode | **Player vs AI** — single-player, offline, no PvP and no networking |
| Transformations | **239**, in linked chains with real activation requirements |
| Stages | **14**, each with day and night variants |
| Story chapters | **10** (original campaign, "The Severed Accord") |
| Challenge Tower floors | **100** |
| Arcade ladders / Boss Rushes | 4 / 4 |
| Assists | **110** — any roster fighter can be called as your assist |
| Summons | 24 named creatures, listed per fighter (not the assist system) |
| Achievements | 31 |
| Fighter sprite sets | **110** — one per fighter, 22 animations / 94 frames each |
| Costume sprite sets | **75** — every costume has its own art |
| Transformation sprite sets | **157** — every form has its own art |
| Total sprite sets | **342**, zero fallbacks |

### Roster

110 unique people, one card each. Alternate ages, titles, masked and Edo
versions, awakenings and the tailed beasts are **not** separate cards — they are
costumes (`js/data/costumes.js`) and transformations
(`js/data/transformations.js`) on the fighter they belong to, and every id the
old 192-entry roster used is redirected by `js/data/roster-migration.js` so an
existing save keeps its progress.

### The twenty fighters with complete, unique kits

Naruto Uzumaki · Sasuke Uchiha · Sakura Haruno · Kakashi Hatake · Rock Lee ·
Gaara · Itachi Uchiha · Pain · Madara Uchiha · Boruto Uzumaki · Kawaki ·
Momoshiki Otsutsuki · Minato Namikaze · Hashirama Senju · Might Guy ·
Killer Bee · Obito Uchiha · Jiraiya · Orochimaru · Tsunade

Each of these has individually authored frame data, damage, reach, movement
speed, a unique ground chain, air chain, heavy, launcher, dash attack, throw,
guard counter, two-to-three jutsu, an ultimate, a passive, a transformation
chain and a named AI personality. A test (`tests/ability-validation.js`) fails
if any of them silently falls back to a template, and another fails if any two
of them share a move-set fingerprint.

**Every other fighter is a prototype.** They have complete metadata,
transformations, unlock conditions, AI profiles, colours and roster positions,
but their moves come from an archetype template. The character-select screen
labels them **Prototype** on the card and in the detail sheet, and says so in
plain language. Nothing in this project claims 192 unique move sets.

### Modes

- **Story** — 10 chapters of an original campaign with dialogue scenes and
  battles, some under special rules.
- **Versus** — pick both fighters, the stage, AI difficulty, round count and
  timer.
- **Arcade** — four ladders (Classic, Akatsuki, Next Generation, Kage), each
  ending with a boss, with a continue system.
- **Survival** — endless waves, limited healing between fights, score and
  best-wave records.
- **Boss Rush** — four rushes (Tailed Beasts, Kage, Akatsuki, Otsutsuki).
- **Challenge Tower** — 100 floors with escalating special conditions (no chakra
  regeneration, substitution disabled, time attack, double damage, and so on).
- **Training** — infinite health/chakra/substitution toggles, five dummy
  behaviours, frame data, combo damage, input display and reset positions.
- **Collection / Achievements** — everything unlocked, plus titles.

### Combat systems

Movement, running, dash, back dash, air dash, jump, double jump, guard, guard
meter, guard damage, guard break, substitution (with stocks and chakra cost),
light and heavy chains, launchers, air combos, dash attacks, throws, guard
counters, two jutsu slots, ultimates with cut-ins, in-battle transformations,
assist calls, knockback, hit stun, block stun, hit stop, invulnerability frames,
armour, wall bounce, ground bounce, knockdown and wake-up invulnerability,
combo counter, damage scaling, hit-stun decay, a hard combo cap, chakra
regeneration and charging, cooldowns, round timer, multiple rounds, slow-motion
finishers, screen shake and damage numbers.

Infinite combos are prevented by four independent mechanisms: damage scaling,
hit-stun decay per hit, a hard hit cap that forces a knockdown, and one-per-combo
limits on wall and ground bounces.

### Transformations

Transformations happen **during** combat and are never duplicate roster cards.
Each form declares real requirements — awakening meter, chakra, a health
threshold, the previous form in the chain, once-per-match, and in some cases a
story or mastery unlock. Pressing the button is never sufficient on its own; the
game tells you exactly what is missing.

Example chains that ship: Naruto (One-Tail → Four-Tail → Sage → KCM → Avatar →
Six Paths → Baryon), Sasuke (Sharingan → Curse Mark 1/2 → Mangekyo → Eternal →
Rinnegan), Madara (Mangekyo → Eternal → Rinnegan → Six Paths → Ten-Tails →
Rinne Sharingan), Rock Lee (six gates), Might Guy (eight gates), Gaara (Sand
Armour → Partial → Full Shukaku), Boruto and Kawaki (Karma chains), plus Obito,
Killer Bee, Minato, Hashirama, Itachi, Pain, Sakura, Tsunade, Kakashi, Jiraiya,
Orochimaru, Momoshiki, Kabuto and Mitsuki.

### Assists

Before a match you pick a **second roster fighter as your assist**. Character
select has three slots — **Your Fighter**, **Assist**, **AI Opponent** — and the
assist picker offers the same 110 fighters, minus the one you are playing, since
nobody can assist themselves. (Allowing duplicates is a flag on
`canAssist()` / `eligibleAssists()`, off by default.) The assist may be the same
character as the AI opponent; they are separate instances.

This is still single-player PvE:

```
PLAYER: main fighter (you control)  +  assist (called, acts, leaves)
AI:     one opponent
```

The assist is **not Player 2**. It is not in `engine.fighters`, has no
controller, takes no hits and is not a target, so `assertPvE()` still counts
exactly one human and one AI. It is on screen only during a call: it enters,
performs one ability, and leaves.

Do not confuse this with **summons** (`js/data/summons.js`): Akamaru,
Gamabunta, Katsuyu and the rest are descriptive roster data listed on the
fighter detail sheet under `fighters[].summons`. They are not wired to the
CHAKRA button and are not the selectable assist.

Every fighter has an `assist` record in `js/data/fighter-assists.js` —
`abilityId`, `cooldown`, `duration`, `entryStyle`, `exitStyle`, `aiBehavior`
and `chakraCost`. The ability is one the fighter already owns, so nothing is
invented: Naruto's Rasengan, Sasuke's Chidori, Kakashi's Lightning Cutter,
Lee's Leaf Hurricane, Guy's Dynamic Entry, Pain's Almighty Push, Bee's Lariat,
Madara's Majestic Destroyer Flame, Minato's Flying Raijin, Hashirama's Wood
Dragon, Gaara's Sand Tsunami, Jiraiya's Toad Oil Flame Bullet, and so on. The
twenty hand-authored fighters name a signature technique each; the other ninety
use their own archetype template ability, which is a prototype assist and is
labelled as such in the data (`authored: false`).

Cooldowns run 10–15 s, varying per fighter. An assist cannot be called while
one is already out, while cooling down, without the chakra, or once the fighter
is down — and the HUD says which of those it is.

The assist draws with its **own sprite set and costume**, through the same
renderer the roster uses. It plays `assistEntry` / `assistAttack` /
`assistExit` where a sheet carries those clips and falls back to existing clips
where it does not, so no fighter needs new art to be callable. It does not
transform during its short appearance.

### AI

Five difficulties (Easy → Legendary) and 20 named personalities plus archetype
fallbacks. The AI **only reads state a human can see** — positions, health,
chakra, guard, live projectiles, and whether an attack is currently in its
start-up or recovery frames — and every decision passes through a per-difficulty
reaction delay before it can change behaviour. It never inspects the player's
input buffer. A test asserts this by scanning the controller's source.

---

## Controls

### Touch (primary)

An arcade layout, built for a phone held in landscape.

**Left thumb — four directional buttons**, not a joystick: **UP**, **DOWN**,
**LEFT**, **RIGHT** in a cross. There is no Jump button: UP *is* upward
movement, which in a side-view fighter means the jump, and it doubles as the
launcher modifier while held.

**Right thumb — five buttons**: **JUTSU** and **GUARD** on the upper row,
**CHAKRA**, **PUNCH** and **KICK** below.

**CHAKRA does two jobs**, so the assist needed no sixth circle: a **quick tap
calls your assist**, and **holding past 200 ms charges chakra**. The two are
mutually exclusive by construction — nothing happens on the way down, the
charge starts only when the timer fires, and the tap fires only if the finger
lifts before it. A quick tap can never visibly start charging, and a long hold
can never emit the tap afterwards. A small **assist portrait sits above the
CHAKRA button** with a cooldown sweep, a seconds countdown and a ready ring; it
takes no pointer events, so it cannot be mistaken for a button.

**Top-right corner, held apart from everything else**: **AWAKENING** and
**ULTIMATE**, so a special can never be caught while reaching for Punch. Each
shows its state honestly — a pulsing ring when it can fire, a cooldown sweep
while it recharges, and dimmed and *unpressable* when the requirement is not
met. A dimmed button does not register the touch at all, so it cannot be
activated early.

The HUD's fighter plate reads from the fighter actually in the match: portrait,
name, a large green health bar and the chakra bar under it, all following the
selected character and the costume they are wearing. The middle of the screen
is left clear.

Multi-touch is handled with pointer IDs — one pointer owns one button — so
holding RIGHT while tapping PUNCH, or LEFT while holding GUARD, works properly
and releasing one finger never drops another. Presses are buffered for ~0.22 s
so a tap made slightly early during recovery still comes out. The control layer
sets `touch-action: none` and cancels its pointer events, which stops scrolling,
pull-to-refresh, double-tap zoom, text selection and long-press menus inside
combat without affecting navigation anywhere else.

Contextual inputs, all reachable without extra buttons:
- Hold **toward the opponent** + **KICK** at close range → throw.
- Hold **UP** + attack → launcher.
- Double-tap **LEFT** or **RIGHT** → dash; attack during it → dash attack.
- Tap **GUARD** while being hit → substitution, if a stock is available.
- Tap **CHAKRA** → call your assist; hold it (grounded, not mid-attack) → charge
  chakra.
- The chip on the **JUTSU** button steps through the fighter's jutsu; the
  caption names the one that will fire.

Buttons are laid out inside the safe-area insets and clamped there, so nothing
reaches the notch, the Dynamic Island or the home indicator. Sizes scale with
viewport height between a 44 px minimum and a cap, so they stay thumb-sized on a
small phone without bloating on a large one.

Everything is customisable in Settings → Controls: size, opacity, per-button
placement (drag-and-drop editor), touch sensitivity, left-handed mirroring,
vibration, and reset to default.

### Keyboard (desktop testing)

| Action | Key |
|---|---|
| Move | `WASD` / arrows |
| Punch / Kick | `J` / `K` |
| Jutsu (selected slot) | `F` |
| Jutsu 1 / 2 / 3 | `U` / `I` / `Y` |
| Charge chakra | `C` |
| Call assist | `H` |
| Ultimate | `O` |
| Guard | `L` |
| Substitution | `;` |
| Awaken | `P` |
| Jump / Dash | `Space` / `Shift` |
| Pause | `Esc` |

Gamepads are polled with the standard mapping.

---

## Project structure

```
/
├── index.html                  screens, HUD, overlays
├── manifest.webmanifest        PWA manifest
├── service-worker.js           offline cache + update handling
├── package.json                only so Node can run tests/ as ES modules
├── css/                        main, loading, menus, roster, combat, controls,
│                               settings, mobile
├── js/
│   ├── boot.js                 loading screen + real init stages
│   ├── main.js                 app controller, routing, match flow
│   ├── constants.js            tuning values in one place
│   ├── screen-manager.js       screen stack + orientation overlay
│   ├── save-manager.js         slots, migrations, export/import, recovery
│   ├── settings-manager.js     settings + side effects
│   ├── audio-manager.js        synthesised SFX and generative music
│   ├── asset-loader.js         icon warm-up, sprite sets, portrait cache
│   ├── input-manager.js        abstract input + buffering + gamepad
│   ├── mobile-controls.js      multi-touch on-screen controls
│   ├── menu-background.js      animated parallax menu background
│   ├── data-validator.js       boot-time integrity checks
│   ├── *-manager.js            roster, progression, unlocks, achievements,
│   │                           story, arcade, survival, tower
│   ├── combat/                 engine, loop, fighter, hitboxes, projectiles,
│   │                           effects, camera, combo/guard/substitution/
│   │                           transformation/assist systems, AI, training,
│   │                           stage + fighter renderers, sprite animator
│   ├── data/                   fighters, roster-migration, costumes, abilities,
│   │                           transformations, fighter-assists (the selectable
│   │                           assist), summons, stages, story, arcade,
│   │                           achievements, unlocks, ai-profiles
│   └── ui/                     menu, select, stage, list, settings, layout
│                               editor, HUD, overlays
├── assets/icons/               generated PNG icon set + editable SVG master
├── assets/fighters/            one folder per fighter: sprite-sheet.png,
│                               portrait.png, fighter.json, plus manifest.json
├── assets/import-staging/      MUGEN import output — never the live art
├── imports/mugen/              drop zone for packages to inspect (git-ignored)
├── reports/                    generated audits, not read by the game
├── tools/mugen-import/         MUGEN parsers, rights check, staging exporter
├── tools/generate-icons.py     procedural icon generator
├── tools/build-fighters.py     sprite-set builder (CLI)
├── tools/fighter_art.py        the pixel-art rig: poses, body, hair, gear
├── tools/designs.py            per-fighter design records
├── tools/pixel.py              integer-only pixel canvas
├── tools/roster-plan.py        the canonical 110 roster + legacy id map
├── tools/pngio.py              dependency-free PNG read/write
└── tests/                      validation suite (plain Node, no dependencies)
```

---

## Development

### Running locally

Any static server works. The game must be served over `http(s)` — ES modules and
service workers do not work from `file://`.

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

### Running the tests

```bash
node tests/run-all.js
```

117 checks across seven suites: roster integrity, ability schema and the
"complete fighters use no templates" rule, transformation chain integrity, save
migrations and corruption recovery, a headless combat simulation, sprite atlas
and animation validation (the suite decodes `sprite-sheet.png` itself and checks
transparency, frame occupancy and ground-line alignment pixel by pixel), and
GitHub Pages path compatibility (absolute paths, manifest fields, icon presence,
service-worker precache list, broken imports).

`package.json` exists **only** so Node treats `tests/*.js` as ES modules. There
are no dependencies and nothing to install to play or deploy the game.

### Rebuilding the fighter sprites

```bash
python3 tools/build-fighters.py                     # every fighter (~8 minutes)
python3 tools/build-fighters.py --variants          # all 232 costume + form sets
python3 tools/build-fighters.py --variants madara   # just one fighter's variants
python3 tools/build-fighters.py naruto sasuke       # just these fighters
python3 tools/build-fighters.py --pass1             # the twenty starters
python3 tools/build-fighters.py --contact out.png --pass1   # visual check grid
```

**Nothing is read as input.** There is no source image to trace or slice. Each
frame is a posed skeleton rasterised into a 64×64 grid:

- `tools/pixel.py` — an integer-only canvas: capsules, ellipses, polygons, an
  outline pass and a two-tone shading pass. No antialiasing anywhere, because
  the game upscales with nearest-neighbour sampling.
- `tools/fighter_art.py` — the rig. Skeleton proportions (~2.5 heads tall, feet
  on y=58), a pose table for all 19 animations, and the parts: torso and
  clothing styles, twelve hair shapes, headbands, coats and cloaks, back gear
  (gourd, swords, scroll), held weapons, face markings, and per-animation
  effects.
- `tools/designs.py` — the design record per fighter. Twenty are authored by
  hand; the rest are derived from each fighter's own `colors`/`visual` block in
  `js/data/fighters.js`, with the remaining choices hashed off the fighter id so
  they stay distinct from one another and identical between builds.
- `tools/build-fighters.py` — drives it, writes the atlas, the portrait,
  `fighter.json` and `assets/fighters/manifest.json`.

The roster is read through `tools/dump-roster.mjs`, so colours and proportions
can never drift from what the game uses.

**Costume and transformation sets** come from the same rig, one step further
down. `tools/dump-transformations.mjs` writes every costume and every form to
`tools/variants.json`, and `designs.py` turns each one into an *override* on the
fighter's own design record:

- `costume_override()` reads what the costume actually is. A kid/genin outfit
  shortens the body and drops the coat; a Hokage or Kazekage set adds the robe
  and hat trim; ANBU adds the mask and darkens the kit; Edo Tensei greys the
  skin and adds tear lines; war and Valley-era sets add shoulder guards and a
  cloak. Anything without a keyword takes a hash-selected variation off the
  costume id, so it is still a different outfit and never only a recolour.
- `form_override()` reads the form's own name, its aura colour, and its position
  in its chain. Sage, Sharingan, Susanoo, Tailed Beast, Kurama, Six Paths, Gates
  and Karma each change the body differently — markings, eye treatment, hair,
  bulk, height, armour. Chain depth drives the escalation, so form 3 of a chain
  reads as further gone than form 1. The Eight Gates run on their gate number:
  gate 8 forces the white-hot skin, blown-back hair, red steam and a bulked-up
  frame.
- Every transformation carries a **baked chakra shroud** — `Canvas.halo()` plus
  flame tongues drawn *behind* the body so they read as backlight rather than
  covering the face. Aura colour only tints effect frames; the shroud is what
  makes a form recognisable on a plain idle frame.

`--variants` rewrites `COSTUMES_WITH_ART` and `FORMS_WITH_ART` from what is
actually on disk, so those lists cannot claim art that was never built.

### Costumes, transformations and the asset report

A costume or a transformation can carry a sprite set of its own. The renderer
resolves, most specific first:

```
active transformation -> selected costume -> base fighter -> procedural silhouette
```

Every step that falls through is recorded by `js/asset-report.js` and shown as a
console warning **in development only** (localhost, `file://`, or
`?devassets=1`). The chain is still there as a safety net, but **nothing selectable
uses it any more**: all 75 costumes and all 157 transformations ship their own
sprite set, so the report lists zero fallbacks. `assetStatus` is `complete` only
when the set exists *and* has all 18 required animations.

```bash
node tools/asset-report.mjs           # the developer report
node tools/asset-report.mjs --write   # also write assets/asset-manifest.json
```

The report groups every fighter/costume/transformation into fully complete,
functional with fallback, missing artwork and missing animations.

### Regenerating the app icon

```bash
python3 tools/generate-icons.py
```

Renders the icon procedurally (no image libraries) and writes every PNG size the
manifest, Apple metadata and favicons need. `assets/icons/icon-source.svg` is the
editable master for design work.

### Save format

Saves live in `localStorage` under `nuf.save.v1` (plus two extra slots), with a
rolling backup copy. The schema is versioned; `js/save-manager.js` migrates old
saves forward and **never discards data it does not recognise** — unknown fields
are preserved verbatim, and a corrupt save is copied aside rather than deleted.
Export/import (Settings → Save data) round-trips the whole save as JSON.

### Performance notes

Fixed-timestep simulation at 60 Hz with an accumulator, decoupled from
`requestAnimationFrame` rendering. Projectiles, particles and damage numbers are
pre-allocated pools — combat allocates nothing per frame. Device pixel ratio is
capped per quality level. Roster portraits render lazily via
`IntersectionObserver`. The loop and audio suspend when the app is backgrounded.

---

## MUGEN import and audit pipeline

`tools/mugen-import/` is **offline tooling**. It is not loaded by the game, not
precached by the service worker, and running it changes nothing about how the
game plays. It exists to answer two questions about a MUGEN character package:
*may we reuse this?* and *what, technically, is in it?*

It does not replace the combat engine. MUGEN data is read as a **reference** for
frame timing, hurtboxes, hitboxes and move startup/recovery, which the game's own
engine then consumes.

### Using it

```bash
# What is in this package, and may we use it? Writes nothing.
node tools/mugen-import/index.mjs imports/mugen/<id> --analyse

# Parse and convert into staging. Art is exported only if rights are APPROVED.
node tools/mugen-import/index.mjs imports/mugen/<id> --fighter <roster-id>

# Audit all 110 roster fighters → reports/mugen-roster-audit.{json,md}
node tools/mugen-import/index.mjs --roster-audit

# Generate the original CC0 test package used by the tests
node tools/mugen-import/make-fixture.mjs <dir>
```

### What it parses

| Format | Support |
|---|---|
| `.def` | manifest, `localcoord`, palettes, state-file lists, nested/renamed files |
| `.sff` | v1 (PCX, RLE) and v2/v2.1 (raw, RLE8, RLE5, LZ5, PNG8/24/32), linked sprites |
| `.air` | actions, per-frame ticks, offsets, flip/blend, `Clsn1`/`Clsn2` and the `Default` variants |
| `.cmd` | command definitions, buffer windows, and the `[State -1]` command→state table |
| `.cns` / `.st` | `StateDef`s, `HitDef`s, `Projectile`s, `ChangeState`/`SelfState` transitions |
| `.snd` | indexed and reported only — never imported automatically |

### The rules it enforces

- **Rights first.** Nothing is called APPROVED because a readme sounds
  permissive. A rip signal — sprites traceable to a commercial game — overrides
  any permissive text in the package. Statuses are APPROVED / MANUAL_REVIEW /
  REJECTED / NOT_FOUND, and artwork is exported only on APPROVED.
- **Staging only.** All output goes to `assets/import-staging/<fighter-id>/`
  (`source/`, `converted/`, `reports/`). Live art under `assets/fighters/` is
  never written to. Approving a staged import into the live game is a separate,
  manual decision.
- **Untrusted input.** Packages are parsed, never executed. Executables and
  archives are refused by extension, paths are resolved against the package root
  so traversal and symlink escapes fail, and every limit — file size, package
  size, file count, recursion depth, sprite count, pixel count, dimensions,
  frame count, boxes per frame, state count, decompressed bytes, text lines —
  lives in `tools/mugen-import/limits.mjs`.
- **No new roster entries.** A fighter id outside the 110 is rejected. Alternate
  forms map onto the existing transformation system; they never become roster
  cards.
- **Summons are not Assists.** MUGEN helpers are classified as projectile,
  summon, temporary helper, effect or special-move component. They are never
  turned into selectable Assist characters — `js/data/fighter-assists.js` and
  `js/combat/assist-system.js` are untouched by this pipeline.
- **Audio is opt-in.** `.snd` contents are identified and reported; importing
  them requires explicit recorded permission.

### The audit

`reports/mugen-roster-audit.md` covers all 110 fighters and records its own
blind spots. Every MUGEN distribution site is unreachable from the build
environment's egress proxy, and the report says so per source rather than
implying the search was exhaustive. No login wall, captcha, paywall or rate
limit was bypassed.

---

## Assets and legal notes

**Nothing in this repository is downloaded, ripped or copied from any published
game, anime or third party.**

- **App icon** — generated by `tools/generate-icons.py` from maths in that file.
  Original design: dark ninja universe, eclipse, blue/red chakra swirl, hooded
  masked shinobi silhouette. No official logo, village symbol or character
  likeness.
- **Fighter sprites** — generated by `tools/build-fighters.py` from the design
  records in `tools/designs.py`. Every fighter has their own set: their own
  hair, build, clothing, gear, palette and silhouette. No sprite is a recolour
  of another, and a test fails the build if two sheets are identical or two
  idle silhouettes match. Reference images were used only to decide the visual
  direction — chibi proportions, 64×64 cells, transparent background, one
  ground line — and none of their pixels is in this repository.
- **Fighters (procedural fallback)** — the original vector silhouette renderer
  is still there and still driven by each roster entry's `colors` and `visual`
  fields. It draws any fighter whose sprite set fails to load, so combat never
  depends on the network.
- **Stages** — generated procedurally from layer descriptions in
  `js/data/stages.js`. No background images.
- **Effects** — a pooled particle system driven by named recipes.
- **Audio** — every sound effect and every music loop is synthesised at runtime
  with the Web Audio API. No downloaded music, no voice lines.
- **Story** — "The Severed Accord" is written for this project and does not
  adapt or retell any published episode.
- **MUGEN imports** — none. The importer in `tools/mugen-import/` can read
  third-party packages, but nothing from one has been merged into the game, and
  no third-party package is committed here. `imports/mugen/` is git-ignored, and
  the only package the tests use is generated fresh by
  `tools/mugen-import/make-fixture.mjs` under CC0. The 110-fighter audit in
  `reports/mugen-roster-audit.md` returned **zero** packages approved for
  automatic reuse.

Character and technique **names** reference well-known series characters for a
private prototype. All asset paths (`portrait`, `spriteSet`, `audioSet`) are
plain relative strings on each roster entry, so names and artwork can be
swapped later without touching game logic.

This project is deliberately self-contained and shares no code or assets with
any other project.

---

## Known limitations

- **90 of the 110 fighters use archetype template move sets.** They are fully
  playable and the archetypes genuinely differ from one another, but they are
  not hand-authored kits. The UI labels them **Prototype** everywhere they
  appear.
- Story mode is 10 chapters of dialogue and battles; there are no animated
  cutscenes, and dialogue scenes are text panels over a stage backdrop.
- Voice volume is wired through the audio manager but there are no voice assets
  to play yet — the slider currently controls an empty bus.
- The language framework exists (setting, `lang` attribute, `LANGUAGES` table)
  but only English strings ship.
- **Fighter sprites are generated, not hand-drawn.** All 342 sets are original
  and genuinely distinct, but they come from one rig, so they share a drawing
  language: the same skeleton proportions, the same capsule-and-outline style,
  the same 22 pose tables. A character artist would give each fighter unique
  timing and posing; this gives each fighter unique *design*. Design records are
  plain data in `tools/designs.py`, so refining one fighter is a small edit and
  a rebuild.
- **Costume and transformation sets are derived, not individually
  art-directed.** Every one of the 75 costumes and 157 forms has its own atlas
  with its own silhouette, gear, palette and shroud — none of them reuse another
  set's sheet, and the tests check that byte-for-byte. But the overrides come
  from rules in `designs.py` reading each variant's name, keywords and chain
  depth, not from a per-variant art pass. Distinct is not the same as
  hand-tuned.
- **The 88 generic Awakenings share one shroud colour.** Their bodies differ —
  five treatments crossed with each fighter's own palette, hair, gear and
  build — but `transformations.js` gives every unnamed Awakening the same
  default `auraColor`, and the baked shroud uses it so the sprite matches the
  glow the renderer draws. Giving each fighter's Awakening its own colour is a
  data change, not an art change, and it has not been made.
- **The 90 derived fighters are drawn from roster data.** They are distinct
  from one another, but their designs were not individually art-directed the
  way the twenty starters were.
- **The game is deliberately single-player.** Every match is one human against
  one AI, asserted at match setup by `CombatEngine.assertPvE()`. There is no
  second human controller, no local versus, and no networking of any kind.
- **The MUGEN audit could not reach any MUGEN distribution site.** MUGEN
  Archive, Mugen Free For All, Elecbyte and Itch.io are all blocked by the build
  environment's outbound proxy, so the 110-fighter audit is a rights assessment
  and a record of what could not be checked — not an exhaustive search. The
  importer itself is exercised end to end against an original generated package,
  so the parsers are verified; the *search* is not complete, and the report says
  which sources were unreachable rather than reporting them as empty.

---

## Licence

See [LICENSE](LICENSE).
