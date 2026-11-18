'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const decisions=require('../tools/p2_g3g4_skill_window_decisions.cjs');
const sha='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
function input(){
 const rows=[
  {skillId:'skill:100',skillName:'short turf',
   sourceNumericId:'100',sourceStatus:'source-structure'},
  {skillId:'skill:101',skillName:'dirt held',
   sourceNumericId:'101',sourceStatus:'source-structure'},
  {skillId:'skill:102',skillName:'other full-phase',
   sourceNumericId:'102',sourceStatus:'source-structure'},
  {skillId:'hint:unavailable',skillName:'unknown',
   sourceNumericId:null,sourceStatus:'unavailable'}
 ].map(x=>({...x,styles:Object.fromEntries(
  ['逃げ','先行','差し','追込'].map(n=>[n,{status:
   x.sourceNumericId?'held':'unavailable'}]))}));
 const modeled={
  skillId:'skill:100',skillName:'short turf',sourceNumericId:'100',
  status:'model-two-axis-partial-original-condition-only',
  windowKey:'phase_laterhalf_random:1',bandId:'top50',
  eligibleStyles:['逃げ','先行','差し','追込'],
  sourceRaceGates:[{type:'ground_type',operator:'==',value:1}],
  modelCourses:[10502],
  styles:Object.fromEntries(['Nige','Senkou','Sasi','Oikomi']
   .map((st,i)=>[st,{
    status:'model-contexts-only',contexts:4,
    byFieldSize:{9:{WPercent:{min:10+i,max:30+i}},
     12:{WPercent:{min:20+i,max:40+i}}},
    deviationDirection:{status:'strict-same-direction-in-all-contexts-and-seed-halves',
     direction:i%2?'-':'+'}
   }])),
  pairs:[['Nige','Senkou'],['Nige','Sasi'],['Nige','Oikomi'],
   ['Senkou','Sasi'],['Senkou','Oikomi'],['Sasi','Oikomi']]
   .map(([first,second],i)=>({
    first,second,status:'model-rank-component-pair-comparison-only',
    WDirection:i===0?
     {status:'held-tie-or-context-reversal',direction:null}:
     {status:'strict-same-direction-in-all-contexts-and-seed-halves',direction:'+'},
    DDirection:{status:'strict-same-direction-in-all-contexts-and-seed-halves',
     direction:'-'}
   }))
 };
 const held={skillId:'skill:101',skillName:'dirt held',sourceNumericId:'101',
  status:'held-source-race-qualifier',
  heldReasons:['unsupported-source-ground-type'],
  windowKey:'phase_firsthalf_random:2',bandId:'top50'};
 return {coarse:{schemaVersion:1,status:
  'P2-rough-skill-by-skill-evidence-review-not-production-rating',
  appSkillCount:4,sourceMatchedSkills:3,rows},
 short:{schemaVersion:1,status:
  'P2.28-balanced-two-axis-source-short-window-model-not-game-proc',
  source:{originalModelRaces:720,sourceUmaSimSHA256:sha},
  summary:{directCandidates:2,modeled:1,heldRaceQualifiers:1,
   modeledPairs:6,stableW:5,heldW:1},
  items:[modeled,held]}};
}
test('source-ID join creates conditional W/D decisions for exact skill without scoring',()=>{
 const {coarse,short}=input(),before=JSON.stringify({coarse,short});
 const x=decisions.join(coarse,short);
 assert.equal(JSON.stringify({coarse,short}),before,'read-only');
 assert.equal(x.status,decisions.STATUS);
 assert.deepEqual(x.summary,{
  appSkills:4,sourceMatched:3,shortWindowSourceCandidates:2,
  conditionalModelEvidenceSkills:1,heldGroundQualifierSkills:1,
  otherSkillsWithoutNewShortWindowEvidence:2,
  oneOriginalAllowedStyleSkills:0,fourOriginalAllowedStylesSkills:1,
  modelComparableWPairs:6,stableModelWPairs:5,heldModelWPairs:1,
  productSkillSuitabilityScores:0
 });
 assert.equal(x.rows[0].decision,'conditionally-use-short-window-rank-evidence');
 assert.equal(x.rows[0].styles.Nige.WPercentByFieldSize[12].min,20);
 assert.deepEqual(x.rows[0].pairs[0].WDirection,{
  status:'held-context-or-seed-inconsistent',direction:null});
 assert.equal(x.rows[0].pairs[1].DDirection.direction,'-');
 assert.equal(x.rows[1].decision,'hold-turf-model-transfer');
 assert.equal(x.rows[2].decision,'no-new-short-window-evidence');
 assert.equal(x.rows[3].sourceNumericId,null);
 assert(x.rows.every(row=>row.wholeSkillSuitability==='not-established'&&
  row.eligibleForP3CardScoring===false&&row.cardScore===null));
});
test('one original allowed style keeps others excluded and has no numeric pairwise zero',()=>{
 const {coarse,short}=input(),x=short.items[0];
 x.eligibleStyles=['先行'];
 for(const st of ['Nige','Sasi','Oikomi'])
  x.styles[st]={status:'explicit-style-ineligible'};
 for(const p of x.pairs){
  p.status='held-explicit-ineligible-pair';
  delete p.WDirection;delete p.DDirection;
 }
 short.summary.stableW=0;short.summary.heldW=0;short.summary.modeledPairs=0;
 const out=decisions.join(coarse,short);
 assert.equal(out.summary.oneOriginalAllowedStyleSkills,1);
 assert.equal(out.rows[0].styles.Nige.status,'original-style-excluded-no-model-W');
 assert.equal(out.rows[0].styles.Senkou.status,
  'conditional-model-only-rank-window-evidence');
 assert(out.rows[0].pairs.every(x=>
  x.status==='not-comparable-explicit-style-eligibility'));
 assert.equal(out.rows[0].cardScore,null);
});
test('no silent identity swap, invented source, or score from incomplete cohort',()=>{
 const {coarse,short}=input();
 short.items[0].sourceNumericId='101';
 assert.throws(()=>decisions.join(coarse,short),/unmatched source ID\/name|duplicate/);
 const q=input();q.short.items[1].heldReasons=[];
 assert.throws(()=>decisions.join(q.coarse,q.short),/surface hold justification/);
 const y=input();y.short.summary.stableW=6;
 assert.throws(()=>decisions.join(y.coarse,y.short),/coverage or W comparisons changed/);
 const w=input();w.short.items[0].pairs[0].WDirection.direction='+';
 assert.throws(()=>decisions.join(w.coarse,w.short),/held direction must be null/);
});
