'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../data/p2_position_condition32_research.v1.json');
const model=require('../tools/globalsim_roster32.cjs');
const audit=require('../tools/skill_p2_33_distance_w.cjs');

function fakeReports(){
 const reports=[];
 for(const scenario of model.SCENARIOS){
  const rows=[];
  for(const course of model.COURSES)for(const n of [9,12])
   for(const mode of model.MODES)
    for(const [timing,bands] of model.courseTargets(manifest,course))
     for(const bandId of bands)
      for(const [i,style] of model.STYLES.entries()){
       const runners=model.COUNTS[scenario][n][i]*30;
       if(runners===0)continue;
       const w=[75,65,35,25][i];
       rows.push({scenario,surface:course.surface,courseId:course.id,
        distance:course.distance,fieldSize:n,mode,timing,bandId,style,
        status:'complete-model-measurement',runners,validRunners:runners,
        unresolvedRunners:0,unresolvedReasons:{},
        opportunityPercent:w,pointOccupancyPercent:w-1,
        opportunityLowerBoundPercent:w,opportunityUpperBoundPercent:w});
      }
  reports.push({schemaVersion:2,scenario,
   status:'P2-model-only-32-source-conditions-roster-sensitivity-not-game-activation',
   modelRevision:model.PIN,sourceSkillRegistrySha256:model.SOURCE_SHA,
   researchManifestSha256:manifest.source.previousArtifactSha256,
   rosterCounts:model.COUNTS[scenario],
   runnersPerStyleMissingIsNull:true,unresolvedTrajectoryIsBoundedNotZero:true,
   seedsPerCell:30,models:12,simulations:1440,
   profileCount:32,profileCourseInstances:94,
   observedRows:rows.length,missingStyleContextCells:scenario==='noFront'?300:0,
   heldContextCells:0,unresolvedRunnerWindows:0,contextRows:rows});
 }
 return reports;
}
function splitFrom(reports){
 return Object.fromEntries(model.SCENARIOS.map((s,i)=>[s,[0,15].map(repStart=>{
  const report=structuredClone(reports[i]);
  report.seedsPerCell=15;report.simulations=720;
  report.seedWindow={repStart,repEndExclusive:repStart+15};
  for(const row of report.contextRows){
   row.runners/=2;row.validRunners/=2;
  }
  return report;
 })]));
}
function setW(report,p,type,style,w,filter=()=>true){
 const courses=model.COURSES.filter(x=>x.surface===p.surface&&
  x.distanceType===type);
 assert(courses.length>0);
 let changed=0;
 for(const row of report.contextRows)
  if(courses.some(c=>c.id===row.courseId)&&
   row.timing===p.timing&&row.bandId===p.bandId&&
   row.style===style&&filter(row)){
   row.opportunityPercent=w;row.pointOccupancyPercent=w;
   row.opportunityLowerBoundPercent=w;
   row.opportunityUpperBoundPercent=w;changed++;
  }
 assert(changed>0);
}
const one=manifest.profiles.find(p=>p.surface==='turf'&&p.distanceScope==='all');
test('P2.33 class contrasts are bounded, directional and never mean away course variance',()=>{
 const groups=[{type:1,distanceClass:'sprint',lowerWPercent:90,upperWPercent:90},
  {type:2,distanceClass:'mile',lowerWPercent:20,upperWPercent:20},
  {type:3,distanceClass:'middle',lowerWPercent:10,upperWPercent:80},
  {type:4,distanceClass:'long',lowerWPercent:40,upperWPercent:40}];
 const contrasts=audit.comparisons(groups);
 assert.equal(contrasts.length,6);
 assert.equal(contrasts[0].direction,'first-higher');
 assert.equal(contrasts[0].fivePointSensitivityDirection,'first-higher');
 assert.equal(contrasts[3].direction,'held-overlap-or-course-mixed');
 assert.throws(()=>audit.compareW(groups[1],groups[0]),/unordered/);
 const broad=audit.compareW(groups[2],groups[3]);
 assert.equal(broad.direction,'held-overlap-or-course-mixed');
});
test('P2.33 preserves source surface and noFront absence, with zero imported ratings',()=>{
 const reports=fakeReports(),halves=splitFrom(reports);
 const before=JSON.stringify({reports,halves});
 const result=audit.audit(manifest,reports,halves);
 assert.equal(JSON.stringify({reports,halves}),before);
 assert.equal(result.status,audit.STATUS);
 assert.equal(result.summary.sameSurfaceAllEligibleCourses.originalSourceProfiles,10);
 assert.equal(result.summary.sameSurfaceAllEligibleCourses.profileStylePairs,40);
 assert.equal(result.summary.sameSurfaceAllEligibleCourses.matchedSourceStyleRosterHeadModeContexts,280);
 assert.equal(result.summary.sameSurfaceAllEligibleCourses.absentStyleContextCells,40);
 assert.equal(result.summary.sameSurfaceAllEligibleCourses.distancePairContextCells,1680);
 assert.equal(result.summary.sameVenueTokyoTurf.matchedSourceStyleRosterHeadModeContexts,112);
 assert.equal(result.summary.sameVenueTokyoTurf.distancePairContextCells,672);
 assert.equal(result.summary.sameSurfaceAllEligibleCourses.strictOriginal30Events,0);
 assert.equal(result.design.sourceIDsPresentOnBothSurfaces,0);
 assert.equal(result.design.surfaceComparison.startsWith('not-identifiable'),true);
 assert(result.missingContexts.every(x=>x.style==='Nige'&&x.scenario==='noFront'));
 assert(result.rows.every(x=>x.perDistanceW.length===4&&x.contrasts.length===6));
 assert(result.rows.every(x=>!Object.hasOwn(x,'gameProcRate')&&
  !Object.hasOwn(x,'cardScore')));
});
test('same-style distance shift is detected only within the same original source signature',()=>{
 const reports=fakeReports();
 setW(reports[0],one,1,'Senkou',80);
 setW(reports[0],one,2,'Senkou',20);
 const halves=splitFrom(reports);
 const a=audit.audit(manifest,reports,halves);
 const ctx=a.rows.find(x=>x.sourceNumericId===one.sourceNumericId&&
  x.style==='Senkou'&&x.scenario==='balanced'&&x.fieldSize===9&&
  x.mode===model.MODES[0]);
 const c=ctx.contrasts.find(x=>x.distancePair.join('|')==='sprint|mile');
 assert(c);
 assert.equal(c.original30.direction,'first-higher');
 assert.equal(c.bothHalvesConfirmOriginal30Direction,true);
 assert.equal(c.bothHalvesConfirmOriginal30FivePointSensitivity,true);
 assert(a.summary.sameSurfaceAllEligibleCourses.strictBothHalvesConfirmedEvents>0);
 assert(a.summary.sameVenueTokyoTurf.strictBothHalvesConfirmedEvents>0);
});
test('a pooled 30-seed direction is not automatically confirmed by either half',()=>{
 const reports=fakeReports();
 setW(reports[0],one,1,'Senkou',60);
 setW(reports[0],one,2,'Senkou',30);
 const halves=splitFrom(reports);
 setW(halves.balanced[0],one,1,'Senkou',20);
 setW(halves.balanced[1],one,1,'Senkou',100);
 const a=audit.audit(manifest,reports,halves);
 const ctx=a.rows.find(x=>x.sourceNumericId===one.sourceNumericId&&
  x.style==='Senkou'&&x.scenario==='balanced'&&x.fieldSize===9&&
  x.mode===model.MODES[0]);
 const c=ctx.contrasts.find(x=>x.distancePair.join('|')==='sprint|mile');
 assert.equal(c.original30.direction,'first-higher');
 assert.equal(c.first15.direction,'second-higher');
 assert.equal(c.last15.direction,'first-higher');
 assert.equal(c.bothHalvesConfirmOriginal30Direction,false);
 assert.equal(c.bothHalvesConfirmOriginal30FivePointSensitivity,false);
});
test('invalid seed window, source or missing course fails closed',()=>{
 const reports=fakeReports(),halves=splitFrom(reports);
 halves.noFront[1].seedWindow.repStart=0;
 assert.throws(()=>audit.audit(manifest,reports,halves),/invalid disjoint/);
 halves.noFront[1].seedWindow.repStart=15;
 reports[0].contextRows[0].surface='dirt';
 assert.throws(()=>audit.audit(manifest,reports,halves),/Wrong source roster|mismatched|surface/);
});
