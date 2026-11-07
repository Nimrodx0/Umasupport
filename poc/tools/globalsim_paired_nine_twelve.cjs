#!/usr/bin/env node
'use strict';
/*
 * P2, RESEARCH ONLY. Matched nine-anchor runners in 9/12-horse v77 races.
 * On exactly the same 12-horse trajectory measure BOTH integer rank cutoffs,
 * then attribute the total 9→12 shift algebraically to rank-boundary mapping
 * and the remaining added-entrant/trajectory component. At 12 runners,
 * perturb only the three entrants' styles, keeping the original nine fixed.
 *
 * This is NOT a clean "field size only" causal effect (extra runners must
 * have a strategy), nor a real-game skill activation probability.
 */
const fs=require('node:fs');
const readline=require('node:readline');
const {spawn}=require('node:child_process');
const expanded=require('./globalsim_position_expanded.cjs');
const pilot=require('./globalsim_position_pilot.cjs');
const rank=require('../src/skill_order_rate_bounds.cjs');
const phase=require('../src/skill_rank_timing.js');
const windows=require('./globalsim_subphase_random_10m.cjs');
const geometry=require('./globalsim_phase_random_10m.cjs');
const dirt=require('./globalsim_dirt_10m.cjs');
const BANDS=require('./globalsim_rank_band_dominance.cjs').BANDS;
const STYLES=expanded.STYLES;
const COURSE_SET=Object.freeze([
 Object.freeze({id:10502,distance:1600,surface:'turf'}),
 Object.freeze({id:10611,distance:1600,surface:'dirt'})
]);
const TARGETS=Object.freeze([
 Object.freeze({id:'mile-ruler',sourceNumericId:'200681',example:'マイルの支配者',
  courseId:10502,timing:'phase_laterhalf_random:0',bandId:'top50'}),
 Object.freeze({id:'high-voltage',sourceNumericId:'202671',example:'ハイボルテージ',
  courseId:10502,timing:'phase_firsthalf_random:2',bandId:'top50'}),
 Object.freeze({id:'gear-shift',sourceNumericId:'201052',example:'ギアシフト',
  courseId:10502,timing:'phase_random:1',bandId:'top50'}),
 Object.freeze({id:'dirt-momentum',sourceNumericId:'202261',example:'勝利の機運',
  courseId:10611,timing:'phase_laterhalf_random:1',bandId:'top50'}),
 Object.freeze({id:'dirt-expert',sourceNumericId:'202001',example:'砂の玄人',
  courseId:10611,timing:'phase_random:1',bandId:'from40'})
]);
const EXTRAS=Object.freeze({
 mixed:Object.freeze(['Nige','Senkou','Oikomi']),
 extraNige:Object.freeze(['Nige','Nige','Nige']),
 extraSenkou:Object.freeze(['Senkou','Senkou','Senkou']),
 extraSasi:Object.freeze(['Sasi','Sasi','Sasi']),
 extraOikomi:Object.freeze(['Oikomi','Oikomi','Oikomi'])
});
const VARIANTS=['mixed',...STYLES.map(s=>'extra'+s)];
const FIXED_SEEDS=30;
const round=x=>Number(x.toFixed(6));
const mean=x=>x.reduce((s,v)=>s+v,0)/x.length;
const cutoffs=(bandId)=>{
 const predicates=BANDS.find(b=>b.id===bandId)?.predicates;
 if(!predicates?.length)throw Error('Unrecognized fixed source band '+bandId);
 return {nine:predicates.map(p=>({
  operator:p.operator,value:p.value,boundary:rank.cutoff(9,p.value)})),
  twelve:predicates.map(p=>({
  operator:p.operator,value:p.value,boundary:rank.cutoff(12,p.value)}))};
};
function eligible(n,bandId,cutoffN=n){
 if(![9,12].includes(n)||![9,12].includes(cutoffN))
  throw Error('Only source-verified 9/12 ranks supported');
 const predicates=BANDS.find(b=>b.id===bandId)?.predicates;
 if(!predicates?.length)throw Error('Unknown source band');
 const projection=rank.andProjection(predicates,cutoffN);
 if(projection.status!=='rank-subcondition-projection')
  throw Error('Unresolved sourced integer rank boundary');
 const allowed=new Set();
 for(let place=1;place<=n;place++)
  if(predicates.every(p=>rank.compare(place,p.operator,
   rank.cutoff(cutoffN,p.value))))allowed.add(place);
 if(cutoffN===n&&(projection.positions.length!==allowed.size||
  projection.positions.some(place=>!allowed.has(place))))
  throw Error('Cross-check of source rank projection failed');
 return allowed;
}
function timeZone(target,courseDistance){
 const original=windows.WINDOWS.find(w=>w.key===target.timing);
 if(original)return {start:original.startRate*courseDistance,
  end:original.endRate*courseDistance};
 const [type,phaseRaw]=target.timing.split(':');
 const idx=Number(phaseRaw);
 if(type!=='phase_random'||!Number.isInteger(idx)||idx<0||idx>3)
  throw Error('Unrecognized source timing window '+target.timing);
 return {start:phase.PHASE_BOUNDARIES[idx]*courseDistance,
  end:phase.PHASE_BOUNDARIES[idx+1]*courseDistance};
}
function plans(seedsPerCell=FIXED_SEEDS){
 if(!Number.isInteger(seedsPerCell)||seedsPerCell<2||
  seedsPerCell>30||seedsPerCell%2)
  throw Error('Require even 2..30 paired seeds');
 const rows=[];
 for(const course of COURSE_SET)
  for(const mode of expanded.MODES)
   for(let rep=0;rep<seedsPerCell;rep++){
    const seed=expanded.seedFor(course.id,9,'balanced',rep);
    const original=expanded.roster(9,'balanced',rep,seed);
    if(JSON.stringify(original.counts)!=='[2,2,3,2]')
     throw Error('Nine-horse baseline composition drift');
    const n9={seed,course,fieldSize:9,scenario:'nine',
     mode,rep,strategies:original.strategies,anchor9:original.strategies};
    rows.push(n9);
    for(const v of VARIANTS){
     const extras=EXTRAS[v];
     rows.push({...n9,fieldSize:12,scenario:v,
      strategies:[...original.strategies,...extras]});
    }
   }
 if(rows.length!==2*2*seedsPerCell*(1+VARIANTS.length))
  throw Error('Unpaired 9/12 test plan');
 return rows;
}
function coreNineSame(race9,race12){
 if(!race9||!race12||race9.horses.length!==9||
  race12.horses.length!==12||race9.seed!==race12.seed||
  race9.courseId!==race12.courseId)
  throw Error('Paired races differ in base design');
 for(let i=0;i<9;i++)
  if(JSON.stringify(race9.horses[i])!==JSON.stringify(race12.horses[i]))
   throw Error('Original nine runners were not kept identical at gate '+i);
 return true;
}
function sample(frames,runner,target,fieldSize,distance){
 const {start,end}=timeZone(target,distance);
 const trace=geometry.rankSegments(frames,runner,start,end,{validated:true});
 if(trace.status!=='estimate')throw Error('Unresolved source window rank trajectory: '+trace.status);
 const observed=geometry.measureWindows(trace.segments,
  eligible(fieldSize,target.bandId,fieldSize),start,end);
 const matched=fieldSize===12?geometry.measureWindows(trace.segments,
  eligible(12,target.bandId,9),start,end):null;
 return {source:observed.tenMetreWindowOpportunity*100,
  cutoffNine:matched?.tenMetreWindowOpportunity*100??null};
}
function analyzePairs(runRows,samples){
 if(!Array.isArray(runRows)||!Array.isArray(samples)||runRows.length!==samples.length)
  throw Error('Paired race results incomplete');
 const seen=new Map(),pairs=[];
 for(const [i,plan] of runRows.entries()){
  const row=samples[i],key=[plan.course.id,plan.mode,plan.rep].join('|');
  if(!seen.has(key))seen.set(key,new Map());
  const group=seen.get(key);
  if(group.has(plan.scenario))throw Error('Duplicate scenario within paired seed');
  group.set(plan.scenario,row);
 }
 for(const [key,group] of seen){
  const nine=group.get('nine');
  if(!nine||group.size!==6)
   throw Error('Missing original nine or any of the 5 twelve-roster cases '+key);
  for(const variant of VARIANTS){
   const twelve=group.get(variant);
   if(!twelve)throw Error('Missing 12 variant '+variant);
   for(const target of TARGETS){
    if(target.courseId!==nine.plan.course.id)continue;
    for(const style of STYLES){
     const a=nine.metrics[target.id]?.[style];
     const b=twelve.metrics[target.id]?.[style];
     if(!a||!b||a.count!==b.count||
      a.count!==nine.plan.anchor9.filter(x=>x===style).length)
      throw Error('Anchor runner population changed '+key+' '+style);
     const initial9=a.sourceSum/a.count;
     const final12=b.sourceSum/b.count;
     const cf9=b.cutoffNineSum/b.count;
     const boundary=final12-cf9;
     const entrants=cf9-initial9;
     if(Math.abs((final12-initial9)-(boundary+entrants))>1e-8)
      throw Error('Two-component decomposition is not exact');
     pairs.push({courseId:target.courseId,
      profileId:target.id,example:target.example,
      bandId:target.bandId,timing:target.timing,
      style,variant,mode:nine.plan.mode,rep:nine.plan.rep,
      anchorRunners:a.count,ninePercent:round(initial9),
      twelvePercent:round(final12),
      twelveWithNineCutoffPercent:round(cf9),
      totalDifferencePoints:round(final12-initial9),
      boundaryComponentPoints:round(boundary),
      addedEntrantsComponentPoints:round(entrants)});
    }
   }
  }
 }
 if(pairs.length!==TARGETS.length*STYLES.length*2*
  (runRows.length/(2*2*6))*VARIANTS.length)
  throw Error('Incomplete source-verified paired output');
 const summaries=[];
 for(const target of TARGETS)for(const style of STYLES){
  const variantSummaries=[];
  for(const variant of VARIANTS){
   const subset=pairs.filter(x=>x.profileId===target.id&&
    x.style===style&&x.variant===variant);
   if(!subset.length)throw Error('Empty source style/variant result');
   const avg=k=>round(mean(subset.map(x=>x[k])));
   const delta=avg('totalDifferencePoints'),
    mapping=avg('boundaryComponentPoints'),
    entrants=avg('addedEntrantsComponentPoints');
   if(Math.abs(delta-mapping-entrants)>0.00001)
    throw Error('Aggregate decomposition not additive');
   variantSummaries.push({variant,nPairedSeedModes:subset.length,
    ninePercent:avg('ninePercent'),
    twelvePercent:avg('twelvePercent'),
    twelveWithNineCutoffPercent:avg('twelveWithNineCutoffPercent'),
    totalDifferencePoints:delta,
    boundaryComponentPoints:mapping,
    addedEntrantsComponentPoints:entrants,
    byMode:Object.fromEntries(expanded.MODES.map(mode=>{
     const xs=subset.filter(x=>x.mode===mode);
     return [mode,{
      n:xs.length,
      ninePercent:round(mean(xs.map(x=>x.ninePercent))),
      twelvePercent:round(mean(xs.map(x=>x.twelvePercent))),
      boundaryComponentPoints:round(mean(xs.map(x=>x.boundaryComponentPoints))),
      addedEntrantsComponentPoints:round(mean(xs.map(x=>x.addedEntrantsComponentPoints)))
     }];
    }))});
  }
  const mixed=variantSummaries.find(x=>x.variant==='mixed');
  if(variantSummaries.some(x=>Math.abs(x.ninePercent-mixed.ninePercent)>1e-6))
   throw Error('Original nine differs between added-roster variants');
  const low=Math.min(...variantSummaries.map(x=>x.twelvePercent));
  const high=Math.max(...variantSummaries.map(x=>x.twelvePercent));
  summaries.push({profileId:target.id,example:target.example,
   courseId:target.courseId,timing:target.timing,bandId:target.bandId,style,
   sourceRankCutoffs:cutoffs(target.bandId),
   mixedBaseline:mixed,
   additionStyleSensitivity:{
    all12MinPercent:round(low),all12MaxPercent:round(high),
    rangePoints:round(high-low),
    extraRunnersOnlyComparison:true,
    originalNineAreIdentical:true},
   byAddedComposition:variantSummaries});
 }
 return {schemaVersion:1,
  status:'research-paired-9-vs-12-anchor-9-model-only-not-game-activation',
  sourceRevision:pilot.PIN,
  method:'Same nine runners and seed in n9 and n12; three added competitors varied among mixed or same-style three. On the same n12 trajectory compare sourced n12 rank boundaries to counterfactual n9 boundaries, and use exact additive decomposition. All estimates are skill-free GlobalSim 10m window overlaps.',
  totalRaceCases:runRows.length,
  targetDefinitions:TARGETS,
  baseRosterNine:[2,2,3,2],
  twelveAddedVariants:EXTRAS,
  calculationCaveats:[
   'The 9-vs-12 change adds opponents; there is no meaningful pure headcount effect independent of entrant composition.',
   'The boundary component is isolated counterfactually on the exact same twelve-horse trajectory, and depends on the selected nine-horse boundary reference.',
   'The residual combines dynamics of added entrants and interactions; it is not a separately identified pure headcount effect.',
   'Across variants, all nine original runners (gate, stats, style, skill-free status) and random seed are the same at race start. Engine RNG evolution may diverge after competitors are added.',
   'The five 12-horse rosters are illustrative sensitivity scenarios, not measured real opponent frequencies.',
   'Only two specific 1600m courses and five representative source rank conditions; not the 77 source-skill population.',
   'The window is a geometrical model of UmaSim random 10m rank checks, not the actual Japanese game skill activation rate.',
   'No approved high/middle/low suitability thresholds, card scores or public UI changes are implied.'
  ],
  pairs,
  summaries};
}
async function execute(template,engine,{seedsPerCell=FIXED_SEEDS}={}){
 const runRows=plans(seedsPerCell),results=[];
 const child=spawn(engine,[],{stdio:['pipe','pipe','pipe']});
 let stderr='';
 child.stderr.setEncoding('utf8');
 child.stderr.on('data',s=>{stderr=(stderr+s).slice(-5000)});
 const done=new Promise(resolve=>child.once('close',
  (code,signal)=>resolve({code,signal})));
 const read=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
 let prevRace9=null;
 const write=(async()=>{
  for(const plan of runRows){
   const race=expanded.makeRace(template,plan);
   if(plan.scenario==='nine')prevRace9=race;
   else coreNineSame(prevRace9,race);
   if(!child.stdin.write(JSON.stringify(race)+'\n'))
    await new Promise(resolve=>child.stdin.once('drain',resolve));
  }
  child.stdin.end();
 })();
 let received=0,err=null;
 try{
  for await(const line of read){
   if(!line.trim())continue;
   if(received>=runRows.length)throw Error('Unexpected GlobalSim output');
   const plan=runRows[received],reply=JSON.parse(line);
   if(reply.error||reply.seed!==undefined&&reply.seed!==plan.seed)
    throw Error('Pinned GlobalSim seed or race error at '+received);
   pilot.checkFrames(reply.frames,plan.fieldSize);
   const metrics={};
   for(const target of TARGETS){
    if(target.courseId!==plan.course.id)continue;
    metrics[target.id]={};
    for(const style of STYLES)metrics[target.id][style]={
     count:0,sourceSum:0,cutoffNineSum:0};
    for(let runner=0;runner<9;runner++){
     const style=plan.anchor9[runner];
     const m=sample(reply.frames,runner,target,
      plan.fieldSize,plan.course.distance);
     const item=metrics[target.id][style];
     item.count++;
     item.sourceSum+=m.source;
     if(plan.fieldSize===12)item.cutoffNineSum+=m.cutoffNine;
    }
   }
   results.push({plan,metrics});
   received++;
  }
  await write;
 }catch(e){err=e;child.kill()}
 const exit=await done;
 if(err)throw err;
 if(exit.code!==0||received!==runRows.length)
  throw Error('Pinned paired GlobalSim incomplete '+JSON.stringify({
   exit,received,wanted:runRows.length,stderr}));
 return analyzePairs(runRows,results);
}
async function main([templatePath,engine,outPath,seeds]){
 if(!outPath)throw Error('Usage: globalsim_paired_nine_twelve.cjs v77-race.jsonl engine result.json [evenSeeds]');
 const lines=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(lines.length!==1)throw Error('Exactly one pinned v77 race template required');
 const result=await execute(JSON.parse(lines[0]),engine,
  {seedsPerCell:Number(seeds||FIXED_SEEDS)});
 fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({raceCases:result.totalRaceCases,
  summaries:result.summaries.filter(x=>
   (x.profileId==='mile-ruler'&&x.style==='Sasi')||
   (x.profileId==='dirt-momentum'&&x.style==='Sasi')||
   (x.profileId==='dirt-expert'&&x.style==='Senkou'))
   .map(x=>({example:x.example,style:x.style,
    mixed:x.mixedBaseline,sensitivity:x.additionStyleSensitivity}))},null,2));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{
 console.error(e.stack||e);process.exitCode=1});
module.exports={COURSE_SET,TARGETS,EXTRAS,VARIANTS,
 cutoffs,eligible,timeZone,plans,coreNineSame,sample,analyzePairs,
 execute,main};
