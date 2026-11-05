'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {validateDocs, scanIssues} = require('../tools/check_project_tracking.cjs');

test('published counts, roadmap and status always follow the actual shipped catalog', () => {
  const result = validateDocs();
  assert.ok(result.events > 0);
  assert.ok(result.cards > 0);
});

test('open issues cannot advertise pre-release zero after events are public', () => {
  const issue = {number: 302, state: 'open',
    title: 'source review',
    body: '## Why this blocks\nReal published events: 0'};
  assert.deepEqual(scanIssues([issue], 2487), ['#302: stale zero-release claim']);
  assert.deepEqual(scanIssues([issue], 0), []);
});

test('historical legacy claims do not count as current state', () => {
  const issue = {number: 302, state: 'open', title: 'review',
    body: '## 現在の状態\n公開中。残る課題は25件。\n\n' +
      '<!-- historical:begin -->\nReal published events: 0\n<!-- historical:end -->'};
  assert.deepEqual(scanIssues([issue], 2487), []);
});

test('issues with no stale zero release assertion do not require alteration', () => {
  const issue = {number: 283, state: 'open', title: 'Pending new cards',
    body: 'New cards awaiting source JSON'};
  assert.deepEqual(scanIssues([issue], 2487), []);
});
