#!/usr/bin/env node
'use strict';
/* P2 research: preserve each style's rank-band occupancy and compare every
 * pair separately. The published front/rear gate is NOT the basis of this
 * analysis. Neither occupancy nor pairwise dominance is a skill trigger rate. */
const fs=require('node:fs');
const dominance=require('./globalsim_rank_band_dominance.cjs');
const STYLES=dominance.STYLES;
const PAIRS=Object.freeze(STYLES.flatMap((first,i)=>
 STYLES.slice(i+1).map(second=>Object.freeze([first,second]))));
const round=x=>Number(x.toFixed(6));
const contextKey=x=>[x.courseId,x.fieldSize,x.scenario,x.mode,
 x.phase,x.bandId].join('|');
function compare(a,b){
 if(a?.status==='absent-style'||b?.status==='absent-style')
  return {status:'absent',differencePoints:null};
 if(a?.status!=='estimate'||b?.status!=='estimate')
  return {status:'unresolved',differencePoints:null};
 const d=100*(a.fraction-b.fraction);
 return {status:d>1e-8?'first-higher':
  d< -1e-8?'second-higher':'tie',differencePoints:round(d)};
}
function summarizePair(rows,{first,second}){
 const counts={firstHigher:0,secondHigher:0,tie:0,absent:0,
  unresolved:0,unstable:0};
 for(const r of rows){
  const c=r.pairwise.find(p=>p.first===first&&p.second===second);
  if(!c)throw Error('Missing four-style pair '+first+'/'+second);
  if(c.status==='first-higher')counts.firstHigher++;
  else if(c.status==='second-higher')counts.secondHigher++;
  else if(c.status==='tie')counts.tie++;
  else if(c.status==='absent')counts.absent++;
  else counts.unresolved++;
  if(c.splitStatus==='unstable-or-unavailable')counts.unstable++;
 }
 const comparable=counts.firstHigher+counts.secondHigher+counts.tie;
 const expected=rows.filter(r=>r.scenario==='noFront'&&
  (first==='Nige'||second==='Nige')).length;
 if(counts.absent!==expected)
  throw Error('Unexpected style absence '+first+'/'+second);
 const splitTested=rows.length>0&&rows.every(r=>
  r.pairwise.find(p=>p.first===first&&p.second===second)
   .splitStatus!=='not-measured');
 const common={first,second,contexts:rows.length,comparable,
  ...counts,splitTested};
 const stable=splitTested&&comparable>0&&counts.unresolved===0&&
  counts.tie===0&&counts.unstable===0&&counts.absent===expected;
 return {...common,gate:stable&&counts.firstHigher===comparable?
  'first-consistently-higher':stable&&
  counts.secondHigher===comparable?
  'second-consistently-higher':'held'};
}
function analyze(profile,{firstProfile=null,lastProfile=null,
 requireComplete=true}={}){
 if(Boolean(firstProfile)!==Boolean(lastProfile))
  throw Error('Both seed-halves required for four-style validation');
 const base=dominance.analyze(profile,{firstProfile,lastProfile,
  requireComplete});
 const first=firstProfile?dominance.analyze(firstProfile,
  {requireComplete}):null;
 const last=lastProfile?dominance.analyze(lastProfile,
  {requireComplete}):null;
 const firstIndex=first?new Map(first.comparisons.map(r=>
  [contextKey(r),r])):null;
 const lastIndex=last?new Map(last.comparisons.map(r=>
  [contextKey(r),r])):null;
 if(firstIndex&&(firstIndex.size!==base.comparisonCount||
  lastIndex.size!==base.comparisonCount))
  throw Error('Split model contexts are not unique/complete');
 const comparisons=base.comparisons.map(row=>{
  const key=contextKey(row);
  const a=firstIndex?.get(key),b=lastIndex?.get(key);
  if(firstIndex&&(!a||!b||
   JSON.stringify(a.integerRanks)!==JSON.stringify(row.integerRanks)||
   JSON.stringify(b.integerRanks)!==JSON.stringify(row.integerRanks)))
   throw Error('Split rank bands mismatch '+key);
  const pairwise=PAIRS.map(([one,two])=>{
   const pooled=compare(row.values[one],row.values[two]);
   const halves=firstIndex?
    [compare(a.values[one],a.values[two]),
     compare(b.values[one],b.values[two])]:[];
   return {first:one,second:two,...pooled,
    splitStatus:halves.length===0?'not-measured':
     (pooled.status==='first-higher'||pooled.status==='second-higher')&&
     halves.every(x=>x.status===pooled.status)?
     'stable':'unstable-or-unavailable',
    halfStatuses:halves.map(x=>x.status)};
  });
  return {courseId:row.courseId,fieldSize:row.fieldSize,
   scenario:row.scenario,mode:row.mode,phase:row.phase,
   bandId:row.bandId,integerRanks:row.integerRanks,
   styles:Object.fromEntries(STYLES.map(style=>[style,row.values[style]])),
   pairwise};
 });
 const byPairPhaseBand=[],byPairScenarioBand=[],byStylePhaseBand=[];
 for(let phase=0;phase<=3;phase++)for(const band of dominance.BANDS){
  const group=comparisons.filter(r=>r.phase===phase&&r.bandId===band.id);
  if(requireComplete&&group.length!==72)
   throw Error('Missing contexts in four-style band '+phase+'/'+band.id);
  const rows=[];
  for(const [first,second] of PAIRS){
   const summary={phase,bandId:band.id,
    ...summarizePair(group,{first,second})};
   rows.push(summary);
   byPairPhaseBand.push(summary);
   for(const scenario of ['balanced','jan2026','noFront']){
    const scope=group.filter(r=>r.scenario===scenario);
    byPairScenarioBand.push({phase,bandId:band.id,scenario,
     ...summarizePair(scope,{first,second})});
   }
  }
  for(const style of STYLES){
   const present=group.map(r=>r.styles[style])
    .filter(v=>v.status==='estimate');
   const versus=STYLES.filter(s=>s!==style).map(opponent=>{
    const p=rows.find(r=>r.first===style&&r.second===opponent||
     r.first===opponent&&r.second===style);
    const favorable=style===p.first?
     'first-consistently-higher':'second-consistently-higher';
    const unfavorable=style===p.first?
     'second-consistently-higher':'first-consistently-higher';
    return {opponent,comparable:p.comparable,
     status:p.gate===favorable?'higher':
      p.gate===unfavorable?'lower':'held'};
   });
   byStylePhaseBand.push({phase,bandId:band.id,style,
    availableContexts:present.length,unavailableContexts:group.length-present.length,
    meanModelOccupancyPercent:present.length?
     round(100*present.reduce((sum,v)=>sum+v.fraction,0)/present.length):null,
    minModelOccupancyPercent:present.length?
     round(100*Math.min(...present.map(v=>v.fraction))):null,
    maxModelOccupancyPercent:present.length?
     round(100*Math.max(...present.map(v=>v.fraction))):null,
    higherThan:versus.filter(x=>x.status==='higher').map(x=>x.opponent),
    lowerThan:versus.filter(x=>x.status==='lower').map(x=>x.opponent),
    unresolvedAgainst:versus.filter(x=>x.status==='held').map(x=>x.opponent),
    comparisons:versus});
  }
 }
 return {schemaVersion:1,sourceRevision:base.sourceRevision,
  status:'research-four-style-pairwise-model-occupancy-not-game-activation',
  raceCount:base.raceCount,seedCount:base.seedCount,
  splitSeedCounts:base.splitSeedCounts,contextCount:base.contextCount,
  bands:dominance.BANDS,styles:STYLES,pairs:PAIRS,
  byPairPhaseBand,byPairScenarioBand,byStylePhaseBand,comparisons,
  limitations:[
   'Every style is assessed independently; front/rear labels are not a substitute for pairwise evidence.',
   'Middle band is source order_rate >=40 AND <=80, not an assumed symmetric center position.',
   'No-front scenario has absent Nige samples, which must not be zero-filled.',
   'Stable direction requires all comparable contexts and both seed halves; ties, missing data, or reversals hold the pair.',
   'Mean occupancy is equal-context model distance share, not real-game activation probability or card usefulness.',
   'No four-style high/low skill labels or app/card ranking may be inferred without a separately reviewed rule.'
  ]};
}
function main(args){
 const [all,first,last,output]=args;
 if(!all||!first||!last||!output)
  throw Error('Usage: globalsim_four_style_rank_fit.cjs full-rank-profile.json first-half-profile.json last-half-profile.json output.json');
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const report=analyze(read(all),{firstProfile:read(first),lastProfile:read(last)});
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({races:report.raceCount,
  pairs:report.byPairPhaseBand.length,styles:report.byStylePhaseBand.length,
  middle:report.byStylePhaseBand.filter(r=>r.phase===1&&
   r.bandId==='middle40to80')},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={STYLES,PAIRS,compare,summarizePair,analyze,main};
