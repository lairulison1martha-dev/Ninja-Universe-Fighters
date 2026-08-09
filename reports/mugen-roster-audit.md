# MUGEN roster audit

Generated 2026-08-09T03:44:58.833Z

This audits all 110 fighters in the cleaned roster for legally reusable MUGEN
character packages. It records what was actually established, and nothing more.

## Summary

| | |
|---|---|
| Fighters audited | 110 |
| Local packages found | 0 |
| APPROVED | 0 |
| MANUAL_REVIEW | 0 |
| REJECTED | 2 |
| NOT_FOUND | 108 |

## Search notes

- Web search was available and was used. Direct page fetches were not, for the sites that matter.
- mugenarchive.com — UNREACHABLE: blocked by this environment's outbound egress proxy (not by the site).
- mugenfreeforall.com — UNREACHABLE: blocked by the same egress proxy.
- spritedatabase.net — UNREACHABLE: blocked by the same egress proxy.
- opengameart.org — UNREACHABLE: blocked by the same egress proxy.
- itch.io — UNREACHABLE: blocked by the same egress proxy.
- elecbyte.com — UNREACHABLE: blocked by the same egress proxy. Its readme was read via a GitHub mirror instead.
- github.com — reachable, and used.
- Consequence: NO MUGEN character package could be downloaded, so none could be inspected, so nothing in this audit can be APPROVED on inspection. Statuses below reflect that honestly.
- No login wall, captcha, paywall or anti-bot system was bypassed or attempted. No site was scraped repeatedly; searches were bounded and few.

## Provenance assessment — Naruto MUGEN characters

**REJECTED for automatic import** (high confidence)

