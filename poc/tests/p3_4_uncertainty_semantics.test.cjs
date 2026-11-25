'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const p34=require('../src/p3_4_uncertainty_semantics.cjs');
const STYLES=['Nige','Senkou','Sasi','Oikomi'];
const plus={status:'model-only-same-direction',direction:'+'};
const minus={status:'model-only-same-direction',direction:'-'};
const held={status:'held-context-or-seed-inconsistent',direction:null};
const pairs=()=>STYLES.flatMap((x,i)=>STYLES.slice(i+1).map(y=>({
 first:x,second:y,status:'partial-original-rank-window-model-comparison',
 WDirection:plus,DDirection:minus
})));
const branch=(distance)=>({
 sourceDistanceType:distance,
 sourceWindow:'phase_firsthalf_random:2',sourceRankBand:'top-50',
 scope:{modelCourseIds:[10504],fixedDistanceScopeOnly:true},
 pairs:pairs().map(p=>({...p,
  status:'fixed-model-partial-rank-window-evidence-only'}))
});
function row(masks,id='200001'){
 return {originalNumericSourceId:id,
  explicitThreeAxisNecessaryOnly:id===null?
   {status:'source-unavailable',potentialGroundStateMasks:null}:
   {status:'static-necessary-gates-only',potentialGroundStateMasks:masks}};
}
function study(decision,evidence=null,heldReasons=null){
 return {partialModelWD:{decision,evidence,originalWholeSkillANDNotEstablished:true,
  sourceScopeMustBeRetained:true,
  heldOriginalGroundQualifierReasons:heldReasons}};
}
test('source not matched, explicit static excluded and not-ruled-out remain three distinct categories',()=>{
 const masks=Array(32).fill(15);
 // style=1, distance=3, ground=2 index5: only ground_condition 2 remains possible.
 masks[5]=2;
 const x=row(masks),fixed={runningStyle:1,distanceType:3,
  groundType:2,groundCondition:2};
 assert.equal(p34.contextApplicability(x,fixed),
  'not-excluded-by-known-source-static-gates-dynamic-unknown');
 assert.equal(p34.contextApplicability(x,{...fixed,groundCondition:1}),
  'excluded-in-this-context-by-known-source-static-necessary-gates');
 assert.equal(p34.contextApplicability(row(null,null),fixed),
  'source-unmatched-applicability-unknown');
 assert.deepEqual(p34.staticSummary(x),{
  sourceMatch:'matched',possibleContextsFromKnownStatic:125,
  excludedContextsFromKnownStatic:3,
  possibleIsActivation:false,fullSourceEligibilityKnown:false
 });
 assert.deepEqual(p34.staticSummary(row(null,null)),{
  sourceMatch:'unmatched',
  possibleContextsFromKnownStatic:null,excludedContextsFromKnownStatic:null,
  possibleIsActivation:false,fullSourceEligibilityKnown:false
 });
 assert.throws(()=>p34.contextApplicability(x,{...fixed,groundCondition:0}),
  /invalid source necessary-condition panel query/);
 assert.throws(()=>p34.staticSummary(row(Array(32).fill(100))),
  /malformed original static bitmask/);
});
test('strict model direction, held tie/reversal, and W versus D conflict stay independent and ungraded',()=>{
 const x=p34.comparisons(pairs(),'P2.34');
 assert.equal(x.length,6);
 assert.equal(x[0].W.status,'direction-repeated-in-fixed-model-only');
 assert.equal(x[0].W.higher,'first');
 assert.equal(x[0].D.higher,'second');
 assert.equal(x[0].oppositeWAndDDirections,true);
 assert.equal(x[0].W.numericGameProbability,null);
 assert.equal(x[0].D.wholeSkillStyleRank,null);
 const heldPairs=pairs();heldPairs[0].WDirection=held;
 const out=p34.comparisons(heldPairs,'P2.34');
 assert.equal(out[0].W.status,
  'held-tie-reversal-or-context-seed-instability-undifferentiated');
 assert.equal(out[0].W.higher,null);
 // Earlier P2.41 did not disambiguate tie from reversal. We must not label it as one.
 assert.throws(()=>p34.direction({status:'held-context-or-seed-inconsistent',
  direction:'-'}),/unknown or fabricated stable direction/);
 assert.throws(()=>p34.direction({status:'model-only-same-direction',
  direction:null}),/model direction sign missing/);
});
test('explicit original style ineligibility means not compared, NEVER model W zero or low skill suitability',()=>{
 const original=pairs();
 original[0]={first:'Nige',second:'Senkou',
  status:'not-comparable-explicit-style-eligibility'};
 const comp=p34.comparisons(original,'P2.34');
 assert.equal(comp[0].status,'source-style-explicitly-not-comparable');
 assert.equal(comp[0].W,null);
 assert.equal(comp[0].D,null);
 assert.equal(comp[1].modelOnly,true);
 original[0].WDirection=plus;
 assert.throws(()=>p34.comparisons(original,'P2.34'),
  /original style exclusion cannot be converted to W=0/);
 const wrong=pairs();wrong[5].first='Nige';
 assert.throws(()=>p34.comparisons(wrong,'P2.34'),
  /original source pair order or identity changed/);
});
test('model W/D direct study is restricted to source scope, and unstudied/ground-held remain null',()=>{
 const direct=study('conditionally-use-short-window-rank-evidence',{
  source:'P2.34',
  scope:{sourceWindow:'phase_firsthalf_random:2',
   modelCourseIds:[10504],scenario:'balanced-only-fixed-turf'},
  stylePairComparisons:pairs()
 });
 const result=p34.scopedModel(direct);
 assert.equal(result.status,'partial-source-window-research-only');
 assert.equal(result.branches.length,1);
 assert.equal(result.branches[0].scope.modelCourseIds[0],10504);
 assert.equal(result.transferableToUnstudiedCourse,false);
 assert.equal(result.realGameActivationRate,null);
 assert.deepEqual(p34.scopedModel(study('no-new-short-window-evidence')),
  {status:'no-additional-short-window-study',branches:[],
   realGameActivationRate:null});
 assert.equal(p34.scopedModel(study('hold-turf-model-transfer',null,
  ['source-dirt-limited'])).status,'held-source-ground-not-covered-by-model');
 assert.throws(()=>p34.scopedModel(study('no-new-short-window-evidence',
  {scope:{modelCourseIds:[10504]}})),/must not carry a measurement/);
 assert.throws(()=>p34.scopedModel(study('hold-turf-model-transfer',null,
  [])),/original ground hold has no reason/);
});
test('middle/long source OR branch cannot be averaged; unknown D stays held independently',()=>{
 const b3=branch(3),b4=branch(4);
 b4.pairs[0].DDirection=held;
 const x=p34.scopedModel(study(
  'conditionally-use-source-exception-branch-W-D',{
   source:'P2.36',originalP235Decision:
    'source-logic-adopt-distance-exclusive-OR',
   independentlyInterpretedSourceBranches:[b3,b4]
  }));
 assert.equal(x.branches.length,2);
 assert.deepEqual(x.branches.map(b=>b.sourceDistanceType),[3,4]);
 assert.equal(x.originalSeparateBranchesMayNotBeAveraged,true);
 assert.equal(x.branches[0].WAndD[0].D.higher,'second');
 assert.equal(x.branches[1].WAndD[0].D.higher,null);
 assert.equal(x.branches[1].WAndD[0].W.higher,'first');
 const missing=study('conditionally-use-source-exception-branch-W-D',{
  source:'P2.36',originalP235Decision:
   'source-logic-adopt-distance-exclusive-OR',
  independentlyInterpretedSourceBranches:[b3,branch(3)]
 });
 assert.throws(()=>p34.scopedModel(missing),
  /original distance OR branch scope lost/);
 const wrong=study('conditionally-use-source-exception-branch-W-D',{
  source:'P2.36',originalP235Decision:
   'source-logic-adopt-distance-exclusive-OR',
  independentlyInterpretedSourceBranches:[b3,branch(1)]
 });
 assert.throws(()=>p34.scopedModel(wrong),
  /two mutually exclusive source branches must remain middle\/long/);
});
