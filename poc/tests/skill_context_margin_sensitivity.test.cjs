'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../tools/globalsim_roster32.cjs');
const prior=require('../tools/skill_specificity32_research.cjs');
const p229=require('../tools/skill_reference_scenario_gate.cjs');
const audit=require('../tools/skill_context_margin_sensitivity.cjs');
function sourceFixture(){
 const conditions=[];
 for(let i=0;i<32;i++)for(const fieldSize of [9,12]){
  const pairwise=prior.PAIRS.map(([first,second])=>{
   const byScenario=Object.fromEntries(model.SCENARIOS.map(s=>{
    const absent=s==='noFront'&&(first==='Nige'||second==='Nige');
    const reversed=i===1&&fieldSize===12&&s==='backHeavy';
    const status=absent?'held-absent-style':reversed?
     'second-strict-all-matched-contexts':'first-strict-all-matched-contexts';
    const low=i===0?0.5:i===2?4.5:2.5;
    return [s,{scenario:s,status,
     contexts:absent?0:2,
     lowerMeanDifferencePoints:absent?null:reversed?-4:low,
     upperMeanDifferencePoints:absent?null:reversed?-2:low+0.25}];
   }));
   return {first,second,byScenario};
  });
  conditions.push({sourceNumericId:String(200000+i),surface:'turf',
   distanceScope:'mile',timing:'phase_random:1',bandId:'top50',
   fieldSize,modelCourseIds:[10502],pairwise});
 }
 return {schemaVersion:1,
  status:'P2-source32-two-axis-point-specificity-and-10m-pairwise-research-only',
  source:{modelRevision:model.PIN,
   fixedUmaSimSkillRegistrySha256:model.SOURCE_SHA},
  conditions};
}
function makeBaseline(src){
 const crossContextConsistency=p229.contextConsensus(src.conditions);
 return {schemaVersion:1,status:
 'P2.29-comparison-reference-context-sensitivity-not-population-validation',
 originalFixedModelRevision:model.PIN,
 sourceSkillRegistrySha256:model.SOURCE_SHA,
 crossContextConsistency};
}
test('margin thresholds tighten, do not turn robust sign into user-approved tiers',()=>{
 const src=sourceFixture(),base=makeBaseline(src),before=JSON.stringify({src,base});
 const out=audit.analyze(src,base);
 assert.equal(JSON.stringify({src,base}),before);
 assert.equal(out.rows.length,192);
 assert.equal(out.summary.byThreshold['0'].total,186);
 assert.equal(out.summary.byThreshold['1'].total,180);
 assert.equal(out.summary.byThreshold['3'].total,6);
 assert.equal(out.summary.byThreshold['5'].total,0);
 assert.equal(out.summary.originalFullyConsistent,93);
 assert.equal(out.summary.originalConsistentOnObservedOnly,93);
 assert.equal(out.summary.heldOrReversal,6);
 assert.equal(out.design.userApprovedProductThreshold,'none');
 assert.equal(Object.hasOwn(out,'cardScore'),false);
 assert.match(out.limitations[0],/NOT a guarantee/);
});
test('the missing-style condition is not silently treated as an observed zero',()=>{
 const s=sourceFixture(),r=audit.analyze(s,makeBaseline(s));
 const nige=r.rows.find(x=>x.sourceNumericId==='200000'&&x.first==='Nige');
 assert.equal(nige.priorCrossContextStatus,
  'consistent-in-observed-contexts-missing-style-scenario');
 assert.equal(nige.missingStyleScenarioHeadcounts,2);
 assert.equal(nige.measuredScenarioHeadcounts,6);
 assert.equal(nige.thresholdSensitivity['0'],
  'strict-above-margin-in-tested-contexts');
 assert.equal(nige.thresholdSensitivity['1'],'margin-not-proven');
 const reversed=r.rows.find(x=>x.sourceNumericId==='200001'&&x.first==='Senkou');
 assert.equal(reversed.priorCrossContextStatus,
  'observed-context-direction-reversal');
 assert.equal(reversed.minimumConservativeScenarioMeanDifferencePoints,null);
});
test('scenario mean interval is conservative but cannot prove all individual courses and seeds',()=>{
 const src=sourceFixture(),base=makeBaseline(src);
 let p=src.conditions[0].pairwise.find(x=>x.first==='Nige');
 p.byScenario.balanced.lowerMeanDifferencePoints=0.1;
 const r=audit.analyze(src,base);
 const x=r.rows.find(y=>y.sourceNumericId==='200000'&&y.first==='Nige');
 assert.equal(x.minimumConservativeScenarioMeanDifferencePoints,0.1);
 assert.equal(x.thresholdSensitivity['0'],'strict-above-margin-in-tested-contexts');
 assert.equal(x.thresholdSensitivity['1'],'margin-not-proven');
});
test('wrong source, missing/mismatched source rows and falsified directions fail closed',()=>{
 const src=sourceFixture(),base=makeBaseline(src);
 const a=structuredClone(src);a.source.modelRevision='unknown';
 assert.throws(()=>audit.analyze(a,base),/identity mismatch/);
 const b=structuredClone(src);b.conditions[0].pairwise.pop();
 assert.throws(()=>audit.analyze(b,base),/malformed source profile/);
 const c=structuredClone(src);c.conditions[1].fieldSize=9;
 assert.throws(()=>audit.analyze(c,base),/missing 9\/12/);
 const d=structuredClone(src);
 d.conditions[0].pairwise[0].byScenario.balanced.lowerMeanDifferencePoints=-5;
 assert.throws(()=>audit.analyze(d,base),/contradicted by interval/);
 const e=structuredClone(src);
 e.conditions[0].pairwise[0].byScenario.noFront.lowerMeanDifferencePoints=0;
 assert.throws(()=>audit.analyze(e,base),/absent style must retain null/);
});