- Sprite Database catalogues per-character sprite rips from Naruto: Clash of Ninja (https://spritedatabase.net/game/2360), which is the source material MUGEN Naruto characters are built from.
- Community projects name the commercial games directly, e.g. "NARUTO: Clash of Ninja X MUGEN Project" on Mugen Free For All (https://mugenfreeforall.com/topic/38626-naruto-clash-of-ninja-x-mugen-project-sasuke-has-been-released/).
- Rights in those sprites sit with the games' publisher, not with the MUGEN author, so no permission statement in a character package can license them onward.

## The one package found with verifiable terms

**Kung Fu Man (KFM)** by Elecbyte — Creative Commons BY-NC 3.0 — attribution optional, non-commercial only

Source: https://github.com/fanyer/mugen/blob/master/readme.txt

Primary source: "licensed under the Creative Commons Noncommercial License, with optional attribution... you don't need our permission to build upon or use parts of any of that content for non-commercial purposes."

Status: **MANUAL_REVIEW**. Why not APPROVED:
- NonCommercial is a restriction on reuse, so it is not a clean grant — whether it suits this project is a decision for the repository owner.
- Kung Fu Man does not correspond to any fighter in the 110-fighter roster, and this pipeline never creates roster entries, so he cannot be imported as a character here regardless.

A real-world integration test of the parsers, if a copy is placed in imports/mugen/ locally. It is deliberately not committed to this repository.

## Method

- Roster source: js/data/fighters.js, the cleaned 110-fighter roster. No roster entry was added, removed or duplicated.
- For each fighter, imports/mugen/<fighter-id>/ was checked for a package a human had downloaded. Any package found there is inspected properly and its own rights check decides its status.
- Where no local package exists, the status comes from the researched findings in this file.
- Where neither exists, the status is NOT_FOUND — no package was obtained, so no claim is made.
- A category-level provenance assessment (see categoryAssessment) applies to Naruto MUGEN characters as a class, and is recorded per fighter as a note rather than being used to fabricate a per-fighter status.
- Nothing is APPROVED without a package that was actually inspected and whose rights hold up.

## Per-fighter

| Fighter | ID | Candidates | Status | Sprite origin | Recommendation |
|---|---|---|---|---|---|
| Naruto Uzumaki | `naruto` | 1 | REJECTED | likely ripped | REJECT |
| Sasuke Uchiha | `sasuke` | 1 | REJECTED | likely ripped | REJECT |
| Sakura Haruno | `sakura` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Kakashi Hatake | `kakashi` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Sai | `sai` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Yamato | `yamato` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Shikamaru Nara | `shikamaru` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Choji Akimichi | `choji` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Ino Yamanaka | `ino` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Hinata Hyuga | `hinata` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Kiba Inuzuka | `kiba` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Shino Aburame | `shino` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Neji Hyuga | `neji` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Rock Lee | `lee` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Tenten | `tenten` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Might Guy | `guy` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Asuma Sarutobi | `asuma` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Kurenai Yuhi | `kurenai` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Ebisu | `ebisu` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Iruka Umino | `iruka` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Konohamaru Sarutobi | `konohamaru` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Hanabi Hyuga | `hanabi` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Hiashi Hyuga | `hiashi` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Hizashi Hyuga | `hizashi` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Hashirama Senju | `hashirama` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Tobirama Senju | `tobirama` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Hiruzen Sarutobi | `hiruzen` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Minato Namikaze | `minato` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Tsunade | `tsunade` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Jiraiya | `jiraiya` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Orochimaru | `orochimaru` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Kushina Uzumaki | `kushina` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Shisui Uchiha | `shisui` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Fugaku Uchiha | `fugaku` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Izuna Uchiha | `izuna` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Gaara | `gaara` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Temari | `temari` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Kankuro | `kankuro` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Chiyo | `chiyo` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Pakura | `pakura` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Rasa | `rasa` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Zabuza Momochi | `zabuza` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Haku | `haku` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Chojuro | `chojuro` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Mei Terumi | `mei` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Kisame Hoshigaki | `kisame` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Yagura Karatachi | `yagura` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Suigetsu Hozuki | `suigetsu` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Killer Bee | `bee` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Fourth Raikage | `raikage4` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Darui | `darui` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Omoi | `omoi` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Samui | `samui` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Yugito Nii | `yugito` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Onoki | `onoki` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Kurotsuchi | `kurotsuchi` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Deidara | `deidara` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Roshi | `roshi` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Han | `han` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Itachi Uchiha | `itachi` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Sasori | `sasori` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Kakuzu | `kakuzu` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Hidan | `hidan` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Konan | `konan` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Pain | `pain` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Nagato | `nagato` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Obito Uchiha | `obito` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| White Zetsu | `white_zetsu` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Black Zetsu | `black_zetsu` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Madara Uchiha | `madara` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Kabuto Yakushi | `kabuto` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Kimimaro | `kimimaro` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Jugo | `jugo` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Karin Uzumaki | `karin` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Danzo Shimura | `danzo` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Hanzo | `hanzo` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Jirobo | `jirobo` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Kidomaru | `kidomaru` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Tayuya | `tayuya` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Sakon and Ukon | `sakon` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Utakata | `utakata` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Fu | `fu` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Boruto Uzumaki | `boruto` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Sarada Uchiha | `sarada` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Mitsuki | `mitsuki` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Kawaki | `kawaki` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Sumire Kakei | `sumire` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Shinki | `shinki` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Mirai Sarutobi | `mirai` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Kagura Karatachi | `kagura` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Buntan Kurosuki | `buntan` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Jigen | `jigen` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Isshiki Otsutsuki | `isshiki` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Delta | `delta` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Code | `code` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Boro | `boro` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Koji Kashin | `koji` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Victor | `victor` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Deepa | `deepa` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Eida | `eida` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Daemon | `daemon` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Momoshiki Otsutsuki | `momoshiki` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Kinshiki Otsutsuki | `kinshiki` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Urashiki Otsutsuki | `urashiki` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Kaguya Otsutsuki | `kaguya` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Hagoromo Otsutsuki | `hagoromo` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Hamura Otsutsuki | `hamura` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Toneri Otsutsuki | `toneri` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Shin Uchiha | `shin` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |
| Menma Uzumaki | `menma` | 0 | NOT_FOUND | unknown | MANUAL_REVIEW |

## Notes

### Naruto Uzumaki (`naruto`)
- Candidate projects exist and were identified by name and URL, but none could be downloaded: the hosting sites are unreachable from this environment.
- The project name states its own source material — Clash of Ninja, a commercial game — so its sprites are not the authors' to license onward. REJECTED for automatic import.

### Sasuke Uchiha (`sasuke`)
- A named release exists for this character. It is built on Clash of Ninja sprites, so it is REJECTED for automatic import on provenance.

### Sakura Haruno (`sakura`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Kakashi Hatake (`kakashi`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Sai (`sai`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Yamato (`yamato`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Shikamaru Nara (`shikamaru`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Choji Akimichi (`choji`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Ino Yamanaka (`ino`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Hinata Hyuga (`hinata`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Kiba Inuzuka (`kiba`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Shino Aburame (`shino`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Neji Hyuga (`neji`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Rock Lee (`lee`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Tenten (`tenten`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Might Guy (`guy`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Asuma Sarutobi (`asuma`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Kurenai Yuhi (`kurenai`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Ebisu (`ebisu`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Iruka Umino (`iruka`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Konohamaru Sarutobi (`konohamaru`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Hanabi Hyuga (`hanabi`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Hiashi Hyuga (`hiashi`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Hizashi Hyuga (`hizashi`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Hashirama Senju (`hashirama`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Tobirama Senju (`tobirama`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Hiruzen Sarutobi (`hiruzen`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Minato Namikaze (`minato`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Tsunade (`tsunade`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Jiraiya (`jiraiya`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Orochimaru (`orochimaru`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Kushina Uzumaki (`kushina`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Shisui Uchiha (`shisui`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Fugaku Uchiha (`fugaku`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Izuna Uchiha (`izuna`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Gaara (`gaara`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Temari (`temari`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Kankuro (`kankuro`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Chiyo (`chiyo`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Pakura (`pakura`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Rasa (`rasa`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Zabuza Momochi (`zabuza`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Haku (`haku`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Chojuro (`chojuro`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Mei Terumi (`mei`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Kisame Hoshigaki (`kisame`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Yagura Karatachi (`yagura`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Suigetsu Hozuki (`suigetsu`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Killer Bee (`bee`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Fourth Raikage (`raikage4`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Darui (`darui`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Omoi (`omoi`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Samui (`samui`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Yugito Nii (`yugito`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Onoki (`onoki`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Kurotsuchi (`kurotsuchi`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Deidara (`deidara`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Roshi (`roshi`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Han (`han`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Itachi Uchiha (`itachi`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Sasori (`sasori`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Kakuzu (`kakuzu`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Hidan (`hidan`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Konan (`konan`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Pain (`pain`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Nagato (`nagato`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Obito Uchiha (`obito`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### White Zetsu (`white_zetsu`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Black Zetsu (`black_zetsu`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Madara Uchiha (`madara`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Kabuto Yakushi (`kabuto`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Kimimaro (`kimimaro`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Jugo (`jugo`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Karin Uzumaki (`karin`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Danzo Shimura (`danzo`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Hanzo (`hanzo`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Jirobo (`jirobo`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Kidomaru (`kidomaru`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Tayuya (`tayuya`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Sakon and Ukon (`sakon`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Utakata (`utakata`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Fu (`fu`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Boruto Uzumaki (`boruto`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Sarada Uchiha (`sarada`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Mitsuki (`mitsuki`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Kawaki (`kawaki`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Sumire Kakei (`sumire`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Shinki (`shinki`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Mirai Sarutobi (`mirai`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Kagura Karatachi (`kagura`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Buntan Kurosuki (`buntan`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Jigen (`jigen`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Isshiki Otsutsuki (`isshiki`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Delta (`delta`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Code (`code`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Boro (`boro`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Koji Kashin (`koji`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Victor (`victor`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Deepa (`deepa`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Eida (`eida`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Daemon (`daemon`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Momoshiki Otsutsuki (`momoshiki`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Kinshiki Otsutsuki (`kinshiki`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Urashiki Otsutsuki (`urashiki`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Kaguya Otsutsuki (`kaguya`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Hagoromo Otsutsuki (`hagoromo`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Hamura Otsutsuki (`hamura`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Toneri Otsutsuki (`toneri`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Shin Uchiha (`shin`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.

### Menma Uzumaki (`menma`)
- No MUGEN package for this fighter was obtained or inspected (see searchNotes). Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial Naruto games, so this fighter would need a package with genuinely original art before any import could be considered.
