'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {requiresStatusUpdate,checkChangedFiles,checkGitDiff}=require('../tools/check_status_freshness.cjs');

test('research, app, source and upstream workflows require same-PR status change',()=>{
  for(const p of [
    'poc/src/skill_tendency.cjs',
    'poc/source-probes/P215SourcePhaseWindowRuntimeTest.kt',
    'poc/data/reviewed_events.v1.json',
    'docs/evidence/skills/new-research.md',
    'docs/plans/skill-conditions/p2.md',
    'docs/project/roadmap.md',
    '.github/workflows/p2-umasim-source-window-runtime.yml'
  ]) assert.equal(requiresStatusUpdate(p),true,p);
  assert.throws(()=>checkChangedFiles(['docs/evidence/skills/latest.md']),/without docs\/project\/status\.md/);
  assert.deepEqual(checkChangedFiles(['docs/evidence/skills/latest.md','docs/project/status.md']),
    {material:1,statusChanged:true});
});

test('nonprogress-only documentation changes do not force a new measurement',()=>{
  for(const p of ['docs/archive/old.md','docs/governance/documentation-policy.md',
    'docs/project/status.md','README.md','poc/tests/project_tracking.test.cjs'])
    assert.equal(requiresStatusUpdate(p),false,p);
  assert.deepEqual(checkChangedFiles(['docs/archive/old.md']),
    {material:0,statusChanged:false});
});

test('empty and invalid Git baselines fail closed',()=>{
  assert.throws(()=>checkGitDiff(''),/STATUS_DIFF_BASE/);
  assert.throws(()=>checkGitDiff('0'.repeat(40)),/STATUS_DIFF_BASE/);
});
