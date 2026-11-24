#!/usr/bin/env node
'use strict';
// Durable identity, not a promise of durable GitHub Actions storage.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {PINNED} = require('./skill_specificity32_research.cjs');
const EXPECTED = Object.freeze({
  roster32: Object.freeze({
    'balanced.json': PINNED.balanced,
    'frontHeavy.json': PINNED.frontHeavy,
    'backHeavy.json': PINNED.backHeavy,
    'noFront.json': PINNED.noFront,
    'roster32-comparison.json': PINNED.priorAggregate
  }),
  expanded: Object.freeze({
    'summary.json': 'd853e79525f0e0fdcacdb0e0e5e96d9af2aa53766a2e8e774cb7d019763954c9',
    'window-profile.json': '92641d16ad597c12082babae6d5784fa82747968aa812f1a2e818c7d8cea6a0d'
  })
});
function verifyFiles(directory, expected) {
  const files = Object.keys(expected);
  if (!files.length) throw Error('No expected research files');
  for (const file of files) {
    const target = path.join(directory, file);
    if (!fs.lstatSync(target).isFile()) throw Error('Not a regular file: ' + file);
    const bytes = fs.readFileSync(target);
    const actual = crypto.createHash('sha256').update(bytes).digest('hex');
    if (actual !== expected[file]) throw Error('Fixed research SHA-256 mismatch: ' + file);
  }
  return files.length;
}
if (require.main === module) {
  try {
    const [mode, directory] = process.argv.slice(2);
    if (!Object.hasOwn(EXPECTED, mode) || !directory) throw Error('Usage: verify_pinned_research.cjs roster32|expanded DIRECTORY');
    console.log('Verified fixed research JSON files: ' + verifyFiles(directory, EXPECTED[mode]));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {EXPECTED, verifyFiles};
