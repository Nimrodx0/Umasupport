#!/usr/bin/env node
'use strict';
/* Source-predicate integer ranks projected onto *all recorded position*
 * GlobalSim histograms. Strict bidirectional group dominance, with unknowns
 * never silently substituted by 0. NOT skill activation probability. */
const fs=require('node:fs');
const bounds=require('../src/skill_order_rate_bounds.cjs');
const pilot=require('./globalsim_position_pilot.cjs');
const STYLES=Object.freeze(['Nige','Senkou','Sasi','Oikomi']);
const BANDS=Object.freeze([
 ['top30',[['<=',30]]],
 ['top40',[['<=',40]]],
 ['top50',[['<=',50]]],
 ['top80',[['<=',80]]],
 ['from40',[['>=',40]]],
 ['from50strict',[['>',50]]],
 ['from70',[['>=',70]]],
 ['middle40to80',[['>=',40],['<=',80]]],
 ['middle30to80',[['>=',30],['<=',80]]],
 ['equal50',[['==',50]]],
 ['middle70to75',[['>=',70],['<=',75]]]
].map(([id,terms])=>({id,predicates:terms.map(([operator,value])=>({
 type:'order_rate',operator,value}))})));
const KEY=['courseId','fieldSize','scenario','mode','phase'];
const key=(x)=>KEY.map(p=>String(x[p])).join('|');
const round=x=>Number(x.toFixed(6));
const direction=(values,scenario)=>{
 const front=scenario==='noFront'?['Senkou']:['Nige','Senkou'];
 const rear=['Sasi','Oikomi'];
 const wanted=[...front,...rear];
 if(wanted.some(s=>values[s]?.status!=='estimate'))
  return {status:'unresolved-style-data',frontGapPoints:null,
   rearGapPoints:null,marginPoints:null};
 const f=front.map(s=>values[s].fraction),r=rear.map(s=>values[s].fraction);
 const frontGap=100*(Math.min(...f)-Math.max(...r));
 const rearGap=100*(Math.min(...r)-Math.max(...f));
 const status=frontGap>1e-8?'front-all-ahead':
  rearGap>1e-8?'rear-all-ahead':'mixed-or-tied';
 return {status,frontGapPoints:round(frontGap),
  rearGapPoints:round(rearGap),
  marginPoints:status==='front-all-ahead'?round(frontGap):
   status==='rear-all-ahead'?round(rearGap):null};
};
function checkedProfile(profile,label){
 if(!profile||profile.sourceRevision!==pilot.PIN||
  profile.status!=='model-all-recorded-positions-rank-distribution-not-actual-game'||
  ![9,12].every(n=>bounds.FIELDS.includes(n))||
  !Array.isArray(profile.samples)||profile.samples.length===0||
  !Number.isSafeInteger(profile.seedCount)||profile.seedCount<1)
  throw Error('Invalid or unfixed GlobalSim full-rank profile '+label);
 const cells=new Map(),contexts=new Map();
 for(const s of profile.samples){
  const k=key(s);
  if(![9,12].includes(s.fieldSize)||!STYLES.includes(s.style)||
   !Number.isInteger(s.phase)||s.phase<0||s.phase>3||
   !['balanced','jan2026','noFront'].includes(s.scenario)||
   !['equal','jitter10'].includes(s.mode)||
   !Number.isInteger(s.runners)||s.runners<0||
   !Number.isInteger(s.invalidRunners)||s.invalidRunners<0||
   !['estimate','held-unresolved-runners',
    'no-style-runner-observations'].includes(s.status))
   throw Error('Malformed position occupancy sample');
  const sk=k+'|'+s.style;
  if(cells.has(sk))throw Error('Duplicate profile style sample '+sk);
  if(s.status==='estimate'){
   if(!s.runners||s.invalidRunners||
    !Array.isArray(s.rankFractions)||
    s.rankFractions.length!==s.fieldSize||
    s.rankFractions.some(x=>typeof x!=='number'||!Number.isFinite(x)||
     x<0||x>1)||
    Math.abs(s.rankFractions.reduce((a,b)=>a+b,0)-1)>1e-6)
    throw Error('Invalid rank fraction '+sk);
  }else if(s.rankFractions!==null||
   (s.status==='no-style-runner-observations'&&s.runners!==0)||
   (s.status==='held-unresolved-runners'&&
    (!s.runners||!s.invalidRunners)))
   throw Error('Unresolved runner must have no rank fractions '+sk);
  cells.set(sk,s);
  if(!contexts.has(k))contexts.set(k,{courseId:s.courseId,
   fieldSize:s.fieldSize,scenario:s.scenario,mode:s.mode,phase:s.phase});
 }
 for(const k of contexts.keys())
  for(const style of STYLES)
   if(!cells.has(k+'|'+style))throw Error('Incomplete style set '+k);
 return {cells,contexts};
}
function analyze(profile,{firstProfile=null,lastProfile=null,requireComplete=true}={}){
 const full=checkedProfile(profile,'full');
 if(Boolean(firstProfile)!==Boolean(lastProfile))
  throw Error('Both seed-halves required for split validation');
 const splits=firstProfile?[checkedProfile(firstProfile,'first'),
  checkedProfile(lastProfile,'last')]:[];
 if(splits.length&&(
  firstProfile.seedCount+lastProfile.seedCount!==profile.seedCount||
  firstProfile.raceCount+lastProfile.raceCount!==profile.raceCount))
  throw Error('Split population does not cover the original races');
 if(requireComplete&&(full.contexts.size!==6*2*3*2*4||
  [...full.contexts.values()].some(x=>!['balanced','jan2026','noFront']
   .includes(x.scenario))))throw Error('Incomplete six-course model context population');
 for(const half of splits){
  if(half.contexts.size!==full.contexts.size||
   [...full.contexts.keys()].some(k=>!half.contexts.has(k)))
   throw Error('Different model contexts between seed halves');
 }
 const evaluated=[];
 for(const [k,context] of full.contexts){
  for(const band of BANDS){
   const ranks=bounds.andProjection(band.predicates,context.fieldSize);
   if(ranks.status!=='rank-subcondition-projection'||
    !ranks.positions.length)throw Error('Unverified source rank band');
   const assess=source=>{
    const values=Object.fromEntries(STYLES.map(style=>{
     const sample=source.cells.get(k+'|'+style);
     if(!sample)return [style,{status:'unresolved-style-data',
      runnerCount:0,fraction:null}];
     if(sample.status!=='estimate')return [style,{
      status:sample.status==='no-style-runner-observations'?
       'absent-style':'unresolved-style-data',
      runnerCount:sample.runners,fraction:null}];
     const sum=ranks.positions.reduce((v,n)=>
      v+sample.rankFractions[n-1],0);
     return [style,{status:'estimate',
      runnerCount:sample.runners,fraction:round(sum)}];
    }));
    return {values,...direction(values,context.scenario)};
   };
   const base=assess(full);
   const halves=splits.map(assess);
   evaluated.push({...context,bandId:band.id,
    sourceConditions:band.predicates,integerRanks:ranks.positions,
    ...base,
    firstHalfDirection:halves[0]?.status??null,
    lastHalfDirection:halves[1]?.status??null,
    splitStatus:splits.length?(halves.every(x=>x.status===base.status)?
     'same-direction-in-both-seed-halves':'not-confirmed-in-both-halves'):
     'not-measured'});
  }
 }
 const byPhaseBand=[];
 const byScenarioBand=[];
 for(let phase=0;phase<=3;phase++)
  for(const band of BANDS){
   const all=evaluated.filter(x=>x.phase===phase&&x.bandId===band.id);
   if(requireComplete&&all.length!==72)throw Error('Incomplete pattern contexts');
   const classify=rows=>{
    const counts={front:0,rear:0,mixed:0,unresolved:0};
    for(const x of rows){
     if(x.status==='front-all-ahead')counts.front++;
     else if(x.status==='rear-all-ahead')counts.rear++;
     else if(x.status==='mixed-or-tied')counts.mixed++;
     else counts.unresolved++;
    }
    const confirmed=rows.length>0&&counts.unresolved===0&&
     (counts.front===rows.length||counts.rear===rows.length);
    const splitOk=splits.length===0?null:rows.every(x=>
     x.splitStatus==='same-direction-in-both-seed-halves');
    const relevantMargins=rows.filter(x=>x.marginPoints!==null)
     .map(x=>x.marginPoints);
    return {...counts,contexts:rows.length,
     splitSameDirection:splitOk===null?null:rows.filter(x=>
      x.splitStatus==='same-direction-in-both-seed-halves').length,
     minStrictMarginPoints:relevantMargins.length?
      Math.min(...relevantMargins):null,
     gate:confirmed&&splitOk===true?
      (counts.front===rows.length?
       'model-front-direction-consistent':
       'model-rear-direction-consistent'):
      'held-ambiguous-or-unconfirmed'};
   };
   byPhaseBand.push({phase,bandId:band.id,sourceConditions:band.predicates,
    ...classify(all)});
   for(const scenario of ['balanced','jan2026','noFront'])
    byScenarioBand.push({phase,bandId:band.id,scenario,
     ...classify(all.filter(x=>x.scenario===scenario))});
  }
 return {schemaVersion:1,
  sourceRevision:pilot.PIN,
  status:'pinned-GlobalSim-model-rank-band-direction-not-game-activation',
  raceCount:profile.raceCount,
  seedCount:profile.seedCount,
  splitSeedCounts:splits.map((_,i)=>i===0?
   firstProfile.seedCount:lastProfile.seedCount),
  contextCount:full.contexts.size,patternCount:BANDS.length,
  comparisonCount:evaluated.length,
  bands:BANDS,
  byPhaseBand,byScenarioBand,comparisons:evaluated,
  limitations:[
   'Only GlobalSim model position distance occupancy; no real game trigger probabilities.',
   'Source rank integer map: reference-based 9/12 runner conversion, not independently verified JP engine.',
   'Phase windows: four full phases, not untested random subphases, straight/corner restrictions, or overtake opportunity conditions.',
   'Strict front/rear group dominance requires ALL available styles on one side to beat ALL styles on the other; opposite direction also uses strict rule.',
   'An absent style, tie, or unresolved runner may not be silently converted to a zero-probability runner.',
   'Balanced and no-front are sensitivity controls; sampled jan2026 roster is one event marginal, not a universal lobby average.',
   'Any seed-half instability forces the evidence gate to remain held, even if pooled model comparison points one way.',
   'Condition predicates describe ranks only; other AND/OR paths, race surface and skill usefulness are separate.'
  ]};
}
function main(args){
 const [input,output,first,last]=args;
 if(!input||!output)throw Error('Usage: globalsim_rank_band_dominance.cjs rank_profile.json output.json [first_profile.json last_profile.json]');
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const out=analyze(read(input),{firstProfile:first?read(first):null,
  lastProfile:last?read(last):null});
 fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
 console.log(JSON.stringify({raceCount:out.raceCount,
  comparisonCount:out.comparisonCount,
  byPhaseBand:out.byPhaseBand},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={STYLES,BANDS,KEY,direction,checkedProfile,analyze,main};
