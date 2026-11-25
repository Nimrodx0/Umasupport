'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {EXPECTED, verifyFiles} = require('../tools/verify_pinned_research.cjs');
const {PINNED} = require('../tools/skill_specificity32_research.cjs');
test('retains all historical SHA-256 pins, including the independent aggregate', () => {
  assert.deepEqual(Object.values(EXPECTED.roster32), Object.values(PINNED));
  assert.equal(Object.keys(EXPECTED.expanded).length, 2);
  for (const files of Object.values(EXPECTED))
    for (const hash of Object.values(files)) assert.match(hash, /^[0-9a-f]{64}$/);
});
test('missing, changed, or symlinked cache input cannot pass verification', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pinned-research-test-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const file = path.join(dir, 'one.json');
  const text = '{"model":true}\n';
  const expected = {'one.json': crypto.createHash('sha256').update(text).digest('hex')};
  assert.throws(() => verifyFiles(dir, expected));
  fs.writeFileSync(file, text);
  assert.equal(verifyFiles(dir, expected), 1);
  fs.writeFileSync(file, text + ' ');
  assert.throws(() => verifyFiles(dir, expected), /SHA-256 mismatch/);
  fs.writeFileSync(path.join(dir, 'other.json'), text);
  fs.rmSync(file);
  fs.symlinkSync(path.join(dir, 'other.json'), file);
  assert.throws(() => verifyFiles(dir, expected), /Not a regular file/);
});
