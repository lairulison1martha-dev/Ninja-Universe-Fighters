# Naruto MUGEN — PASS 2 status: sprite import NOT performed

PASS 2 was to download `Naruto.sff` (~84.3 MB) from Google Drive, decode it, and
replace the current Naruto's artwork and animations wherever rights permit.

**The sprite import did not happen, and Naruto was not visually replaced.** No
MUGEN sprite pixel exists in this repository. This document says exactly why,
and what was done instead.

---

## Why the import did not run

### 1. The file could not be downloaded

The environment's outbound network policy refuses `drive.google.com` at the
gateway:

```
curl: (56) CONNECT tunnel failed, response 403
```

and the proxy's own status endpoint records it as a policy denial, not a
transient failure:

```json
{ "kind": "connect_rejected",
  "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
  "host": "drive.google.com:443" }
```

`drive.usercontent.google.com` and `docs.google.com` are refused the same way.
This is the same class of restriction that made every MUGEN distribution site
unreachable during the roster audit. It is not something to work around — and
the brief's instruction not to bypass gates applies to this one too.

The file was never on disk, so nothing about it could be decoded, measured or
mapped. Every question PASS 2 asks about the SFF — sprite count, groups, per
form sprite inventories, linked sprites, unused sprites, reconstructed
animations — is **unanswered**, not answered with an estimate.

### 2. The rights gate blocks the pixels regardless

Even with the file in hand, `license-check.mjs` returns **MANUAL_REVIEW** for
this package: it carries no readme, no licence, no credits and no statement of
terms. The repository's own roster audit is stricter still, recording `naruto`
as **REJECTED** on provenance — Naruto MUGEN characters as a class are built on
sprites ripped from the commercial *Clash of Ninja* games.

Under the pipeline's rules that means artwork is not exported and not committed.
The brief anticipated this and gave the correct instruction: decode locally, map
locally, report locally, commit no pixels. That branch is the one we are on —
with the download blocked, we are on it without even the local decode.

### 3. The importer would have refused the file anyway

This one was ours, and it is fixed. `LIMITS.maxFileBytes` was 64 MiB. An
84.3 MB `.sff` would have been refused before a single byte was parsed:

```
File too large: Naruto.sff is 84300000 bytes, limit 67108864
```

`LIMITS.maxSprites` was 4,000, which a character with four transformation modes
passes well before finishing its base move set. Both would have turned PASS 2
into a failed import for reasons that have nothing to do with rights or the
network. See "What was fixed" below.

---

## What was NOT done

To be unambiguous, because the brief asked for these and none of them happened:

| Asked for | Status |
|---|---|
| Download `Naruto.sff` | **BLOCKED** — network policy |
| SFF version, sprites decoded, groups | **UNKNOWN** — nothing was parsed |
| Per-form sprite inventories (base / KCM / Bijuu / Ashura) | **NOT PRODUCED** |
| Linked / palette-dependent / unused sprite counts | **NOT PRODUCED** |
| Animations reconstructed into SpriteAnimator | **NONE** |
| Filling the four unmapped clips from SFF evidence | **NOT ATTEMPTED** — needs the sprites |
| Replacing Naruto's artwork | **NOT DONE** |
| Committing MUGEN sprite pixels | **NOT DONE — and must not be** |

The current Naruto renders from its existing original artwork, unchanged. All
342 sprite sets are intact.

## What was NOT changed, deliberately

**Naruto's transformation chain was not restructured.** The brief asks for a
branching Awakening — Base → KCM *or* Ashura — modelled on the MUGEN
progression. That is a real, sprite-independent piece of work, and it was left
undone on purpose:

- Naruto's live chain is seven stages
  (`onetail → fourtail → sage → kcm1 → kcm2 → sixpaths → baryon`). The MUGEN
  progression covers three of them. Reshaping the chain to Base → kcm1 → kcm2
  with a Base → sixpaths branch means dropping `onetail`, `fourtail`, `sage` and
  `baryon` from the progression — four forms with their own working artwork,
  which the brief also says to preserve.
- It would restructure a shipped, working system in service of a replacement
  that is currently blocked twice over. If the sprites never arrive, the game is
  left with a chain reshaped around a character it does not have.

The existing Awakening button already advances one stage per press, in place,
with full requirement checks — verified in PASS 1 and unchanged. Branching is
ready to build as the first item of PASS 2b, once the source question is
settled; it is a change to `nextFormFor()` plus a selector, and it does not need
the SFF.

---

