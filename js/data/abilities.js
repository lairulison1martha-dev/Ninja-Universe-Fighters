/**
 * Ability registry aggregator.
 *
 * Importing this module guarantees every ability module has run, so
 * ABILITIES contains the complete set.
 */

import { ABILITY_REGISTRY, getAbility, mk, projectile } from './ability-schema.js';
import { templateKit } from './abilities-core.js';
import * as SIG_A from './abilities-signature-a.js';
import * as SIG_B from './abilities-signature-b.js';

export const ABILITIES = ABILITY_REGISTRY;

/** Hand-authored kits, keyed by fighter id. */
export const SIGNATURE_KITS = {
  naruto: SIG_A.NARUTO_KIT,
  sasuke: SIG_A.SASUKE_KIT,
  sakura: SIG_A.SAKURA_KIT,
  kakashi: SIG_A.KAKASHI_KIT,
  lee: SIG_A.LEE_KIT,
  gaara: SIG_A.GAARA_KIT,
  itachi: SIG_A.ITACHI_KIT,
  pain: SIG_A.PAIN_KIT,
  madara: SIG_A.MADARA_KIT,
  boruto: SIG_A.BORUTO_KIT,
  kawaki: SIG_B.KAWAKI_KIT,
  momoshiki: SIG_B.MOMOSHIKI_KIT,
  minato: SIG_B.MINATO_KIT,
  hashirama: SIG_B.HASHIRAMA_KIT,
  guy: SIG_B.GUY_KIT,
  bee: SIG_B.BEE_KIT,
  obito: SIG_B.OBITO_KIT,
  jiraiya: SIG_B.JIRAIYA_KIT,
  orochimaru: SIG_B.OROCHIMARU_KIT,
  tsunade: SIG_B.TSUNADE_KIT,
};

export function abilityCount() {
  return Object.keys(ABILITY_REGISTRY).length;
}

export { getAbility, templateKit, mk, projectile };
