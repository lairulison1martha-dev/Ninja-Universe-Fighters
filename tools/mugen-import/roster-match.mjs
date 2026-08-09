/**
 * Matching a MUGEN package folder against the existing roster.
 *
 * MUGEN folders are named by whoever uploaded them: `naruto`, `Uzumaki Naruto`,
 * `sage naruto by someone (final)`, `EMS Sasuke v2`. This turns that into one
 * of four answers:
 *
 *   base            the fighter themself
 *   transformation  one of that fighter's existing forms
 *   costume         one of that fighter's existing costumes
 *   unknown         nobody, or more than one — and it stays unresolved
 *
 * The rule that matters most is the last one. An alternate form is NEVER a new
 * roster entry: "Sage Naruto" is Naruto's `naruto_sage` transformation, and a
 * package matching two fighters is reported ambiguous rather than assigned to
 * whichever one sorted first.
 *
 * Matching is weighted, not set-membership. "Uzumaki Naruto" shares the token
 * `uzumaki` with Kushina, Karin, Boruto and Menma, so treating a clan name as
 * equal evidence to a given name would make half the roster ambiguous. A
 * fighter id is strong evidence, a given name is strong, a clan name is weak.
 */

/** Words that carry no identity: packaging noise and English glue. */
const STOPWORDS = new Set([
  'and', 'the', 'for', 'from', 'with', 'via', 'mugen', 'char', 'chars',
  'character', 'ver', 'version', 'final', 'release', 'released', 'edit',
  'edited', 'beta', 'alpha', 'wip', 'new', 'old', 'update', 'updated', 'fix',
  'fixed', 'full', 'pack', 'style', 'test', 'demo', 'ai', 'patch', 'mod',
  'ryona', 'nsfw', 'sprite', 'sprites', 'anim', 'anims', 'zip', 'rar',
]);

/**
 * Split a name into comparable tokens.
 *
 * Three characters minimum. Two-letter fragments turn up inside hyphenated
 * names constantly — `kung-fu-man` would otherwise match the fighter `fu` —
 * and a folder that really is named after a short id is caught by the
 * exact-folder-name rule instead.
 */
export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/**
 * Extra names for fighters the roster's display name does not spell out.
 *
 * Deliberately short. Every entry is a name that community packages actually
 * use as the whole folder name, where the display name would never match.
 */
export const FIGHTER_ALIASES = Object.freeze({
  obito: ['tobi', 'juubito', 'jubito'],
  minato: ['yondaime'],
  hiruzen: ['sandaime'],
  raikage4: ['raikage'],
  bee: ['killerbee'],
  pain: ['pein', 'tendo'],
  guy: ['gai', 'maito'],
  lee: ['rocklee'],
  jiraiya: ['ero'],
  white_zetsu: ['whitezetsu'],
  black_zetsu: ['blackzetsu'],
});

/**
 * Terms that name a transformation, matched against the whole package name.
 *
 * `weight` breaks the ladders: "Eternal Mangekyo Sharingan" contains
 * "mangekyo" and "sharingan" too, so without weights an EMS package would map
 * to whichever rule ran first. Most specific wins.
 */
