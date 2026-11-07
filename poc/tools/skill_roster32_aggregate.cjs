#!/usr/bin/env node
'use strict';
/* Four fixed synthetic roster scenarios, 32 deduplicated original source
 * rank-time-surface-distance signatures, and 9/12 heads.
 * The source-balanced scenario is NEVER silently replaced by a new prior.
 */
const fs=require('node:fs');
const model=require('./globalsim_roster32.cjs');
const styles=model.STYLES;
const round=v=>Number(v.toFixed(6));
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const BOUNDARIES=[{id:'20-80',low:20,high:80},
 {id:'10-90',low:10,high:90},
 {id:'5-95',low:5,high:95}];
const classify=(v,low,high)=>v<low?'low':v>=high?'high':'middle';
const reference=[
 {id:'200681',style:'Sasi',nine:35.536379,twelve:1.076901},
 {id:'202671',style:'Sasi',nine:31.944075,twelve:10.978271},
 {id:'201051',style:'Sasi',nine:31.76795,twelve:2.937873},
 {id:'101902211',style:'Senkou',nine:50.043284,twelve:65.726951},
 {id:'202261',style:'Sasi',nine:30.47097,twelve:3.329828},
 {id:'202951',style:'Oikomi',nine:3.018803,twelve:.081509}
];
function validateReports(manifest,reports,seedsPerCell=30){
 model.verifyManifest(manifest);
 if(!Array.isArray(reports)||reports.length!==4||
  new Set(reports.map(r=>r.scenario)).size!==4||
  reports.some(r=>!model.SCENARIOS.includes(r.scenario)||
   r.schemaVersion!==2||
   r.status!=='P2-model-only-32-source-conditions-roster-sensitivity-not-game-activation'||
   r.modelRevision!==model.PIN||r.sourceSkillRegistrySha256!==model.SOURCE_SHA||
   r.seedsPerCell!==seedsPerCell||r.models!==12||
   r.simulations!==12*2*2*seedsPerCell||
   r.profileCount!==32||r.profileCourseInstances!==94||
   !Array.isArray(r.contextRows)||r.contextRows.length!==r.observedRows||
   !r.runnersPerStyleMissingIsNull||!r.unresolvedTrajectoryIsBoundedNotZero))
  throw Error('Missing/unsupported fixed source scenario report');
 const map=new Map();
 for(const r of reports){
  const idx=new Map();
  let invalids=0,held=0;
  for(const row of r.contextRows){
   const k=[row.courseId,row.fieldSize,row.mode,
    row.timing,row.bandId,row.style].join('|');
   const measured=row.status==='complete-model-measurement';
   const unresolved=row.status==='held-unresolved-rank-trajectory';
   if(idx.has(k)||row.scenario!==r.scenario||
    ![9,12].includes(row.fieldSize)||!model.MODES.includes(row.mode)||
    !model.STYLES.includes(row.style)||
    !Number.isSafeInteger(row.runners)||row.runners<=0||
    !Number.isSafeInteger(row.validRunners)||row.validRunners<0||
    !Number.isSafeInteger(row.unresolvedRunners)||row.unresolvedRunners<0||
    row.validRunners+row.unresolvedRunners!==row.runners||
    !Number.isFinite(row.opportunityLowerBoundPercent)||
    !Number.isFinite(row.opportunityUpperBoundPercent)||
    row.opportunityLowerBoundPercent<0||
    row.opportunityUpperBoundPercent>100||
    row.opportunityLowerBoundPercent>row.opportunityUpperBoundPercent+1e-5||
    !(measured||unresolved)||
    (measured&&(row.unresolvedRunners!==0||
     !Number.isFinite(row.opportunityPercent)||
     Math.abs(row.opportunityLowerBoundPercent-row.opportunityPercent)>0.00001||
     Math.abs(row.opportunityUpperBoundPercent-row.opportunityPercent)>0.00001||
     !Number.isFinite(row.pointOccupancyPercent)||
     row.pointOccupancyPercent>row.opportunityPercent+0.00001))||
    (unresolved&&(row.unresolvedRunners===0||
     row.opportunityPercent!==null||row.pointOccupancyPercent!==null)))
    throw Error('Scenario context is missing or malformed '+k);
   const course=model.COURSES.find(x=>x.id===row.courseId);
   const expected=course&&model.COUNTS[r.scenario][row.fieldSize][
    model.STYLES.indexOf(row.style)]*seedsPerCell;
   if(!expected||row.runners!==expected||row.surface!==course.surface)
    throw Error('Wrong source roster count or course surface in context '+k);
   invalids+=row.unresolvedRunners;
   if(unresolved)held++;
   idx.set(k,row);
  }
  if(invalids!==r.unresolvedRunnerWindows||held!==r.heldContextCells)
   throw Error('Held runner counts do not reconcile '+r.scenario);
  map.set(r.scenario,idx);
 }
 return map;
}
function classPossibilities(lo,hi,low,high){
 if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo<0||hi>100||lo>hi)
  throw Error('Invalid model rank-ambiguity opportunity interval');
 const all=[];
 if(lo<low)all.push('low');
 if(hi>=low&&lo<high)all.push('middle');
 if(hi>=high)all.push('high');
 if(!all.length)throw Error('Empty classification interval');
 return all;
}
function profiles(manifest,reports){
 const index=validateReports(manifest,reports,reports[0]?.seedsPerCell);
 const output=[];
 for(const p of manifest.profiles){
  const courses=model.COURSES.filter(c=>c.surface===p.surface&&
   model.SCOPE[p.distanceScope].includes(c.distanceType)).map(x=>x.id);
  for(const n of [9,12])for(const style of styles){
   const variants={};
   for(const scenario of model.SCENARIOS){
    const count=model.COUNTS[scenario][n][styles.indexOf(style)];
    if(!count){
     variants[scenario]={status:'no-style-runners',
      opportunityPercent:null,lowerBoundPercent:null,upperBoundPercent:null,
      contexts:0,heldContexts:0,unresolvedRunnerWindows:0,
      styleRunners:0,minimumPercent:null,maximumPercent:null};
     continue;
    }
    const context=[];
    for(const id of courses)for(const mode of model.MODES){
     const r=index.get(scenario).get(
      [id,n,mode,p.timing,p.bandId,style].join('|'));
     if(!r)throw Error('Not all source scope courses/modes modeled '+
      JSON.stringify({id,n,mode,style,scenario,p}));
     context.push(r);
    }
    if(context.length!==courses.length*2)
     throw Error('Wrong scenario fixed course population');
    const incomplete=context.filter(r=>r.status!=='complete-model-measurement');
    const lb=round(mean(context.map(r=>r.opportunityLowerBoundPercent)));
    const ub=round(mean(context.map(r=>r.opportunityUpperBoundPercent)));
    const complete=!incomplete.length;
    const vals=complete?context.map(r=>r.opportunityPercent):null;
    variants[scenario]={status:complete?
      'model-rank-window-measured':'held-ambiguous-source-rank-trajectory',
     opportunityPercent:complete?round(mean(vals)):null,
     lowerBoundPercent:lb,upperBoundPercent:ub,
     contexts:context.length,heldContexts:incomplete.length,
     unresolvedRunnerWindows:context.reduce((s,r)=>s+r.unresolvedRunners,0),
     styleRunners:count,
     minimumPercent:complete?round(Math.min(...vals)):null,
     maximumPercent:complete?round(Math.max(...vals)):null};
   }
   const applicable=Object.entries(variants).filter(([,v])=>
    v.status!=='no-style-runners');
   const measured=applicable.filter(([,v])=>v.opportunityPercent!==null);
   const expected=style==='Nige'?3:4;
   if(applicable.length!==expected||
    !Number.isFinite(variants.balanced.opportunityPercent))
    throw Error('Absent vs source-balanced measurable style validation failed');
   const held=applicable.length-measured.length;
   const lo=Math.min(...applicable.map(([,v])=>v.lowerBoundPercent));
   const hi=Math.max(...applicable.map(([,v])=>v.upperBoundPercent));
   const guaranteed=round(Math.max(0,
    Math.max(...applicable.map(([,v])=>v.lowerBoundPercent))-
    Math.min(...applicable.map(([,v])=>v.upperBoundPercent))));
   const fullRange=held===0?round(hi-lo):null;
   const boundaries=Object.fromEntries(BOUNDARIES.map(c=>{
    const classes=applicable.map(([scenario,v])=>({
     scenario,choices:classPossibilities(
      v.lowerBoundPercent,v.upperBoundPercent,c.low,c.high)}));
    const allSingleton=classes.every(x=>x.choices.length===1);
    const shared=['low','middle','high'].filter(k=>
     classes.every(x=>x.choices.includes(k)));
    const assessment=allSingleton&&shared.length===1?'stable':
     shared.length===0?'unstable':'indeterminate';
    const baseline=classify(variants.balanced.opportunityPercent,c.low,c.high);
    return [c.id,{balancedCategory:baseline,
     robustness:assessment,
     definiteChangesFromBalanced:classes.filter(x=>
      !x.choices.includes(baseline)).map(x=>x.scenario),
     possibleChangesFromBalanced:classes.filter(x=>
      x.choices.some(z=>z!==baseline)).map(x=>x.scenario)}];
   }));
   const baseline=variants.balanced.opportunityPercent;
   output.push({sourceNumericId:p.sourceNumericId,surface:p.surface,
    distanceScope:p.distanceScope,timing:p.timing,bandId:p.bandId,
    courseIds:courses,fieldSize:n,style,
    scenarios:variants,applicableScenarioCount:applicable.length,
    measuredScenarioCount:measured.length,heldScenarioCount:held,
    allApplicableScenariosFullyResolved:held===0,
    guaranteedMinimumScenarioSpanPoints:guaranteed,
    maximumPossibleScenarioSpanPoints:round(hi-lo),
    minAcrossScenariosPercent:held===0?round(lo):null,
    maxAcrossScenariosPercent:held===0?round(hi):null,
    rangeAcrossScenariosPoints:fullRange,
    maximumAbsoluteShiftFromBalancedPoints:held===0?
     round(Math.max(...measured.map(([,v])=>
      Math.abs(v.opportunityPercent-baseline)))):null,
    candidateThresholdRobustness:boundaries});
  }
 }
 if(output.length!==256)throw Error('Not all 32×2×4 source cohort style cases');
 return output;
}
function analyze(manifest,reports){
 const rows=profiles(manifest,reports);
 const by=xs=>({
  count:xs.length,
  fullyResolved:xs.filter(x=>x.allApplicableScenariosFullyResolved).length,
  heldByUnresolvedTrajectory:xs.filter(x=>x.heldScenarioCount>0).length,
  scenarioRangeOver5Points:xs.filter(x=>x.rangeAcrossScenariosPoints!==null&&
   x.rangeAcrossScenariosPoints>5).length,
  scenarioRangeOver20Points:xs.filter(x=>x.rangeAcrossScenariosPoints!==null&&
   x.rangeAcrossScenariosPoints>20).length,
  scenarioRangeOver50Points:xs.filter(x=>x.rangeAcrossScenariosPoints!==null&&
   x.rangeAcrossScenariosPoints>50).length,
  guaranteedScenarioSpanOver20Points:xs.filter(x=>
   x.guaranteedMinimumScenarioSpanPoints>20).length,
  possibleScenarioSpanOver20Points:xs.filter(x=>
   x.maximumPossibleScenarioSpanPoints>20).length,
  shiftFromBalancedOver20Points:xs.filter(x=>
   x.maximumAbsoluteShiftFromBalancedPoints!==null&&
   x.maximumAbsoluteShiftFromBalancedPoints>20).length,
  noFrontMissingStyleCases:xs.filter(x=>
   x.scenarios.noFront.status==='no-style-runners').length,
  byCandidate:Object.fromEntries(BOUNDARIES.map(c=>[c.id,{
   stable:xs.filter(x=>x.candidateThresholdRobustness[c.id].robustness==='stable').length,
   unstable:xs.filter(x=>x.candidateThresholdRobustness[c.id].robustness==='unstable').length,
   indeterminate:xs.filter(x=>x.candidateThresholdRobustness[c.id].robustness==='indeterminate').length
  }]))
 });
 const groups=Object.fromEntries(styles.map(style=>[style,
  Object.fromEntries([9,12].map(n=>[n,by(rows.filter(x=>
   x.style===style&&x.fieldSize===n))]))]));
 if(reports[0].seedsPerCell===30){
  for(const ref of reference){
   for(const [n,k] of [[9,'nine'],[12,'twelve']]){
    const found=rows.find(x=>x.sourceNumericId===ref.id&&
     x.style===ref.style&&x.fieldSize===n);
    if(!found||Math.abs(found.scenarios.balanced.opportunityPercent-
     ref[k])>0.0001)
     throw Error('Balanced baseline fails frozen 77 cohort replay '+ref.id+' '+n);
   }
  }
 }
 const order=[...rows].sort((a,b)=>
  b.guaranteedMinimumScenarioSpanPoints-a.guaranteedMinimumScenarioSpanPoints||
  b.maximumPossibleScenarioSpanPoints-a.maximumPossibleScenarioSpanPoints);
 const examples=[
  ['200681','Sasi'],['202671','Sasi'],
  ['201051','Sasi'],['101902211','Senkou'],
  ['202261','Sasi'],['202951','Oikomi']
 ].flatMap(([id,style])=>[9,12].map(n=>rows.find(x=>
  x.sourceNumericId===id&&x.style===style&&x.fieldSize===n))).filter(Boolean);
 return {schemaVersion:2,
  status:'p2-model-only-32-source-condition-opportunities-across-four-artificial-rosters',
  source:{modelRevision:model.PIN,
   originalSkillRegistrySha256:model.SOURCE_SHA,
   originalBalancedReferenceManifestSha256:manifest.source.previousArtifactSha256},
  design:{sourceSkillCount:77,sourceConditionProfiles:32,
   originalPathsCovered:81,
   styles:styles,fieldSizes:[9,12],
   scenarios:model.COUNTS,
   courses:model.COURSES.map(c=>({id:c.id,distance:c.distance,surface:c.surface})),
   modes:model.MODES,seedsPerCell:reports[0].seedsPerCell,
   raceCases:reports.reduce((a,r)=>a+r.simulations,0),
   opportunityNotGameActivationProbability:true},
  rawUncertainty:{byScenario:Object.fromEntries(reports.map(r=>
   [r.scenario,{heldContextCells:r.heldContextCells,
    unresolvedRunnerWindows:r.unresolvedRunnerWindows,
    missingStyleContextCells:r.missingStyleContextCells}]))},
  summary:{all:by(rows),
   byStyleAndHeadcount:groups,
   byField:Object.fromEntries([9,12].map(n=>[n,by(rows.filter(x=>x.fieldSize===n))]))},
  examples,largestGuaranteedRosterShifts:order.slice(0,16),
  profiles:rows,
  boundaries:[
   'The fixed 32 source conditions were deduplicated from the 77-skill research and are NOT representative of all skills.',
   'Balanced is the original standard research baseline; frontHeavy, backHeavy, noFront are synthetic stress scenarios, not measured player frequencies.',
   'The source 9/12 roster changes also change position-percentage-to-rank cutoffs, so cross-headcount contrasts are not a pure scenario effect.',
   'Only within identical headcount, course, mode and replicate is the seed and initial randomized stats common across scenarios.',
   'NoFront contains zero Nige runners; missing Nige is NULL, never 0% chance of activation.',
   'An exactly tied model trajectory is unresolved, NOT assigned a fake ranking. The unknown runners contribute conservative [0,100] bounds per runner.',
   'A profile including held contexts has NULL point estimate and bounds. Candidate-threshold robustness is stable, unstable, or indeterminate based on ALL permitted bounds.',
   'Aggregates over equal-weight source-eligible courses/modes only; participating runner counts differ by fixed roster.',
   'Different compositions change race dynamics; model omits actual skills, other ANDs, OR unions, activation draws and effect usefulness.',
   '20/80,10/90,5/95 are research-only probes; they are not approved suitability labels nor changes to production P3 standard balanced scope.'
  ]};
}
function main([manifestPath,balancedPath,frontPath,backPath,noFrontPath,outPath]){
 if(!outPath)throw Error('Usage: skill_roster32_aggregate.cjs manifest.json balanced.json frontHeavy.json backHeavy.json noFront.json report.json');
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const manifest=read(manifestPath);
 const report=analyze(manifest,[read(balancedPath),read(frontPath),
  read(backPath),read(noFrontPath)]);
 fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({design:report.design,summary:report.summary,
  examples:report.examples.map(p=>({id:p.sourceNumericId,style:p.style,
   fieldSize:p.fieldSize,range:p.rangeAcrossScenariosPoints,
   values:Object.fromEntries(Object.entries(p.scenarios).map(([k,v])=>
    [k,v.opportunityPercent]))}))},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={BOUNDARIES,classify,validateReports,profiles,analyze,main};
