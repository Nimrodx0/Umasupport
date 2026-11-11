#!/usr/bin/env node
'use strict';
/* P2 research only. Four ORIGINAL-SOURCE subphase random windows with exactly
 * the same 10-metre geometry as the frozen full-phase study. Both studies are
 * replayed on the SAME balanced 720 races to verify matching population and
 * stable SHA of the previous full-phase result. No real activation rates. */
const fs=require('node:fs');
const readline=require('node:readline');
const {spawn}=require('node:child_process');
const source=require('../src/skill_rank_timing.js');
const old=require('./globalsim_phase_random_10m.cjs');
const dist=require('./globalsim_rank_distribution.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const pilot=require('./globalsim_position_pilot.cjs');
const bands=require('./globalsim_rank_band_dominance.cjs').BANDS;
const bounds=require('../src/skill_order_rate_bounds.cjs');
const STYLES=expanded.STYLES;
const round=n=>Number(n.toFixed(6));
const exactWindow=(type,phase)=>{
 const spec=source.TIME_SPECS[type];
 const s=source.timing({type,operator:'==',value:phase});
 if(!spec||!s||s.status!=='source-defined'||s.courseDependent||
  !s.randomWindow||s.windows.length!==1||
  s.windows[0].phase!==phase||spec.fraction!==.5||
  ![0,.5].includes(spec.offset))
  throw Error('Unrecognized original-source random subphase '+type+phase);
 const start=source.PHASE_BOUNDARIES[phase],
  end=source.PHASE_BOUNDARIES[phase+1],span=end-start;
 const startRate=start+span*spec.offset;
 const endRate=start+span*(spec.offset+spec.fraction);
 if(Math.abs(s.windows[0].startRate-startRate)>1e-7||
  Math.abs(s.windows[0].endRate-endRate)>1e-7)
  throw Error('Incompatible original window boundaries');
 return Object.freeze({key:type+':'+phase,
  sourceCondition:{type,operator:'==',value:phase},
  phase,startRate,endRate,
  sourceWindowName:s.kind});
};
const WINDOWS=Object.freeze([
 exactWindow('phase_laterhalf_random',0),
 exactWindow('phase_firsthalf_random',1),
 exactWindow('phase_laterhalf_random',1),
 exactWindow('phase_firsthalf_random',2)
]);
function collect(){
 const groups=new Map();
 const append=(plan,window,band,style,measure)=>{
  const key=[plan.course.id,plan.fieldSize,plan.mode,window.key,
   band.id,style].join('|');
  if(!groups.has(key)){
   groups.set(key,{courseId:plan.course.id,
    fieldSize:plan.fieldSize,mode:plan.mode,windowKey:window.key,
    bandId:band.id,style,observations:0,pointSum:0,
    windowSum:0,minRunnerDelta:Infinity,maxRunnerDelta:-Infinity,
    split:[{n:0,pointSum:0,windowSum:0},{n:0,pointSum:0,windowSum:0}]});
  }
  const g=groups.get(key);
  g.observations++;
  g.pointSum+=measure.pointOccupancy;
  g.windowSum+=measure.tenMetreWindowOpportunity;
  g.minRunnerDelta=Math.min(g.minRunnerDelta,measure.difference);
  g.maxRunnerDelta=Math.max(g.maxRunnerDelta,measure.difference);
  // Preserve the original 30-seed aggregate output byte-for-byte.
  // Additional split observations are collected only when the source plan
  // exposes its fixed replicate index; synthetic legacy tests omit it.
  if(Number.isSafeInteger(plan.rep)){
   if(plan.rep<0||plan.rep>=30)throw Error('Source replicate out of range');
   const half=plan.rep<15?0:1;
   const h=g.split[half];h.n++;
   h.pointSum+=measure.pointOccupancy;
   h.windowSum+=measure.tenMetreWindowOpportunity;
  }
 };
 return {groups,append};
}
function inspectRace(plan,frames,aggregation){
 pilot.checkFrames(frames,plan.fieldSize);
 for(let runner=0;runner<plan.fieldSize;runner++)
  for(const window of WINDOWS){
   const start=plan.course.distance*window.startRate,
    end=plan.course.distance*window.endRate;
   const fragments=old.rankSegments(frames,runner,start,end,
    {validated:true});
   if(fragments.status!=='estimate')
    throw Error('Source subphase 10m runner unresolved: '+
     JSON.stringify({seed:plan.seed,runner,window:window.key,
      status:fragments.status}));
   const independent=dist.histogram(frames,runner,plan.course.distance,
    window.startRate,window.endRate,true);
   if(independent.status!=='estimate')
    throw Error('Source subphase histogram unresolved');
   for(const band of bands){
    const rankProjection=bounds.andProjection(band.predicates,
     plan.fieldSize);
    if(rankProjection.status!=='rank-subcondition-projection'||
     !rankProjection.positions?.length)
     throw Error('Source rank AND projection not verified '+band.id);
    const eligible=new Set(rankProjection.positions);
    const measure=old.measureWindows(fragments.segments,eligible,start,end);
    const direct=independent.rankFractions.reduce((s,x,i)=>
     s+(eligible.has(i+1)?x:0),0);
    if(Math.abs(direct-measure.pointOccupancy)>1e-6)
     throw Error('Subphase occupancy disagrees with independently evaluated histogram '+
      JSON.stringify({seed:plan.seed,runner,window:window.key,
       band:band.id,original:direct,new:measure.pointOccupancy}));
    aggregation.append(plan,window,band,plan.strategies[runner],measure);
   }
  }
}
function report(aggregation,seedsPerCell=30){
 if(!Number.isSafeInteger(seedsPerCell)||seedsPerCell<2||
  seedsPerCell>30||seedsPerCell%2)
  throw Error('Invalid even number of fixed seeds');
 const rows=[...aggregation.groups.values()].map(g=>{
  if(!Number.isSafeInteger(g.observations)||g.observations<seedsPerCell)
   throw Error('Subphase runner population incomplete');
  const p=g.pointSum/g.observations,w=g.windowSum/g.observations;
  if(w+1e-8<p||w>1+1e-8||p<0)
   throw Error('Negative 10m coverage or bad rank proportions');
  return {courseId:g.courseId,fieldSize:g.fieldSize,mode:g.mode,
   windowKey:g.windowKey,bandId:g.bandId,style:g.style,
   runners:g.observations,pointPercent:round(p*100),
   random10mOpportunityPercent:round(w*100),
   upliftPoints:round((w-p)*100),
   minRunnerUpliftPoints:round(g.minRunnerDelta*100),
   maxRunnerUpliftPoints:round(g.maxRunnerDelta*100)};
 }).sort((a,b)=>a.windowKey.localeCompare(b.windowKey)||
  a.bandId.localeCompare(b.bandId)||a.style.localeCompare(b.style)||
  a.courseId-b.courseId||a.fieldSize-b.fieldSize||
  a.mode.localeCompare(b.mode));
 const byWindowBand=[];
 for(const window of WINDOWS)for(const band of bands){
  const styles={};
  for(const style of STYLES){
   const cells=rows.filter(x=>x.windowKey===window.key&&
    x.bandId===band.id&&x.style===style);
   if(cells.length!==24)
    throw Error('Missing 24 balanced contexts '+window.key+'/'+band.id+'/'+style);
   const mean=key=>round(cells.reduce((s,x)=>s+x[key],0)/cells.length);
   styles[style]={pointPercent:mean('pointPercent'),
    random10mOpportunityPercent:mean('random10mOpportunityPercent'),
    upliftPoints:mean('upliftPoints'),
    minContextUpliftPoints:round(Math.min(...cells.map(c=>c.upliftPoints))),
    maxContextUpliftPoints:round(Math.max(...cells.map(c=>c.upliftPoints))),
    contexts:cells.length};
  }
  byWindowBand.push({windowKey:window.key,bandId:band.id,styles});
 }
 if(rows.length!==24*WINDOWS.length*bands.length*STYLES.length||
  byWindowBand.length!==WINDOWS.length*bands.length)
  throw Error('Subphase 10m report incomplete');
 return {schemaVersion:1,
  status:'research-GlobalSim-subphase-random-10m-rank-opportunity-not-game-skill-rate',
  sourceRevision:pilot.PIN,scenario:'balanced',
  seedsPerCell,simulations:24*seedsPerCell,contextsPerWindow:24,
  windows:WINDOWS.map(w=>({...w,startRate:round(w.startRate),
   endRate:round(w.endRate)})),modelWindowMetres:10,modelEndClampMetres:2,
  windowBands:byWindowBand.length,perContextRows:rows.length,
  byWindowBand,contextRows:rows,
  limitations:[
   'An analytically sampled 10m window intersects a rank band somewhere on the skill-free frozen GlobalSim position trajectory; not an activation probability.',
   'The four short windows correspond exactly to source phase_firsthalf_random or phase_laterhalf_random windows, not to whole-phase averages.',
   'Original fractional boundaries are used without rounding to eight decimals before interpolation.',
   'The simulator is an artificial uniform/opponent baseline, not the real race or the game skill checker, and does not validate dirt conditions.',
   'Unknown conditions, OR branch unions, actual triggered frames and skill usefulness remain unmeasured.',
   'No P3/P4 user-facing suitability, new high/medium/low threshold, or card score is defined.'
  ]};
}
function splitReport(aggregation,seedsPerCell=30){
 if(seedsPerCell!==30)throw Error('P2.28 seed stability requires fixed 15+15 of 30');
 const data=[...aggregation.groups.values()].flatMap(g=>g.split.map((h,i)=>{
  if(!h.n||h.n<15||h.n>90)throw Error('Missing fixed-model half-cohort observations');
  const p=h.pointSum/h.n,w=h.windowSum/h.n;
  if(p<0||w<p-1e-8||w>1+1e-8)
   throw Error('Malformed split-half point/window metrics');
  return {courseId:g.courseId,fieldSize:g.fieldSize,mode:g.mode,
   windowKey:g.windowKey,bandId:g.bandId,style:g.style,
   half:i===0?'first15':'last15',
   runners:h.n,pointPercent:round(p*100),
   random10mOpportunityPercent:round(w*100)};
 })).sort((a,b)=>a.windowKey.localeCompare(b.windowKey)||
  a.bandId.localeCompare(b.bandId)||a.style.localeCompare(b.style)||
  a.courseId-b.courseId||a.fieldSize-b.fieldSize||
  a.mode.localeCompare(b.mode)||a.half.localeCompare(b.half));
 if(data.length!==2*24*WINDOWS.length*bands.length*STYLES.length)
  throw Error('Incomplete 4-short-window fixed split report');
 return {schemaVersion:1,status:'p2-fixed-15-plus-15-short-window-bands-not-game-activation',
  sourceRevision:pilot.PIN,scenario:'balanced',seedsPerHalf:15,
  baseRaces:720,perContextRows:data.length,contextRows:data,
  limitations:['Split-half runner observations share a race and are descriptive, not independent inferential samples.',
   'Point occupancy and 10m window opportunity remain separate metrics; no W-minus-uniform comparison.',
   'Same original four source short windows, frozen model seed identities and 11 rank bands.',
   'No source skill activation, scenario weights, production UI, effect utility or suitability grade.']};
}
async function execute(template,engine,{seedsPerCell=30}={}){
 if(!Number.isSafeInteger(seedsPerCell)||seedsPerCell<2||
  seedsPerCell>30||seedsPerCell%2)
  throw Error('Even seeds 2..30 required');
 const plans=expanded.makePlan({seedsPerCell})
  .filter(p=>p.scenario==='balanced');
 if(plans.length!==24*seedsPerCell)throw Error('Missing fixed race plan');
 const sub=collect(),full=old.collect();
 const child=spawn(engine,[],{stdio:['pipe','pipe','pipe']});
 let stderr='';
 child.stderr.setEncoding('utf8');
 child.stderr.on('data',s=>{stderr=(stderr+s).slice(-4000)});
 const done=new Promise(resolve=>child.once('close',
  (code,signal)=>resolve({code,signal})));
 const lines=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
 const write=(async()=>{
  for(const p of plans){
   if(!child.stdin.write(JSON.stringify(expanded.makeRace(template,p))+'\n'))
    await new Promise(resolve=>child.stdin.once('drain',resolve));
  }
  child.stdin.end();
 })();
 let count=0,err=null;
 try{
  for await(const line of lines){
   if(!line.trim())continue;
   if(count>=plans.length)throw Error('Unexpected GlobalSim line');
   const p=plans[count],reply=JSON.parse(line);
   if(reply.error||reply.seed!==undefined&&reply.seed!==p.seed)
    throw Error('Mismatched GlobalSim reply at '+count);
   old.inspectRace(p,reply.frames,full);
   inspectRace(p,reply.frames,sub);
   count++;
  }
  await write;
 }catch(e){err=e;child.kill()}
 const exit=await done;
 if(err)throw err;
 if(exit.code!==0||count!==plans.length)
  throw Error('Incomplete model replay '+JSON.stringify({
   exit,expected:plans.length,count,stderr}));
 return {full:old.report(full,{seedsPerCell}),
  short:report(sub,seedsPerCell),
  split:seedsPerCell===30?splitReport(sub,seedsPerCell):null};
}
async function main([templatePath,engine,fullOutput,shortOutput,seeds,splitOutput]){
 if(!templatePath||!engine||!fullOutput||!shortOutput)
  throw Error('Usage: globalsim_subphase_random_10m.cjs original.jsonl engine full-phase.json short-windows.json [seeds]');
 const text=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(text.length!==1)throw Error('Requires exactly one frozen GlobalSim template');
 const {full,short,split}=await execute(JSON.parse(text[0]),engine,
  {seedsPerCell:Number(seeds||30)});
 fs.writeFileSync(fullOutput,JSON.stringify(full,null,2)+'\n');
 fs.writeFileSync(shortOutput,JSON.stringify(short,null,2)+'\n');
 if(splitOutput){if(!split)throw Error('Fixed 30 source seeds required for split');
  fs.writeFileSync(splitOutput,JSON.stringify(split,null,2)+'\n')}
 console.log(JSON.stringify({races:short.simulations,windows:short.windows,
  windowBands:short.windowBands,perContextRows:short.perContextRows,
  sample:short.byWindowBand.filter(x=>
   x.bandId==='top50'&&['phase_laterhalf_random:0',
    'phase_firsthalf_random:2'].includes(x.windowKey))},null,2));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{
 console.error(e.stack||e);process.exitCode=1});
module.exports={WINDOWS,exactWindow,collect,inspectRace,report,splitReport,execute,main};
