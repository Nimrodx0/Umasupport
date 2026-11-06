#!/usr/bin/env node
'use strict';
/* Research only: two independent descriptors of an exact, source-matched
 * rank-band CONDITION in balanced GlobalSim race simulations.
 * The observed phase-DISTANCE fraction is not an in-game skill trigger rate.
 * The uniform-rank baseline is a mathematical counterfactual, not a real
 * opponent distribution or an observed game mechanic. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const rules=require('../src/skill_balanced_four_style_fit.cjs');
const verifier=require('./verify_balanced_four_style_evidence.cjs');
const PINNED_SOURCE_SHA=rules.EVIDENCE.fullReportSha256;
const STYLES=rules.EVIDENCE.styles;
const round=x=>Number(x.toFixed(6));
const groupKey=(p,b)=>p+'|'+b;
const rowKey=r=>[r.courseId,r.fieldSize,r.mode,r.phase,r.bandId].join('|');
const EXPECTED_MODES=['equal','jitter10'];
const EXPECTED_FIELDS=[9,12];
const knownBand=new Set(rules.EVIDENCE.bands);
const expectedPairCode=g=>g==='first-consistently-higher'?'F':
 g==='second-consistently-higher'?'S':'?';
function summarize(report,{requireComplete=true}={}){
 if(!report||report.schemaVersion!==1||
  report.sourceRevision!==rules.EVIDENCE.sourceRevision||
  report.status!=='research-four-style-pairwise-model-occupancy-not-game-activation'||
  !Array.isArray(report.comparisons)||!Array.isArray(report.byPairScenarioBand))
  throw Error('Not the source-pinned four-style research report');
 if(requireComplete&&(report.raceCount!==2160||report.seedCount!==30||
  JSON.stringify(report.splitSeedCounts)!=='[15,15]'||
  report.contextCount!==288||report.comparisons.length!==3168||
  report.byPairScenarioBand.length!==792))
  throw Error('Incomplete 2160-race four-style research report');
 const balanced=report.comparisons.filter(r=>r.scenario==='balanced');
 const groups=new Map(),seen=new Set();
 for(const r of balanced){
  if(!Number.isInteger(r.phase)||r.phase<0||r.phase>3||
   !knownBand.has(r.bandId)||!EXPECTED_FIELDS.includes(r.fieldSize)||
   !EXPECTED_MODES.includes(r.mode)||!Number.isInteger(r.courseId)||
   !Array.isArray(r.integerRanks)||r.integerRanks.length===0)
   throw Error('Invalid balanced model context');
  const k=rowKey(r);
  if(seen.has(k))throw Error('Repeated balanced context '+k);
  seen.add(k);
  if(r.integerRanks.some(n=>!Number.isInteger(n)||n<1||n>r.fieldSize)||
   new Set(r.integerRanks).size!==r.integerRanks.length)
   throw Error('Invalid integer rank projection '+k);
  const proof=rules.bandProof(
   rules.exactBand([{type:'order_rate',operator:'<=',value:20}])?.predicates||[],
   {type:'phase_random',operator:'==',value:0}); // do not use as calibration
  void proof;
  const gk=groupKey(r.phase,r.bandId);
  if(!groups.has(gk))groups.set(gk,[]);
  groups.get(gk).push(r);
 }
 const pairRows=new Map();
 for(const row of report.byPairScenarioBand){
  if(row.scenario!=='balanced')continue;
  const k=[row.phase,row.bandId,row.first,row.second].join('|');
  if(pairRows.has(k))throw Error('Repeated balanced pair evidence '+k);
  pairRows.set(k,row);
 }
 const results=[];
 for(let phase=0;phase<4;phase++)for(const [b,bandId] of
  rules.EVIDENCE.bands.entries()){
  const scope=groups.get(groupKey(phase,bandId))||[];
  if(!scope.length&&!requireComplete)continue;
  if(requireComplete&&(scope.length!==24||
   scope.filter(r=>r.fieldSize===9).length!==12||
   scope.filter(r=>r.fieldSize===12).length!==12))
   throw Error('Incomplete balanced opportunity contexts '+phase+'/'+bandId);
  if(!scope.length)throw Error('Empty rank-band context');
  const pairs=rules.EVIDENCE.pairs.map(([first,second],i)=>{
   const k=[phase,bandId,first,second].join('|'),r=pairRows.get(k);
   if(!r||r.contexts!==scope.length||
    r.comparable!==scope.length||r.absent!==0||
    r.unresolved!==0||r.splitTested!==true||
    expectedPairCode(r.gate)!==
     rules.EVIDENCE.directionByPhase[phase][b][i])
    throw Error('Unconfirmed balanced pair evidence '+k);
   return {first,second,relation:r.gate,
    stable:r.gate!=='held'};
  });
  const all=Object.fromEntries(STYLES.map(style=>{
   const fractions=scope.map(r=>{
    const v=r.styles?.[style];
    if(!v||v.status!=='estimate'||!Number.isFinite(v.fraction)||
     v.fraction<0||v.fraction>1||
     !Number.isSafeInteger(v.runnerCount)||v.runnerCount<1)
     throw Error('Unmeasured balanced style '+style);
    return {fraction:v.fraction,field:r.fieldSize,
     baseline:r.integerRanks.length/r.fieldSize};
   });
   const meanPercent=100*fractions.reduce((v,f)=>v+f.fraction,0)/
    fractions.length;
   const baselinePercent=100*fractions.reduce((v,f)=>v+f.baseline,0)/
    fractions.length;
   const versus={higherThan:[],lowerThan:[],heldAgainst:[]};
   for(const p of pairs){
    if(p.first!==style&&p.second!==style)continue;
    const other=p.first===style?p.second:p.first;
    if(!p.stable)versus.heldAgainst.push(other);
    else if((p.relation==='first-consistently-higher'&&p.first===style)||
     (p.relation==='second-consistently-higher'&&p.second===style))
     versus.higherThan.push(other);
    else versus.lowerThan.push(other);
   }
   return [style,{
    opportunity:{
     status:'model-rank-distance-occupancy',
     meanPercent:round(meanPercent),
     minContextPercent:round(100*Math.min(...fractions.map(f=>f.fraction))),
     maxContextPercent:round(100*Math.max(...fractions.map(f=>f.fraction))),
     byFieldSize:Object.fromEntries(EXPECTED_FIELDS.map(n=>{
      const xs=fractions.filter(f=>f.field===n);
      return [n,xs.length?round(100*xs.reduce((v,f)=>v+f.fraction,0)/xs.length):null];
     })),
     sampleContexts:fractions.length},
    specificity:{
     status:'rank-band-relative-advantage-not-skill-utility',
     uniformRankReferencePercent:round(baselinePercent),
     deviationFromUniformReferencePoints:round(meanPercent-baselinePercent),
     ...versus,
     allThreePairsConfirmed:versus.heldAgainst.length===0
    }}];
  }));
  results.push({phase,bandId,scenario:'balanced',
   sourceRankConditions:rules.exactBand(
    (require('../tools/globalsim_rank_band_dominance.cjs').BANDS
      .find(z=>z.id===bandId)||{}).predicates||[])?.predicates||null,
   contexts:scope.length,styles:all});
 }
 if(requireComplete&&(seen.size!==1056||pairRows.size!==264||
  results.length!==44))throw Error('Incomplete balanced two-axis results');
 return {schemaVersion:1,modelRevision:rules.EVIDENCE.sourceRevision,
  sourceFourStyleReportSha256:PINNED_SOURCE_SHA,
  status:'research-two-axis-rank-condition-only-not-skill-activation',
  scenario:'balanced',racesInOriginalExperiment:report.raceCount,
  contextsPerBandPhase:requireComplete?24:null,
  styles:STYLES,results,
  limits:[
   'Opportunity is percentage of simulated phase distance at source rank band, not skill activation probability.',
   'Specificity means model occupancy deviation from a hypothetical uniform rank reference and validated pairwise relative order. It is NOT skill effect usefulness.',
   'Uniform rank reference accounts for exact 9/12 integer-rank bands; it is not a real match distribution.',
   'Balanced is a controlled benchmark, not the most frequent real-world composition.',
   'Context min/max are sensitivity ranges across courses, sizes, modes, not confidence intervals.',
   'Neither axis defines a high/low threshold or a card score. AND/OR, preconditions and unmeasured triggers remain held.',
   'Skill effect usefulness is a separate future research axis and must not be inferred from either descriptor.'
  ]};
}
function main(args){
 const [src,out]=args;
 if(!src||!out)throw Error('Usage: globalsim_balanced_two_axis.cjs four-style-pairwise.json output.json');
 const buffer=fs.readFileSync(src);
 verifier.verify(buffer);
 const doc=summarize(JSON.parse(buffer.toString('utf8')));
 fs.writeFileSync(out,JSON.stringify(doc,null,2)+'\n');
 console.log(JSON.stringify({phaseBands:doc.results.length,
  styleObservations:doc.results.length*STYLES.length,
  sourceSha256:crypto.createHash('sha256').update(buffer).digest('hex'),
  destination:out},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={PINNED_SOURCE_SHA,STYLES,summarize,main};
