#!/usr/bin/env node
'use strict';
/*
 * P2.13: two DISJOINT, deterministic 15-seed cohorts from the exact fixed
 * 30-seed GlobalSim v77 races. Original P2.31 W comparison scope retained.
 * This is not new random independent field sampling nor real game procs.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const model=require('./globalsim_roster32.cjs');
const agg=require('./skill_roster32_aggregate.cjs');
const pair=require('./skill_specificity32_research.cjs');
const threshold=require('./skill_context_margin_sensitivity.cjs').THRESHOLDS;
const supported=new Set([
 'consistent-in-all-tested-contexts',
 'consistent-in-observed-contexts-missing-style-scenario'
]);
const keys=r=>[r.courseId,r.fieldSize,r.mode,r.timing,r.bandId,r.style].join('|');
const pKey=p=>[p.sourceNumericId,p.surface,p.distanceScope,p.timing,p.bandId].join('|');
const round=x=>Number(x.toFixed(6));
function validateHalves(full,parts,scenario){
 if(!full||full.scenario!==scenario||!Array.isArray(parts)||parts.length!==2||
  !parts.every((r,i)=>r.schemaVersion===2&&
   r.status==='P2-model-only-32-source-conditions-roster-sensitivity-not-game-activation'&&
   r.scenario===scenario&&r.modelRevision===model.PIN&&
   r.sourceSkillRegistrySha256===model.SOURCE_SHA&&
   r.seedsPerCell===15&&r.simulations===720&&r.models===12&&
   r.profileCount===32&&r.profileCourseInstances===94&&
   r.runnersPerStyleMissingIsNull&&r.unresolvedTrajectoryIsBoundedNotZero&&
   r.seedWindow?.repStart===15*i&&
   r.seedWindow.repEndExclusive===15*(i+1)&&
   JSON.stringify(r.rosterCounts)===JSON.stringify(model.COUNTS[scenario])&&
   Array.isArray(r.contextRows)&&r.contextRows.length===r.observedRows))
  throw Error('P2.13 invalid disjoint source seed windows');
 const index=parts.map((report,i)=>{
  const m=new Map();let held=0,ambiguous=0;
  for(const row of report.contextRows){
   const k=keys(row);
   const c=model.COURSES.find(c=>c.id===row.courseId);
   const styleCount=model.COUNTS[scenario][row.fieldSize]?.[
    model.STYLES.indexOf(row.style)];
   const expected=styleCount*15;
   if(m.has(k)||!c||!expected||row.surface!==c.surface||
    row.scenario!==scenario||!model.MODES.includes(row.mode)||
    !Number.isSafeInteger(row.runners)||row.runners!==expected||
    !Number.isSafeInteger(row.validRunners)||row.validRunners<0||
    !Number.isSafeInteger(row.unresolvedRunners)||row.unresolvedRunners<0||
    row.runners!==row.validRunners+row.unresolvedRunners||
    !Number.isFinite(row.opportunityLowerBoundPercent)||
    !Number.isFinite(row.opportunityUpperBoundPercent)||
    row.opportunityLowerBoundPercent<0||row.opportunityUpperBoundPercent>100||
    row.opportunityLowerBoundPercent>row.opportunityUpperBoundPercent+0.000005||
    !['held-unresolved-rank-trajectory','complete-model-measurement'].includes(row.status)||
    (row.unresolvedRunners>0)!==
     (row.status==='held-unresolved-rank-trajectory'))
    throw Error('P2.13 incomplete or invalid half context '+k);
   held+=(row.unresolvedRunners>0?1:0);
   ambiguous+=row.unresolvedRunners;
   m.set(k,row);
  }
  if(held!==report.heldContextCells||
   ambiguous!==report.unresolvedRunnerWindows||
   m.size!==full.contextRows.length)
   throw Error('P2.13 incomplete half context population');
  return m;
 });
 const visited=new Set();
 for(const original of full.contextRows){
  const k=keys(original);
  if(visited.has(k))throw Error('P2.13 duplicated original context');
  visited.add(k);
  const a=index[0].get(k),b=index[1].get(k);
  if(!a||!b||a.runners+b.runners!==original.runners||
   a.unresolvedRunners+b.unresolvedRunners!==original.unresolvedRunners||
   a.validRunners+b.validRunners!==original.validRunners)
   throw Error('P2.13 split halves do not reconcile source runner counts '+k);
  const weighted=(field)=>round((a[field]*a.runners+b[field]*b.runners)/
   original.runners);
  for(const field of ['opportunityLowerBoundPercent',
    'opportunityUpperBoundPercent'])
   if(Math.abs(weighted(field)-original[field])>0.000004)
    throw Error('P2.13 original 30-seed W bounds not reconstructed '+k);
 }
 if(visited.size!==full.contextRows.length)
  throw Error('P2.13 failed 30-seed original context coverage');
 return index;
}
function signedBounds(a,b,direction){
 if(!a||!b)throw Error('P2.13 missing style in comparison');
 if(!['first','second'].includes(direction))throw Error('P2.13 unknown prior direction');
 const lo=direction==='first'?
  a.opportunityLowerBoundPercent-b.opportunityUpperBoundPercent:
  b.opportunityLowerBoundPercent-a.opportunityUpperBoundPercent;
 const hi=direction==='first'?
  a.opportunityUpperBoundPercent-b.opportunityLowerBoundPercent:
  b.opportunityUpperBoundPercent-a.opportunityLowerBoundPercent;
 if(lo>hi+0.000005)throw Error('P2.13 invalid held-rank bounds');
 return {lower:round(lo),upper:round(hi)};
}
function audit(manifest,fullReports,splitReports,p231){
 model.verifyManifest(manifest);
 if(!p231||p231.schemaVersion!==1||
  p231.status!=='P2.31-individual-course-mode-W-margin-vs-scenario-mean-research-only'||
  p231.source?.modelRevision!==model.PIN||
  p231.source?.skillRegistrySha256!==model.SOURCE_SHA||
  !Array.isArray(p231.rows)||p231.rows.length!==192||
  JSON.stringify(p231.design?.thresholdPoints)!==JSON.stringify(threshold))
  throw Error('P2.13 source P2.31 report mismatch');
 const full=agg.validateReports(manifest,fullReports,30);
 const parts=new Map();
 for(const scenario of model.SCENARIOS){
  if(!splitReports[scenario])throw Error('P2.13 missing scenario split');
  const f=fullReports.find(x=>x.scenario===scenario);
  parts.set(scenario,validateHalves(f,splitReports[scenario],scenario));
 }
 const profiles=new Map(manifest.profiles.map(p=>[pKey(p),p]));
 if(profiles.size!==32)throw Error('P2.13 source profile count drift');
 const seen=new Set(),rows=[];
 for(const p of p231.rows){
  const id=[p.sourceNumericId,p.surface,p.distanceScope,
   p.timing,p.bandId].join('|');
  const profile=profiles.get(id);
  const key=[id,p.first,p.second].join('|');
  if(!profile||seen.has(key)||!pair.PAIRS.some(z=>
   z[0]===p.first&&z[1]===p.second))
   throw Error('P2.13 duplicate/unknown original source style pair');
  seen.add(key);
  const isSupported=supported.has(p.priorConsensus);
  if(isSupported!==['first','second'].includes(p.observedDirection))
   throw Error('P2.13 baseline direction inconsistent');
  const courses=model.COURSES.filter(c=>c.surface===profile.surface&&
   model.SCOPE[profile.distanceScope].includes(c.distanceType));
  if(!courses.length)throw Error('P2.13 no eligible courses');
  const halfSamples=[[],[]],missing=[];
  for(const scenario of model.SCENARIOS)
   for(const n of [9,12]){
    const counts=model.COUNTS[scenario][n];
    if(!counts[model.STYLES.indexOf(p.first)]||
       !counts[model.STYLES.indexOf(p.second)]){
      missing.push({scenario,fieldSize:n});
      continue;
    }
    for(const course of courses)for(const mode of model.MODES)
     for(let h=0;h<2;h++){
      const index=parts.get(scenario)[h];
      const k=(style)=>[course.id,n,mode,profile.timing,
       profile.bandId,style].join('|');
      const a=index.get(k(p.first)),b=index.get(k(p.second));
      if(!a||!b)throw Error('P2.13 required half style missing in source');
      halfSamples[h].push({scenario,fieldSize:n,courseId:course.id,mode,
       ...(isSupported?signedBounds(a,b,p.observedDirection):
        {lower:null,upper:null})});
     }
   }
  if(halfSamples[0].length!==p.measuredCourseModeContextCells||
    halfSamples[1].length!==p.measuredCourseModeContextCells||
    missing.length*2*courses.length!==p.absentStyleCourseModeContextCells)
   throw Error('P2.13 source half course/mode coverage drift');
  const minima=isSupported?halfSamples.map(c=>
   round(Math.min(...c.map(x=>x.lower)))):[null,null];
  const strictlyOpposite=isSupported?halfSamples.map(c=>
   c.some(x=>x.upper< -0.00001)):[false,false];
  const byThreshold=Object.fromEntries(threshold.map(t=>{
   const p31=p.thresholds?.[String(t)]?.individualCourseModePass===true;
   const halfPass=isSupported&&minima.every(x=>x>t);
   if(halfPass&&!p31)throw Error('P2.13 split threshold passes but full 30 does not');
   return [String(t),{full30Pass:p31,
    first15Pass:isSupported&&minima[0]>t,
    last15Pass:isSupported&&minima[1]>t,
    both15Pass:halfPass,
    full30Only:p31&&!halfPass}];
  }));
  rows.push({sourceNumericId:p.sourceNumericId,surface:p.surface,
   distanceScope:p.distanceScope,timing:p.timing,bandId:p.bandId,
   first:p.first,second:p.second,
   priorConsensus:p.priorConsensus,
   previouslyConsistent:isSupported,
   observedDirection:isSupported?p.observedDirection:null,
   availableCourseModeContextsPerHalf:halfSamples[0].length,
   missingHeadcountScenarioCells:missing,
   minimumConservativeSignedWPointsByHalf:minima,
   strictlyOppositeOriginalDirectionInAnyContextByHalf:strictlyOpposite,
   heldOriginalPartialCondition:!isSupported,
   thresholds:byThreshold});
 }
 if(seen.size!==192||rows.length!==192)throw Error('P2.13 incomplete source pairs');
 const summary=Object.fromEntries(threshold.map(t=>{
  const k=String(t),base=rows.filter(x=>x.thresholds[k].full30Pass),
   replicated=rows.filter(x=>x.thresholds[k].both15Pass),
   held=rows.filter(x=>x.thresholds[k].full30Only);
  if(base.length!==p231.summary?.[k]?.minimumAcrossIndividualCourseModePass||
   base.length!==replicated.length+held.length)
   throw Error('P2.13 original P2.31 marginal denominator mismatch');
  return [k,{researchOnlyPoints:t,
   original30SeedIndividualContextPass:base.length,
   bothDisjoint15SeedHalvesPass:replicated.length,
   original30OnlyNotBothHalves:held.length,
   firstHalfPass:rows.filter(x=>x.thresholds[k].first15Pass).length,
   secondHalfPass:rows.filter(x=>x.thresholds[k].last15Pass).length,
   fullCoverageBothPass:replicated.filter(x=>x.priorConsensus===
    'consistent-in-all-tested-contexts').length,
   observedOnlyMissingStyleBothPass:replicated.filter(x=>x.priorConsensus===
    'consistent-in-observed-contexts-missing-style-scenario').length}];
 }));
 return {schemaVersion:1,
  status:'P2.13-fixed-split15-source32-W-robustness-no-real-game-procs',
  source:{modelRevision:model.PIN,skillRegistrySha256:model.SOURCE_SHA,
   originalSourceResearchSha256:pair.PINNED},
  design:{originalModelRaces:5760,split0To14And15To29:'same fixed seeds; two non-overlapping sample halves',
   simulationCasesPerHalf:2880,sourcePartialConditionSignatures:32,
   distinctConditionStylePairs:192,thresholdPoints:threshold,
   opponentRosters:model.SCENARIOS,fieldSizes:[9,12],
   modelSeedsNewlySampled:false,fullSkillActivated:false,
   independentRealWorldSamples:false,weightedRepresentativeCourse:false},
  summary,rows,
  limitations:[
   'These two halves are non-overlapping deterministic seed subsets of a *single fixed simulation design*, not independent observed races.',
   'Each half shares original source rank/time condition profiles and engine; no statistical significance or confidence interval follows.',
   'Minimum lower bound is over fixed course, artificial strength, field size and roster. Missing styles are absent, not zero.',
   'Only W (rank 10m window) is compared; D=O-U remains an independent research axis.',
   'Original source whole-skill AND/OR, preConditions, multiple Invoke, actual skill procs and effects remain unassessed.',
   '0/1/3/5 percentage-point margins are hypothetical sensitivity probes, not adopted suitability thresholds or user-facing card labels.'
  ]};
}
function main(args){
 if(args.length!==15)throw Error('Usage: split15.cjs manifest 4full 8half P2.31 output');
 const [manifest,...rest]=args;
 const fullPaths=rest.slice(0,4),splitPaths=rest.slice(4,12),
  p231Path=rest[12],outPath=rest[13];
 const reports=fullPaths.map((path,i)=>{
  const raw=fs.readFileSync(path);
  const s=model.SCENARIOS[i];
  if(crypto.createHash('sha256').update(raw).digest('hex')!==pair.PINNED[s])
   throw Error('P2.13 immutable full30 source checksum drift '+s);
  return JSON.parse(raw);
 });
 const halves=Object.fromEntries(model.SCENARIOS.map((s,i)=>[
  s,[JSON.parse(fs.readFileSync(splitPaths[i*2],'utf8')),
     JSON.parse(fs.readFileSync(splitPaths[i*2+1],'utf8'))]]));
 const out=audit(JSON.parse(fs.readFileSync(manifest,'utf8')),reports,halves,
  JSON.parse(fs.readFileSync(p231Path,'utf8')));
 fs.writeFileSync(outPath,JSON.stringify(out,null,2)+'\n');
 console.log('P2_13_SPLIT15_W='+JSON.stringify({
  summary:out.summary,limitations:out.limitations.slice(0,2)}));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={validateHalves,signedBounds,audit,main};
