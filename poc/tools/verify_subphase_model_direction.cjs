#!/usr/bin/env node
'use strict';
/* A compact, source-matched evidence gate for three *precise* rank windows.
 * This is not an independent game validation. It prevents promotion from a
 * source definition or aggregate summary that has drifted. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const source=require('../src/skill_rank_timing.js');
const EVIDENCE=require('../data/p2_subphase_model_direction.v1.json');
const ENGINE='80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1';
const SOURCE_WINDOWS=Object.freeze([
 ['early-latter','phase_laterhalf_random',0],
 ['middle-first','phase_firsthalf_random',1],
 ['middle-latter','phase_laterhalf_random',1]
]);
const exact=(v,expected)=>typeof v==='number'&&Math.abs(v-expected)<1e-8;
function validate(snapshot){
 if(!snapshot||snapshot.schemaVersion!==1||
  snapshot.status!=='pinned-GlobalSim-model-relative-rank-direction-research-only'||
  snapshot.sourceRevision!==ENGINE||
  !/^[0-9a-f]{64}$/.test(snapshot.reportSha256||'')||
  snapshot.races!==2160||snapshot.runnerWindowObservations!==68040||
  snapshot.seedsPerCell!==30||
  snapshot.courses!==6||
  JSON.stringify(snapshot.fieldSizes)!=='[9,12]'||
  JSON.stringify(snapshot.scenarios)!=='["balanced","jan2026","noFront"]'||
  JSON.stringify(snapshot.statModes)!=='["equal","jitter10"]'||
  !Array.isArray(snapshot.windows)||snapshot.windows.length!==3)
  return false;
 const seen=new Set();
 for(const [id,type,value] of SOURCE_WINDOWS){
  const w=snapshot.windows.find(x=>x.windowId===id);
  if(!w||seen.has(w.windowId)||w.type!==type||
   w.operator!=='=='||w.value!==value)return false;
  seen.add(w.windowId);
  const t=source.timing({type,operator:'==',value});
  if(t?.status!=='source-defined'||t.windows.length!==1||
   t.courseDependent||!t.randomWindow||
   !exact(w.startRate,t.windows[0].startRate)||
   !exact(w.endRate,t.windows[0].endRate)||
   w.contexts!==72||w.comparable!==72||w.frontAhead!==72||
   w.rearCounterexamples!==0||w.ties!==0||w.unresolved!==0||
   w.splitBothFrontAhead!==72||w.anySplitReversal!==0||
   !Number.isFinite(w.minGapPoints)||w.minGapPoints<=0||
   w.directionGate!=='all-contexts-and-splits-directionally-consistent')
   return false;
 }
 return seen.size===3;
}
function verifiedWindow(condition,snapshot=EVIDENCE){
 if(!condition||condition.operator!=='=='||
  !Number.isSafeInteger(condition.value)||!validate(snapshot))return null;
 const w=snapshot.windows.find(w=>w.type===condition.type&&
  w.value===condition.value);
 return w?{windowId:w.windowId,
  sourceWindow:{type:w.type,operator:w.operator,value:w.value,
   startRate:w.startRate,endRate:w.endRate},
  study:'fixed-GlobalSim-2160-races-all-recorded-position-model-only',
  reportSha256:snapshot.reportSha256,
  experimentAction:snapshot.experimentAction,
  modelContexts:w.contexts,
  bothSeedHalvesFrontAhead:w.splitBothFrontAhead,
  modelMinFrontMinusRearPoints:w.minGapPoints}:null;
}
function verifyReproduction(snapshot,raw){
 if(!validate(snapshot)||!Buffer.isBuffer(raw))
  throw Error('Invalid pinned source-window evidence');
 const digest=crypto.createHash('sha256').update(raw).digest('hex');
 if(digest!==snapshot.reportSha256)
  throw Error('Full simulator model report digest changed');
 const report=JSON.parse(raw.toString('utf8'));
 if(report.schemaVersion!==1||report.sourceRevision!==ENGINE||
  report.races!==snapshot.races||
  report.observations!==snapshot.runnerWindowObservations||
  report.seedsPerCell!==snapshot.seedsPerCell||
  report.contextCount!==216||
  !Array.isArray(report.byWindow)||report.byWindow.length!==3||
  !Array.isArray(report.comparisons)||report.comparisons.length!==216)
  throw Error('Incorrect model report population');
 for(const w of snapshot.windows){
  const x=report.byWindow.find(y=>y.windowId===w.windowId);
  if(!x||x.sourceCondition.type!==w.type||
   x.sourceCondition.operator!==w.operator||
   x.sourceCondition.value!==w.value||
   !exact(x.range[0],w.startRate)||!exact(x.range[1],w.endRate))
   throw Error('Wrong model source interval');
  for(const k of ['contexts','comparable','frontAhead',
   'rearCounterexamples','ties','unresolved','splitBothFrontAhead',
   'anySplitReversal','minGapPoints','directionGate'])
   if(x[k]!==w[k])throw Error('Reported model statistics drifted: '+k);
 }
 for(const c of report.comparisons){
  if(c.status!=='comparable'||c.direction!=='front-ahead'||
   c.splitFirstDirection!=='front-ahead'||
   c.splitLastDirection!=='front-ahead'||
   !Number.isFinite(c.frontMinusRearPoints)||
   c.frontMinusRearPoints<=0)
   throw Error('Raw model context cannot certify a universal tested direction');
 }
 return true;
}
function main(args){
 const [reportPath]=args;
 if(!reportPath)throw Error('Usage: verify_subphase_model_direction.cjs model_report.json');
 verifyReproduction(EVIDENCE,fs.readFileSync(reportPath));
 console.log(JSON.stringify({verified:true,revision:EVIDENCE.sourceRevision,
  races:EVIDENCE.races,contexts:EVIDENCE.windows.map(w=>w.contexts),
  modelReportSha256:EVIDENCE.reportSha256},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={ENGINE,SOURCE_WINDOWS,EVIDENCE,validate,verifiedWindow,
 verifyReproduction,main};
