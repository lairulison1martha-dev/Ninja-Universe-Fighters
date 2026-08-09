/**
 * .st — state files.
 *
 * Syntactically identical to .cns; MUGEN just splits large characters across
 * `char.st`, `st1`, `st2`… and the common-state file. Same parser, separate
 * module so the pipeline reads the way the brief describes it.
 */

export { parseCns as parseSt, parseCnsText as parseStText, mergeCns } from './parse-cns.mjs';
export { parseCns as default } from './parse-cns.mjs';