export const FORM_TERMS = Object.freeze([
  { re: /\bbaryon\b/i, id: /_baryon$/, weight: 9, label: 'baryon' },
  { re: /six[\s_-]*paths?|rikudou?|\bsixpaths?\b|\bsm\b/i, id: /_sixpaths$/, weight: 8, label: 'six paths' },
  { re: /kurama[\s_-]*(avatar|link|mode\s*2)|\bkcm ?2\b/i, id: /_kcm2$/, weight: 8, label: 'kurama avatar' },
  { re: /\bkcm ?1?\b|kurama[\s_-]*chakra|chakra[\s_-]*mode|bijuu?[\s_-]*mode/i, id: /_kcm1$/, weight: 6, label: 'kurama chakra mode' },
  { re: /\bsage\b|sennin[\s_-]*mode|senjutsu|\bsm\b/i, id: /_sage$/, weight: 6, label: 'sage mode' },
  { re: /four[\s_-]*tails?|\b4[\s_-]*tails?\b/i, id: /_fourtail$/, weight: 7, label: 'four tails' },
  { re: /one[\s_-]*tail|\b1[\s_-]*tail\b/i, id: /_onetail$/, weight: 7, label: 'one tail' },
  { re: /\bems\b|eternal[\s_-]*mangekyou?/i, id: /_ems$/, weight: 8, label: 'eternal mangekyo' },
  { re: /\brinnegan\b|\brinne[\s_-]*sharingan\b/i, id: /_rinnegan$|_rinne_sharingan$/, weight: 7, label: 'rinnegan' },
  { re: /mangekyou?|\bms\b/i, id: /_mangekyo$/, weight: 5, label: 'mangekyo' },
  { re: /\bsharingan\b/i, id: /_sharingan$/, weight: 3, label: 'sharingan' },
  { re: /curse[\s_-]*mark[\s_-]*(2|two|ii)|\bcm ?2\b|level[\s_-]*2/i, id: /_cm2$/, weight: 8, label: 'curse mark 2' },
  { re: /curse[\s_-]*mark|\bcm ?1?\b|juin/i, id: /_cm1$/, weight: 6, label: 'curse mark' },
  { re: /ten[\s_-]*tails?|juubi(to|dara)?|jinchuriki|\bjuubi\b/i, id: /_obito$|tentail|juubi/, weight: 8, label: 'ten tails' },
  { re: /susanoo?|susano'?o/i, id: /susanoo?/, weight: 7, label: 'susanoo' },
  { re: /\bkarma\b|\bkama\b/i, id: /karma/, weight: 7, label: 'karma' },
  { re: /eight[\s_-]*gates?|\bgates?\b|\bhachimon\b/i, id: /gate/, weight: 6, label: 'eight gates' },
  { re: /awakening|awakened/i, id: /awaken/, weight: 3, label: 'awakening' },
]);

/** Terms that name a costume rather than a form. */
export const COSTUME_TERMS = Object.freeze([
  { re: /edo[\s_-]*tensei|\bedo\b|reanimat/i, id: 'edo', weight: 7, label: 'edo tensei' },
  { re: /white[\s_-]*mask/i, id: 'white_mask', weight: 8, label: 'white mask' },
  { re: /\bmasked?\b/i, id: 'masked', weight: 5, label: 'masked' },
  { re: /shippuu?den/i, id: 'shippuden', weight: 7, label: 'shippuden' },
  { re: /the[\s_-]*last|blank[\s_-]*period/i, id: 'the_last', weight: 7, label: 'the last' },
  { re: /\badult\b|boruto[\s_-]*era/i, id: 'adult', weight: 6, label: 'adult' },
  { re: /\bkid\b|academy|child/i, id: 'kid', weight: 6, label: 'kid' },
  { re: /\byoung\b/i, id: 'young', weight: 5, label: 'young' },
  { re: /\bhokage\b/i, id: 'hokage', weight: 7, label: 'hokage' },
  { re: /\bkazekage\b/i, id: 'kazekage', weight: 7, label: 'kazekage' },
  { re: /\banbu\b/i, id: 'anbu', weight: 7, label: 'anbu' },
  { re: /\bjonin\b|\bjounin\b/i, id: 'jonin', weight: 6, label: 'jonin' },
  { re: /\bgenin\b|chunin[\s_-]*exams?/i, id: 'genin', weight: 6, label: 'genin' },
  { re: /\bsannin\b/i, id: 'sannin', weight: 6, label: 'sannin' },
  { re: /\belder\b|\bold\b/i, id: 'elder', weight: 5, label: 'elder' },
  { re: /war[\s_-]*arc|fourth[\s_-]*war|\bwar\b/i, id: 'war', weight: 5, label: 'war arc' },
  { re: /valley[\s_-]*of[\s_-]*the[\s_-]*end|\bvalley\b/i, id: 'valley', weight: 6, label: 'valley of the end' },
  { re: /time[\s_-]*skip/i, id: 'timeskip', weight: 6, label: 'timeskip' },
  { re: /\btobi\b/i, id: 'tobi', weight: 6, label: 'tobi' },
  { re: /\bbase\b/i, id: 'base', weight: 3, label: 'base form' },
]);

/**
 * Build the lookup once per run.
 *
 * @param {{FIGHTERS: Object, TRANSFORMATIONS: Object, costumesFor: Function}} gameData
 */
export function buildMatchIndex({ FIGHTERS, TRANSFORMATIONS = {}, costumesFor = null }) {
  const fighters = [];
  for (const [id, f] of Object.entries(FIGHTERS)) {
    const nameWords = tokenize(f.displayName);
    fighters.push({
      fighterId: id,
      displayName: f.displayName,
      id,
      idTokens: tokenize(id.replace(/_/g, ' ')),
      givenName: nameWords[0] || id,
      otherNames: nameWords.slice(1),
      aliases: FIGHTER_ALIASES[id] || [],
      // Words are de-duplicated: a costume whose id and name say the same
      // thing ("masked" / "Masked") must not count as two pieces of evidence.
      forms: Object.values(TRANSFORMATIONS)
        .filter((t) => t.fighterId === id)
        .map((t) => ({
          id: t.id, displayName: t.displayName, words: [...new Set(tokenize(t.displayName))],
        })),
      costumes: (costumesFor ? costumesFor(id) : [])
        .filter((c) => c.id !== 'default')
        .map((c) => ({
          id: c.id, name: c.name, words: [...new Set(tokenize(`${c.id} ${c.name}`))],
        })),
    });
  }
  return { fighters, byId: Object.fromEntries(fighters.map((f) => [f.fighterId, f])) };
}

/** Weights. A given name identifies; a clan name barely narrows anything. */
const W = Object.freeze({ exactId: 5, idToken: 3, givenName: 4, otherName: 1, alias: 4 });

/**
 * Which fighter is this package for?
 *
 * @returns {{fighterId, displayName, confidence, reason, candidates, matchedTerms}}
 *   confidence is 'exact' | 'likely' | 'ambiguous' | 'none'
 */
export function matchFighterIn(index, folderName, characterName) {
  const folder = String(folderName || '').toLowerCase();
  const words = new Set([...tokenize(folderName), ...tokenize(characterName)]);

  const scored = [];
  for (const f of index.fighters) {
    let score = 0;
    const why = [];
    for (const w of words) {
      if (w === f.id) { score += W.exactId; why.push(`id "${w}"`); }
      else if (f.idTokens.includes(w)) { score += W.idToken; why.push(`id part "${w}"`); }
      if (w === f.givenName) { score += W.givenName; why.push(`name "${w}"`); }
      else if (f.otherNames.includes(w)) { score += W.otherName; why.push(`clan name "${w}"`); }
      if (f.aliases.includes(w)) { score += W.alias; why.push(`alias "${w}"`); }
    }
    if (score > 0) scored.push({ ...f, score, why });
  }

  // The folder being named exactly after a fighter id settles it outright —
  // checked before the score, so a two-letter id like `fu` still resolves
  // even though the tokenizer will not emit it.
  const exact = index.byId[folder];
  if (exact) {
    return {
      fighterId: exact.fighterId,
      displayName: exact.displayName,
      confidence: 'exact',
      reason: 'the folder is named after the fighter id',
      candidates: [exact.fighterId],
      matchedTerms: [`id "${folder}"`],
    };
  }

  if (!scored.length) {
    return {
      fighterId: null, displayName: null, confidence: 'none',
      reason: 'no roster fighter matches this name', candidates: [], matchedTerms: [],
    };
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score === scored[0].score);
  if (top.length > 1) {
    return {
      fighterId: null, displayName: null, confidence: 'ambiguous',
      reason: `${top.length} fighters match equally well — choose one with --fighter`,
      candidates: top.map((s) => s.fighterId),
      matchedTerms: top[0].why,
    };
  }
  return {
    fighterId: top[0].fighterId,
    displayName: top[0].displayName,
    confidence: 'likely',
    reason: `matched on ${top[0].why.join(', ')}`,
    candidates: [top[0].fighterId],
    matchedTerms: top[0].why,
  };
}

/**
 * Once the fighter is known, is this the fighter, a form, or a costume?
 *
 * A form beats a costume on a tie: Obito has both a `masked` costume and an
 * `obito_masked` transformation, and a MUGEN package carrying a full move set
 * for masked Obito is the form.
 */
export function classifyVariant(index, fighterId, text) {
  const f = index.byId[fighterId];
  if (!f) return { type: 'unknown', formId: null, costumeId: null, terms: [] };
  const haystack = String(text || '');
  const words = new Set(tokenize(haystack));

  /*
   * The fighter's own name must not count as variant evidence. Costume names
   * routinely repeat it ("Young Kakashi"), so without this every package for
   * Kakashi would look like his `young` costume.
   */
  const identity = new Set([
    f.id, f.givenName, ...f.idTokens, ...f.otherNames, ...f.aliases,
  ]);
  const nameEvidence = (variantWords) =>
    variantWords.filter((w) => words.has(w) && !identity.has(w));

  const formHits = [];
  for (const form of f.forms) {
    let score = 0;
    const terms = [];
    for (const t of FORM_TERMS) {
      if (t.id.test(form.id) && t.re.test(haystack)) { score += t.weight; terms.push(t.label); }
    }
    /*
     * Some concepts exist as both a form and a costume — Obito has an
     * `obito_masked` transformation AND a `masked` costume. A costume term
     * that names this exact form counts for the form too, so the pair
     * resolves to the form rather than splitting the evidence.
     */
    for (const t of COSTUME_TERMS) {
      if (form.id === `${fighterId}_${t.id}` && t.re.test(haystack)) {
        score += t.weight; terms.push(t.label);
      }
    }
    // The form's own display name, for anything the term table misses.
    const nameHits = nameEvidence(form.words);
    if (nameHits.length) { score += nameHits.length * 2; terms.push(`name "${nameHits.join(' ')}"`); }
    if (score > 0) formHits.push({ id: form.id, displayName: form.displayName, score, terms });
  }

  const costumeHits = [];
  for (const c of f.costumes) {
    let score = 0;
    const terms = [];
    for (const t of COSTUME_TERMS) {
      if (t.id === c.id && t.re.test(haystack)) { score += t.weight; terms.push(t.label); }
    }
    const nameHits = nameEvidence(c.words);
    if (nameHits.length) { score += nameHits.length * 2; terms.push(`name "${nameHits.join(' ')}"`); }
    if (score > 0) costumeHits.push({ id: c.id, name: c.name, score, terms });
  }

  formHits.sort((a, b) => b.score - a.score);
  costumeHits.sort((a, b) => b.score - a.score);
  const bestForm = formHits[0] || null;
  const bestCostume = costumeHits[0] || null;

  if (bestForm && (!bestCostume || bestForm.score >= bestCostume.score)) {
    return {
      type: 'transformation',
      formId: bestForm.id,
      formName: bestForm.displayName,
      costumeId: null,
      terms: bestForm.terms,
      alternatives: formHits.slice(1, 4).map((h) => h.id),
    };
  }
  if (bestCostume) {
    return {
      type: 'costume',
      formId: null,
      costumeId: bestCostume.id,
      costumeName: bestCostume.name,
      terms: bestCostume.terms,
      alternatives: costumeHits.slice(1, 4).map((h) => h.id),
    };
  }
  return { type: 'base', formId: null, costumeId: null, terms: [], alternatives: [] };
}

/**
 * Full match: fighter + variant, in one call.
 *
 * @returns {Object} `{ fighterId, displayName, confidence, reason, candidates,
 *   type, formId, costumeId, stagingSubpath }`
 */
export function matchPackage(index, folderName, characterName) {
  const who = matchFighterIn(index, folderName, characterName);
  if (!who.fighterId) {
    return { ...who, type: 'unknown', formId: null, costumeId: null, stagingSubpath: null };
  }
  // Both names feed the variant check — a folder called `sage_naruto` and a
  // .def called "Naruto (Sage Mode)" should reach the same answer.
  const variant = classifyVariant(index, who.fighterId, `${folderName} ${characterName || ''}`);
  const sub = variant.type === 'transformation' ? `${who.fighterId}/forms/${variant.formId}`
    : variant.type === 'costume' ? `${who.fighterId}/costumes/${variant.costumeId}`
      : who.fighterId;
  return { ...who, ...variant, stagingSubpath: sub };
}

export default matchPackage;
