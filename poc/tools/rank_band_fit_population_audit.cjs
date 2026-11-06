#!/usr/bin/env node
'use strict';
/* Aggregate source-only 2162-skill review: which original AND/OR paths are
 * newly supported by exact model rank-band windows? NEVER publish source
 * skill records or infer a real trigger probability. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const fit=require('../src/skill_activation_fit_v1.cjs');
const rankInventory=require('./order_rate_integer_audit.cjs');
const REV='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const PINNED='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const STYLES=['逃げ','先行','差し','追込'];
function audit(records){
 if(!Array.isArray(records)||!records.length)
  throw Error('Invalid original skill source');
 const seen=new Set(),proofByWindow=new Map();
 const stats={sourceSkills:0,withOrderRate:0,
  withVerifiedRankBandPath:0,sourceRankBandStyleCases:0,
  fullyResolvedNewRankBandSkills:0,heldWithVerifiedRankBandPath:0,
  withStudiedButNotUniformBand:0,
  onlyOldHalfBandProof:0};
 const exampleIds={fullyResolved:[],partialOrHeld:[],mixedOrUnconfirmed:[]};
 for(const record of records){
  if(!record||typeof record.id!=='string'||
   seen.has(record.id)||!Array.isArray(record.invokes))
   throw Error('Duplicate or malformed source skill');
  seen.add(record.id);stats.sourceSkills++;
  const profile={status:'source-structure',sourceNumericId:record.id,
   invokes:record.invokes.map((x,i)=>({
    index:x.index??i,
    conditions:x.conditions===undefined?[]:x.conditions,
    preConditions:x.preConditions===undefined?[]:x.preConditions
   }))};
  let hasRank=false;
  for(const invoke of profile.invokes)
   for(const side of ['conditions','preConditions']){
    if(!Array.isArray(invoke[side]))throw Error('Malformed source AND/OR');
    for(const row of invoke[side]){
     if(!Array.isArray(row))throw Error('Malformed source AND row');
     if(row.some(c=>c?.type==='order_rate'))hasRank=true;
    }
   }
  if(!hasRank)continue;
  stats.withOrderRate++;
  const result=fit.evaluate(profile);
  const styles=STYLES.map(s=>result.styles[s]);
  const proof=styles.flatMap(s=>s.paths.filter(p=>p.modelBandEvidence));
  const studied=styles.flatMap(s=>s.paths.filter(p=>
   p.rankOnly?.modelBandReview||p.modelBandReview));
  if(studied.length)stats.withStudiedButNotUniformBand++;
  if(studied.length&&exampleIds.mixedOrUnconfirmed.length<10)
   exampleIds.mixedOrUnconfirmed.push(record.id);
  if(!proof.length){
   if(styles.every(s=>['high','low'].includes(s.status)))
    stats.onlyOldHalfBandProof++;
   continue;
  }
  stats.withVerifiedRankBandPath++;
  stats.sourceRankBandStyleCases+=styles.filter(s=>
   s.paths.some(p=>p.modelBandEvidence)).length;
  for(const p of proof){
   const k=p.modelBandEvidence.phase+'|'+p.modelBandEvidence.bandId;
   if(!proofByWindow.has(k))proofByWindow.set(k,new Set());
   proofByWindow.get(k).add(record.id);
  }
  if(styles.every(s=>['high','low'].includes(s.status))&&
    styles.every(s=>s.paths.some(p=>p.modelBandEvidence))){
   stats.fullyResolvedNewRankBandSkills++;
   if(exampleIds.fullyResolved.length<14)
    exampleIds.fullyResolved.push(record.id);
  }else{
   stats.heldWithVerifiedRankBandPath++;
   if(exampleIds.partialOrHeld.length<14)
    exampleIds.partialOrHeld.push(record.id);
  }
 }
 if(stats.sourceSkills!==records.length)throw Error('Population drift');
 return {schemaVersion:1,
  status:'fixed-UmaSim-research-only-new-rank-band-fit-source-coverage',
  sourceRevision:REV,sourceSha256:PINNED,
  sourceModel:'GlobalSim rank band 2160 races / 20 exact phase-band gates',
  rankFitVersion:fit.VERSION,
  allFourStylesStudied:STYLES,
  stats,proofByWindow:[...proofByWindow].map(([k,v])=>{
   const [phase,bandId]=k.split('|');
   return {phase:Number(phase),bandId,uniqueSourceSkills:v.size};
  }).sort((a,b)=>a.phase-b.phase||a.bandId.localeCompare(b.bandId)),
  exampleSourceIds:exampleIds,
  warnings:[
   'Entire fixed UmaSim registry is not the current published app skill catalog.',
   'Band proof uses model position occupancy, not Japan game trigger probabilities.',
   'A full source skill counts as resolved only if ALL four style results agree and have verified band paths.',
   'Held/unmodeled source alternatives are not silently removed. Explicit running-style restrictions are honored.',
   'Absolute distance/turf/dirt gates remain separate from relative style direction.',
   'Source IDs are given only as small debugging samples, not copied source conditions or skill dictionaries.'
  ]};
}
function main(args){
 const [input,output]=args;
 if(!input||!output)throw Error('Usage: rank_band_fit_population_audit.cjs source_skill_data.txt summary.json');
 const bytes=fs.readFileSync(input);
 const hash=crypto.createHash('sha256').update(bytes).digest('hex');
 if(hash!==PINNED)throw Error('Pinned source skill dictionary SHA drift');
 const records=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
 const inventory=rankInventory.audit(records);
 if(inventory.totals.sourceSkills!==2162||
  inventory.totals.skillsWithOrderRate!==858||
  inventory.totals.rankTerms!==1465)
  throw Error('Source denominator changed');
 const result=audit(records);
 if(result.stats.sourceSkills!==2162||
  result.stats.withOrderRate!==858||
  result.stats.fullyResolvedNewRankBandSkills>
   result.stats.withVerifiedRankBandPath)
  throw Error('Unverified new skill cohort count');
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({stats:result.stats,
  proofByWindow:result.proofByWindow,
  exampleSourceIds:result.exampleSourceIds},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={REV,PINNED,STYLES,audit,main};
