/**
 * Reuse-rights assessment.
 *
 * This is the gate. Nothing is imported because it parsed cleanly — it is
 * imported because the rights are clear, and the default answer is no.
 *
 * The honest position on MUGEN is that the overwhelming majority of character
 * packages are built from sprites ripped out of commercial games, and are
 * shared inside a community that tolerates that without anyone actually
 * holding the rights to grant reuse. A readme saying "free to use" from
 * someone who did not own the sprites does not make them reusable, so an
 * explicit grant raises confidence but never on its own produces APPROVED for
 * art that looks ripped.
 *
 * Statuses:
 *   APPROVED       an identifiable licence permits reuse AND the assets do not
 *                  look ripped.
 *   MANUAL_REVIEW  something is unclear, missing, or in tension.
 *   REJECTED       an explicit prohibition, or clear evidence of ripped assets.
 *   NOT_FOUND      no package to assess.
 */

import path from 'node:path';
import { readText, walkPackage, isExecutable } from './limits.mjs';

export const STATUS = Object.freeze({
  APPROVED: 'APPROVED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  REJECTED: 'REJECTED',
  NOT_FOUND: 'NOT_FOUND',
});

/** Filenames that usually carry the terms. */
const DOC_PATTERNS = [
  /readme/i, /read_?me/i, /licen[cs]e/i, /copying/i, /terms/i, /rights/i,
  /credits?/i, /info\.txt/i, /about/i, /notice/i, /説明/, /_r\.txt$/i,
];

/** Phrases that grant reuse. */
const PERMISSIVE = [
  { re: /\bCC0\b|creative\s+commons\s+zero|public\s+domain/i, weight: 5, label: 'CC0 / public domain' },
  { re: /\bMIT\s+licen[cs]e\b/i, weight: 5, label: 'MIT' },
  { re: /\bapache\s+licen[cs]e\b/i, weight: 4, label: 'Apache' },
  { re: /\bCC[- ]BY(?![- ]NC)/i, weight: 4, label: 'CC-BY' },
  { re: /\bGPL\b|\bGNU\s+general\s+public/i, weight: 3, label: 'GPL' },
  { re: /free\s+to\s+(use|edit|modify|reuse)/i, weight: 2, label: 'stated free to use' },
  { re: /you\s+(may|can)\s+(freely\s+)?(use|edit|modify|reuse|redistribute)/i, weight: 2, label: 'explicit permission' },
  { re: /open\s+source/i, weight: 2, label: 'described as open source' },
  { re: /permission\s+is\s+(hereby\s+)?granted/i, weight: 3, label: 'permission granted' },
  { re: /no\s+need\s+to\s+ask/i, weight: 2, label: 'no permission needed' },
];

