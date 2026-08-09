/**
 * Research findings for the roster audit.
 *
 * This file records what was actually established about MUGEN packages for
 * this roster, on the date given, and — just as importantly — what could not
 * be established and why. It is data, edited by hand as research is done, so
 * the audit generator never has to invent anything.
 *
 * Anyone extending this: a finding belongs here only if a source supports it.
 * "Probably fine" is not a finding.
 */

export const RESEARCHED_AT = '2026-08-09';

/**
 * What the search actually managed to reach.
 *
 * The blocking here is on THIS environment's side, not the sites' — the
 * sandbox routes outbound traffic through an egress proxy with an allowlist,
 * and the MUGEN distribution sites are not on it. No login wall, captcha,
 * paywall or rate limit was encountered, because no request reached them.
 * That distinction matters, so it is stated rather than glossed as "blocked".
 */
export const SEARCH_NOTES = Object.freeze([
  'Web search was available and was used. Direct page fetches were not, for the sites that matter.',
  'mugenarchive.com — UNREACHABLE: blocked by this environment\'s outbound egress proxy (not by the site).',
  'mugenfreeforall.com — UNREACHABLE: blocked by the same egress proxy.',
  'spritedatabase.net — UNREACHABLE: blocked by the same egress proxy.',
  'opengameart.org — UNREACHABLE: blocked by the same egress proxy.',
  'itch.io — UNREACHABLE: blocked by the same egress proxy.',
  'elecbyte.com — UNREACHABLE: blocked by the same egress proxy. Its readme was read via a GitHub mirror instead.',
  'github.com — reachable, and used.',
  'Consequence: NO MUGEN character package could be downloaded, so none could be inspected, '
  + 'so nothing in this audit can be APPROVED on inspection. Statuses below reflect that honestly.',
  'No login wall, captcha, paywall or anti-bot system was bypassed or attempted. '
  + 'No site was scraped repeatedly; searches were bounded and few.',
]);

/** How each status in the audit was reached. */
export const METHOD = Object.freeze([
  'Roster source: js/data/fighters.js, the cleaned 110-fighter roster. No roster entry was added, removed or duplicated.',
  'For each fighter, imports/mugen/<fighter-id>/ was checked for a package a human had downloaded. '
  + 'Any package found there is inspected properly and its own rights check decides its status.',
  'Where no local package exists, the status comes from the researched findings in this file.',
  'Where neither exists, the status is NOT_FOUND — no package was obtained, so no claim is made.',
  'A category-level provenance assessment (see categoryAssessment) applies to Naruto MUGEN characters '
  + 'as a class, and is recorded per fighter as a note rather than being used to fabricate a per-fighter status.',
  'Nothing is APPROVED without a package that was actually inspected and whose rights hold up.',
]);

/**
 * The provenance question for this roster specifically.
 *
 * This is the finding that matters most, and it is not a close call: MUGEN
 * Naruto characters are built from sprites extracted from commercial Naruto
 * games. Sprite Database catalogues per-character rips from Naruto: Clash of
 * Ninja; community projects such as "NARUTO: Clash of Ninja X MUGEN Project"
 * are explicitly built on that material.
 *
 * The consequence is decisive: a MUGEN author's readme cannot grant reuse of
 * sprites they extracted from someone else's game. So no readme found on such
 * a package could move it to APPROVED, and the importer treats a rip signal as
 * REJECTED regardless of how permissive the accompanying text is.
 */
export const CATEGORY_ASSESSMENT = Object.freeze({
  category: 'Naruto MUGEN characters',
  assessment: 'REJECTED for automatic import',
  confidence: 'high',
  basis: [
    'Sprite Database catalogues per-character sprite rips from Naruto: Clash of Ninja '
    + '(https://spritedatabase.net/game/2360), which is the source material MUGEN Naruto characters are built from.',
    'Community projects name the commercial games directly, e.g. "NARUTO: Clash of Ninja X MUGEN Project" '
    + 'on Mugen Free For All (https://mugenfreeforall.com/topic/38626-naruto-clash-of-ninja-x-mugen-project-sasuke-has-been-released/).',
    'Rights in those sprites sit with the games\' publisher, not with the MUGEN author, '
    + 'so no permission statement in a character package can license them onward.',
  ],
  perFighterNote:
    'No MUGEN package for this fighter was obtained or inspected (see searchNotes). '
    + 'Separately, Naruto MUGEN characters as a class are built on sprites ripped from commercial '
    + 'Naruto games, so this fighter would need a package with genuinely original art before any '
    + 'import could be considered.',
});

