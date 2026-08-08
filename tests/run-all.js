#!/usr/bin/env node
/**
 * Test runner.
 *
 *   node tests/run-all.js
 *
 * No dependencies, no build step — just Node with ES modules.
 */

import { report, installBrowserStubs } from './helpers.js';

installBrowserStubs();

const SUITES = [
  './roster-validation.js',
  './ability-validation.js',
  './transformation-validation.js',
  './save-validation.js',
  './combat-validation.js',
  './sprite-validation.js',
  './roster-cleanup.js',
  './costume-validation.js',
  './assist-validation.js',
  './github-pages-paths.js',
  './data-integrity.js',
];

console.log('Ninja Universe Fighters — validation suite\n');

for (const path of SUITES) {
  try {
    const mod = await import(path);
    await mod.run();
  } catch (err) {
    console.error(`\n✗ suite ${path} failed to load:\n  ${err.stack || err.message}\n`);
    process.exitCode = 1;
  }
}

const ok = report();
if (!ok) process.exitCode = 1;
