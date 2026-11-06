#!/usr/bin/env node
'use strict';
/* Strict, bounded proof: the source rank band, exact phase and fixed 30-seed
 * model must ALL agree before any qualitative style fit may be promoted.
 * Model occupancy is never a game skill activation probability. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const b=require('./globalsim_rank_band_dominance.cjs');
const bounds=require('../src/skill_order_rate_bounds.cjs');
const EVIDENCE=require('../data/p2_rank_band_model_direction.v1.json');
const ENGINE='80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1';
const DIGEST='7bd254e3b10d58119caeab7eadee27d96b0a9946856b2812ffc40bc697df0eca';
const key=(phase,id)=>phase+'|'+id;
const sig=terms=>terms.map(c=>c.type+'|'+c.operator+'|'+c.value)
 .sort().join('&&');
const supported=row=>row.unresolved===0&&row.mixed===0&&
 row.splitSameDirection===72&&
 ((row.front===72&&row.rear===0)||(row.rear===72&&row.front===0));
function validate(e){
 if(!e||e.schemaVersion!==1||
  e.modelStatus!=='pinned-GlobalSim-model-rank-band-direction-not-game-activation'||
  e.engineRevision!==ENGINE||e.reportSha256!==DIGEST||
  e.rankMappingVersion!==bounds.VERSION||
  e.races!==2160||e.seedsPerCell!==30||
  JSON.stringify(e.seedHalfCounts)!=='[15,15]'||
  e.contextsPerPhase!==72||e.totalBands!==b.BANDS.length||
  JSON.stringify(e.fullPhaseWindows)!=='[0,1,2,3]'||
  !Array.isArray(e.rows)||e.rows.length!==b.BANDS.length*4||
  !Array.isArray(e.warnings)||e.warnings.length<3)
  return false;
 const seen=new Set(),ids=new Set(b.BANDS.map(x=>x.id));
 let passing=0;
 for(const row of e.rows){
  const k=key(row.phase,row.bandId);
  if(!Number.isInteger(row.phase)||row.phase<0||row.phase>3||
   !ids.has(row.bandId)||seen.has(k))return false;
  seen.add(k);
  const cells=['front','rear','mixed','unresolved','splitSameDirection'];
  if(cells.some(p=>!Number.isInteger(row[p])||row[p]<0||
   row[p]>72)||row.front+row.rear+row.mixed+
   row.unresolved!==72||
   !Number.isFinite(row.minStrictMarginPoints)||
   row.minStrictMarginPoints<=0)return false;
  if(supported(row)){
   if(row.phase===3)return false; // source contains late counterexamples
   passing++;
  }
 }
 return passing===20;
}
function studyBand(terms,phaseCondition,e=EVIDENCE){
 if(!validate(e)||!Array.isArray(terms)||!phaseCondition||
  phaseCondition.type!=='phase_random'||
  phaseCondition.operator!=='=='||
  !Number.isSafeInteger(phaseCondition.value)||
  phaseCondition.value<0||phaseCondition.value>3)
  return null;
 const band=b.BANDS.find(x=>sig(x.predicates)===sig(terms));
 if(!band)return null;
 const row=e.rows.find(x=>x.phase===phaseCondition.value&&
  x.bandId===band.id);
 if(!row)return null;
 return {...row,sourceConditions:band.predicates,
  supported:supported(row),
  sourceAction:e.sourceAction,reportSha256:e.reportSha256};
}
function verifiedBand(terms,phaseCondition,e=EVIDENCE){
 const study=studyBand(terms,phaseCondition,e);
 if(!study?.supported)return null;
 const projection=Object.fromEntries([9,12].map(n=>[n,
  bounds.andProjection(study.sourceConditions,n).positions]));
 return {bandId:study.bandId,phase:study.phase,
  status:study.front===72?'front':'rear',
  modelContexts:72,splitSeedHalvesConfirmed:study.splitSameDirection,
  minGroupMarginPoints:study.minStrictMarginPoints,
  positionsByField:projection,
  modelOnly:true,studyAction:study.sourceAction,
  sourceReportSha256:study.reportSha256};
}
function verifyReproduction(e,buffer){
 if(!validate(e)||!Buffer.isBuffer(buffer))
  throw Error('Invalid model evidence input');
 const digest=crypto.createHash('sha256').update(buffer).digest('hex');
 if(digest!==DIGEST)throw Error('GlobalSim full model report SHA changed');
 const report=JSON.parse(buffer.toString('utf8'));
 if(report.sourceRevision!==ENGINE||
  report.status!=='pinned-GlobalSim-model-rank-band-direction-not-game-activation'||
  report.raceCount!==e.races||
  report.seedCount!==e.seedsPerCell||
  JSON.stringify(report.splitSeedCounts)!=='[15,15]'||
  report.contextCount!==288||
  report.comparisonCount!==3168||
  !Array.isArray(report.byPhaseBand)||report.byPhaseBand.length!==44||
  !Array.isArray(report.comparisons)||report.comparisons.length!==3168)
  throw Error('Full model context population changed');
 const map=new Map(report.byPhaseBand.map(row=>[key(row.phase,row.bandId),row]));
 if(map.size!==44)throw Error('Duplicate model phase band');
 for(const expected of e.rows){
  const x=map.get(key(expected.phase,expected.bandId));
  if(!x||x.contexts!==72)throw Error('Missing model phase band');
  for(const p of ['front','rear','mixed','unresolved',
   'splitSameDirection','minStrictMarginPoints'])
   if(x[p]!==expected[p])throw Error('Model evidence drift '+p);
  if((x.gate!=='held-ambiguous-or-unconfirmed')!==supported(expected))
   throw Error('Model acceptance gate inconsistent');
 }
 return true;
}
function main(args){
 const [path]=args;
 if(!path)throw Error('Usage: verify_rank_band_model_evidence.cjs rank-band-direction.json');
 verifyReproduction(EVIDENCE,fs.readFileSync(path));
 console.log(JSON.stringify({verified:true,model:EVIDENCE.engineRevision,
  races:EVIDENCE.races,studiedRows:EVIDENCE.rows.length,
  acceptedRows:EVIDENCE.rows.filter(supported).length,
  completeReportSha256:EVIDENCE.reportSha256},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={ENGINE,DIGEST,EVIDENCE,key,sig,supported,validate,
 studyBand,verifiedBand,verifyReproduction,main};
