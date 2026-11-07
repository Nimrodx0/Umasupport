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
   r.schemaVersion!==1||
   r.status!=='P2-model-only-32-source-conditions-roster-sensitivity-not-game-activation'||
   r.modelRevision!==model.PIN||r.sourceSkillRegistrySha256!==model.SOURCE_SHA||
   r.seedsPerCell!==seedsPerCell||r.models!==12||
   r.simulations!==12*2*2*seedsPerCell||
   r.profileCount!==32||r.profileCourseInstances!==94||
   !Array.isArray(r.contextRows)||r.contextRows.length!==r.observedRows||
   !r.runnersPerStyleMissingIsNull))
  throw Error('Missing/unsupported fixed source scenario report');
 const map=new Map();
 for(const r of reports){
  const idx=new Map();
  for(const row of r.contextRows){
   const k=[row.courseId,row.fieldSize,row.mode,
    row.timing,row.bandId,row.style].join('|');
   if(idx.has(k)||row.scenario!==r.scenario||
    ![9,12].includes(row.fieldSize)||!model.MODES.includes(row.mode)||
    !model.STYLES.includes(row.style)||!Number.isInteger(row.runners)||
    !Number.isFinite(row.opportunityPercent)||row.opportunityPercent<0||
    row.opportunityPercent>100||row.pointOccupancyPercent<0||
    row.pointOccupancyPercent>row.opportunityPercent+0.00001)
    throw Error('Scenario context is missing or malformed '+k);
   const course=model.COURSES.find(x=>x.id===row.courseId);
   const expected=course&&model.COUNTS[r.scenario][row.fieldSize][
    model.STYLES.indexOf(row.style)]*seedsPerCell;
   if(!expected||row.runners!==expected||row.surface!==course.surface)
    throw Error('Wrong source roster count or course surface in context '+k);
   idx.set(k,row);
  }
  map.set(r.scenario,idx);
 }
 return map;
}
function profiles(manifest,reports){
 const index=validateReports(manifest,reports);
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
      opportunityPercent:null,contexts:0,
      styleRunners:0,minimumPercent:null,maximumPercent:null};
     continue;
    }
    const available=[];
    for(const id of courses)for(const mode of model.MODES){
     const r=index.get(scenario).get(
      [id,n,mode,p.timing,p.bandId,style].join('|'));
     if(!r)throw Error('Not all source scope courses/modes modeled '+
      JSON.stringify({id,n,mode,style,scenario,p}));
     available.push(r.opportunityPercent);
    }
    if(available.length!==courses.length*2)
     throw Error('Wrong scenario fixed course population');
    variants[scenario]={status:'model-rank-window-measured',
     opportunityPercent:round(mean(available)),
     contexts:available.length,styleRunners:count,
     minimumPercent:round(Math.min(...available)),
     maximumPercent:round(Math.max(...available))};
   }
   const observed=Object.entries(variants).filter(([,v])=>
    v.status==='model-rank-window-measured').map(([scenario,v])=>({
     scenario,value:v.opportunityPercent}));
   if(observed.length!==(style==='Nige'?3:4)||
    !Number.isFinite(variants.balanced.opportunityPercent))
    throw Error('Absent vs measured style validation failed');
   const min=Math.min(...observed.map(v=>v.value)),
    max=Math.max(...observed.map(v=>v.value));
   const boundaries=Object.fromEntries(BOUNDARIES.map(c=>{
    const cls=observed.map(v=>classify(v.value,c.low,c.high));
    const m=classify(variants.balanced.opportunityPercent,c.low,c.high);
    return [c.id,{balancedCategory:m,
     changesFromBalanced:observed.filter((v,i)=>cls[i]!==m).map(v=>v.scenario),
     stableAcrossAllDefinedScenarios:new Set(cls).size===1}];
   }));
   const baseline=variants.balanced.opportunityPercent;
   output.push({sourceNumericId:p.sourceNumericId,surface:p.surface,
    distanceScope:p.distanceScope,timing:p.timing,bandId:p.bandId,
    courseIds:courses,fieldSize:n,style,
    scenarios:variants,availableScenarioCount:observed.length,
    minAcrossScenariosPercent:round(min),
    maxAcrossScenariosPercent:round(max),
    rangeAcrossScenariosPoints:round(max-min),
    maximumAbsoluteShiftFromBalancedPoints:round(Math.max(...observed.map(x=>
     Math.abs(x.value-baseline)))),
    candidateThresholdRobustness:boundaries});
  }
 }
 if(output.length!==256)throw Error('Not all 32×2×4 source cohort style cases');
 return output;
}
function analyze(manifest,reports){
 const rows=profiles(manifest,reports);
 const by=(xs)=>({
  count:xs.length,
  scenarioRangeOver5Points:xs.filter(x=>x.rangeAcrossScenariosPoints>5).length,
  scenarioRangeOver20Points:xs.filter(x=>x.rangeAcrossScenariosPoints>20).length,
  scenarioRangeOver50Points:xs.filter(x=>x.rangeAcrossScenariosPoints>50).length,
  shiftFromBalancedOver20Points:xs.filter(x=>
   x.maximumAbsoluteShiftFromBalancedPoints>20).length,
  noFrontMissingStyleCases:xs.filter(x=>
   x.scenarios.noFront.status==='no-style-runners').length,
  byCandidate:Object.fromEntries(BOUNDARIES.map(c=>[c.id,{
   unstable:xs.filter(x=>
    !x.candidateThresholdRobustness[c.id].stableAcrossAllDefinedScenarios).length,
   stable:xs.filter(x=>
    x.candidateThresholdRobustness[c.id].stableAcrossAllDefinedScenarios).length
  }]))
 });
 const groups=Object.fromEntries(styles.map(style=>[style,
  Object.fromEntries([9,12].map(n=>[n,by(rows.filter(x=>
   x.style===style&&x.fieldSize===n))]))]));
 // The historical balanced control is the same source engine, seeds, original
 // 6 turf/6 dirt course IDs and 30 trials; enforce prior published numbers.
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
 const order=[...rows].sort((a,b)=>b.rangeAcrossScenariosPoints-
  a.rangeAcrossScenariosPoints);
 const examples=[
  ['200681','Sasi'],['202671','Sasi'],
  ['201051','Sasi'],['101902211','Senkou'],
  ['202261','Sasi'],['202951','Oikomi']
 ].flatMap(([id,style])=>[9,12].map(n=>rows.find(x=>
  x.sourceNumericId===id&&x.style===style&&x.fieldSize===n))).filter(Boolean);
 return {schemaVersion:1,
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
  summary:{all:by(rows),
   byStyleAndHeadcount:groups,
   byField:Object.fromEntries([9,12].map(n=>[n,by(rows.filter(x=>x.fieldSize===n))]))},
  examples,largestRosterShifts:order.slice(0,16),
  profiles:rows,
  boundaries:[
   'The fixed 32 source conditions were deduplicated from the old 77-skill research and are NOT representative of all skills.',
   'Balanced is the original reference-only research baseline; frontHeavy, backHeavy and noFront are artificial stress tests, NOT measured race frequencies.',
   'The source 9/12 roster changes also change position-percentage-to-rank cutoffs, so cross-headcount contrasts are not a pure scenario effect.',
   'Only within equal field size, course, mode and replicate is the seed and initial individual randomized stats common across scenarios.',
   'NoFront contains zero Nige runners; its missing Nige value is NULL, NOT zero percent activation opportunity.',
   'Aggregates over each fixed model scenario equal-weight source-eligible course and stat-mode contexts; field-style racer numbers differ by roster.',
   'Different synthetic compositions change running dynamics; the model omits actual skills, other ANDs, skill activation draws and effect usefulness.',
   '20/80,10/90,5/95 are sensitivity probes only; they are NOT approved suitability labels or changes to product UI/P3 standard balanced-deck scope.'
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
