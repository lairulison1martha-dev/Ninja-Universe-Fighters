# Import staging

Where `tools/mugen-import/` writes. **Live art in `assets/fighters/` is never
written to by the importer** — a human copies things across after reading the
comparison report, or does not.

One folder per import:

```
<fighter-id>/                      base fighter
<fighter-id>/forms/<form-id>/      a transformation
<fighter-id>/costumes/<id>/        a costume
<fighter-id>/candidates/<pkg>/     two packages aimed at the same target
```

and inside each:

```
source/      the package's own data, re-encoded as JSON
converted/   the game-shaped artefacts, including artwork when rights allow
reports/     the analysis, the rights audit and the comparison
```

## Nothing in here is committed

`.gitignore` excludes everything under this directory except this README, and
that is deliberate on two counts.

`source/` is a re-encoding of a third-party package's own files. Committing it
would redistribute that package in a different file format — before the rights
question the importer exists to answer has been answered. `converted/` is
derived from the same material and can run to megabytes per character.

The conclusions belong in `reports/`, which *is* committed: the roster audit,
the batch summary, and the per-package analysis write-ups. Those are findings
about a package, not copies of it.

Staging is a working area. Re-running an import regenerates it, and a re-import
clears the previous contents first so one package's output can never be
mistaken for another's.
