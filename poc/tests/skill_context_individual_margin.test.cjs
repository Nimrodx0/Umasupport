'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../data/p2_position_condition32_research.v1.json');
const model=require('../tools/globalsim_roster32.cjs');
const prior=require('../tools/skill_specificity32_research.cjs');
const baseline=require('../tools/skill_reference_scenario_gate.cjs');
const mean=require('../tools/skill_context_margin_sensitivity.cjs');
const individual=require('../tools/skill_context_individual_margin.cjs');

function fakeReports(){
 const reports=[];
 const opp=[75,65,35,25];
 for(const scenario of model.SCENARIOS){
  const rows=[];
  for(const course of model.COURSES)for(const n of [9,12])
   for(const mode of model.MODES)
    for(const [timing,bands] of model.courseTargets(manifest,course))
     for(const bandId of bands)for(const [i,style] of model.STYLES.entries()){
      const count=model.COUNTS[scenario][n][i];
      if(!count)continue;
      const value=opp[i];
      rows.push({scenario,surface:course.surface,courseId:course.id,
       distance:course.distance,fieldSize:n,mode,timing,bandId,style,
       status:'complete-model-measurement',runners:count*30,
       validRunners:count*30,unresolvedRunners:0,unresolvedReasons:{},
       opportunityPercent:value,pointOccupancyPercent:value-1,
       opportunityLowerBoundPercent:value,
       opportunityUpperBoundPercent:value});
     }
  reports.push({schemaVersion:2,
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
 for(const p of manifest.profiles)for(const fieldSize of [9,12])
  for(const [i,style] of model.STYLES.entries())
   profiles.push({...p,fieldSize,style,
    scenarios:{balanced:{opportunityPercent:opp[i]}}});
 const aggregate={schemaVersion:2,
  status:'p2-model-only-32-source-condition-opportunities-across-four-artificial-rosters',
  design:{sourceConditionProfiles:32,raceCases:5760},profiles};
 return {reports,aggregate};
}
function fixture(){
 const {reports,aggregate}=fakeReports();
 const p29=baseline.audit(prior.quantify(manifest,reports,aggregate));
 const p30=mean.analyze(prior.quantify(manifest,reports,aggregate),p29);
 return {reports,p30};
}
test('P2.31 real source manifest: every individual course/mode source context is retained and missing Nige is missing',()=>{
 const {reports,p30}=fixture();
 const orig=JSON.stringify({reports,p30});
 const x=individual.audit(manifest,reports,p30);
 assert.equal(JSON.stringify({reports,p30}),orig);
 assert.equal(x.rows.length,192);
 for(const t of ['0','1','3','5']){
  assert.equal(x.summary[t].scenarioMeanPass,192);
  assert.equal(x.summary[t].minimumAcrossIndividualCourseModePass,192);
  assert.equal(x.summary[t].scenarioMeanOnlyNotEveryCourseMode,0);
 }
 const full=x.rows.filter(v=>v.priorConsensus===
  'consistent-in-all-tested-contexts');
 const limited=x.rows.filter(v=>v.priorConsensus===
  'consistent-in-observed-contexts-missing-style-scenario');
 assert.equal(full.length,96);assert.equal(limited.length,96);
 assert(full.every(x=>x.absentStyleCourseModeContextCells===0));
 assert(limited.every(x=>x.absentStyleCourseModeContextCells===
  x.numberOfSourceEligibleCourses*model.MODES.length*2));
 assert.equal(x.design.seedSplitStatus.startsWith('NOT TESTED'),true);
 assert.equal(Object.hasOwn(x,'cardSuitability'),false);
});
test('a rare weak course/mode can defeat the threshold despite a much larger scenario mean',()=>{
 const p=manifest.profiles.find(x=>model.COURSES.filter(c=>
  c.surface===x.surface&&model.SCOPE[x.distanceScope]
  .includes(c.distanceType)).length>1);
 assert(p,'Need multiple source-eligible courses to test average masking');
 const eligible=model.COURSES.filter(c=>c.surface===p.surface&&
  model.SCOPE[p.distanceScope].includes(c.distanceType));
 const index=new Map(),source=new Map();
 index.set('balanced',source);
 for(const course of eligible)for(const mode of model.MODES){
  const near=course.id===eligible[0].id&&mode===model.MODES[0];
  const a=near?30.5:70,b=30;
  const mk=(style)=>[course.id,9,mode,p.timing,p.bandId,style].join('|');
  source.set(mk('Senkou'),{opportunityLowerBoundPercent:a,
   opportunityUpperBoundPercent:a});
  source.set(mk('Sasi'),{opportunityLowerBoundPercent:b,
   opportunityUpperBoundPercent:b});
 }
 const cells=individual.matchingContexts(index,p,'Senkou','Sasi',9,'balanced');
 assert.equal(cells.length,eligible.length*2);
 const values=cells.map(c=>c.differenceLowerPoints);
 assert.equal(Math.min(...values),0.5);
 const scenarioMean=values.reduce((a,b)=>a+b,0)/values.length;
 assert(scenarioMean>5,'Scenario mean can pass a threshold while one course fails');
 assert.equal(cells.some(c=>c.differenceLowerPoints<=5),true);
});
test('P2.31 rejects absent, duplicate, mixed provenance and maliciously optimistic mean',()=>{
 const {reports,p30}=fixture();
 const source=structuredClone(p30);
 source.source.modelRevision='untrusted';
 assert.throws(()=>individual.audit(manifest,reports,source),/unverified P2.30/);
 const dup=structuredClone(p30);dup.rows[1]=structuredClone(dup.rows[0]);
 assert.throws(()=>individual.audit(manifest,reports,dup),/repeated source style pair/);
 const gap=structuredClone(reports);gap[0].contextRows.pop();
 assert.throws(()=>individual.audit(manifest,gap,p30),/source context|Scenario context|source scenario/);
 const unrealistic=structuredClone(p30);
 unrealistic.rows[0].minimumConservativeScenarioMeanDifferencePoints=-1;
 assert.throws(()=>individual.audit(manifest,reports,unrealistic),
  /contradicts source mean/);
});
