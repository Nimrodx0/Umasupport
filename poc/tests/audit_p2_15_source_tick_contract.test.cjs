'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const c=require('../tools/audit_p2_15_source_tick_contract.cjs');
const original=[
 'val checks = conditions.map { andConditions ->',
 'andConditions.mapNotNull { checkCondition(skill, it, setting, calculatedConditions) }',
 'if (checks.isEmpty()) return { true }',
 'checks.any { andConditions ->',
 'andConditions.all { it.invoke(this) }',
 'if (!it.preChecked) {',
 'it.preChecked = it.preCheck(this)',
 'return@forEach',
 'if (it.check(this)) {',
 'fun RaceState.checkSkillTrigger()'
].join('\n');
const source=original+'\n'+'// valid padding\n'.repeat(160);
test('original fixed Kotlin checker source verifies OR of AND and preCheck latch, not activation',()=>{
 const ok=c.checkChecker(source);
 assert.equal(ok.originalSourceOrOfAndSourceCodeAnchored,true);
 assert.equal(ok.originalPreconditionTrueLatchCodeAnchored,true);
 assert.equal(ok.originalActualGameRuntimeObserved,false);
 assert.equal(ok.ignoredUnsupportedPredicatesPossibleInOriginalSource,true);
});
test('loss of original source OR or preCheck gate fails closed',()=>{
 assert.throws(()=>c.checkChecker(source.replace(
  'checks.any { andConditions ->','checks.all { andConditions ->')),
  /source semantics changed/);
 assert.throws(()=>c.checkChecker(source.replace(
  'it.preChecked = it.preCheck(this)','it.preChecked = false')),
  /source semantics changed/);
 assert.throws(()=>c.checkChecker(source.replace(
  'fun RaceState.checkSkillTrigger()','fun RaceState.fake()')),
  /fixed source skill check/);
});
test('fixed original registry hash gate excludes synthetic source and full-run claim',()=>{
 assert.throws(()=>c.audit('[]',source),/SHA mismatch/);
 assert.equal(c.SHA.length,64);
});
