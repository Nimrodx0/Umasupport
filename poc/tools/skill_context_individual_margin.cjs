#!/usr/bin/env node
'use strict';
/*
 * P2.31: compare P2.30's scenario-MEAN interval margins with the minimum
 * interval margin across ACTUAL recorded course × ability-mode contexts.
 * The 5,760 fixed skill-free model races are NOT 5,760 independent samples
 * and the reports have no per-seed split. No suitability labels are issued.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const model=require('./globalsim_roster32.cjs');
const agg=require('./skill_roster32_aggregate.cjs');
const pair=require('./skill_specificity32_research.cjs');
const margin=require('./skill_context_margin_sensitivity.cjs');
const CONSISTENT=new Set([
 'consistent-in-all-tested-contexts',
 'consistent-in-observed-contexts-missing-style-scenario'
]);
const THRESHOLDS=margin.THRESHOLDS;
const round=n=>Number(n.toFixed(6));
const key=(p,a,b)=>[p.sourceNumericId,p.surface,p.distanceScope,
 p.timing,p.bandId,a,b].join('|');
const cellKey=(course,n,mode,timing,band,style)=>
 [course,n,mode,timing,band,style].join('|');
function matchingContexts(index,profile,first,second,fieldSize,scenario){
 if(!model.SCENARIOS.includes(scenario)||![9,12].includes(fieldSize)||
  !model.STYLES.includes(first)||!model.STYLES.includes(second))
  throw Error('Unrecognized P2.31 fixed context');
 const absent=model.COUNTS[scenario][fieldSize];
 const firstMissing=absent[model.STYLES.indexOf(first)]===0;
 const secondMissing=absent[model.STYLES.indexOf(second)]===0;
 if(firstMissing||secondMissing)return [];
 const courseIds=model.COURSES.filter(c=>c.surface===profile.surface&&
   model.SCOPE[profile.distanceScope].includes(c.distanceType)).map(c=>c.id);
 if(!courseIds.length)throw Error('No original source compatible courses');
 const source=index.get(scenario);
 return courseIds.flatMap(courseId=>model.MODES.map(mode=>{
  const a=source.get(cellKey(courseId,fieldSize,mode,
   profile.timing,profile.bandId,first));
  const b=source.get(cellKey(courseId,fieldSize,mode,
   profile.timing,profile.bandId,second));
  if(!a||!b)throw Error('P2.31 missing exact course/ability source row');
  const compared=pair.sameContextContrast(a,b);
  if(!['first-strictly-higher','second-strictly-higher',
   'held-overlap-or-tie'].includes(compared.status))
   throw Error('P2.31 unexpectedly missing recorded style');
  return {scenario,fieldSize,courseId,mode,
   first,second,...compared};
 }));
}
function audit(manifest,reports,p230){
 model.verifyManifest(manifest);
 const index=agg.validateReports(manifest,reports,30);
 if(!p230||p230.schemaVersion!==1||
  p230.status!=='P2.30-conservative-mean-margin-sensitivity-research-only'||
  p230.source?.modelRevision!==model.PIN||
  p230.source?.skillRegistrySha256!==model.SOURCE_SHA||
  !Array.isArray(p230.rows)||p230.rows.length!==192||
  p230.design?.reuses32ConditionTwoAxisW!=='yes'||
  JSON.stringify(p230.design?.thresholdsPoints)!==
   JSON.stringify(THRESHOLDS))
  throw Error('P2.31 unverified P2.30 research source');
 const profiles=new Map(manifest.profiles.map(x=>[
  key(x,model.STYLES[0],model.STYLES[1]).split('|').slice(0,5).join('|'),x
 ]));
 if(profiles.size!==32)throw Error('P2.31 source condition manifest drift');
 const checked=new Set(),rows=[];
 for(const source of p230.rows){
  if(!pair.PAIRS.some(([a,b])=>
    a===source.first&&b===source.second))
   throw Error('P2.31 unsupported style pair');
  const sourceKey=[source.sourceNumericId,source.sourceSurface,
   source.sourceDistanceScope,source.timing,source.bandId].join('|');
  const profile=profiles.get(sourceKey);
  if(!profile)throw Error('P2.31 source profile not found');
  const name=key(profile,source.first,source.second);
  if(checked.has(name))throw Error('P2.31 repeated source style pair');
  checked.add(name);
  const support=CONSISTENT.has(source.priorCrossContextStatus);
  if(support&&!['first','second'].includes(source.observedDirection))
   throw Error('P2.31 missing direction for an allegedly consistent pair');
  const contexts=[];
  for(const n of [9,12])for(const scenario of model.SCENARIOS){
   contexts.push(...matchingContexts(index,profile,
    source.first,source.second,n,scenario));
  }
  const numberCourses=model.COURSES.filter(x=>x.surface===profile.surface&&
   model.SCOPE[profile.distanceScope].includes(x.distanceType)).length;
  const perScenario=numberCourses*model.MODES.length;
  if(contexts.length!==source.measuredScenarioHeadcounts*perScenario||
   8*perScenario-contexts.length!==
     source.missingStyleScenarioHeadcounts*perScenario)
   throw Error('P2.31 mismatched source context/missing style coverage');
  const signed=contexts.map(x=>source.observedDirection==='first'?
   x.differenceLowerPoints:-x.differenceUpperPoints);
  const minIndividual=support?round(Math.min(...signed)):null;
  if(support&&(!signed.length||!signed.every(x=>x>pair.EPS)||
   minIndividual>source.minimumConservativeScenarioMeanDifferencePoints+0.00005))
   throw Error('P2.31 signed course context contradicts source mean or direction');
  const perThreshold=Object.fromEntries(THRESHOLDS.map(v=>{
   const admitted=support&&minIndividual>v;
   const mean=source.thresholdSensitivity?.[String(v)]===
    'strict-above-margin-in-tested-contexts';
   if(admitted&&!mean)throw Error('P2.31 individual context stronger than its mean');
   return [String(v),{individualCourseModePass:admitted,
    scenarioMeanPass:mean,
    meanOnly:mean&&!admitted}];
  }));
  rows.push({sourceNumericId:source.sourceNumericId,
   surface:source.sourceSurface,distanceScope:source.sourceDistanceScope,
   timing:source.timing,bandId:source.bandId,
   first:source.first,second:source.second,
   priorConsensus:source.priorCrossContextStatus,
   observedDirection:support?source.observedDirection:null,
   originalMeanMinimumPoints:source.minimumConservativeScenarioMeanDifferencePoints,
   measuredCourseModeContextCells:contexts.length,
   absentStyleCourseModeContextCells:8*perScenario-contexts.length,
   numberOfSourceEligibleCourses:numberCourses,
   minimumIndividualCourseModeLowerBoundPoints:minIndividual,
   thresholds:perThreshold});
 }
 if(rows.length!==192||checked.size!==192)
  throw Error('P2.31 unmatched source comparisons');
 const summary=Object.fromEntries(THRESHOLDS.map(v=>{
  const k=String(v),mean=rows.filter(x=>x.thresholds[k].scenarioMeanPass),
   individual=rows.filter(x=>x.thresholds[k].individualCourseModePass);
  const meanOnly=rows.filter(x=>x.thresholds[k].meanOnly);
  if(mean.length!==p230.summary?.byThreshold?.[k]?.total||
   individual.length+meanOnly.length!==mean.length)
   throw Error('P2.31 P2.30 mean count mismatch');
  return [k,{thresholdPoints:v,
   scenarioMeanPass:mean.length,
   minimumAcrossIndividualCourseModePass:individual.length,
   scenarioMeanOnlyNotEveryCourseMode:meanOnly.length,
   fullCoverageIndividualPass:individual.filter(x=>x.priorConsensus===
    'consistent-in-all-tested-contexts').length,
   observedOnlyMissingStyleIndividualPass:individual.filter(x=>
    x.priorConsensus===
    'consistent-in-observed-contexts-missing-style-scenario').length}];
 }));
 return {schemaVersion:1,
  status:'P2.31-individual-course-mode-W-margin-vs-scenario-mean-research-only',
  source:{modelRevision:model.PIN,
   skillRegistrySha256:model.SOURCE_SHA,sourceArtifactSha256:pair.PINNED},
  design:{sourceSignatures:32,styleComparisons:192,
   rosters:model.SCENARIOS,heads:[9,12],modes:model.MODES,
   sourceEligibleCoursesOnly:true,
   thresholdPoints:THRESHOLDS,seedSplitStatus:'NOT TESTED: only aggregated 30-seed reports',
   weighting:'none',gameSkillProcs:'not measured'},
  summary,rows,
  limitations:[
   'Minimum is across aggregate course × ability-mode W opportunity bounds, NOT individual races or seeds.',
   'Missing style creates no comparison; eligible source courses only, no inferred real-course weights.',
   'Each scenario/field uses 30-seed aggregate, not independent seed-split confirmation.',
   'No original skill full AND/OR, precondition or multiple Invoke activation is measured.',
   'O-U specificity D is distinct; only W pair contrasts appear here.',
   'Thresholds 0/1/3/5 are diagnostic values, not scientifically validated or adopted product labels.',
   'Results cannot be converted into real skill activation probabilities, card rankings or public suitability badges.'
  ]};
}
function main(args){
 if(args.length!==8)throw Error('Usage: skill_context_individual_margin.cjs manifest balanced frontHeavy backHeavy noFront P2.30.json output.json [reserved]');
 const [manifest,balanced,frontHeavy,backHeavy,noFront,p230,out,reserved]=args;
 if(reserved!=='--verified')throw Error('Explicit verified source mode required');
 const sourcePaths=[balanced,frontHeavy,backHeavy,noFront];
 const reports=sourcePaths.map((path,i)=>{
  const raw=fs.readFileSync(path);
  const s=model.SCENARIOS[i];
  if(crypto.createHash('sha256').update(raw).digest('hex')!==pair.PINNED[s])
   throw Error('P2.31 immutable source artifact checksum mismatch '+s);
  return JSON.parse(raw);
 });
 const z=audit(JSON.parse(fs.readFileSync(manifest,'utf8')),reports,
  JSON.parse(fs.readFileSync(p230,'utf8')));
 fs.writeFileSync(out,JSON.stringify(z,null,2)+'\n');
 console.log('P2_31_COURSE_MODE_MARGIN='+JSON.stringify({
  summary:z.summary,limitations:z.limitations.slice(0,2)}));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={THRESHOLDS,matchingContexts,audit,main};
