'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const src=require('../src/skill_phase_random_source_window_audit.cjs');
const blockers=require('../src/skill_source_path_blocker_impact.cjs');
const c=(type,operator,value)=>({type,operator,value});
function syntheticChecker(){
 return [
  '"phase_random" -> checkInRandom(calculatedAreas, condition.type + condition.value) {',
  '    baseSetting.initPhaseRandom(condition.value)',
  '}',
  ...src.CHECKER_ANCHORS.slice(2)
 ].join('\n');
}
function skill(n,invokes){
 return {id:'skill:'+n,name:'Source '+n,activationProfile:{
  status:'source-structure',sourceNumericId:String(n),
  invokes:invokes.map((x,index)=>({index,
   preConditions:x.pre||[],conditions:x.conditions||[]}))}};
}
function sample(){
 const skills=[
  skill(100,[{conditions:[
   [c('phase_random','==',1),c('running_style','==',2),c('distance_type','==',2)],
   [c('phase_random','==',2),c('is_overtake','==',1)]
  ],pre:[[c('distance_type','==',2)],[c('distance_type','==',3)]]}]),
  skill(101,[{conditions:[[c('phase_random','!=',2),c('ground_type','==',1)]]}]),
  skill(102,[{conditions:[[c('phase_random','==',8)]]}]),
  skill(103,[{conditions:[[c('phase_random','==',0),c('phase_random','==',1)]]}]),
  skill(104,[{conditions:[[]],pre:[
   [c('phase_random','==',2)],[c('is_overtake','==',1)]
  ]}]),
  skill(105,[{conditions:[[c('phase_random','==',1),c('order_rate','>=',50)]]}]),
  {id:'hint:unmatched',name:'unmatched',activationProfile:{
   status:'unavailable',reason:'not-sourced'}}
 ];
 const model={cards:[{id:'card',hints:[],events:[]}],skills,
  skillById:Object.fromEntries(skills.map(x=>[x.id,x]))};
 const impact=blockers.audit(model,['100']);
 return {model,impact};
}
test('source checker must be pinned to actual phase-window cached-interval semantics',()=>{
 const a=src.verifyPinnedChecker(syntheticChecker());
 assert.equal(a.fixedUmaSimRevision,src.SOURCE_REV);
 assert.equal(a.sourceConditionOperatorUsedByThisDispatch,false);
 assert.equal(a.simulationAndTrueSkillTriggerMeasured,false);
 assert.throws(()=>src.verifyPinnedChecker(syntheticChecker().replace(
  'min(start + 10.0, zoneEnd)','min(start + 20.0, zoneEnd)')),
  /missing, duplicate or changed/);
 assert.throws(()=>src.verifyPinnedChecker(syntheticChecker().replace(
  '"phase_random" -> checkInRandom','"phase_random" -> condition.checkInRace')),
  /changed pinned window|not the pinned/);
});
test('phase-only blocker candidates preserve exact OR/pre-OR provenance and held operators',()=>{
 const {model,impact}=sample(),before=JSON.stringify(model);
 const out=src.audit(model,impact,syntheticChecker());
 assert.equal(JSON.stringify(model),before);
 assert.equal(out.provenance.upstreamContentEmbedded,false);
 assert.equal(out.summary.originalMatchedSkills,6);
 assert.equal(out.summary.phaseRandomSingletonCandidateSkills,5);
 assert.equal(out.summary.phaseRandomSingletonCandidateStyleCells,17);
 assert.equal(out.summary.fullyEvaluatedSourceRoutes,0);
 assert.equal(out.summary.actualSkillProcObservations,0);
 assert.equal(out.summary.officialSkillSuitabilityRatings,0);
 const rows=out.rows.filter(x=>x.sourceNumericId==='100');
 assert.deepEqual(rows.map(x=>x.style),['先行']);
 assert.equal(rows[0].researchPaths.length,1,
  'sibling OR with an is_overtake blocker is not the same source AND');
 assert.equal(rows[0].researchPaths[0].conditionOrIndex,0);
 assert.equal(rows[0].researchPaths[0].preconditionOrIndex,0);
 assert.equal(rows[0].researchPaths[0].preconditionOrCount,2);
 const heldOperator=out.rows.find(x=>x.sourceNumericId==='101');
 assert.equal(heldOperator.researchPaths[0].state,
  'unsupported-original-operator-or-phase-number');
 assert.equal(heldOperator.researchPaths[0].phasePredicates[0].operator,'!=');
 assert.equal(heldOperator.researchPaths[0].phasePredicates[0]
  .operatorInterpretedAsRuntimeComparison,false);
 const heldId=out.rows.find(x=>x.sourceNumericId==='102');
 assert.equal(heldId.researchPaths[0].phasePredicates[0].phaseNumberSupportedByResearch,false);
 const crossed=out.rows.find(x=>x.sourceNumericId==='103');
 assert.equal(crossed.researchPaths[0].totalSourcePhasePredicates,2);
 assert.equal(crossed.researchPaths[0].noFullConditionOrProcClaim,true);
 const pre=out.rows.find(x=>x.sourceNumericId==='104');
 assert.equal(pre.researchPaths[0].phasePredicates[0].side,'preConditions');
 assert.equal(pre.researchPaths[0].preconditionOrIndex,0);
 assert(!out.rows.some(x=>x.sourceNumericId==='105'),
  'rank AND cannot be upgraded using a phase-only window');
 assert(!out.rows.some(x=>x.sourceNumericId==='106'),
  'unavailable source never becomes a zero or a fit');
 assert(!('productRatings' in out));
});
test('tampered or mismatched blocker audit must not silently promote partial conditions',()=>{
 const {model,impact}=sample();
 const wrong=structuredClone(impact);
 wrong.rows[0].byStyle['先行'].status='only-finite-predicate-types-in-some-route';
 assert.throws(()=>src.audit(model,wrong,syntheticChecker()),
  /promoted across another/);
 const removed=structuredClone(impact);
 removed.rows[0].sourceNumericId='999';
 assert.throws(()=>src.audit(model,removed,syntheticChecker()),
  /missing exact app skill/);
 const broken=structuredClone(impact);
 broken.denominators.appSkills=999;
 assert.throws(()=>src.audit(model,broken,syntheticChecker()),
  /not aligned/);
});
