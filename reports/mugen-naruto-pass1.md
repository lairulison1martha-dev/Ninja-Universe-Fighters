# Naruto MUGEN package — PASS 1 analysis

Package: **"Uzumaki Naruto"** (displayname *Naruto*) by **sage of six path med + Mikel8888**,
versiondate 12/09/2015, manifest `Naruto all.def`.

PASS 1 is code, transformation and animation analysis. `Naruto.sff` (~84 MB) and
`Naruto.snd` were not part of this upload, which is expected and is not treated
as an error. **No live game file was changed by this pass.** The current Naruto
still renders from its existing artwork.

---

## 1. What is in the package

19 files, 1.4 MB, no executables, no nested archives, no `.sff`, no `.snd`.

| File | Purpose | Statedefs |
|---|---|---|
| `Naruto all.def` | manifest — 8 state files, 6 palettes | — |
| `Naruto.air` | 793 actions, 3,912 frames | — |
| `Naruto.cmd` | 85 commands, 89 `[State -1]` entries | — |
| `Naruto.cns` | base states | 42 |
| `common1.cns` | MUGEN common states | 52 |
| `IA.cns` | AI and the global `[Statedef -1/-2/-3]` logic | 3 |
| `Especiales.cns` | specials | 50 |
| `Supers.cns` | supers | 135 |
| `KageBunshin.cns` | shadow-clone helper states | 19 |
| `KCM_Mode.cns` | KCM mode state block | 53 |
| `Bijuu_Mode.cns` | Bijuu mode state block | 61 |
| `Ashura_Mode.cns` | Ashura mode state block | 65 |
| `1.act`–`6.act` | palettes | — |
| `Thumbs.db` | Windows thumbnail cache, ignored | — |

480 statedefs parsed, 428 after de-duplication. 156 HitDefs, 189 Helper spawns.

## 2. How this character implements a "form"

MUGEN has no concept of a form, so the author built one, using a pattern the
importer now detects generically (`tools/mugen-import/mode-scan.mjs`):

1. a command sends the character to an **activation state**;
2. that state spawns a long-lived **marker helper**;
3. `[Statedef -3]` in `IA.cns` watches `numhelper(N)` every tick and keeps a
   **variable** in sync with it;
4. every other command is gated on that variable, so the whole move set changes
   while the marker is alive.

That gives three mode flags — `var(2)`, `var(3)`, `var(4)` — and one shared
resource, `var(5)`, a 0–1000 meter that fills on hit (`+1` per landed hit in
`[Statedef -2]`) and drains while a mode is running.

## 3. Transformations discovered

### KCM Mode → maps to the existing `naruto_kcm1` (Kurama Chakra Mode)

| | |
|---|---|
| Kind | **TRUE TRANSFORMATION** |
| Activation command | hold **Down** + **S** (`[State -1, KCM Mode]`) |
| Activation state | **2190** (`KCM_Mode.cns`) |
| Deactivation | **2191**, hold Down + S again, requires `var(2) = 1` |
| Flag variable | `var(2)`, driven by marker helpers **2195** (on) / **2196** (off) |
| Meter requirement | `var(5) >= 250` (of 1000) |
| Power requirement | none |
| Health requirement | none |
| Exclusivity | `var(2) = 0 && var(3) = 0 && var(4) = 0` — no other mode may be active |
| State block | 53 states, 2060–2961 |
| AIR actions | 67 |
| Attacks enabled | 24 HitDefs, 49 commands gated on `var(2)` |
| Helpers | 11, including the `KCM Mode` marker |
| Palette | none — `PalFX` in the activation state, no `.act` swap |
| Exit condition | manual, or `var(5)` draining at −1/tick |
| Confidence | **high** |

### Bijuu Mode → maps to the existing `naruto_kcm2` (Kurama Avatar)

The marker helper is named **"KCM Mode Full"** in the package's own source —
this is its KCM2.