/** Phrases that forbid it. */
const RESTRICTIVE = [
  { re: /do\s*n[o']?t\s+(edit|modify|rip|steal|reupload|re-?upload|redistribute)/i, weight: 5, label: 'explicit prohibition' },
  { re: /permission\s+(is\s+)?required|ask\s+(me\s+)?(first|before)/i, weight: 4, label: 'permission required' },
  { re: /private\s+(release|edit)|not\s+for\s+(public\s+)?release/i, weight: 5, label: 'private release' },
  { re: /all\s+rights\s+reserved/i, weight: 3, label: 'all rights reserved' },
  { re: /\bNC\b|non[- ]?commercial/i, weight: 2, label: 'non-commercial only' },
  { re: /\bND\b|no[- ]?deriv/i, weight: 4, label: 'no derivatives' },
  { re: /personal\s+use\s+only/i, weight: 4, label: 'personal use only' },
];

/**
 * Signals that the art came out of a commercial game.
 *
 * These are the names that appear in Naruto MUGEN readmes and folder names.
 * Matching one is not proof, but it moves a package to REJECTED for automatic
 * import, which is the correct default.
 */
const RIP_SIGNALS = [
  { re: /\bripped?\s+(from|by)\b/i, label: 'says "ripped from"' },
  { re: /sprites?\s+(from|by)\s+(the\s+)?(game|capcom|snk|bandai|namco|nintendo|arc\s*system)/i, label: 'sprites credited to a commercial publisher' },
  { re: /clash\s+of\s+ninja|gekitou\s+ninja|ultimate\s+ninja|naruto\s+shippuden:?\s+/i, label: 'names a commercial Naruto game' },
  { re: /jump\s+(ultimate|super)\s+stars/i, label: 'names Jump Ultimate Stars' },
  { re: /\b(nds|gba|snes|psx|ps2|arcade)\s+rip/i, label: 'names a console rip' },
  { re: /capcom|\bsnk\b|bandai|namco|nintendo|arc\s*system\s*works|sega\b/i, label: 'names a commercial publisher' },
  { re: /spriters?[- ]resource/i, label: 'references The Spriters Resource' },
];

/** Audio that is almost certainly not the author's to license. */
const AUDIO_RIP_SIGNALS = [
  { re: /voice\s*(clips?|lines?|rip)/i, label: 'mentions voice clips' },
  { re: /from\s+the\s+anime|anime\s+(voice|audio|rip)/i, label: 'mentions anime audio' },
  { re: /\bOST\b|soundtrack/i, label: 'mentions a soundtrack' },
];

/** Collect the text of every licence-ish document in a package. */
export function collectDocuments(root, allFiles = null) {
  const files = allFiles || walkPackage(root).files;
  const docs = [];
  for (const f of files) {
    const base = path.basename(f);
    const ext = path.extname(f).toLowerCase();
    if (!['.txt', '.md', '', '.nfo', '.rtf'].includes(ext)) continue;
    if (!DOC_PATTERNS.some((re) => re.test(base))) continue;
    try {
      const text = readText(root, f);
      docs.push({ path: f, bytes: text.length, text });
    } catch {
      docs.push({ path: f, bytes: 0, text: '', unreadable: true });
    }
  }
  return docs;
}

/**
 * Assess a package's reuse rights.
 *
 * @param {string} root package root
 * @param {Object} opts { defInfo, allFiles, declared }
 *   `declared` is an optional rights record a human wrote into
 *   `<package>/nuf-rights.json` after checking the source page.
 */
export function checkLicense(root, { defInfo = null, allFiles = null, declared = null } = {}) {
  const files = allFiles || walkPackage(root).files;
  if (!files.length) {
    return {
      status: STATUS.NOT_FOUND,
      confidence: 'none',
      reasons: ['The package is empty'],
      documents: [], permissive: [], restrictive: [],
      spriteOrigin: 'unknown', audioOrigin: 'unknown',
      redistributionAllowed: null, reuseAllowed: null,
      creator: null, license: null,
    };
  }

  const docs = collectDocuments(root, files);
  const corpus = docs.map((d) => d.text).join('\n').slice(0, 400000);
  const haystack = `${corpus}\n${files.join('\n')}`;

  const permissive = PERMISSIVE.filter((p) => p.re.test(corpus)).map((p) => p.label);
  const restrictive = RESTRICTIVE.filter((p) => p.re.test(corpus)).map((p) => p.label);
  const ripSignals = RIP_SIGNALS.filter((p) => p.re.test(haystack)).map((p) => p.label);
  const audioSignals = AUDIO_RIP_SIGNALS.filter((p) => p.re.test(corpus)).map((p) => p.label);

  const permScore = PERMISSIVE.filter((p) => p.re.test(corpus)).reduce((n, p) => n + p.weight, 0);
  const restScore = RESTRICTIVE.filter((p) => p.re.test(corpus)).reduce((n, p) => n + p.weight, 0);

  const executables = files.filter(isExecutable);
  const hasAudio = files.some((f) => ['.snd', '.wav', '.mp3', '.ogg'].includes(path.extname(f).toLowerCase()));

  const reasons = [];
  if (!docs.length) reasons.push('No readme or licence file in the package');
  for (const p of permissive) reasons.push(`Permissive: ${p}`);
  for (const r of restrictive) reasons.push(`Restrictive: ${r}`);
  for (const s of ripSignals) reasons.push(`Rip signal: ${s}`);
  if (executables.length) {
    reasons.push(`Contains ${executables.length} executable file(s), which were not opened`);
  }

  // A human-written rights record beats inference, but is still recorded as
  // an assertion rather than treated as proof.
  if (declared) {
    reasons.push(`Declared by a reviewer in nuf-rights.json: ${declared.license || 'unspecified'}`);
  }

  const spriteOrigin = ripSignals.length ? 'likely ripped'
    : permScore >= 4 ? 'likely original'
      : 'unknown';
  const audioOrigin = !hasAudio ? 'none present'
    : audioSignals.length ? 'likely ripped'
      : 'unknown';

  let status;
  let confidence;
  if (restScore >= 4 || ripSignals.length) {
    status = STATUS.REJECTED;
    confidence = ripSignals.length ? 'high' : 'medium';
    if (ripSignals.length) {
      reasons.push('Rejected for automatic import: the assets look ripped from a commercial game, '
        + 'so no readme in the package can grant reuse rights over them.');
    }
  } else if (declared?.reuseAllowed === true && declared?.verifiedBy && !ripSignals.length) {
    status = STATUS.APPROVED;
    confidence = 'high';
    reasons.push(`Approved on a reviewer's verified declaration (${declared.verifiedBy})`);
  } else if (permScore >= 5 && !restrictive.length && spriteOrigin === 'likely original') {
    status = STATUS.APPROVED;
    confidence = 'medium';
  } else {
    status = STATUS.MANUAL_REVIEW;
    confidence = permScore || restScore ? 'low' : 'none';
    if (!docs.length) {
      reasons.push('Manual review: with no stated terms, reuse cannot be assumed.');
    }
  }

  return {
    status,
    confidence,
    reasons,
    documents: docs.map((d) => ({ path: d.path, bytes: d.bytes, unreadable: !!d.unreadable })),
    permissive,
    restrictive,
    ripSignals,
    audioSignals,
    executables,
    spriteOrigin,
    audioOrigin,
    redistributionAllowed: status === STATUS.APPROVED ? true
      : status === STATUS.REJECTED ? false : null,
    reuseAllowed: status === STATUS.APPROVED ? true
      : status === STATUS.REJECTED ? false : null,
    creator: declared?.creator || defInfo?.author || null,
    license: declared?.license || (permissive[0] || null),
    source: declared?.source || null,
    /** Audio never rides along on a sprite approval. */
    audioImportAllowed: !!(declared?.audioReuseAllowed === true && status === STATUS.APPROVED),
  };
}

/** Read a reviewer's rights declaration, if the package carries one. */
export function readDeclaredRights(root, allFiles = null) {
  const files = allFiles || walkPackage(root).files;
  const hit = files.find((f) => path.basename(f).toLowerCase() === 'nuf-rights.json');
  if (!hit) return null;
  try {
    return JSON.parse(readText(root, hit));
  } catch {
    return null;
  }
}

export default checkLicense;
