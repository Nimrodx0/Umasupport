#!/usr/bin/env node
'use strict';
/*
 * P2.30 research-only sensitivity of P2.29 context-consistent W directions
 * to conservative, non-adopted percentage-point margin thresholds.
 * Two-axis source output and P2.29 cross-context report must agree.
 *
 * A lower bound on MEAN context contrast is NOT a confidence bound and
 * says nothing about individual seeds, whole-skill AND gates or proc rates.
 */
const fs=require('node:fs');
const model=require('./globalsim_roster32.cjs');
const p229=require('./skill_reference_scenario_gate.cjs');
const THRESHOLDS=Object.freeze([0,1,3,5]);
const REQUIRED_STATUSES=new Set([
 'consistent-in-all-tested-contexts',
 'consistent-in-observed-contexts-missing-style-scenario']);
const stylePairs=new Set(require('./skill_specificity32_research.cjs').PAIRS.map(x=>x.join('|')));
const id=(c,a,b)=>[c.sourceNumericId,c.surface,c.distanceScope,
 c.timing,c.bandId,a,b].join('|');
const stable=v=>Number(v.toFixed(6));
function marginFor(c,p,direction){
 const scenarioValues=[];
 for(const scenario of model.SCENARIOS){
  const value=p.byScenario?.[scenario];
  if(!value||typeof value.status!=='string')
   throw Error('P2.30 source scenario data missing');
  if(value.status==='held-absent-style'){
   if(value.contexts!==0||value.lowerMeanDifferencePoints!==null||
    value.upperMeanDifferencePoints!==null)
    throw Error('P2.30 absent style must retain null limits');
   continue;
  }
  const lo=value.lowerMeanDifferencePoints,hi=value.upperMeanDifferencePoints;
  if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo>hi+0.00001)
   throw Error('P2.30 invalid source interval');
  if(value.contexts!==c.modelCourseIds.length*model.MODES.length)
   throw Error('P2.30 source context denominator drift');
  scenarioValues.push({headcount:c.fieldSize,roster:scenario,
   conservativeMarginPoints:direction==='first'?lo:-hi});
 }
 return scenarioValues;
}
function analyze(source,baseline){
 if(!source||!baseline||source.schemaVersion!==1||
   baseline.schemaVersion!==1||
   source.status!=='P2-source32-two-axis-point-specificity-and-10m-pairwise-research-only'||
   baseline.status!=='P2.29-comparison-reference-context-sensitivity-not-population-validation'||
   source.source?.modelRevision!==model.PIN||
   baseline.originalFixedModelRevision!==model.PIN||
   source.source?.fixedUmaSimSkillRegistrySha256!==model.SOURCE_SHA||
   baseline.sourceSkillRegistrySha256!==model.SOURCE_SHA||
   !Array.isArray(source.conditions)||source.conditions.length!==64||
   !Array.isArray(baseline.crossContextConsistency?.rows)||
   baseline.crossContextConsistency.rows.length!==192)
  throw Error('P2.30 source and P2.29 report identity mismatch');
 const manifest=new Map();
 for(const c of source.conditions){
  if(!Array.isArray(c.pairwise)||c.pairwise.length!==6||
   !Array.isArray(c.modelCourseIds)||!c.modelCourseIds.length||
   ![9,12].includes(c.fieldSize))throw Error('P2.30 malformed source profile');
  for(const p of c.pairwise){
   if(!stylePairs.has([p.first,p.second].join('|')))
    throw Error('P2.30 invalid style pair');
   const k=id(c,p.first,p.second);
   if(!manifest.has(k))manifest.set(k,[]);
   manifest.get(k).push({c,p});
  }
 }
 if(manifest.size!==192||[...manifest.values()].some(x=>
  x.length!==2||x[0].c.fieldSize===x[1].c.fieldSize||
  !x.some(v=>v.c.fieldSize===9)||!x.some(v=>v.c.fieldSize===12)))
  throw Error('P2.30 missing 9/12 condition pairs');
 const seen=new Set(),rows=[];
 for(const row of baseline.crossContextConsistency.rows){
  const key=id(row,row.first,row.second);
  if(seen.has(key)||!manifest.has(key)||
   ![...REQUIRED_STATUSES,'observed-context-direction-reversal',
    'held-not-all-observed-contexts-strict','no-comparable-scenario']
    .includes(row.result))
   throw Error('P2.30 missing or repeated source consensus');
  seen.add(key);
  const supported=REQUIRED_STATUSES.has(row.result);
  const available=manifest.get(key).flatMap(({c,p})=>{
   const intervals=marginFor(c,p,row.observedDirection);
   return intervals;
  });
  if(available.length!==row.comparableScenarioHeadcounts||
   available.length+row.missingStyleScenarioHeadcounts!==8)
   throw Error('P2.30 inconsistent source/missing-style coverage');
  if(supported&& !['first','second'].includes(row.observedDirection))
   throw Error('P2.30 consistent direction missing');
  const minMargin=supported?stable(Math.min(...available.map(x=>x.conservativeMarginPoints))):null;
  if(supported&&(!(minMargin>0)||available.some(x=>!(x.conservativeMarginPoints>0))))
   throw Error('P2.30 original strict scenario status contradicted by interval');
  const byThreshold=Object.fromEntries(THRESHOLDS.map(v=>[
   String(v),supported&&minMargin>v?'strict-above-margin-in-tested-contexts':
    supported?'margin-not-proven':'direction-not-strictly-consistent'
  ]));
  rows.push({sourceNumericId:row.sourceNumericId,sourceSurface:row.surface,
   sourceDistanceScope:row.distanceScope,
   timing:row.timing,bandId:row.bandId,first:row.first,second:row.second,
   priorCrossContextStatus:row.result,
   originalSourceConditionScope:'partial-rank-and-timing-only',
   observedDirection:supported?row.observedDirection:null,
   measuredScenarioHeadcounts:available.length,
   missingStyleScenarioHeadcounts:row.missingStyleScenarioHeadcounts,
   // Equal weighting is NOT used. A minimum is a worst-case among observed
   // scenario-level arithmetic means, each of which covers courses/modes.
   minimumConservativeScenarioMeanDifferencePoints:minMargin,
   thresholdSensitivity:byThreshold,
   heldReasons:supported?[]:[row.result]
  });
 }
 if(rows.length!==192||seen.size!==192)
  throw Error('P2.30 required 192 comparisons');
 const originalCounts=baseline.crossContextConsistency.byStatus;
 for(const category of Object.keys(originalCounts))
  if(rows.filter(x=>x.priorCrossContextStatus===category).length!==originalCounts[category])
   throw Error('P2.30 P2.29 classification discrepancy');
 const byThreshold=Object.fromEntries(THRESHOLDS.map(v=>{
  const passed=rows.filter(x=>x.thresholdSensitivity[String(v)]===
   'strict-above-margin-in-tested-contexts');
  return [String(v),{marginPoints:v,
   fullCoverage:passed.filter(x=>x.priorCrossContextStatus===
    'consistent-in-all-tested-contexts').length,
   observedOnlyMissingStyle:passed.filter(x=>x.priorCrossContextStatus===
    'consistent-in-observed-contexts-missing-style-scenario').length,
   total:passed.length,
   heldOrReversed:rows.length-passed.length}];
 }));
 for(let i=1;i<THRESHOLDS.length;i++)
  if(byThreshold[String(THRESHOLDS[i])].total>
    byThreshold[String(THRESHOLDS[i-1])].total)
   throw Error('P2.30 stricter threshold increased subset');
 return {schemaVersion:1,
  status:'P2.30-conservative-mean-margin-sensitivity-research-only',
  source:{modelRevision:model.PIN,skillRegistrySha256:model.SOURCE_SHA},
  design:{comparedSourceSignatures:32,stylePairs:192,
   opponentRosters:model.SCENARIOS,fieldSizes:[9,12],
   thresholdsPoints:THRESHOLDS,
   baselineOfComparison:'minimum-of-source-scenario-mean-bounds-no-weighting',
   reuses32ConditionTwoAxisW:'yes',
   realGameEventFrequencies:'unknown',
   userApprovedProductThreshold:'none'},
  originalCrossContextGroups:originalCounts,
  summary:{byThreshold,
   originalFullyConsistent:rows.filter(x=>x.priorCrossContextStatus===
     'consistent-in-all-tested-contexts').length,
   originalConsistentOnObservedOnly:rows.filter(x=>x.priorCrossContextStatus===
     'consistent-in-observed-contexts-missing-style-scenario').length,
   heldOrReversal:rows.filter(x=>!REQUIRED_STATUSES.has(x.priorCrossContextStatus)).length},
  rows,
  limitations:[
   'A threshold on the smallest scenario MEAN contrast is NOT a guarantee for every individual course, strength mode, seed or actual race.',
   'These are sensitivity cutoffs (0,1,3,5 percentage points), NOT adopted high/medium/low labels or a statistically justified meaningful-difference threshold.',
   'No statistical confidence, seed split or independence test is performed; repeated source conditions and model runs are correlated.',
   'Missing styles are not treated as zero; observed-only consensus is strictly less evidence than full scenario coverage.',
   'The compared opportunities concern a rank/time subcondition, NOT all source AND/OR/preconditions or actual skill activation.',
   'The D=O-U point occupancy specificity axis is separate and not combined with the W opportunity comparisons.',
   'No product UX changes, P3 score, real-world representative assumptions, weights or user-skill activation probabilities.'
  ]};
}
function main(argv){
 if(argv.length!==3)throw Error('Usage: skill_context_margin_sensitivity.cjs <two-axis.json> <p2-29-report.json> <output.json>');
 const report=analyze(JSON.parse(fs.readFileSync(argv[0],'utf8')),
  JSON.parse(fs.readFileSync(argv[1],'utf8')));
 fs.writeFileSync(argv[2],JSON.stringify(report,null,2)+'\n');
 console.log('P2_30_MARGIN_SENSITIVITY='+JSON.stringify({
  originalGroups:report.originalCrossContextGroups,
  byThreshold:report.summary.byThreshold,
  caveat:'sensitivity only, not adopted label or source whole-skill trigger'
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={THRESHOLDS,marginFor,analyze,main};