| | |
|---|---|
| Kind | **TRUE TRANSFORMATION** |
| Activation command | **S** from KCM (via state 2550), or **Z** from base (`IA Bijuu Mode`) |
| Activation state | **11190** (`Bijuu_Mode.cns`) |
| Deactivation | **11191**, **Z**, requires `var(3) = 1` |
| Flag variable | `var(3)`, marker helpers **11195** / **11196** |
| Meter requirement | `var(5) >= 750` on the KCM route |
| Power requirement | `power = 9000` on both routes |
| State block | 61 states, 11060–12605 |
| AIR actions | 84 |
| Attacks enabled | 28 HitDefs, 51 commands gated on `var(3)` |
| Helpers | 19 |
| Stat/state changes | state 11190 sets `var(2) = 0` — entering Bijuu **turns KCM off** |
| Exit condition | manual, or `var(5)` draining at −2/tick (twice KCM's rate) |
| Confidence | **high** |

### Ashura Mode → maps to the existing `naruto_sixpaths` (Six Paths Sage Mode)

| | |
|---|---|
| Kind | **TRUE TRANSFORMATION** |
| Activation command | **S** (`[State -1, Ashura Mode]` → state 550 → 13190 after 6 ticks) |
| Activation state | **13190** (`Ashura_Mode.cns`) |
| Deactivation | **13191**, requires `var(4) = 1` |
| Flag variable | `var(4)`, marker helpers **13195** / **13196** |
| Meter requirement | none |
| Power requirement | `power = 9000` |
| Health requirement | `life > lifemax/5000000` — always true; not a real gate |
| Exclusivity | requires all three mode flags clear, so it is reached **from base** |
| State block | 65 states, 13060–132200 |
| AIR actions | 84 |
| Attacks enabled | 28 HitDefs, 47 commands gated on `var(4)` |
| Helpers | 38 — the most of any mode, including Gudodama (truth-seeking orbs) |
| Exit condition | manual, or `var(5)` draining at −1/tick |
| Confidence | **high** on the mechanics; **medium** on the mapping to `naruto_sixpaths`, which is a judgement call about position in the chain and move set, not something the data states |

### Kurama Mode — NOT a fourth transformation

| | |
|---|---|
| Kind | **SUPER/HYPER ATTACK with a held stance** |
| Command | hold **Down** + **S** |
| States | 3400 (activation) → 3401 (held) → 3402 (exit), in `Supers.cns` |
| Requires | `var(5) >= 250` **and** `var(3) = 1 \|\| var(4) = 1` — Bijuu or Ashura must already be running |
| Sets no flag | it does not spawn a marker helper and no variable tracks it |
| Maps to | an enhanced state of `naruto_kcm2`, not a transformation slot |
| Confidence | **high** |

## 4. Requested forms that are MISSING FROM PACKAGE

| Requested | Status |
|---|---|
| Base Naruto | **PRESENT** |
| One-Tail … Eight-Tail Cloak (as player forms) | **MISSING FROM PACKAGE** |
| Sage Mode | **MISSING FROM PACKAGE** |
| KCM / KCM1 | **PRESENT** (`var(2)`) |
| KCM2 | **PRESENT** as Bijuu Mode — its marker helper is named "KCM Mode Full" |
| Bijuu Mode | **PRESENT** (`var(3)`) |
| Kurama Link Mode | **PRESENT** as the Kurama Mode sub-state, not a form |
| Six Paths Sage Mode / Rikudo | **MISSING BY NAME** — Ashura Mode occupies that position |
| Ashura Mode | **PRESENT** (`var(4)`) |

**On the tail cloaks specifically.** `Supers.cns` does contain helpers named
`Clon 1 Cola` through `Clon 8 Colas`, spawned by the single super *Senpo Cho
Bijuu Rasen Shuriken*. These are eight clone helpers inside one attack — each
with its own animation and HitDef — not cloak forms the player transforms into.
They have no mode flag, no marker helper, no state block and no activation
command. Reading them as One-Tail through Eight-Tail would be inventing eight
transformations out of one super's visual effect.

## 5. The transformation order this package actually supports

```
base ──(hold Down+S, meter ≥ 250)──▶ KCM ──(S, meter ≥ 750 + full power)──▶ Bijuu
                                                                             │
base ──(S, full power)───────────────────────────────────────────▶ Ashura    │
                                                                             ▼
                     Bijuu or Ashura ──(hold Down+S, meter ≥ 250)──▶ Kurama Mode
```

Two entry points, not one ladder. KCM chains into Bijuu and is cleared on the
way in. Ashura is reached **from base** on full power and is not downstream of
KCM or Bijuu. Kurama Mode sits on top of Bijuu or Ashura as a held super.

The game's own seven-stage chain (`onetail → fourtail → sage → kcm1 → kcm2 →
sixpaths → baryon`) is **not changed by this pass**. The package supplies new
material for three of those stages; the other four keep what they already have.

## 6. Animations

793 AIR actions, 3,912 frames, 222 distinct SFF sprite groups referenced (max
group 30070). The importer mapped **20 of the game's 24 animation clips** with
high confidence:

| Clip | AIR action | | Clip | AIR action |
|---|---|---|---|---|
| idle | 0 | | dash | 105 |
| combatIdle | 5 | | guardBreak | 140 |
| guard | 10 | | guardHit | 150 |
| walk | 11 | | victory | 180 |
| walkBack | 21 | | lightAttack | 200 |
| jump | 40 | | heavyAttack | 430 |
| fall | 47 | | jutsu1 | 2430 |
| run | 100 | | ultimate | 4200 |
| hurt | 5000 | | knockdown | 5040 |
| getUp | 5120 | | defeat | 5160 |

Unmapped: **landing, jutsu2, jutsu3, transformation** — the first because the
package folds it into the fall animation, the rest because they need a decision
about which of the mode-specific attacks fills each slot rather than a
mechanical mapping.

Each mode has its own full animation band, which is why the action count is so
high: 67 KCM actions, 84 Bijuu, 84 Ashura, plus the base set and the supers.

## 7. Attacks

150 attacking states carrying 156 HitDefs. 141 have usable startup/active
timing derived from their `AnimElem` triggers.

61 states spend meter. The complete super list, by cost:

| Cost | State | Name | Command | File |
|---|---|---|---|---|
| 5000 | 5535 | Super Chakra Cannon | hold D + Y | Supers |
| 4000 | 6573 | kurama susanoo | X + hold D | Supers |
| 3000 | 4200 | Senpo Cho Bijuu Rasen Shuriken | hold D + C | Supers |
| 3000 | 40000 | Kurama Tailed Beast Bomb | Y + hold D | Supers |
| 3000 | 3300 | Cho Oodama Rasen Shuriken | hold D + C | Supers |
| 3000 | 3900 | Bijuu Wakusey Rasen Shuriken | hold D + C | Supers |
| 3000 | 9875 | Cho Oodama Rasenrengan | hold D + Y | Supers |
| 2500 | 3100 | Sempou Cho Oodama Rasen Tarengan | hold D + B | Supers |
| 2500 | 4100 | Naruto Ittai Rendan | hold D + B | Supers |
| 2000 | 3000 | Oodama Rasengan | hold D + A | Supers |
| 2000 | 3500 | Bijuu Rasengan | hold D + A | Supers |
| 2000 | 3700 | Bijuudama | hold D + A | Supers |
| 2000 | 4000 | Senpo Yoton Rasen Shuriken | hold D + A | Supers |
| 1500 | 1500 | Cho Odama Rasengan | ~D,DB,B,C | Especiales |
| 1500 | 14400 | Bijuudama Rasen Shuriken | ~D,DF,F,C | Ashura |
| 1500 | 14500 | Cho Bijuudama | ~D,DB,B,C | Ashura |
| 1000 | 1100 | Kage Bunshin no Jutsu | ~D,DB,B,A | Especiales |
| 1000 | 1300 | Kuchiyose Gamakichi | ~D,DB,B,B | Especiales |
| 1000 | 1400 | Rasenrengan | ~D,DF,F,C | Especiales |
| 1000 | 1600 | Sempou Oodama Rasengan | ~D,DB,B,C | Especiales |
| 1000 | 10883 | Kuchiyose: Fukasaku + Shima | X + hold D | Especiales |
| 1000 | 2700 | Bijuu Senkoodan | ~D,DB,B,C | KCM |
| 1000 | 2850 | Rasenkyugan | ~D,DF,F,C | KCM |
| 1000 | 2900 | Kuchiyose Yatai Kuzushi | ~D,DB,B,B | KCM |
| 1000 | 2950 | Wakusey Rasengan | ~D,DF,F,B | KCM |
| 1000 | 12100 | Cho Mini Bijuudama | ~D,DF,F,A | Bijuu |
| 1000 | 12300 | Bijuu Wakusey Rasengan | ~D,DF,F,B | Bijuu |
| 1000 | 12400 | Kurama Hunt | ~D,DB,B,B | Bijuu |
| 1000 | 12500 | Bijuu Wakusey Rasenkyugan | ~D,DB,B,C | Bijuu |
| 1000 | 14000 | Jinton Rasengan | ~D,DF,F,A | Ashura |
| 1000 | 14100 | Gudodama Blast | ~D,DB,B,A | Ashura |
| 1000 | 14200 | Futton Kairiki Muso | ~D,DF,F,B | Ashura |
| 1000 | 14300 | Revenge | ~D,DB,B,B | Ashura |
| 500 | 6144 | Fuuma Shuriken | Y | Naruto |

Each mode brings its own three-to-four move kit, which is what makes a
per-form jutsu mapping possible rather than one shared move set.

### Recommended ultimates

| Form | Ultimate | State | Cost |
|---|---|---|---|
| base | Super Chakra Cannon | 5535 | 5000 |
| `naruto_kcm1` | Senpo Cho Bijuu Rasen Shuriken | 4200 | 3000 |
| `naruto_kcm2` | Kurama Tailed Beast Bomb | 40000 | 3000 |
| `naruto_sixpaths` | Cho Bijuudama | 14500 | 1500 |

### Recommended jutsu slots

Recorded per form in `tools/mugen-import/mappings/naruto.mjs` — three
meter-spending command moves from each mode's own file, so no two forms share
a kit.

## 8. Shadow clones

`KageBunshin.cns` is a **helper state block**: states 15000–15210 give a clone
its own idle, walk, run, jump and two attacking states (15200, 15210). Clones
are spawned as `Helper` instances named *Kage Bunshin Clon* (15 spawn sites),
*Kage Bunshin* (4) and *Kage Bunshin Revuelta* (1). The clone costs nothing
itself; the summoning state 1100 spends 1000 power.

Classification: **temporary helper — a Naruto ability.** Not a selectable
Assist and not a Summon. `js/data/fighter-assists.js` and
`js/combat/assist-system.js` are untouched by this pass.

## 9. Other helpers

| Helper | Spawns | Classification |
|---|---|---|
| Agujas | 20 | projectile |
| Kage Bunshin Clon | 15 | temporary helper (ability) |
| Camara Lenta | 10 | effect — a slow-motion controller |
| Kurama Helper | 6 | special-move component — the fox avatar |
| Gamakichi | 1 | **summon** — a toad, from Kuchiyose Gamakichi |
| Fukasaku + Shima | 1 | **summon** — the toad elders |
| Chakra Bar | 1 | effect — the package draws its own meter UI |
| sasuke | 2 | special-move component inside one super — **not a roster fighter** |

The two toads are the only genuine summons. Everything else is a projectile, an
effect, or a component of a specific move.

## 10. Collision data

| | |
|---|---|
| Frames with hurtboxes (`Clsn2`) | 1,893 of 3,912 — **48.4%** |
| Frames with attack boxes (`Clsn1`) | 272 of 3,912 — **7.0%** |
| Derived scale | 0.888 game units per MUGEN unit, measured from a tallest hurtbox of 178 |
| Validation | **6 boxes rejected** — action 1355 frames 6–9 declare a 1352×47 attack box, which is a whole screen wide |

The game's current Naruto uses per-ability hitboxes (range / hitHeight /
hitYOffset), not per-frame boxes, so this is genuinely new information for 48%
of frames. The four broken boxes on action 1355 are excluded rather than
imported; the rest convert cleanly.

The existing hitboxes are **not** replaced by this pass.

## 11. Palettes

Six `.act` files, declared as `pal.defaults = 1,2,3,4,5,6`. Each changes only
6–8 of 256 colour indices, and only the indices carrying the jumpsuit and hair:

| File | Changed indices | Effect |
|---|---|---|
| `1.act` | — | default orange |
| `2.act` | 7 | gold |
| `3.act` | 7 | blue |
| `4.act` | 8 | red |
| `5.act` | 6 | grey |
| `6.act` | 8 | green |

Nothing in the CNS selects a palette to signal a mode — the modes use `PalFX`
and their own animation bands instead.

Interpretation: **alternate colours.** Not costumes, not transformations, not
mode effects. Naruto already has five costumes in the game with their own
artwork; these would recolour rather than re-dress, and are not imported as
costumes.

## 12. Rights

The importer's rights check was run unmodified and returned:

> **MANUAL_REVIEW** (confidence: none) — *"No readme or licence file in the
> package"*, *"with no stated terms, reuse cannot be assumed"*.

The package contains no readme, no licence, no credits file and no terms of any
kind. Under the pipeline's rules that means **artwork export is refused**, and
it was: this import produced analysis only, no sprite sheet, no portrait.

Two things should be read alongside that result:

- The repository's own 110-fighter audit (`reports/mugen-roster-audit.md`)
  already records `naruto` as **REJECTED** for automatic import, on the basis
  that Naruto MUGEN characters as a class are built on sprites ripped from the
  commercial *Clash of Ninja* games. That assessment is stricter than
  MANUAL_REVIEW and it is the one that governs, because a package that simply
  says nothing has not answered the question.
- An ~84 MB sprite archive for one character is consistent with a large ripped
  set rather than hand-drawn original art.

**Nothing here blocks PASS 1**, which imported no artwork. It does mean PASS 2's
sprite import will be refused by `license-check.mjs` unless the rights position
changes — see the note at the end of this report.

## 13. What changed in the live game

**Nothing.** Deliberately.

`assets/fighters/naruto/` is untouched, `js/data/fighters.js` is untouched,
`js/data/transformations.js` is untouched, and the save format is unchanged. The
roster is still exactly 110 fighters with exactly one Naruto, and Naruto remains
selectable both as a fighter and as an Assist.

That is the correct outcome for this pass. Every value worth changing — sprite
rows, frame durations, hitboxes, move timing — depends on sprites that have not
arrived, and the alternative would be a Naruto whose data claims animations that
do not exist.

Two things were verified rather than changed:

- **The Awakening button already does what was asked.**
  `js/combat/transformation-system.js` advances `fighter.form` along
  `fighter.data.transformations` one stage per press, checks every requirement,
  and transforms in place — no character select, no new fighter, no match reset.
  Position, facing, target, ownership and health all persist.
- **Naruto's Assist entry is independent of the transformation chain**, so the
  chain applies when Naruto is the main fighter and does not follow him into
  another fighter's Assist slot.

## 14. What is waiting for `Naruto.sff`

| Waiting on the SFF | Ready now |
|---|---|
| A 64×64 atlas per form, built from the sprite groups each mode's AIR actions reference | The AIR → clip mapping (20 of 24 clips) |
| Frame durations baked into `fighter.json` | Per-frame tick counts, already parsed |
| Portrait per form | — |
| Any decision to retire the current artwork | The per-frame hitbox conversion |
| — | The mode → transformation mapping, in `tools/mugen-import/mappings/naruto.mjs` |
| — | Per-form jutsu and ultimate candidates |

The current Naruto artwork stays exactly where it is until a replacement has
been imported **and tested**.

---

## Tooling changed by this pass

Three real bugs surfaced while tracing this character, all of them fixed:

1. **CNS controllers were bound by label, not by enclosing state.**
   `[State 3000, VarSet]` inside `[Statedef 2190]` was being attributed to
   state 3000 — MUGEN binds a controller to the StateDef it appears under, and
   the number in the header is documentation authors routinely leave stale.
   The effect on this package was severe: 2 attacking moves were found instead
   of 150.
2. **`state number ≥ 3000` was treated as proof of a super.** A character with
   several modes parks each mode's ordinary attacks in its own high band, so
   this classified 83 normals as ultimates. Meter spend is now required as
   evidence; the count is 9.
3. **Staging was not cleared before a re-import**, so a previous package's
   sprite sheet survived in `converted/` and read as output of the new import.

New: `tools/mugen-import/mode-scan.mjs`, which finds transformation modes
generically by the marker-helper-plus-variable pattern, and is wired into every
import as `converted/mode-scan.json`.