## What WAS done

### The size and count limits now fit a real character

`tools/mugen-import/limits.mjs`:

| Limit | Was | Now | Why |
|---|---|---|---|
| `maxFileBytes` | 64 MiB | 64 MiB (unchanged) | a 200 MB "readme.txt" is not a readme |
| `maxSpriteArchiveBytes` | — | 320 MiB | new, and used **only** by `parseSff` |
| `maxSprites` | 4,000 | 24,000 | 793 AIR actions span 3,912 frames across 222 groups |
| `maxTotalSpritePixels` | — | 400,000,000 | new — the guard that actually matters |

The shape of the change matters as much as the numbers. The general file
ceiling stays tight; only sprite archives get the larger allowance, because they
are the one file type that is legitimately enormous. And the real protection
against a decompression bomb is not a sprite count but total decoded area, so
that is now capped explicitly and the decoder stops and reports when an archive
passes it.

Verified against a file of exactly the size in question:

```
file size 84.3 MB
archive ceiling: ACCEPTED
default ceiling: refused as designed — FILE_TOO_LARGE
over-ceiling:    refused — FILE_TOO_LARGE
```

and against a character-scale archive built from original block art:

```
built SFF v2: 6,000 sprites
parsed: version 2 | 6,000 sprites | 6,000 decoded | 762 ms | 141 MB RSS
errors 0
```

So when the SFF does arrive, the importer will read it rather than refuse it.

### The raw archive cannot be committed by accident

`.gitignore` already excluded `imports/mugen/` and `assets/import-staging/`.
Added, as belt and braces, `*.sff`, `*.snd`, `*.act`, `*.air` and `*.cns`
anywhere in the tree — these have no legitimate home here, since the game ships
PNG atlases and the importer reads MUGEN files from a working directory. A test
asserts both the patterns and that no such file is sitting in the tree.

### Naruto regression tests

Nine new tests, covering the parts of the brief's list that do not need pixels:

- exactly one Naruto, all seven forms beneath him, no roster id named after a mode
- Base → KCM (requires all mode flags clear), KCM → Bijuu (requires `var(2) = 1`),
  Base → Ashura as a separate branch on full power
- no tail-cloak or Sage form invented; the four unsourced forms keep their data
- each form's jutsu kit is distinct — no state is shared between two forms
- one ultimate per form, no state reused, all meter-spending
- the action-1355 screen-wide box stays rejected while a normal box passes
- shadow clones stay an ability, not an Assist and not a Summon
- the raw SFF can never be tracked
- the archive ceiling clears 84.3 MB while the general ceiling does not

---

---

## An honest note on the browser suite

`browser-test.mjs` is **flaky**, and this pass is where it got noticed. Across
eight runs it failed twice, both times on the same pair:

- `fighters cannot be separated beyond the camera frame`
- `projectiles spawn and are pooled — no projectile spawned`

Roughly one run in four. No runtime file has changed since PASS 1 — the diff
across this pass touches only `.gitignore`, the importer's limits, the SFF
parser and tests — so this is pre-existing intermittency rather than a
regression. Earlier passes reported 111/111 because those particular runs came
up clean, which is exactly how flaky tests hide.

Both look timing-dependent: the projectile test presumably drives an input and
samples the pool before the AI has been allowed to act, and the camera test
samples fighter positions at a moment when they can legitimately be mid-
separation. Neither is diagnosed yet, and neither should be "fixed" by loosening
the assertion — the assist tests hit the same class of problem earlier and the
right fix there was to control the fight state, not to weaken the check.

Worth fixing on its own merits, separately from any MUGEN work.

## What PASS 2b needs

One of these, in order of preference:

1. **`Naruto.sff` reachable from this environment** — attached to the
   conversation the way the PASS 1 archive was, or on a host the network policy
   permits. Note the ~84 MB size against upload limits; splitting the archive or
   supplying a subset of sprite groups would still let the mapping proceed.
2. **A rights position on the package** — even with the file, artwork export
   stays refused while the package states no terms and the provenance
   assessment stands. If you have a permission statement from the authors, it
   goes in `imports/mugen/naruto/nuf-rights.json` and the check will read it.
3. If neither is available, the PASS 1 mappings are still worth something on
   their own: they describe frame composition, grouping, timing and offsets
   precisely enough to guide **original** artwork built with
   `tools/build-fighters.py`, which is what the game already ships and what the
   brief names as the fallback. That path needs no third-party pixels at all.

Nothing in this pass forecloses any of the three.
