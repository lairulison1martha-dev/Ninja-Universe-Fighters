# MUGEN package drop zone

Put a MUGEN character package here, one folder per fighter, named with the
fighter's roster id:

```
imports/mugen/naruto/
  naruto.def
  naruto.sff
  naruto.air
  ...
```

You can put as many as you like in here at once — the batch command below
sorts them out in one run.

The folder name is free-form, but it is the main clue the importer has, so
name it after the character. `naruto`, `Uzumaki Naruto`, `sage naruto`,
`EMS Sasuke v2` and `adult sasuke` all resolve correctly; `char_final_v3`
does not.

Then see what is here:

```
node tools/mugen-import/index.mjs --list-local
```

### Import everything in one run

```
node tools/mugen-import/index.mjs --batch imports/mugen --dry-run   # look first
node tools/mugen-import/index.mjs --batch imports/mugen             # then import
```

The batch matches every folder against the 110-fighter roster, decides whether
each is the base fighter, one of their transformations or one of their
costumes, imports the ones whose rights allow it, skips the rest, and writes
`reports/mugen-batch-import.json` and `.md`. A broken, rejected or ambiguous
package is recorded and the run continues.

Output lands under the fighter it belongs to — never as a new roster entry:

```
assets/import-staging/naruto/                          base fighter
assets/import-staging/naruto/forms/naruto_sage/        a transformation
assets/import-staging/sasuke/costumes/adult/           a costume
assets/import-staging/itachi/candidates/<package-id>/  two packages, one target
```

For every folder that prints, this reports the character name and author from
the `.def`, which data files are inside, the rights status and the documents
behind it, the matching roster fighter if one is obvious, an import readiness,
and the exact command to run next. It writes nothing.

### One package at a time

Look at one package in detail without writing anything:

```
node tools/mugen-import/index.mjs imports/mugen/naruto --analyse
```

Import it into staging — analysis always, artwork only if the rights check
came back APPROVED:

```
node tools/mugen-import/index.mjs imports/mugen/naruto --fighter naruto
```

### Readiness, as `--list-local` reports it

| | |
|---|---|
| `READY_TO_IMPORT` | rights APPROVED and the target fighter is known |
| `ANALYSIS_ONLY` | parseable and targeted, but the terms are not clear enough to approve artwork |
| `NEEDS_FIGHTER_ID` | no roster fighter is obvious — choose one with `--fighter` |
| `REJECTED` | rights say no |
| `BLOCKED` | no character `.def`, or nothing readable |

`ANALYSIS_ONLY` is the default for a package that says nothing about reuse. A
folder with no readme has not granted permission; it has simply not mentioned
the question.

## Nothing in here is committed

`.gitignore` excludes `imports/mugen/*` (this README aside). That is
deliberate. The packages that land here are third-party archives whose reuse
rights are exactly what the pipeline exists to establish — committing them
would redistribute them before that question has been answered, which is the
one thing the audit is meant to prevent.

Test fixtures are not kept here either. `tools/mugen-import/make-fixture.mjs`
generates an original, CC0 package (`Blockfighter`) into a temp directory on
demand, so the test suite never needs a third-party character on disk.

## What the importer will and will not do with what you drop here

- It **parses** `.def`, `.sff`, `.air`, `.cmd`, `.cns`, `.st` and `.snd`. It
  never executes anything, and it refuses to open executables and archives.
- It **writes only** to `assets/import-staging/<fighter-id>/`. Live art under
  `assets/fighters/` is never touched.
- It **exports artwork only when the rights check returns APPROVED**.
  Otherwise you get the parsed data, the reports and a written explanation of
  why the art was withheld.
- It **never creates a roster entry.** A fighter id that is not one of the 110
  is rejected outright.
- It **never imports audio automatically.** `.snd` is indexed and reported;
  importing it needs explicit, recorded permission.
