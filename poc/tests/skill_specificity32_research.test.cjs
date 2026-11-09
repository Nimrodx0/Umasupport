'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const skill=require('../tools/skill_specificity32_research.cjs');
const model=require('../tools/globalsim_roster32.cjs');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,
 '../data/p2_position_condition32_research.v1.json'),'utf8'));
const STYLES=model.STYLES;
test('strict context comparison: interval ties, reversals and absent styles remain held',()=>{
 const a={opportunityLowerBoundPercent:40,opportunityUpperBoundPercent:40};
 const b={opportunityLowerBoundPercent:20,opportunityUpperBoundPercent:20};
 assert.equal(skill.sameContextContrast(a,b).status,'first-strictly-higher');
 assert.equal(skill.sameContextContrast(b,a).status,'second-strictly-higher');
 assert.equal(skill.sameContextContrast(a,a).status,'held-overlap-or-tie');
 assert.equal(skill.sameContextContrast(null,b).status,'not-applicable-absent-style');
 const wide={opportunityLowerBoundPercent:15,opportunityUpperBoundPercent:45};
 assert.equal(skill.sameContextContrast(a,wide).status,'held-overlap-or-tie');
 assert.equal(skill.strictAcrossContexts([
  skill.sameContextContrast(a,b),skill.sameContextContrast(b,a)]),
 'held-context-direction-reversal');
 assert.equal(skill.strictAcrossContexts([
  skill.sameContextContrast(a,b),skill.sameContextContrast(a,a)]),
 'held-overlap-or-context-mixed');
 assert.equal(skill.strictAcrossContexts([
  skill.sameContextContrast(a,b),skill.sameContextContrast(null,b)]),
 'held-absent-style');
});
test('four-roster strict comparisons cannot turn absent Nige into a zero-rate loss',()=>{
 const cmp=s=>({status:s});
 const all=Object.fromEntries(model.SCENARIOS.map(x=>
  [x,cmp('first-strict-all-matched-contexts')]));
 assert.equal(skill.acrossFour(all),
  'first-higher-in-all-four-rosters-and-matched-contexts');
 all.frontHeavy=cmp('second-strict-all-matched-contexts');
 assert.equal(skill.acrossFour(all),
  'direction-reversed-between-fully-observed-rosters');
 all.frontHeavy=cmp('held-overlap-or-context-mixed');
 assert.equal(skill.acrossFour(all),
  'held-some-roster-or-context-comparisons');
 all.noFront=cmp('held-absent-style');
 assert.equal(skill.acrossFour(all),
  'not-four-way-comparable-style-absent');
});
function fakeReports(){
 const result=[];
 for(const scenario of model.SCENARIOS){
  const rows=[];
  for(const course of model.COURSES)
   for(const n of [9,12])
    for(const mode of model.MODES)
     for(const [timing,bs] of model.courseTargets(manifest,course))
      for(const bandId of bs)
       for(const [i,style] of STYLES.entries()){
        const count=model.COUNTS[scenario][n][i];
        if(!count)continue;
        const v=[75,65,35,25][i];
        rows.push({scenario,surface:course.surface,
         courseId:course.id,distance:course.distance,
         fieldSize:n,mode,timing,bandId,style,
         status:'complete-model-measurement',
         runners:count*30,validRunners:count*30,
         unresolvedRunners:0,unresolvedReasons:{},
         opportunityPercent:v,pointOccupancyPercent:v-1,
         opportunityLowerBoundPercent:v,opportunityUpperBoundPercent:v});
       }
  result.push({schemaVersion:2,
   status:'P2-model-only-32-source-conditions-roster-sensitivity-not-game-activation',
   modelRevision:model.PIN,sourceSkillRegistrySha256:model.SOURCE_SHA,
   researchManifestSha256:manifest.source.previousArtifactSha256,
   scenario,rosterCounts:model.COUNTS[scenario],
   runnersPerStyleMissingIsNull:true,unresolvedTrajectoryIsBoundedNotZero:true,
   seedsPerCell:30,models:12,simulations:1440,
   profileCount:32,profileCourseInstances:94,
   observedRows:rows.length,missingStyleContextCells:scenario==='noFront'?300:0,
   heldContextCells:0,unresolvedRunnerWindows:0,contextRows:rows});
 }
 const profiles=[];
 for(const p of manifest.profiles)
  for(const fieldSize of [9,12])
   for(const [i,style] of STYLES.entries())
    profiles.push({...p,fieldSize,style,
     scenarios:{balanced:{opportunityPercent:[75,65,35,25][i]}}});
 const prior={schemaVersion:2,
  status:'p2-model-only-32-source-condition-opportunities-across-four-artificial-rosters',
  design:{sourceConditionProfiles:32,raceCases:5760},
  profiles};
 return {result,prior};
}
test('full 32-source synthetic study produces independent W/O and four-style relative order',()=>{
 const {result,prior}=fakeReports();
 const out=skill.quantify(manifest,result,prior);
 assert.equal(out.summary.totalConditionHeadcounts,64);
 assert.equal(out.summary.totalConditionHeadcountPairs,384);
 assert.equal(out.summary.fullyStrictBalancedFourStyleOrders,64);
 assert.equal(out.summary.fullyStrictOrdersByHeadcount['9'],32);
 const p=out.conditions.find(x=>x.sourceNumericId==='200681'&&x.fieldSize===9);
 assert(p);
 assert.equal(p.styles.Nige.opportunity10mPercent,75);
 assert.equal(p.styles.Nige.pointOccupancyPercent,74);
 assert.equal(p.styles.Nige.pointTo10mUpliftPoints,1);
 assert.equal(p.styles.Nige.uniformOnePointRankReferencePercent,55.555556);
 assert.equal(p.styles.Nige.pointDeviationFromUniformRankReferencePoints,18.444444);
 assert.equal(p.styles.Nige.relativeOrder.status,'relative-leader');
 assert.equal(p.styles.Oikomi.relativeOrder.status,'relative-trailer');
 assert.equal(p.pairwise.find(x=>x.first==='Nige'&&x.second==='Senkou')
  .underFourArtificialRosters,'not-four-way-comparable-style-absent');
 assert.equal(p.pairwise.find(x=>x.first==='Senkou'&&x.second==='Sasi')
  .underFourArtificialRosters,'first-higher-in-all-four-rosters-and-matched-contexts');
 assert.equal(out.summary.crossHeadcountPairs['same-strict-direction'],192);
 assert.equal(out.model.seedSplitConfirmation.startsWith('NOT TESTED'),true);
 const old=structuredClone(prior);
 old.profiles[0].scenarios.balanced.opportunityPercent++;
 assert.throws(()=>skill.quantify(manifest,result,old),/cannot be reproduced/);
});
test('a tied rank is held as interval while W and point uniform deviation remain separate',()=>{
 const {result,prior}=fakeReports();
 const r=result.find(x=>x.scenario==='backHeavy');
 const row=r.contextRows.find(x=>x.courseId===10502&&x.fieldSize===9&&
  x.mode==='equal'&&x.style==='Senkou'&&
  x.timing==='phase_laterhalf_random:0'&&x.bandId==='top50');
 assert(row);
 row.status='held-unresolved-rank-trajectory';
 row.validRunners-=1;row.unresolvedRunners=1;
 row.unresolvedReasons={'held-tied-position':1};
 row.opportunityLowerBoundPercent=64;
 row.opportunityUpperBoundPercent=66;
 row.opportunityPercent=null;row.pointOccupancyPercent=null;
 r.heldContextCells=1;r.unresolvedRunnerWindows=1;
 const out=skill.quantify(manifest,result,prior);
 const p=out.conditions.find(x=>x.sourceNumericId==='200681'&&x.fieldSize===9);
 assert(p);
 assert.equal(p.styles.Senkou.opportunity10mPercent,65);
 assert.equal(p.pairwise.find(x=>x.first==='Senkou'&&x.second==='Sasi')
  .byScenario.backHeavy.contextDiagnostics.heldByRankTie,1);
});
