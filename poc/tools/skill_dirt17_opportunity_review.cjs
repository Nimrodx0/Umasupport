#!/usr/bin/env node
'use strict';
/* Research-only source-cohort reconciliation for 17 dirt-limited skills.
 * Dirt is independently modeled with six genuine frozen dirt geometries,
 * NOT simply inferred by changing ground_type on turf race data.
 * Turf/dirt differences are confounded by course geometry. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const base=require('./skill_phase10_cohort_review.cjs');
const short=require('./skill_subphase10_cohort_review.cjs');
const submodel=require('./globalsim_subphase_random_10m.cjs');
const dirt=require('./globalsim_dirt_10m.cjs');
const phases=require('../src/skill_rank_timing.js');
const bands=require('./globalsim_rank_band_dominance.cjs').BANDS;
const STYLES=Object.keys(base.STYLE_IDS);
const REV=base.MODEL_REV;
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const sign=rows=>rows.map(x=>[x.type,x.operator,x.value].join(':')).sort().join('&');
const bandKeys=new Map(bands.map(b=>[sign(b.predicates),b.id]));
const shortKeys=new Set(submodel.WINDOWS.map(w=>w.key));
const OP=new Set(['==','!=','<','<=','>','>=']);
const compare=(a,op,b)=>op==='=='?a===b:op==='!='?a!==b:
 op==='<'?a<b:op==='>'?a>b:op==='<='?a<=b:a>=b;
function indexModel(report,{type,courses}){
 const isFull=type==='full';
 const status=isFull?
  'research-GlobalSim-10m-rank-opportunity-not-game-activation':
  'research-GlobalSim-subphase-random-10m-rank-opportunity-not-game-skill-rate';
 if(!['full','short'].includes(type)||!report||report.schemaVersion!==1||
  report.status!==status||report.sourceRevision!==REV||
  report.simulations!==720||report.seedsPerCell!==30||
  report.scenario!=='balanced'||
  (isFull?report.perContextRows!==4224||
   report.phaseBands!==44:report.perContextRows!==4224||
   report.windowBands!==44)||
  !Array.isArray(report.contextRows)||report.contextRows.length!==4224)
  throw Error('Dirt model not complete or source-pinned');
 if(!Array.isArray(courses)||courses.length!==6||
  courses.some(c=>c.surface!==2||!dirt.COURSES.some(x=>
   x.id===c.id&&x.distance===c.distance&&x.distanceType===c.distanceType)))
  throw Error('Dirt course source manifest was not validated');
 const ids=new Set(courses.map(c=>c.id)),seen=new Set(),index=new Map();
 for(const row of report.contextRows){
  const window=isFull?String(row.phase):row.windowKey;
  const key=[row.courseId,row.fieldSize,row.mode,window,
   row.bandId,row.style].join('|');
  if(seen.has(key))throw Error('Repeated dirt context '+key);
  seen.add(key);
  if(!ids.has(row.courseId)||![9,12].includes(row.fieldSize)||
   !['equal','jitter10'].includes(row.mode)||
   (isFull?![0,1,2,3].includes(row.phase):!shortKeys.has(window))||
   !bands.some(b=>b.id===row.bandId)||
   !STYLES.includes(row.style)||row.runners<30||
   !Number.isFinite(row.random10mOpportunityPercent)||
   !Number.isFinite(row.pointPercent)||
   row.random10mOpportunityPercent<0||row.random10mOpportunityPercent>100||
   row.pointPercent<0||row.pointPercent>100||
   row.random10mOpportunityPercent+1e-5<row.pointPercent)
   throw Error('Dirt reference sample missing or malformed '+key);
  const g=[window,row.bandId,row.style].join('|');
  if(!index.has(g))index.set(g,[]);
  index.get(g).push(row);
 }
 if(index.size!==176||[...index.values()].some(a=>a.length!==24))
  throw Error('Incomplete dirt full/short course context groups');
 return index;
}
function selectedCourses(sourceConditions,manifest){
 const constraints=sourceConditions.filter(x=>x.type==='distance_type');
 if(constraints.some(c=>!OP.has(c.operator)||
  !Number.isSafeInteger(c.value)))return [];
 return manifest.filter(c=>constraints.every(g=>
  compare(c.distanceType,g.operator,g.value))).map(x=>x.id);
}
function targetPath(path){
 const conditions=path.sourceConditions||[];
 if(path.surfaceAssessment!=='held-unverified-surface-requirement'||
  path.nonModelledReasons?.some(x=>![
   'held-unverified-surface-requirement',
   'phase-random-full-window-not-matched',
   'additional-AND-or-other-timing-unmodelled'
  ].includes(x))||
  conditions.filter(c=>c.type==='ground_type').length!==1||
  !conditions.some(c=>c.type==='ground_type'&&
   c.operator==='=='&&c.value===2)||
  conditions.some(c=>!['ground_type','distance_type','order_rate',
   'phase_random','phase_firsthalf_random',
   'phase_laterhalf_random'].includes(c.type)))
  return null;
 const time=conditions.filter(c=>phases.TIME_SPECS[c.type]);
 const rank=conditions.filter(c=>c.type==='order_rate');
 if(time.length!==1||time[0].operator!=='=='||
  !bandKeys.has(sign(rank))||
  bandKeys.get(sign(rank))!==path.bandId)return null;
 const k=time[0].type+':'+time[0].value;
 const isFull=time[0].type==='phase_random'&&
  Number.isInteger(time[0].value)&&time[0].value>=0&&time[0].value<=3;
 const isShort=shortKeys.has(k);
 if(!isFull&&!isShort)return null;
 const src=phases.timing(time[0]);
 if(src?.status!=='source-defined'||src.windows?.length!==1||
  src.courseDependent)return null;
 return {modelType:isFull?'full':'short',
  key:isFull?String(time[0].value):k,
  sourceTimeCondition:time[0],bandId:path.bandId};
}
function analyze({baseline,combined,turfFull,turfShort,dirtModel}){
 short.checkSource(baseline);
 if(!combined||combined.schemaVersion!==1||
  combined.status!=='research-77-skills-full-plus-short-10m-rank-condition-only'||
  combined.source?.sha256!==baseline.source.sha256||
  combined.counts?.skills!==77||
  combined.counts?.bySkillStatus?.['held-at-least-one-unverified-source-path']!==17)
  throw Error('Not the 77 original-source + short-window research reference');
 if(!dirtModel||dirtModel.schemaVersion!==1||
  dirtModel.status!=='research-GlobalSim-v77-dirt-10m-rank-opportunity-not-game-activation'||
  dirtModel.sourceRevision!==REV||dirtModel.surface!==2||
  dirtModel.groundCondition!=='Good'||dirtModel.simulations!==720||
  dirtModel.surfaceAptitude!=='A'||dirtModel.distanceAptitude!=='A')
  throw Error('Non-pinned or incomplete dirt research model');
 const fullDirt=indexModel(dirtModel.fullPhase,
  {type:'full',courses:dirtModel.courses});
 const shortDirt=indexModel(dirtModel.shortWindows,
  {type:'short',courses:dirtModel.courses});
 const fullTurf=base.indexModel(turfFull);
 const shortTurf=short.indexSubphase(turfShort);
 const refById=new Map(combined.items.map(x=>[x.sourceNumericId,x]));
 const results=[],values=[],unique=new Map();
 for(const item of baseline.items){
  if(!item.paths.some(p=>p.surfaceAssessment===
   'held-unverified-surface-requirement'))continue;
  if(item.paths.length!==1||item.paths[0].styles===null)
   throw Error('Unmodeled or multi-OR dirt skill requires separate study '+item.sourceNumericId);
  const path=item.paths[0],key=targetPath(path);
  if(!key)throw Error('Cannot match original dirt source time/rank '+item.sourceNumericId);
  const overlay=refById.get(item.sourceNumericId);
  if(!overlay||overlay.status!=='held-at-least-one-unverified-source-path')
   throw Error('New and old surface research cohorts disagree '+item.sourceNumericId);
  const dirtCourses=selectedCourses(path.sourceConditions,dirtModel.courses);
  const turfCourses=base.gateCourses(path.sourceConditions).courseIds;
  if(!dirtCourses.length||!turfCourses.length)
   throw Error('No comparable source distance type in six dirt and turf courses');
  const dIndex=key.modelType==='full'?fullDirt:shortDirt;
  const tIndex=key.modelType==='full'?fullTurf:shortTurf;
  const styleRows={};
  for(const style of STYLES){
   const modelKey=[key.key,key.bandId,style].join('|');
   const observed=base.measure(dIndex.get(modelKey)||[],dirtCourses);
   const control=base.measure(tIndex.get(modelKey)||[],turfCourses);
   if(!observed||!control)throw Error('Dirt/turf model data missing '+modelKey);
   styleRows[style]={status:'dirt-model-rank-condition-only',
    opportunityPercent:observed.opportunityPercent,
    contexts:observed.contexts,byHeadcount:observed.byHeadcount,
    minContextPercent:observed.minContextPercent,
    maxContextPercent:observed.maxContextPercent,
    pointOccupancyPercent:observed.pointOccupancyPercent,
    turfDifferentCourseReferencePercent:control.opportunityPercent,
    differenceDirtMinusTurfPoints:Number((
     observed.opportunityPercent-control.opportunityPercent).toFixed(6))};
   const record={sourceNumericId:item.sourceNumericId,style,
    opportunityPercent:observed.opportunityPercent};
   values.push(record);
   const sig=[key.modelType,key.key,key.bandId,
    dirtCourses.join(','),style].join('|');
   if(!unique.has(sig))unique.set(sig,record);
  }
  results.push({sourceNumericId:item.sourceNumericId,
   skillName:item.skillName,cohort:item.cohort,
   sourceConditions:path.sourceConditions,
   timeCondition:key.sourceTimeCondition,
   rankBandId:key.bandId,modelWindow:key.key,modelType:key.modelType,
   modelDirtCourseIds:dirtCourses,modelTurfReferenceCourseIds:turfCourses,
   status:'model-source-dirt-rank-component-measured-not-game-activation',
   byStyle:styleRows});
 }
 if(results.length!==17||
  new Set(results.map(x=>x.sourceNumericId)).size!==17||
  values.length!==68)
  throw Error('Expected exactly 17 original dirt source skill conditions');
 const dist=xs=>Object.fromEntries(STYLES.map(style=>[style,
  base.distribution(xs.filter(x=>x.style===style))]));
 const examples=['202001','202261','202311','202951','202841'];
 return {schemaVersion:1,
  status:'research-17-dirt-skill-rank-only-opportunity-not-game-activation',
  source:{...baseline.source},
  model:{sourceRevision:REV,dirtSurface:2,groundCondition:'Good',
   courseIds:dirtModel.courses.map(x=>x.id),races:720,
   referencedTurfFullSha256:short.FULL_SHA,
   referenceShortSha256:combined.model.shortWindowReportSha256,
   dirtReportSha256:null},
  counts:{sourceSkills:results.length,sourceStyleCases:values.length,
   uniqueConditionSignatures:unique.size/4,
   originalFullPhaseRankConditions:results.filter(x=>x.modelType==='full').length,
   originalShortWindowRankConditions:results.filter(x=>x.modelType==='short').length,
   independentlyValidatedGameSkillActivationRates:0},
  distribution:{allSkills:dist(values),distinctConditions:dist([...unique.values()])},
  examples:examples.map(id=>results.find(r=>r.sourceNumericId===id))
   .filter(Boolean),items:results,
  boundaries:[
   'All 17 source skills have ground_type==2 and an exact original-source 10m random rank-window; source AND/OR and skill IDs were verified separately.',
   'All six model dirt course IDs have surface=2 and geometry files at the frozen GlobalSim commit. Aptitudes are uniformly A, with no skills.',
   'The separate six turf reference courses have matching distance mix but different geometries. The dirt-minus-turf difference is NOT an isolated surface effect.',
   'The model uses skill-free balanced synthetic opponents and does NOT establish real-game trigger probability or effect utility.',
   'These dirt data are a separately labeled model baseline; production labels, card scores and high/medium/low thresholds are unchanged.'
  ]};
}
function main([baselinePath,combinedPath,turfFullPath,turfShortPath,dirtPath,outPath]){
 if(!outPath)throw Error('Usage: skill_dirt17_opportunity_review.cjs old77 combined77 turfFull turfShort dirtModel output.json');
 const baseline=JSON.parse(fs.readFileSync(baselinePath));
 const combined=JSON.parse(fs.readFileSync(combinedPath));
 const fullBytes=fs.readFileSync(turfFullPath);
 const shortBytes=fs.readFileSync(turfShortPath);
 if(hash(fullBytes)!==short.FULL_SHA||
  hash(shortBytes)!==combined.model.shortWindowReportSha256)
  throw Error('Pinned turf research control changed');
 const dirtBytes=fs.readFileSync(dirtPath);
 const output=analyze({baseline,combined,
  turfFull:JSON.parse(fullBytes),
  turfShort:JSON.parse(shortBytes),
  dirtModel:JSON.parse(dirtBytes)});
 output.model.dirtReportSha256=hash(dirtBytes);
 fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify({counts:output.counts,
  examples:output.examples.map(x=>({name:x.skillName,
   window:x.modelWindow,style:Object.fromEntries(
    Object.entries(x.byStyle).map(([s,v])=>[s,
     {dirt:v.opportunityPercent,turfReference:v.turfDifferentCourseReferencePercent}]))}))},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={indexModel,selectedCourses,targetPath,analyze,main};
