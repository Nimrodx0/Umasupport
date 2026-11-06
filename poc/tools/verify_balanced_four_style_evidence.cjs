#!/usr/bin/env node
'use strict';
/* Verify that the checked-in balanced 4-style direction table exactly matches
 * the 2160-race GlobalSim v77 output, not just a plausible hand-written row. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const fit=require('../src/skill_balanced_four_style_fit.cjs');
function verify(buffer,e=fit.EVIDENCE){
 if(!fit.validEvidence(e)||!Buffer.isBuffer(buffer))
  throw Error('Malformed pinned balanced model evidence');
 const sha=crypto.createHash('sha256').update(buffer).digest('hex');
 if(sha!==e.fullReportSha256)
  throw Error('Four-style source model SHA changed');
 const report=JSON.parse(buffer.toString('utf8'));
 if(report.schemaVersion!==1||
  report.status!=='research-four-style-pairwise-model-occupancy-not-game-activation'||
  report.sourceRevision!==e.sourceRevision||
  report.raceCount!==e.races||
  report.seedCount!==e.seedsPerCell||
  JSON.stringify(report.splitSeedCounts)!==JSON.stringify(e.splitSeeds)||
  report.contextCount!==288||
  report.comparisons?.length!==3168||
  report.byPairScenarioBand?.length!==4*11*3*6||
  report.byPairPhaseBand?.length!==4*11*6)
  throw Error('Four-style source study dimensions changed');
 const index=new Map();
 for(const row of report.byPairScenarioBand){
  if(row.scenario!=='balanced')continue;
  const key=[row.phase,row.bandId,row.first,row.second].join('|');
  if(index.has(key))throw Error('Duplicate balanced evidence row '+key);
  index.set(key,row);
 }
 if(index.size!==4*11*6)throw Error('Incomplete balanced evidence map');
 const toCode={'first-consistently-higher':'F',
  'second-consistently-higher':'S',held:'?'};
 let accepted=0,held=0;
 for(let phase=0;phase<4;phase++){
  for(const [b,bandId] of e.bands.entries()){
   const word=e.directionByPhase[phase][b];
   for(const [i,[first,second]] of e.pairs.entries()){
    const k=[phase,bandId,first,second].join('|');
    const row=index.get(k);
    if(!row||row.contexts!==24||
     row.comparable!==24||row.absent!==0||
     row.unresolved!==0||row.splitTested!==true||
     row.firstHigher+row.secondHigher+row.tie!==24||
     !Number.isInteger(row.unstable)||row.unstable<0||
     row.unstable>24||!Object.hasOwn(toCode,row.gate))
     throw Error('Invalid balanced context '+k);
    const actual=toCode[row.gate];
    if(actual!==word[i])
     throw Error('Balanced 4-style direction mismatch '+k);
    if(actual==='?')held++;else accepted++;
   }
  }
 }
 return {verified:true,sourceRevision:e.sourceRevision,
  reportSha256:sha,scenario:'balanced',
  phaseBandRows:4*11,pairRows:index.size,acceptedPairs:accepted,
  heldPairs:held,contextsPerPair:24};
}
function main(args){
 const [file]=args;
 if(!file)throw Error('Usage: verify_balanced_four_style_evidence.cjs four-style-pairwise.json');
 console.log(JSON.stringify(verify(fs.readFileSync(file)),null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(err){console.error(err.stack||err);process.exitCode=1}
module.exports={verify,main};
