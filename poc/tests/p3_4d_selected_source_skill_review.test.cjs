'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../src/p3_4d_selected_source_skill_review.cjs');
function fakeChecker(){
 return 'x'.repeat(11000)+[
  '"always" -> condition.withAssert("==", 1) { { true } }',
  '"running_style" -> condition.preChecked(baseSetting.basicRunningStyle.value)',
  '"straight_random" -> condition.withAssert("==", 1)',
  '"near_count" -> condition.checkSpecialState()',
  '"accumulatetime" -> condition.checkInRace { simulation.currentTime.toInt() }',
  '"distance_type" -> condition.preChecked(baseSetting.trackDetail.distanceType)',
  '"is_lastspurt" -> condition.checkInRaceBool { isInSpurt() }',
  '"phase_firsthalf_random" -> checkInRandom(',
  'baseSetting.initPhaseRandom(condition.value, 0.0 to 0.5)'
 ].join('\n');
}
function fakeSkillData(){
 return 'y'.repeat(11000)+'"near_count" to ApproximateMultiCondition(';
}
function model(){
 return m.verifyChecker(fakeChecker(),fakeSkillData());
}
function fixture(example){
 return {
  source:{id:example.id,name:example.name,
   invokes:[{skillId:example.id,index:1,
    conditions:[example.conditions.map(x=>({...x}))]}]},
  row:{appSkillId:'skill:'+example.id,sourceNumericId:example.id,
   originalName:example.name,
   staticSourceApplicability:{sourceMatch:'matched',possibleContextsFromKnownStatic:128},
   modelPartialWD:{status:'no-additional-short-window-study'},
   selectedSourceANDDisposition:example.id==='203431'?
    'reuse-P2.38-spurt-window-predicates-but-hold-middle-distance-full-AND-W':null,
   unresolvedReasons:['full-original-AND-OR-Invoke-unverified'],
   wholeSkillSuitability:null,suitabilityLabel:null,cardScore:null,
   eligibleForP3CardScoring:false}
 };
}
test('Kotlin source checked: always / static runner style / dynamic special state are distinct',()=>{
 const x=model();
 assert.equal(x.alwaysSourceHandlerReturnsTrue,true);
 assert.equal(x.nearCountUsesApproximateSpecialState,true);
 assert.equal(x.originalRevision,m.PIN);
 assert.throws(()=>m.verifyChecker(fakeChecker().replace(
  '"always" -> condition.withAssert("==", 1) { { true } }','not-always'),
 fakeSkillData()),/mechanism drift: always/);
 assert.throws(()=>m.verifyChecker(fakeChecker(),fakeSkillData().replace(
  '"near_count" to ApproximateMultiCondition(','no-nearby-model')),
 /mechanism drift: approxNear/);
});
test('REAL named source examples in synthetic fixture preserve four DISTINCT evidence conclusions and zero product labels',()=>{
 const seen=new Map();
 for(const x of m.CASES){
  const {source,row}=fixture(x);
  const out=m.inspectOne(source,row,model());
  seen.set(x.id,out);
  assert.equal(out.originalName,x.name);
  assert.deepEqual(out.fullSourceConditionAND,x.conditions);
  assert.equal(out.productStyleLabel,null);
  assert.equal(out.productLabelApproved,false);
  assert.equal(out.wholeOriginalSkillProcRate,null);
  assert.equal(out.cardScore,null);
 }
 assert.equal(seen.get('200432').couldSupportFutureGeneralReview,true);
 assert.equal(seen.get('200432').sourceConditionContrast,
  'source-current-trigger-condition-constant-across-styles');
 assert.equal(seen.get('201312').sourceConditionContrast,
  'source-running-style-gate-restricts-eligibility-to-style-2');
 assert.equal(seen.get('201591').sourceConditionContrast,
  'source-special-state-near-count-unknown-across-styles');
 assert.equal(seen.get('203431').sourceConditionContrast,
  'source-distance-gate-and-dynamic-spurt-phase-AND-unresolved');
});
test('an explicit style restriction is NOT an automatically approved style target',()=>{
 const x=m.CASES[1],v=fixture(x);
 const o=m.inspectOne(v.source,v.row,model());
 assert.equal(o.productStyleLabel,null);
 assert(o.notYetProven.includes(
  'source-restriction-does-not-automatically-certify-product-targeted-label'));
});
test('original source AND/OR and independent app-source identity changes are rejected',()=>{
 const x=m.CASES[0],v=fixture(x);
 v.source.invokes[0].conditions.push([{type:'running_style',operator:'==',value:2}]);
 assert.throws(()=>m.inspectOne(v.source,v.row,model()),/full original source trigger AND/);
 const y=fixture(x);
 y.source.invokes.push(structuredClone(y.source.invokes[0]));
 assert.throws(()=>m.inspectOne(y.source,y.row,model()),/full original source trigger AND/);
 const z=fixture(x);
 z.row.originalName='different name';
 assert.throws(()=>m.inspectOne(z.source,z.row,model()),/source\/app identity mismatch/);
});
test('missing original AND, weakened ground evidence, or product label leakage fails closed',()=>{
 const x=m.CASES[3],a=fixture(x);
 a.row.selectedSourceANDDisposition=null;
 assert.throws(()=>m.inspectOne(a.source,a.row,model()),/P2.43 original distance AND hold/);
 const b=fixture(x);
 b.row.suitabilityLabel='汎用';
 assert.throws(()=>m.inspectOne(b.source,b.row,model()),/source\/app identity mismatch/);
 const c=fixture(x);
 c.row.unresolvedReasons=[];
 assert.throws(()=>m.inspectOne(c.source,c.row,model()),/source\/app identity mismatch/);
 const d=fixture(x);
 d.row.staticSourceApplicability.sourceMatch='unmatched';
 assert.throws(()=>m.inspectOne(d.source,d.row,model()),/source\/app identity mismatch/);
});
