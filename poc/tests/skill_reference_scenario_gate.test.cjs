'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const audit=require('../tools/skill_reference_scenario_gate.cjs');
const model=require('../tools/globalsim_roster32.cjs');
const pairs=require('../tools/skill_specificity32_research.cjs').PAIRS;
function fake(){
 const conditions=[],headcount=[];
 const status='first-strict-all-matched-contexts';
 for(let profile=0;profile<32;profile++){
  const sourceNumericId=String(200000+profile);
  for(const n of [9,12]){
   const pairwise=pairs.map(([first,second])=>{
    const byScenario=Object.fromEntries(model.SCENARIOS.map(s=>{
     const absent=s==='noFront'&&(first==='Nige'||second==='Nige');
     return [s,{scenario:s,status:absent?'held-absent-style':status,
      contexts:absent?0:2}];
    }));
    return {first,second,byScenario,
     balancedMatchedContextDirection:status,
     underFourArtificialRosters:first==='Nige'||
      second==='Nige'?
      'not-four-way-comparable-style-absent':
      'first-higher-in-all-four-rosters-and-matched-contexts'};
   });
   conditions.push({sourceNumericId,surface:'turf',
    distanceScope:'mile',timing:'phase_random:1',
    bandId:'top50',fieldSize:n,modelCourseIds:[10502],pairwise});
  }
  for(const [first,second] of pairs)
   headcount.push({sourceNumericId,distanceScope:'mile',
    timing:'phase_random:1',bandId:'top50',first,second,
    nineStatus:status,twelveStatus:status,relation:'same-strict-direction'});
 }
 return {schemaVersion:1,status:
  'P2-source32-two-axis-point-specificity-and-10m-pairwise-research-only',
  source:{modelRevision:model.PIN,
   fixedUmaSimSkillRegistrySha256:model.SOURCE_SHA},
  model:{scenarios:model.SCENARIOS,fieldSizes:[9,12]},
  summary:{totalConditionHeadcounts:64,
   totalConditionHeadcountPairs:384,
   balancedPairDirections:{[status]:384},
   fourRosterPairDirections:{
    'first-higher-in-all-four-rosters-and-matched-contexts':192,
    'not-four-way-comparable-style-absent':192},
   crossHeadcountPairs:{'same-strict-direction':192}},
  conditions,crossHeadcountPairs:headcount};
}
test('fixed comparison baseline is explicitly NOT established as representative, no unapproved weights',()=>{
 const f=fake(),before=JSON.stringify(f);
 const z=audit.audit(f);
 assert.equal(JSON.stringify(f),before);
 assert.equal(z.comparisonSummary.stylePairComparisons,384);
 assert.equal(z.comparisonSummary.balancedStrict,384);
 assert.equal(z.comparisonSummary.strictAcrossAllFourArtificialRosters,192);
 assert.equal(z.comparisonSummary.balancedStrictButNotFourRobust,192);
 assert.equal(z.comparisonSummary.noFrontAbsencePairComparisons,192);
 assert.equal(z.comparisonSummary.crossHeadcountSameStrict,192);
 assert.equal(z.comparisonSummary.crossHeadcountStrictReverse,0);
 assert.deepEqual(z.comparisonSummary.sourceConditionHeadcountCourseCountDistribution,
  [{eligibleModelCourses:1,conditionHeadcounts:64}]);
 assert.deepEqual(z.fixedReferenceRosterCounts['9'].balanced,[2,2,3,2]);
 assert.deepEqual(z.fixedReferenceRosterCounts['12'].balanced,[3,3,3,3]);
 assert.match(z.decisionStatus.balancedRoster,/unverified/);
 assert.match(z.decisionStatus.headcount,/separate/);
 assert.equal(Object.hasOwn(z,'populationWeightedSuitability'),false);
 assert.equal(z.unresolvedReferenceDecisions.length,8);
});
test('separate headcount effects and roster sensitivity are held, not averaged or declared reversed',()=>{
 const f=fake();
 const pair=f.conditions[0].pairwise[3]; // Senkou vs Sasi in fixed pair order
 assert.notEqual(pair.first,'Nige');
 pair.byScenario.frontHeavy.status='second-strict-all-matched-contexts';
 pair.underFourArtificialRosters='direction-reversed-between-fully-observed-rosters';
 f.summary.fourRosterPairDirections['first-higher-in-all-four-rosters-and-matched-contexts']--;
 f.summary.fourRosterPairDirections['direction-reversed-between-fully-observed-rosters']=1;
 const p=f.crossHeadcountPairs.find(x=>x.sourceNumericId==='200000'&&
  x.first===pair.first&&x.second===pair.second);
 p.twelveStatus='second-strict-all-matched-contexts';
 p.relation='headcount-reversal';
 f.summary.crossHeadcountPairs['same-strict-direction']--;
 f.summary.crossHeadcountPairs['headcount-reversal']=1;
 const result=audit.audit(f);
 assert.equal(result.comparisonSummary.strictAcrossAllFourArtificialRosters,191);
 assert.equal(result.comparisonSummary.crossHeadcountStrictReverse,1);
 assert.equal(result.comparisonSummary.balancedStrictButNotFourRobust,193);
 assert.equal(result.comparisonSummary.byHeadcount['9'].pairs,192);
 assert.equal(result.comparisonSummary.byHeadcount['12'].pairs,192);
});
test('source statuses, full pair coverage, duplicate profiles and summary drift fail closed',()=>{
 const f=fake();
 f.status='actual-game-probabilities';
 assert.throws(()=>audit.audit(f),/not verified/);
 const x=fake();x.conditions[0].pairwise.pop();
 assert.throws(()=>audit.audit(x),/malformed source-matched/);
 const y=fake();y.conditions[1]={...y.conditions[0]};
 assert.throws(()=>audit.audit(y),/duplicate original/);
 const z=fake();z.summary.balancedPairDirections['first-strict-all-matched-contexts']=0;
 assert.throws(()=>audit.audit(z),/summary disagrees/);
 const a=fake();a.conditions[0].pairwise[0].byScenario.noFront.status=
  'first-strict-all-matched-contexts';
 assert.throws(()=>audit.audit(a),/stale within-scenario/);
});
test('non-applicable Nige and invalid course contexts cannot masquerade as zero',()=>{
 const f=fake();
 f.conditions[0].pairwise[0].byScenario.noFront.contexts=2;
 assert.throws(()=>audit.audit(f),/mismatched course/);
 const bad=fake();
 bad.conditions[0].modelCourseIds=[99999];
 assert.throws(()=>audit.audit(bad),/malformed source-matched/);
});
