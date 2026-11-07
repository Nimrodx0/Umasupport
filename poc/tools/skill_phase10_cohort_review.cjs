#!/usr/bin/env node
'use strict';
/* Research-only 53+24 source skill audit using fixed balanced GlobalSim 10m
 * phase_random rank opportunity. NEVER a real skill activation rate, a
 * high/low label, or a support-card score. No third-party source data bundled.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const review53=require('./skill_activation_fit_v1_report.cjs');
const new24=require('./rank_band_app_identity_audit.cjs');
const bounds=require('../src/skill_order_rate_bounds.cjs');
const bands=require('./globalsim_rank_band_dominance.cjs').BANDS;
const expanded=require('./globalsim_position_expanded.cjs');
const SOURCE_SHA=review53.SHA||'4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const REV='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const MODEL_REV='80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1';
const STYLE_IDS=Object.freeze({Nige:1,Senkou:2,Sasi:3,Oikomi:4});
const ABSENT_IDS=new Set(['100702211','100702221','101902211','103401211',
 '103401221','103601111','105501111']);
const ALLOWED_GATES=new Set(['distance_type','ground_type',
 'ground_condition','running_style']);
const TIMING=new Set(['phase_random','phase_firsthalf_random',
 'phase_laterhalf_random','phase_firstquarter_random',
 'phase_firstquarter','phase_firsthalf','phase_laterhalf','phase',
 'phase_straight_random','phase_corner_random',
 'phase_first_half_straight_random','phase_latter_half_straight_random',
 'distance_rate','distance_rate_after_random','corner_random']);
const round=v=>Number(v.toFixed(6));
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const cond=c=>[c.type,c.operator,c.value].join(':');
const predSig=p=>p.map(cond).sort().join('&');
const bandBySig=new Map(bands.map(b=>[predSig(b.predicates),b]));
const courseDistance=new Map(expanded.COURSES.map(c=>[c.id,c.distance]));
const distanceType=d=>d<1400?1:d<1800?2:d<2500?3:4;
function strictCohorts(audit,raw){
 if(!audit||audit.auditVersion!==7||audit.source?.revision!==REV||
  audit.source?.sha256!==SOURCE_SHA||
  audit.p2StyleReview?.total!==53||
  audit.p2StyleTendency?.app?.inferred!==53||
  !Array.isArray(raw)||raw.length!==2162)
  throw Error('Source cohort is not the fixed 53 + 2162 audit');
 const original53=audit.p2StyleReview.groups.flatMap(g=>g.skills||[]);
 if(original53.length!==53||new Set(original53.map(x=>x.sourceNumericId)).size!==53)
  throw Error('Original 53 source cohort incomplete');
 const originalById=new Map(raw.map(x=>[String(x.id),x]));
 if(originalById.size!==2162)throw Error('Duplicate source registry IDs');
 const twentyFour=new24.candidates(raw);
 if(twentyFour.length!==24||
  twentyFour.filter(x=>ABSENT_IDS.has(x.sourceNumericId)).length!==7||
  twentyFour.some(x=>x.evidenceWindows.length===0))
  throw Error('New 24 source cohort drift or uncertain app coverage');
 const oldIds=new Set(original53.map(x=>x.sourceNumericId));
 if(twentyFour.some(x=>oldIds.has(x.sourceNumericId)))
  throw Error('Source cohorts overlap');
 const items=[];
 for(const x of original53){
  const rawSkill=originalById.get(x.sourceNumericId);
  if(!rawSkill||new24.norm(rawSkill.name)!==new24.norm(x.name))
   throw Error('Original 53 ID/name drift '+x.sourceNumericId);
  const actual=(rawSkill.invokes||[]).map((inv,i)=>({...inv,
   index:inv.index??i,conditions:inv.conditions??[],
   preConditions:inv.preConditions??[]}));
  // The historic 53 review is exactly one invoke. Check that its source
  // AND/OR branches equal the original source; do not lose hidden branches.
  if(actual.length!==1||x.paths.length!==actual[0].conditions.length||
   actual[0].preConditions?.length)
   throw Error('Historic source 53 coverage mismatch '+x.sourceNumericId);
  for(const p of x.paths){
   const rhs=actual[0].conditions[p.orIndex];
   if(!rhs||predSig(p.sourceConditions)!==predSig(rhs))
    throw Error('Historic source 53 branch changed '+x.sourceNumericId);
  }
  items.push({sourceNumericId:x.sourceNumericId,skillName:x.name,
   cohort:'old53',catalogScope:'historically-app-reviewed',
   historicalDirection:x.tendency,invokes:actual});
 }
 for(const x of twentyFour){
  const rawSkill=originalById.get(x.sourceNumericId);
  if(!rawSkill||new24.norm(rawSkill.name)!==x.sourceName)
   throw Error('New 24 ID/name drift '+x.sourceNumericId);
  items.push({sourceNumericId:x.sourceNumericId,skillName:x.sourceName,
   cohort:'new24',catalogScope:ABSENT_IDS.has(x.sourceNumericId)?
    'not-in-fixed-881-app':'verified-in-fixed-881-app',
   historicalDirection:null,invokes:(rawSkill.invokes||[]).map((inv,i)=>({
    ...inv,index:inv.index??i,conditions:inv.conditions??[],
    preConditions:inv.preConditions??[]}))});
 }
 if(items.length!==77||new Set(items.map(x=>x.sourceNumericId)).size!==77)
  throw Error('Incomplete source 77');
 return items.sort((a,b)=>a.sourceNumericId.localeCompare(b.sourceNumericId));
}
function indexModel(report){
 if(!report||report.schemaVersion!==1||
  report.status!=='research-GlobalSim-10m-rank-opportunity-not-game-activation'||
  report.sourceRevision!==MODEL_REV||
  report.scenario!=='balanced'||report.simulations!==720||
  report.seedsPerCell!==30||report.contexts!==24||
  report.phaseBands!==44||report.perContextRows!==4224||
  report.windowMetres!==10||!Array.isArray(report.contextRows)||
  report.contextRows.length!==4224)
  throw Error('Unverified complete balanced-only 10m model report');
 const map=new Map(),seen=new Set();
 for(const r of report.contextRows){
  if(![9,12].includes(r.fieldSize)||
   !expanded.COURSES.some(c=>c.id===r.courseId)||
   !expanded.MODES.includes(r.mode)||
   ![0,1,2,3].includes(r.phase)||
   !bands.some(b=>b.id===r.bandId)||
   !Object.hasOwn(STYLE_IDS,r.style)||
   !Number.isFinite(r.random10mOpportunityPercent)||
   r.random10mOpportunityPercent<0||
   r.random10mOpportunityPercent>100||
   !Number.isFinite(r.pointPercent)||r.pointPercent<0||
   r.pointPercent>100||r.runners<30)
   throw Error('Malformed ten-metre model observation');
  const key=[r.courseId,r.fieldSize,r.mode,r.phase,r.bandId,r.style].join('|');
  if(seen.has(key))throw Error('Duplicate ten-metre model observation '+key);
  seen.add(key);
  const k=[r.phase,r.bandId,r.style].join('|');
  if(!map.has(k))map.set(k,[]);
  map.get(k).push(r);
 }
 if(seen.size!==4224||map.size!==176||
  [...map.values()].some(rows=>rows.length!==24))
  throw Error('10m model is missing contexts or styles');
 return map;
}
function gateCourses(conditions){
 const gates=conditions.filter(c=>c.type==='distance_type');
 if(!gates.length)return {courseIds:[...courseDistance.keys()],distanceTypes:[1,2,3,4],
  scope:'six-course-reference-no-explicit-distance-gate'};
 if(gates.some(c=>!['==','!=','<=','>=','<','>'].includes(c.operator)||
  !Number.isSafeInteger(c.value)))
  return {courseIds:[],distanceTypes:[],scope:'held-invalid-distance-gate'};
 const compare=(a,op,b)=>op==='=='?a===b:op==='!='?a!==b:
  op==='<='?a<=b:op==='>='?a>=b:op==='<'?a<b:a>b;
 const filtered=[...courseDistance].filter(([,d])=>
  gates.every(c=>compare(distanceType(d),c.operator,c.value)));
 return {courseIds:filtered.map(([id])=>id),
  distanceTypes:[...new Set(filtered.map(([,d])=>distanceType(d)))].sort(),
  scope:filtered.length?'matched-source-distance-gate':'held-no-matching-model-course'};
}
function sourceSurface(conditions){
 const surface=conditions.filter(c=>['ground_type','ground_condition'].includes(c.type));
 if(!surface.length)return 'no-explicit-surface-gate-turf-model-provisional-transfer';
 if(surface.some(c=>c.type==='ground_type'&&
  (c.operator!=='=='||c.value!==1)))return 'held-unverified-surface-requirement';
 if(surface.some(c=>c.type==='ground_condition'))
  return 'held-unverified-track-condition';
 return 'source-turf-gate-matched-model';
}
function perStyleSourceEligibility(row,style){
 const explicit=row.filter(c=>c.type==='running_style');
 if(!explicit.length)return true;
 const id=STYLE_IDS[style];
 for(const c of explicit){
  if(c.operator==='=='&&id!==c.value)return false;
  if(c.operator==='!='&&id===c.value)return false;
  if(!['==','!='].includes(c.operator))return null;
 }
 return true;
}
function measure(rows,selectedCourses){
 const samples=rows.filter(r=>selectedCourses.includes(r.courseId));
 if(!samples.length)return null;
 const average=key=>round(samples.reduce((a,b)=>a+b[key],0)/samples.length);
 const byHeadcount=Object.fromEntries([9,12].map(n=>{
  const subset=samples.filter(r=>r.fieldSize===n);
  return [n,subset.length?
   round(subset.reduce((a,b)=>a+b.random10mOpportunityPercent,0)/subset.length):null];
 }));
 return {scope:'model-rank-condition-10m-window-not-real-skill-trigger',
  modelScenario:'balanced',contexts:samples.length,
  sourceCourseIds:[...new Set(samples.map(r=>r.courseId))].sort((a,b)=>a-b),
  opportunityPercent:average('random10mOpportunityPercent'),
  pointOccupancyPercent:average('pointPercent'),
  upliftPoints:average('upliftPoints'),
  minContextPercent:round(Math.min(...samples.map(r=>r.random10mOpportunityPercent))),
  maxContextPercent:round(Math.max(...samples.map(r=>r.random10mOpportunityPercent))),
  byHeadcount};
}
function assessPath(row,preConditions,index){
 if(!Array.isArray(row)||row.some(x=>!x||
  typeof x.type!=='string'||!Number.isSafeInteger(x.value)||
  !['==','!=','<','<=','>','>='].includes(x.operator)))
  return {status:'held-bad-conditions',sourceConditions:row||[]};
 const conditions=row.map(x=>({type:x.type,operator:x.operator,value:x.value}));
 const times=conditions.filter(x=>TIMING.has(x.type));
 const rank=conditions.filter(x=>x.type==='order_rate');
 const band=bandBySig.get(predSig(rank))||null;
 const phase=times.length===1&&times[0].type==='phase_random'&&
  times[0].operator==='=='&&Number.isInteger(times[0].value)&&
  times[0].value>=0&&times[0].value<4?times[0].value:null;
 const gates=gateCourses(conditions),surface=sourceSurface(conditions);
 const other=conditions.filter(x=>x.type!=='order_rate'&&
  x.type!=='phase_random'&&!ALLOWED_GATES.has(x.type));
 const reasons=[];
 if(!band)reasons.push('source-rank-band-not-in-11-model-bands');
 if(phase===null)reasons.push('phase-random-full-window-not-matched');
 if(other.length)reasons.push('additional-AND-or-other-timing-unmodelled');
 if(Array.isArray(preConditions)&&preConditions.length)
  reasons.push('invoke-preconditions-unmodelled');
 if(gates.courseIds.length===0)reasons.push('distance-not-simulated');
 if(surface.startsWith('held-'))reasons.push(surface);
 const geometricallyMeasured=!!band&&phase!==null&&gates.courseIds.length>0;
 const styleRows={};
 for(const style of Object.keys(STYLE_IDS)){
  const eligible=perStyleSourceEligibility(conditions,style);
  if(eligible===false){styleRows[style]={
   status:'source-style-ineligible',partialRankOpportunity:null};continue}
  if(eligible===null)reasons.push('unknown-running-style-operator');
  const model=geometricallyMeasured&&eligible!==false?
   measure(index.get([phase,band.id,style].join('|'))||[],gates.courseIds):null;
  if(geometricallyMeasured&&!model)
   throw Error('Expected ten-metre model evidence missing');
  const clear=geometricallyMeasured&&!reasons.length&&eligible===true;
  styleRows[style]={status:clear?
   'rank-and-window-modelled-not-real-activation':
   'held-whole-skill-with-rank-component-only',
   partialRankOpportunity:model};
 }
 return {status:geometricallyMeasured?
  (reasons.length?'held-other-conditions-but-rank-component-measured':
   'rank-window-and-race-gates-modelled'):
  'held-no-matching-rank-window',
  sourceConditions:conditions,phase,bandId:band?.id||null,
  raceGates:conditions.filter(x=>ALLOWED_GATES.has(x.type)),
  matchingCourseIds:gates.courseIds,surfaceAssessment:surface,
  nonModelledReasons:[...new Set(reasons)],
  styles:styleRows};
}
function qnt(sorted,p){
 if(!sorted.length)return null;
 const i=(sorted.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);
 return round(sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo));
}
function distribution(rows){
 const numbers=rows.map(r=>r.opportunityPercent).sort((a,b)=>a-b);
 const n=numbers.length;
 return {count:n,min:n?round(numbers[0]):null,
  p10:qnt(numbers,.1),p25:qnt(numbers,.25),
  median:qnt(numbers,.5),p75:qnt(numbers,.75),p90:qnt(numbers,.9),
  max:n?round(numbers[n-1]):null,
  descriptiveBins:{
   '0-to-under-5':numbers.filter(x=>x<5).length,
   '5-to-under-20':numbers.filter(x=>x>=5&&x<20).length,
   '20-to-under-50':numbers.filter(x=>x>=20&&x<50).length,
   '50-to-under-80':numbers.filter(x=>x>=50&&x<80).length,
   '80-to-100':numbers.filter(x=>x>=80).length
  }};
}
function audit77(sourceAudit,raw,model){
 const items=strictCohorts(sourceAudit,raw),idx=indexModel(model);
 const out=[],knownCaseRows=[],signatureMap=new Map(),tallies={};
 const count=k=>{tallies[k]=(tallies[k]||0)+1};
 for(const skill of items){
  const paths=[];
  for(const [invokeIndex,invoke] of skill.invokes.entries()){
   if(!Array.isArray(invoke.conditions)||!Array.isArray(invoke.preConditions))
    throw Error('Malformed source invoke '+skill.sourceNumericId);
   for(const [orIndex,row] of invoke.conditions.entries()){
    const p=assessPath(row,invoke.preConditions,idx);
    const status=p.status;
    count(skill.cohort+':'+status);
    paths.push({invokeIndex,orIndex,...p});
   }
  }
  if(!paths.length)throw Error('Source skill without condition paths '+skill.sourceNumericId);
  const single=paths.length===1;
  // No multi-branch OR union without joint event probability; each path is
  // measured separately, never summed as if independent or simultaneous.
  const allPathModelled=paths.every(x=>x.status==='rank-window-and-race-gates-modelled');
  const skillStatus=single&&allPathModelled?
   'single-rank-window-path-modelled-not-skill-rate':
   single?'held-source-path-not-modelled':
   'held-multiple-OR-or-invokes-no-joint-event-estimate';
  count(skill.cohort+':skill:'+skillStatus);
  for(const p of paths){
   if(p.status!=='rank-window-and-race-gates-modelled')continue;
   for(const [style,v] of Object.entries(p.styles)){
    if(v.status!=='rank-and-window-modelled-not-real-activation')continue;
    const x=v.partialRankOpportunity;
    const point={cohort:skill.cohort,sourceNumericId:skill.sourceNumericId,
     style,phase:p.phase,bandId:p.bandId,
     opportunityPercent:x.opportunityPercent,pointOccupancyPercent:x.pointOccupancyPercent,
     upliftPoints:x.upliftPoints,courseIds:x.sourceCourseIds,
     signature:[p.phase,p.bandId,p.matchingCourseIds.join(','),p.surfaceAssessment].join('|')};
    knownCaseRows.push(point);
    const key=point.signature+'|'+style;
    if(!signatureMap.has(key))signatureMap.set(key,point);
   }
  }
  out.push({sourceNumericId:skill.sourceNumericId,
   skillName:skill.skillName,cohort:skill.cohort,
   catalogScope:skill.catalogScope,
   historicalDirection:skill.historicalDirection,
   status:skillStatus,
   paths});
 }
 if(out.length!==77||out.filter(x=>x.cohort==='old53').length!==53||
  out.filter(x=>x.cohort==='new24').length!==24)
  throw Error('Cohort audit lost 53 or 24 records');
 const selected=['201052','200702','202311','202312','202671','202001',
  '202101','202271','203352','204511','202951'];
 const byId=new Map(out.map(x=>[x.sourceNumericId,x]));
 const examples=selected.filter(id=>byId.has(id)).map(id=>{
  const skill=byId.get(id);
  return {id,name:skill.skillName,cohort:skill.cohort,status:skill.status,
   paths:skill.paths.map(p=>({status:p.status,phase:p.phase,bandId:p.bandId,
    surfaceAssessment:p.surfaceAssessment,reasons:p.nonModelledReasons,
    byStyle:Object.fromEntries(Object.entries(p.styles).map(([s,v])=>
     [s,v.partialRankOpportunity?.opportunityPercent??null]))}))};
 });
 const summarizeByStyle=(rows)=>Object.fromEntries(Object.keys(STYLE_IDS).map(style=>
  [style,distribution(rows.filter(x=>x.style===style))]));
 const uniqueRows=[...signatureMap.values()];
 return {schemaVersion:1,
  status:'research-only-source-77-ten-metre-rank-condition-opportunity-not-skill-activation',
  source:{revision:REV,sha256:SOURCE_SHA,
   cohort:'original-53-and-added-24-with-fixed-source-id',
   original53:53,new24:24,appMatchedOfNew24:17,appMissingOfNew24:7},
  model:{sourceRevision:MODEL_REV,scenario:'balanced',
   simulatedRaces:720,sourceReportSha256:hash(Buffer.from(JSON.stringify(model))), // audit reference only; byte SHA separately in CLI
   phases:4,bands:11,styles:4,modelWindowMetres:10,
   fullPhaseRandomOnly:true},
  counts:{skills:out.length,
   byCohort:{old53:53,new24:24},byPathAndSkill:tallies,
   modeledFullPhaseSourcePaths:out.flatMap(x=>x.paths).filter(p=>
    p.phase!==null&&p.bandId!==null).length,
   distributionEligiblePaths:out.flatMap(x=>x.paths).filter(p=>
    p.status==='rank-window-and-race-gates-modelled').length,
   distributionStyleCases:knownCaseRows.length,
   distinctConditionsWithinEvidence:signatureMap.size},
  distribution:{
   allEligibleStyleCases:distribution(knownCaseRows),
   byStyle:summarizeByStyle(knownCaseRows),
   uniqueConditionSignatures:distribution(uniqueRows),
   uniqueByStyle:summarizeByStyle(uniqueRows),
   byCohort:Object.fromEntries(['old53','new24'].map(x=>[x,
    summarizeByStyle(knownCaseRows.filter(r=>r.cohort===x))]))},
  examples,items:out,
  boundaries:[
   'Source 53+24 IDs and all AND/OR paths are from fixed UmaSim 2162 skill registry, not from name guessing.',
   'Only exact phase_random 0..3 with one of the 11 exact source rank bands is in the full-phase 10m experiment.',
   'No duration-firsthalf, duration-laterhalf, straight/corner or additional AND condition is silently mapped to a full phase.',
   'Distance_type source gates filter only available 6 GlobalSim model course IDs before averaging.',
   'Dirt/unknown track state can have a rank-only turf-model component but never a confirmed skill opportunity.',
   'When no explicit distance gate exists, 6 course equal weighting is a benchmark, not the game population.',
   'Other skill OR/Invoke paths have no estimated union probability; individual candidate paths stay separate.',
   'Descriptive bins and percentiles summarize these 77 source candidates, not natural skill population prevalence.',
   'Correlated gold/white siblings and repeated conditions are separately deduplicated in uniqueConditionSignatures.',
   'No high/medium/low threshold, actual game trigger probability, effect usefulness, or support-card score is introduced.'
  ]};
}
function main([auditPath,sourcePath,modelPath,outPath]){
 if(!outPath)throw Error('Usage: skill_phase10_cohort_review.cjs inventory_audit.json pinned_skill_data.txt phase10.json output.json');
 const audit=JSON.parse(fs.readFileSync(auditPath));
 const bytes=fs.readFileSync(sourcePath);
 if(hash(bytes)!==SOURCE_SHA)throw Error('Pinned source skill dictionary SHA mismatch');
 const raw=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
 const modelBytes=fs.readFileSync(modelPath);
 const model=JSON.parse(modelBytes.toString('utf8'));
 const result=audit77(audit,raw,model);
 result.model.sourceReportSha256=hash(modelBytes);
 fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({source:result.source,counts:result.counts,
  distribution:result.distribution.uniqueByStyle,examples:result.examples},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={REV,SOURCE_SHA,MODEL_REV,STYLE_IDS,strictCohorts,indexModel,
 gateCourses,sourceSurface,perStyleSourceEligibility,measure,assessPath,
 distribution,audit77,main};
