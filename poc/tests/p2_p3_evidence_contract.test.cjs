'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../data/p2_position_condition32_research.v1.json');
const bridge=require('../src/p2_p3_evidence_contract.cjs');
const roster=require('../tools/globalsim_roster32.cjs');
const bands=require('../tools/globalsim_rank_band_dominance.cjs').BANDS;
const rank=require('../src/skill_order_rate_bounds.cjs');
const research=require('../tools/skill_specificity32_research.cjs');
const styles=roster.STYLES;
const round=n=>Number(n.toFixed(6));
function sourceReport(){
 const conditions=[],crossHeadcountPairs=[];
 for(const source of manifest.profiles){
  const pairsByN={};
  for(const n of [9,12]){
   const idx=bands.find(x=>x.id===source.bandId);
   const positions=rank.andProjection(idx.predicates,n).positions;
   const u=100*positions.length/n;
   const s={};
   for(const [i,style] of styles.entries()){
    const W=[75,65,35,25][i],O=W-1;
    s[style]={opportunity10mPercent:W,pointOccupancyPercent:O,
      uniformOnePointRankReferencePercent:round(u),
      pointDeviationFromUniformRankReferencePoints:round(O-u),
      pointTo10mUpliftPoints:1,relativeOrder:{
       status:i===0?'relative-leader':i===3?'relative-trailer':'relative-intermediate',
       higherThan:styles.slice(i+1),lowerThan:styles.slice(0,i),heldAgainst:[]}};
   }
   const pairwise=research.PAIRS.map(([first,second])=>{
    const byScenario=Object.fromEntries(roster.SCENARIOS.map(name=>[name,{
      status:name==='noFront'&&(first==='Nige'||second==='Nige')?
        'held-absent-style':'first-strict-all-matched-contexts'
    }]));
    return {first,second,
      balancedMatchedContextDirection:'first-strict-all-matched-contexts',
      balancedMeanOpportunityDifferencePoints:
        s[first].opportunity10mPercent-s[second].opportunity10mPercent,
      balancedMeanPointOccupancyDifferencePoints:
        s[first].pointOccupancyPercent-s[second].pointOccupancyPercent,
      byScenario,underFourArtificialRosters:
        first==='Nige'?'not-four-way-comparable-style-absent':
        'first-higher-in-all-four-rosters-and-matched-contexts'};
   });
   const courses=roster.COURSES.filter(c=>c.surface===source.surface&&
    roster.SCOPE[source.distanceScope].includes(c.distanceType)).map(c=>c.id);
   conditions.push({...source,modelCourseIds:courses,fieldSize:n,
    sourceIntegerPositions:positions,
    allSixPairDirectionsStrictAcrossBalancedContexts:true,
    styles:s,pairwise});
   pairsByN[n]=pairwise;
  }
  for(const [first,second] of research.PAIRS)
   crossHeadcountPairs.push({...source,first,second,
    nineStatus:'first-strict-all-matched-contexts',
    twelveStatus:'first-strict-all-matched-contexts',
    relation:'same-strict-direction'});
 }
 return {schemaVersion:1,status:bridge.STATUS,
  source:{modelRevision:roster.PIN,
   fixedUmaSimSkillRegistrySha256:roster.SOURCE_SHA,
   sourceManifestPreviousReviewSha256:manifest.source.previousArtifactSha256,
   pinnedFullRosterInputSha256:{...research.PINNED}},
  model:{sourceConditions:32,fieldSizes:[9,12],styles:[...styles],
   seedSplitConfirmation:'NOT TESTED: synthetic 30-seed case'},
  conditions,crossHeadcountPairs};
}
test('complete fixed 32 conditions retain separate 9/12 W, O, U and D',()=>{
 const data=sourceReport();
 assert.equal(bridge.validate(data).byCondition.size,64);
 const ix=bridge.openEvidence(data);
 const r=ix.lookup(manifest.profiles[0]);
 assert.equal(r.status,'source-rank-condition-only-not-full-skill');
 assert.deepEqual(r.fields.map(x=>x.fieldSize),[9,12]);
 assert.equal(r.fields[0].styles.Nige.W10mOpportunityPercent,75);
 assert.equal(r.fields[0].styles.Nige.OPointOccupancyPercent,74);
 assert.equal(r.fields[0].styles.Nige.OminusUDeviationPoints,
  round(74-r.fields[0].styles.Nige.UUniformPointReferencePercent));
 assert.equal(r.headcountSensitivity.length,6);
 assert.equal(r.headcountSensitivity[0].status,'same-strict-direction');
 assert(!Object.hasOwn(r,'rating'));
 assert(!Object.hasOwn(r,'probability'));
 assert.equal(ix.scope.seedSplit,'unverified');
});
test('source ID alone is insufficient: the same representative source ID may have different course scopes',()=>{
 const ix=bridge.openEvidence(sourceReport());
 assert.throws(()=>ix.lookup({sourceNumericId:'204511'}),/five-field/);
 const two=manifest.profiles.filter(p=>p.sourceNumericId==='204511');
 assert.equal(two.length,2);
 assert.equal(ix.lookup(two[0]).status,'source-rank-condition-only-not-full-skill');
 assert.equal(ix.lookup({...two[0],distanceScope:'mile'}).status,'not-in-research-cohort');
});
test('does not silently turn a changed provenance or missing cohort into evidence',()=>{
 const r=sourceReport();
 r.source.pinnedFullRosterInputSha256.balanced='wrong';
 assert.throws(()=>bridge.validate(r),/unpinned/);
 const x=sourceReport();x.conditions.pop();
 assert.throws(()=>bridge.validate(x),/32×2/);
 const y=sourceReport();y.conditions[1].sourceNumericId='arbitrary';
 assert.throws(()=>bridge.validate(y),/out-of-scope/);
});
test('reject W vs O confusion and W-U mistaken for point-specificity',()=>{
 const x=sourceReport();
 x.conditions[0].styles.Sasi.pointDeviationFromUniformRankReferencePoints+=1;
 assert.throws(()=>bridge.validate(x),/W, O and U/);
 const y=sourceReport();
 y.conditions[0].styles.Nige.pointOccupancyPercent=99;
 assert.throws(()=>bridge.validate(y),/W, O and U/);
 const z=sourceReport();
 z.conditions[0].styles.Nige.uniformOnePointRankReferencePercent=80;
 assert.throws(()=>bridge.validate(z),/W, O and U/);
});
test('cross-headcount reversal cannot be hidden by a 9/12 average',()=>{
 const x=sourceReport();
 x.crossHeadcountPairs[0].relation='headcount-reversal';
 assert.throws(()=>bridge.validate(x),/headcount sensitivity/);
 const y=sourceReport();
 y.conditions[0].pairwise[0].balancedMatchedContextDirection='second-strict-all-matched-contexts';
 assert.throws(()=>bridge.validate(y),/comparison source status/);
});
test('pairwise holds and missing styles are never converted into fabricated wins',()=>{
 const x=sourceReport();
 const c=x.conditions[0],p=c.pairwise[0];
 p.balancedMatchedContextDirection='held-overlap-or-context-mixed';
 p.byScenario.balanced.status=p.balancedMatchedContextDirection;
 c.allSixPairDirectionsStrictAcrossBalancedContexts=false;
 c.styles.Nige.relativeOrder.higherThan=c.styles.Nige.relativeOrder.higherThan.filter(s=>s!=='Senkou');
 c.styles.Nige.relativeOrder.heldAgainst.push('Senkou');
 c.styles.Senkou.relativeOrder.lowerThan=c.styles.Senkou.relativeOrder.lowerThan.filter(s=>s!=='Nige');
 c.styles.Senkou.relativeOrder.heldAgainst.push('Nige');
 const pair=x.crossHeadcountPairs.find(q=>q.sourceNumericId===c.sourceNumericId&&
  q.distanceScope===c.distanceScope&&q.timing===c.timing&&
  q.bandId===c.bandId&&q.first==='Nige'&&q.second==='Senkou');
 pair.nineStatus=p.balancedMatchedContextDirection;
 pair.relation='held-at-least-one-headcount';
 assert.equal(bridge.validate(x).byCondition.size,64);
 const r=bridge.openEvidence(x).lookup(manifest.profiles[0]);
 assert.equal(r.fields[0].pairwise[0].balancedStatus,'held-overlap-or-context-mixed');
 assert.equal(r.headcountSensitivity[0].status,'held-at-least-one-headcount');
});