/**
 * Per-fighter findings, keyed by roster id.
 *
 * Only fighters with something actually established appear here. Everyone else
 * correctly falls through to NOT_FOUND.
 */
export const FINDINGS = Object.freeze({
  naruto: {
    status: 'REJECTED',
    recommendation: 'REJECT',
    rightsConfidence: 'high',
    spriteOrigin: 'likely ripped',
    audioOrigin: 'likely ripped',
    licenseTerms: 'none that can cover the underlying sprites',
    candidates: [
      {
        name: 'NARUTO: Clash of Ninja X MUGEN Project (community project, multiple characters)',
        creator: 'community project, multiple contributors',
        sourceUrl: 'https://mugenfreeforall.com/topic/38626-naruto-clash-of-ninja-x-mugen-project-sasuke-has-been-released/',
        rightsStatus: 'REJECTED',
        licenseTerms: 'not obtainable — page unreachable from this environment',
      },
    ],
    notes: [
      'Candidate projects exist and were identified by name and URL, but none could be downloaded: '
      + 'the hosting sites are unreachable from this environment.',
      'The project name states its own source material — Clash of Ninja, a commercial game — so its '
      + 'sprites are not the authors\' to license onward. REJECTED for automatic import.',
    ],
  },
  sasuke: {
    status: 'REJECTED',
    recommendation: 'REJECT',
    rightsConfidence: 'high',
    spriteOrigin: 'likely ripped',
    audioOrigin: 'likely ripped',
    licenseTerms: 'none that can cover the underlying sprites',
    candidates: [
      {
        name: 'Sasuke — NARUTO: Clash of Ninja X MUGEN Project',
        creator: 'community project',
        sourceUrl: 'https://mugenfreeforall.com/topic/38626-naruto-clash-of-ninja-x-mugen-project-sasuke-has-been-released/',
        rightsStatus: 'REJECTED',
        licenseTerms: 'not obtainable — page unreachable from this environment',
      },
    ],
    notes: [
      'A named release exists for this character. It is built on Clash of Ninja sprites, '
      + 'so it is REJECTED for automatic import on provenance.',
    ],
  },
});

/**
 * The one MUGEN character with genuinely verifiable terms that was found.
 *
 * Kung Fu Man is Elecbyte's sample character, bundled with MUGEN itself. Its
 * licence was read from a primary source (the MUGEN readme, via a GitHub
 * mirror since elecbyte.com is unreachable here): the sample content is under
 * Creative Commons **NonCommercial**, attribution optional.
 *
 * It is recorded here because it is the honest answer to "is there any MUGEN
 * character with clear terms" — but it is NOT usable for this roster:
 *
 *   1. NonCommercial is a restriction, not a clean grant. Whether it fits this
 *      project is the repo owner's call, not a tool's.
 *   2. Kung Fu Man is not a Naruto character, so he maps to no roster fighter,
 *      and this pipeline is forbidden from creating roster entries.
 */
export const NOTABLE_LICENSED_PACKAGE = Object.freeze({
  name: 'Kung Fu Man (KFM)',
  creator: 'Elecbyte',
  engineVersion: 'MUGEN 1.0 / 1.1 sample content',
  license: 'Creative Commons BY-NC 3.0 — attribution optional, non-commercial only',
  sourceUrl: 'https://github.com/fanyer/mugen/blob/master/readme.txt',
  primarySourceQuote:
    '"licensed under the Creative Commons Noncommercial License, with optional attribution... '
    + 'you don\'t need our permission to build upon or use parts of any of that content for '
    + 'non-commercial purposes."',
  status: 'MANUAL_REVIEW',
  whyNotApproved: [
    'NonCommercial is a restriction on reuse, so it is not a clean grant — whether it suits this '
    + 'project is a decision for the repository owner.',
    'Kung Fu Man does not correspond to any fighter in the 110-fighter roster, and this pipeline '
    + 'never creates roster entries, so he cannot be imported as a character here regardless.',
  ],
  usefulFor: 'A real-world integration test of the parsers, if a copy is placed in imports/mugen/ '
    + 'locally. It is deliberately not committed to this repository.',
});

export default FINDINGS;
