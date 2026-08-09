# MUGEN batch import

Generated 2026-08-09T12:56:42.447Z from `imports/mugen`

**Dry run.** Everything below was worked out without writing a single
staging file. Re-run without `--dry-run` to import.

## Summary

| | |
|---|---|
| Packages scanned | 1 |
| Imported (artwork + analysis) | 0 |
| Analysis only (no artwork) | 0 |
| Would import (dry run) | 0 |
| Rejected | 0 |
| Blocked | 0 |
| Ambiguous | 0 |
| Unmatched | 1 |
| Failed mid-import | 0 |
| Base fighters matched | 0 |
| Transformations matched | 0 |
| Costumes matched | 0 |
| Distinct roster fighters matched | 0 |
| Roster fighters with no candidate | 110 |
| Targets with more than one package | 0 |
| Staging paths created | 0 |

## Packages

| Package | Fighter | Type | Rights | Readiness | Result |
|---|---|---|---|---|---|
| `_fixture-blockfighter` | — | unknown | APPROVED | NEEDS_FIGHTER_ID | SKIPPED |

## Why a package was not imported

- `_fixture-blockfighter` — no single roster fighter matches

## Roster fighters with no candidate package

110 of 110: `naruto`, `sasuke`, `sakura`, `kakashi`, `lee`, `gaara`, `itachi`, `pain`, `madara`, `boruto`, `kawaki`, `momoshiki`, `minato`, `hashirama`, `guy`, `bee`, `obito`, `jiraiya`, `orochimaru`, `tsunade`, `sai`, `yamato`, `shikamaru`, `choji`, `ino`, `kiba`, `hinata`, `neji`, `tenten`, `shino`, `iruka`, `asuma`, `kurenai`, `konohamaru`, `ebisu`, `tobirama`, `hiruzen`, `shisui`, `fugaku`, `izuna`, `danzo`, `nagato`, `konan`, `kisame`, `deidara`, `sasori`, `hidan`, `kakuzu`, `zabuza`, `haku`, `kimimaro`, `kabuto`, `jugo`, `suigetsu`, `karin`, `hanzo`, `jirobo`, `kidomaru`, `tayuya`, `sakon`, `yugito`, `yagura`, `roshi`, `han`, `utakata`, `fu`, `rasa`, `raikage4`, `darui`, `mei`, `chojuro`, `onoki`, `kurotsuchi`, `temari`, `kankuro`, `chiyo`, `omoi`, `samui`, `sarada`, `mitsuki`, `sumire`, `jigen`, `isshiki`, `delta`, `boro`, `koji`, `code`, `daemon`, `eida`, `victor`, `deepa`, `kaguya`, `hagoromo`, `hamura`, `toneri`, `kinshiki`, `urashiki`, `menma`, `hanabi`, `hiashi`, `hizashi`, `kushina`, `pakura`, `white_zetsu`, `black_zetsu`, `shinki`, `mirai`, `kagura`, `buntan`, `shin`

## Rules this run followed

- Live art in assets/fighters/ is never written to by this pipeline.
- Artwork is exported only when the rights check returns APPROVED.
- A package matching two fighters is reported, never assigned by guessing.
- Alternate forms map onto existing transformations; no roster entry is created.
- One failing package does not stop the batch.
