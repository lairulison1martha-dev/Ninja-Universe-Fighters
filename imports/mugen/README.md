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

Then inspect it:

```
node tools/mugen-import/index.mjs imports/mugen/naruto --analyse
```

and, if the rights check comes back APPROVED, import it into staging:

```
node tools/mugen-import/index.mjs imports/mugen/naruto --fighter naruto
```

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
