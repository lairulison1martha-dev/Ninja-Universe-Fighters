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
| Assists and summons | 24 |
| Achievements | 31 |
| Fighter sprite sets | **110** — one per fighter, 19 animations / 84 frames each |

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
assists, knockback, hit stun, block stun, hit stop, invulnerability frames,
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

Left thumb: virtual joystick (fixed or floating), **JUMP**, **DASH**.
Right thumb: **A** (light), **B** (heavy), **J1** / **J2** / **J3** (jutsu), **ULT**,
**GRD** (guard), **SUB** (substitution), **AWK** (awaken/transform), **AST**
(assist).

Multi-touch is handled with pointer IDs, so moving while attacking and guarding
at the same time works properly. Presses are buffered for ~0.22 s so a tap made
slightly early during recovery still comes out.

Contextual inputs:
- Hold **toward the opponent** + **B** at close range → throw.
- Hold **up** + attack → launcher.
- Attack during a dash → dash attack.
- Hold **GRD** + **down** → charge chakra.

Everything is customisable in Settings → Controls: size, opacity, per-button
placement (drag-and-drop editor), fixed vs floating joystick, dead zone,
sensitivity, left-handed mirroring, vibration, and reset to default.

### Keyboard (desktop testing)

| Action | Key |
|---|---|
| Move | `WASD` / arrows |
| Light / Heavy | `J` / `K` |
| Jutsu 1 / 2 / 3 | `U` / `I` / `Y` |
| Ultimate | `O` |
| Guard | `L` |
| Substitution | `;` |
| Awaken | `P` |
| Assist | `H` |
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
│   │                           transformations, assists, stages, story, arcade,
│   │                           achievements, unlocks, ai-profiles
│   └── ui/                     menu, select, stage, list, settings, layout
│                               editor, HUD, overlays
├── assets/icons/               generated PNG icon set + editable SVG master
├── assets/fighters/            one folder per fighter: sprite-sheet.png,
│                               portrait.png, fighter.json, plus manifest.json
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
python3 tools/build-fighters.py                # every fighter (~6 minutes)
python3 tools/build-fighters.py naruto sasuke  # just these
python3 tools/build-fighters.py --pass1        # the twenty starters
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
- **Fighter sprites are generated, not hand-drawn.** All 192 sets are original
  and genuinely distinct, but they come from one rig, so they share a drawing
  language: the same skeleton proportions, the same capsule-and-outline style,
  the same 19 pose tables. A character artist would give each fighter unique
  timing and posing; this gives each fighter unique *design*. Design records are
  plain data in `tools/designs.py`, so refining one fighter is a small edit and
  a rebuild.
- **Transformations reuse the base fighter's sprite set.** A transformed
  fighter plays the same sheet with the engine's aura and colour effects over
  it; there are no separate atlases for Sage Mode, the Gates, Susanoo and the
  rest yet. The generator is already parameterised for it (a form is just
  another design record), so this is the next batch of work rather than a
  redesign.
- **The 172 derived fighters are drawn from roster data.** They are distinct
  from one another, but their designs were not individually art-directed the
  way the twenty starters were.
- **The game is deliberately single-player.** Every match is one human against
  one AI, asserted at match setup by `CombatEngine.assertPvE()`. There is no
  second human controller, no local versus, and no networking of any kind.
- Assists render as a coloured silhouette rather than a distinct summon design.

---

## Licence

See [LICENSE](LICENSE).
