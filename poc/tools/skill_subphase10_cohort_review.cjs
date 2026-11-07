#!/usr/bin/env node
'use strict';
/* P2: overlay exact original-source phase-half random windows onto the
 * fixed 77-item source-verified 10m full-phase audit. Preserve status, AND/OR,
 * surface gates and all unmeasured conditions. Never claim skill activation. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const old=require('./skill_phase10_cohort_review.cjs');
const engine=require('./globalsim_subphase_random_10m.cjs');
const source=require('../src/skill_rank_timing.js');
const bands=require('./globalsim_rank_band_dominance.cjs').BANDS;
const STYLES=Object.keys(old.STYLE_IDS);
const FULL_SHA='f512e24b2987ccd642f17f21f92865e965a43b90985ef37d622f1ae2f2ec9e58';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const round=x=>Number(x.toFixed(6));
const kcond=c=>[c.type,c.operator,c.value].join(':');
const signature=conditions=>conditions.map(kcond).sort().join('&');
const bandsBySig=new Map(bands.map(b=>[signature(b.predicates),b.id]));
const ALLOWED=new Set(['distance_type','ground_type',
 'ground_condition','running_style','order_rate']);
const windowsByKey=new Map(engine.WINDOWS.map(w=>[w.key,w]));
function checkSource(baseline){
 if(!baseline||baseline.schemaVersion!==1||
  baseline.status!=='research-only-source-77-ten-metre-rank-condition-opportunity-not-skill-activation'||
  baseline.source?.revision!==old.REV||
  baseline.source?.sha256!==old.SOURCE_SHA||
  baseline.source.original53!==53||baseline.source.new24!==24||
  baseline.counts?.skills!==77||
  baseline.counts?.distributionEligiblePaths!==34||
  baseline.model?.sourceRevision!==old.MODEL_REV||
  baseline.model.sourceReportSha256!==FULL_SHA||
  !Array.isArray(baseline.items)||baseline.items.length!==77)
  throw Error('Fixed full-phase source cohort was not verified');
 return baseline;
}
function indexSubphase(model){
 if(!model||model.schemaVersion!==1||
  model.status!=='research-GlobalSim-subphase-random-10m-rank-opportunity-not-game-skill-rate'||
  model.scenario!=='balanced'||model.sourceRevision!==old.MODEL_REV||
  model.simulations!==720||model.seedsPerCell!==30||
  model.contextsPerWindow!==24||model.windowBands!==44||
  model.perContextRows!==4224||
  model.modelWindowMetres!==10||model.modelEndClampMetres!==2||
  !Array.isArray(model.windows)||model.windows.length!==4||
  !Array.isArray(model.contextRows)||model.contextRows.length!==4224)
  throw Error('Incomplete or unverifiable short-window model report');
 const windows=new Map(model.windows.map(w=>[w.key,w]));
 if(windows.size!==4)throw Error('Repeated source random window');
 for(const [k,orig] of windowsByKey){
  const w=windows.get(k);
  if(!w||signature([w.sourceCondition])!==signature([orig.sourceCondition])||
   Math.abs(w.startRate-orig.startRate)>1e-6||
   Math.abs(w.endRate-orig.endRate)>1e-6)
   throw Error('Source random window definition drift '+k);
 }
 const seen=new Set(),map=new Map();
 for(const r of model.contextRows){
  const unique=[r.courseId,r.fieldSize,r.mode,r.windowKey,
   r.bandId,r.style].join('|');
  if(seen.has(unique))throw Error('Duplicate model context '+unique);
  seen.add(unique);
  if(!windowsByKey.has(r.windowKey)||
   !bands.some(b=>b.id===r.bandId)||
   !STYLES.includes(r.style)||![9,12].includes(r.fieldSize)||
   !['equal','jitter10'].includes(r.mode)||
   ![10501,10502,10304,10504,10604,10506].includes(r.courseId)||
   !Number.isSafeInteger(r.runners)||r.runners<30||
   !Number.isFinite(r.pointPercent)||r.pointPercent<0||r.pointPercent>100||
   !Number.isFinite(r.random10mOpportunityPercent)||
   r.random10mOpportunityPercent<0||r.random10mOpportunityPercent>100||
   r.random10mOpportunityPercent+1e-5<r.pointPercent)
   throw Error('Invalid model short-window observation');
  const key=[r.windowKey,r.bandId,r.style].join('|');
  if(!map.has(key))map.set(key,[]);
  map.get(key).push(r);
 }
 if(map.size!==4*11*4||[...map.values()].some(v=>v.length!==24))
  throw Error('Short-window source model has incomplete balanced contexts');
 return map;
}
function subwindowPath(oldPath,subIndex,fullIndex){
 const conditions=oldPath.sourceConditions;
 if(!Array.isArray(conditions)||!conditions.length)
  return {status:'held-unknown-original-conditions',styles:{}};
 const times=conditions.filter(c=>source.TIME_SPECS[c.type]);
 const time=times.length===1?times[0]:null;
 const key=time?.type+':'+time?.value;
 const window=windowsByKey.get(key);
 if(oldPath.status!=='held-no-matching-rank-window'||!time||
  !window||time.operator!=='=='||
  signature(conditions.filter(c=>c.type==='order_rate'))!==
   signature(bands.find(b=>b.id===oldPath.bandId)?.predicates||[])||
  times.length!==1||conditions.some(c=>
   c.type!==time.type&&!ALLOWED.has(c.type))||
  oldPath.nonModelledReasons?.some(s=>s!=='phase-random-full-window-not-matched'&&
   s!=='additional-AND-or-other-timing-unmodelled'&&
   s!=='held-unverified-surface-requirement'&&
   s!=='held-unverified-track-condition'))
  return {status:'held-original-condition-not-modelled',
   sourceWindowKey:window?.key??null,styles:{}};
 const sourceTiming=source.timing(time);
 if(sourceTiming?.status!=='source-defined'||sourceTiming.windows.length!==1||
  sourceTiming.courseDependent||
  Math.abs(sourceTiming.windows[0].startRate-window.startRate)>1e-6||
  Math.abs(sourceTiming.windows[0].endRate-window.endRate)>1e-6)
  throw Error('Source timing differs from pinned short window');
 const courses=old.gateCourses(conditions);
 if(!courses.courseIds.length||
  JSON.stringify(courses.courseIds)!==JSON.stringify(oldPath.matchingCourseIds))
  return {status:'held-original-course-outside-model',
   sourceWindowKey:key,styles:{}};
 const surface=old.sourceSurface(conditions);
 if(surface!==oldPath.surfaceAssessment)
  throw Error('Source surface assessment changed for '+key);
 const styles={};
 for(const style of STYLES){
  if(oldPath.styles?.[style]?.status==='source-style-ineligible'){
   styles[style]={status:'source-style-ineligible',
    opportunity:null,fullPhaseReference:null};continue;
  }
  if(!oldPath.styles?.[style])
   throw Error('Source has no explicit four-style record '+style);
  const rows=subIndex.get([key,oldPath.bandId,style].join('|'));
  const full=fullIndex.get([time.value,oldPath.bandId,style].join('|'));
  if(!rows||!full||rows.length!==24||full.length!==24)
   throw Error('Missing matched model window or full-phase baseline');
  const value=old.measure(rows,courses.courseIds);
  const reference=old.measure(full,courses.courseIds);
  if(!value||!reference)throw Error('Missing filtered model observations');
  styles[style]={status:surface.startsWith('held-')?
   'held-unverified-surface-rank-component-only':
   'modeled-subphase-rank-component-not-real-activation',
   opportunity:value,
   fullPhaseReferencePercent:reference.opportunityPercent,
   differenceFromFullPhasePoints:round(
    value.opportunityPercent-reference.opportunityPercent)};
 }
 return {status:surface.startsWith('held-')?
  'held-unverified-surface-rank-component-available':
  'rank-and-short-random-window-component-modelled',
  sourceWindowKey:key,windowStartRate:round(window.startRate),
  windowEndRate:round(window.endRate),
  modelCourseIds:courses.courseIds,
  surfaceAssessment:surface,styles};
}
function summarize(oldAudit,shortModel,fullModel){
 const baseline=checkSource(oldAudit);
 const subIndex=indexSubphase(shortModel),fullIndex=old.indexModel(fullModel);
 const skillRows=[],measured=[],signatures=new Map();
 let newlyModeledPaths=0,newlyHeldSurfacePaths=0,shortUnsupported=0;
 for(const item of baseline.items){
  const paths=item.paths.map(p=>{
   const isBaselineMeasured=p.status==='rank-window-and-race-gates-modelled';
   const sub=subwindowPath(p,subIndex,fullIndex);
   const full=isBaselineMeasured||p.status===
    'held-other-conditions-but-rank-component-measured';
   const measuredStatus=isBaselineMeasured?
    'modeled-full-phase-rank-component-not-real-activation':
    sub.status==='rank-and-short-random-window-component-modelled'?
    'modeled-short-window-rank-component-not-real-activation':
    sub.status==='held-unverified-surface-rank-component-available'||
    full&&p.surfaceAssessment?.startsWith('held-')?
    'held-unverified-surface':'held-other-source-conditions';
   if(sub.status==='rank-and-short-random-window-component-modelled')
    newlyModeledPaths++;
   if(sub.status==='held-unverified-surface-rank-component-available')
    newlyHeldSurfacePaths++;
   if(p.status==='held-no-matching-rank-window'&&
    sub.status==='held-original-condition-not-modelled')
    shortUnsupported++;
   const summary={status:measuredStatus,
    priorStatus:p.status,
    sourceConditions:p.sourceConditions,sourceTiming:
     sub.sourceWindowKey??(p.phase===null?null:'phase_random:'+p.phase),
    bandId:p.bandId,phase:p.phase,modelCourseIds:
     sub.modelCourseIds??p.matchingCourseIds,
    surfaceAssessment:p.surfaceAssessment,
    originalReasons:p.nonModelledReasons,
    subphaseWindow:sub.sourceWindowKey??null,
    byStyle:{}};
   for(const style of STYLES){
    const existing=p.styles?.[style];
    const v=isBaselineMeasured?existing?.partialRankOpportunity:
     sub.styles?.[style]?.opportunity;
    const ref=isBaselineMeasured?v?.opportunityPercent??
     null:sub.styles?.[style]?.fullPhaseReferencePercent??null;
    summary.byStyle[style]={status:measuredStatus.startsWith('modeled-')?
     (v?'rank-window-modelled':'source-style-ineligible'):
     v?'rank-component-only-not-whole-skill':
      'held-unmeasured',
     opportunityPercent:v?.opportunityPercent??null,
     pointOccupancyPercent:v?.pointOccupancyPercent??null,
     contextCount:v?.contexts??null,
     minContextPercent:v?.minContextPercent??null,
     maxContextPercent:v?.maxContextPercent??null,
     byHeadcount:v?.byHeadcount??null,
     fullPhaseReferencePercent:ref,
     differenceFromFullPhasePoints:isBaselineMeasured?0:
      sub.styles?.[style]?.differenceFromFullPhasePoints??null};
    if(measuredStatus.startsWith('modeled-')&&v){
     const k=summary.sourceTiming+'|'+summary.bandId+'|'+
      summary.modelCourseIds.join(',')+'|'+summary.surfaceAssessment;
     const data={sourceNumericId:item.sourceNumericId,cohort:item.cohort,
      style,opportunityPercent:v.opportunityPercent,
      modelWindow:summary.sourceTiming,
      bandId:summary.bandId,
      minContextPercent:v.minContextPercent,
      maxContextPercent:v.maxContextPercent};
     measured.push(data);
     if(!signatures.has(k+'|'+style))signatures.set(k+'|'+style,data);
    }
   }
   return summary;
  });
  const fullyCovered=paths.every(p=>
   p.status.startsWith('modeled-'));
  const caseStatus=paths.length===1&&fullyCovered?
   'one-source-path-rank-window-modelled-not-skill-rate':
   fullyCovered?'all-source-paths-separately-modeled-OR-union-held':
   'held-at-least-one-unverified-source-path';
  skillRows.push({sourceNumericId:item.sourceNumericId,
   skillName:item.skillName,cohort:item.cohort,
   catalogScope:item.catalogScope,
   status:caseStatus,paths});
 }
 if(skillRows.length!==77||measured.length!==
  measured.filter(x=>x.style==='Nige').length*4)
  throw Error('Incomplete four-style source audit');
 const counts=Object.fromEntries([
  'one-source-path-rank-window-modelled-not-skill-rate',
  'all-source-paths-separately-modeled-OR-union-held',
  'held-at-least-one-unverified-source-path'
 ].map(k=>[k,skillRows.filter(s=>s.status===k).length]));
 const sourcePathCount=skillRows.reduce((s,x)=>s+x.paths.length,0);
 const individual=STYLES.reduce((o,style)=>
  (o[style]=old.distribution(measured.filter(x=>x.style===style)),o),{});
 const unique=[...signatures.values()];
 const uniqueStyle=STYLES.reduce((o,style)=>
  (o[style]=old.distribution(unique.filter(x=>x.style===style)),o),{});
 const ids=['200681','200691','202011','202671','203641',
  '203642','204511','202261','202951'];
 const sample=ids.map(id=>skillRows.find(x=>x.sourceNumericId===id))
  .filter(Boolean).map(x=>({sourceNumericId:x.sourceNumericId,
   skillName:x.skillName,status:x.status,
   paths:x.paths.map(p=>({status:p.status,window:p.sourceTiming,
    bandId:p.bandId,surfaceAssessment:p.surfaceAssessment,
    byStyle:Object.fromEntries(STYLES.map(s=>[s,
     {opportunityPercent:p.byStyle[s].opportunityPercent,
      fullPhaseReferencePercent:p.byStyle[s].fullPhaseReferencePercent,
      differenceFromFullPhasePoints:p.byStyle[s].differenceFromFullPhasePoints}]))}))}));
 return {schemaVersion:1,
  status:'research-77-skills-full-plus-short-10m-rank-condition-only',
  source:{...baseline.source},model:{
   sourceRevision:old.MODEL_REV,
   fullPhaseReportSha256:FULL_SHA,
   shortWindowReportSha256:null,
   scenario:'balanced',races:720,
   subphaseWindows:engine.WINDOWS.map(w=>w.key),
   opportunityNotActivationProbability:true},
  counts:{skills:77,original53:53,added24:24,
   bySkillStatus:counts,
   sourcePaths:sourcePathCount,
   newlyModeledSubphasePaths:newlyModeledPaths,
   newSubphasePathsWithSurfaceHeld:newlyHeldSurfacePaths,
   missingSubphaseSourcePaths:shortUnsupported,
   eligibleModelledPaths:measured.length/4,
   eligibleStyleCases:measured.length,
   distinctConditionSignatures:signatures.size/4,
   historicalFullPhaseEligiblePaths:baseline.counts.distributionEligiblePaths},
  distribution:{allEligibleStylePaths:old.distribution(measured),
   byStyle:individual,uniqueConditionCases:old.distribution(unique),
   uniqueByStyle:uniqueStyle},
  examples:sample,items:skillRows,
  boundaries:[
   'All 77 original source-ID conditions are retained in the original pinned audit; no game skill activation rate is estimated.',
   'The four short windows are the exact original-source phase first/latter halves; full-phase values are only comparison baselines, never substituted.',
   'Distance requirements filter original six course contexts; surface requirements unsupported by the turf-only model are held.',
   'Short window values are exact geometry on piecewise-linear no-skill GlobalSim traces, not actual skill activation rolls.',
   'All source OR/Invoke paths are separately modeled and no probability union or simple mean is invented.',
   'High/medium/low thresholds and skill effect usefulness remain unsettled and are not inferred from descriptive bins.',
   'Same-conditions gold/white skill duplicates are counted separately from distinct source condition signatures.',
   'No public app model, support-card rating, saved data or display is changed.'
  ]};
}
function main([baselinePath,shortPath,fullPath,outputPath]){
 if(!outputPath)throw Error('Usage: skill_subphase10_cohort_review.cjs old77.json short-model.json full-model.json output.json');
 const oldAudit=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
 const shortBytes=fs.readFileSync(shortPath);
 const shortModel=JSON.parse(shortBytes.toString('utf8'));
 const fullBytes=fs.readFileSync(fullPath);
 if(hash(fullBytes)!==FULL_SHA)
  throw Error('Complete full-phase 720 race model JSON SHA drift');
 const fullModel=JSON.parse(fullBytes.toString('utf8'));
 const result=summarize(oldAudit,shortModel,fullModel);
 result.model.shortWindowReportSha256=hash(shortBytes);
 fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({counts:result.counts,
  distribution:result.distribution.uniqueByStyle,examples:result.examples},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={FULL_SHA,checkSource,indexSubphase,subwindowPath,
 summarize,main};
