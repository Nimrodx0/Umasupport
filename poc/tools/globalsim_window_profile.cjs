#!/usr/bin/env node
'use strict';
/* P2 research only. Integrates sampled, model-only rank-band occupancy
 * over a SOURCE-DEFINED random phase window by piecewise-linear quadrature.
 * This is NOT the likelihood of activating a skill in the real game, and
 * the report must not be used to change existing style labels. */
const fs=require('node:fs');
const rank=require('../src/skill_rank_timing.js');
const pilot=require('./globalsim_position_pilot.cjs');
const expanded=require('./globalsim_position_expanded.cjs');

const WINDOW_DEFS=Object.freeze([
 {id:'middle-full',condition:'phase_random',phase:1},
 {id:'final-first-half',condition:'phase_firsthalf_random',phase:2},
 {id:'final-full',condition:'phase_random',phase:2},
 {id:'final-later-half',condition:'phase_laterhalf_random',phase:2}
]);
const WINDOWS=Object.freeze(WINDOW_DEFS.map(w=>{
 const evidence=rank.timing({type:w.condition,operator:'==',value:w.phase});
 if(evidence?.status!=='source-defined'||evidence.windows.length!==1||
    !evidence.randomWindow||evidence.courseDependent)
  throw Error('Unsupported phase window '+w.id);
 return {...w,startRate:evidence.windows[0].startRate,
  endRate:evidence.windows[0].endRate};
}));
const EPS=1e-7;
const keyFor=s=>[s.courseId,s.fieldSize,s.scenario,s.mode,s.style].join('|');
function assertSample(s){
 if(!s||!Number.isInteger(s.courseId)||![9,12].includes(s.fieldSize)||
  !(s.scenario in expanded.SOURCES)||!expanded.MODES.includes(s.mode)||
  !expanded.STYLES.includes(s.style))
  throw Error('Invalid sampled model group');
 if(!Number.isFinite(s.fraction)||
  !pilot.POINTS.some(p=>Math.abs(s.fraction-p)<EPS))
  throw Error('Unexpected sampled race progress point');
 for(const name of ['n','unknown','front','back'])
  if(!Number.isSafeInteger(s[name])||s[name]<0)
   throw Error('Invalid sample count '+name);
 if(s.front+s.back!==s.n)throw Error('Rank band counts do not partition valid runners');
 const equal=(a,b)=>a===b||(typeof a==='number'&&typeof b==='number'&&
  Math.abs(a-b)<1e-12);
 if(!equal(s.pTopHalf,s.n?s.front/s.n:null)||
    !equal(s.pBackHalf,s.n?s.back/s.n:null))
  throw Error('Probability and count mismatch');
}
function integrate(points,window){
 const rows=points.filter(s=>s.fraction>=window.startRate-EPS&&
  s.fraction<=window.endRate+EPS).sort((a,b)=>a.fraction-b.fraction);
 const missing=pilot.POINTS.filter(f=>f>=window.startRate-EPS&&
  f<=window.endRate+EPS).filter(f=>!rows.some(s=>Math.abs(s.fraction-f)<EPS));
 if(missing.length||rows.length<2||
  Math.abs(rows[0].fraction-window.startRate)>EPS||
  Math.abs(rows.at(-1).fraction-window.endRate)>EPS)
  return {status:'incomplete-grid',pTopHalf:null,pBackHalf:null,
   sampledPoints:rows.length,missingFractions:missing};
 if(rows.some(s=>s.n===0))
  return {status:'no-valid-ranks',pTopHalf:null,pBackHalf:null,
   sampledPoints:rows.length,missingFractions:[],
   emptyFractions:rows.filter(s=>s.n===0).map(s=>s.fraction)};
 let top=0,back=0;
 for(let i=1;i<rows.length;i++){
  const a=rows[i-1],b=rows[i];
  const dx=b.fraction-a.fraction;
  if(dx<=0)throw Error('Repeated or unordered sample fractions');
  top+=dx*(a.pTopHalf+b.pTopHalf)/2;
  back+=dx*(a.pBackHalf+b.pBackHalf)/2;
 }
 const width=window.endRate-window.startRate;
 if(width<=0)throw Error('Invalid phase interval');
 // Endpoints are derived using 8-digit rounding in skill_rank_timing.
 // Normalize by the actual sampled interval width, not that rounded width.
 const observedWidth=rows.at(-1).fraction-rows[0].fraction;
 if(Math.abs(observedWidth-width)>EPS)throw Error('Phase/source boundary mismatch');
 const pTopHalf=top/observedWidth,pBackHalf=back/observedWidth;
 if(Math.abs(pTopHalf+pBackHalf-1)>1e-9)
  throw Error('Top/back integration must partition the rank space');
 return {status:'estimate',pTopHalf,pBackHalf,
  sampledPoints:rows.length,missingFractions:[],
  minValidRunners:Math.min(...rows.map(s=>s.n)),
  maxValidRunners:Math.max(...rows.map(s=>s.n)),
  unknownRankObservationsByPoint:rows.map(s=>({fraction:s.fraction,
   count:s.unknown}))};
}
function analyze(source){
 if(!source||source.schemaVersion!==2||
  source.sourceRevision!==pilot.PIN||
  source.status!=='experimental-GlobalSim-v77-probabilities-not-actual-skill-rates'||
  !Array.isArray(source.samples)||!source.samples.length)
  throw Error('Expected pinned GlobalSim expanded summary v2');
 const groups=new Map(),unique=new Set();
 for(const s of source.samples){
  assertSample(s);
  const k=keyFor(s),cell=k+'|'+s.fraction.toPrecision(12);
  if(unique.has(cell))throw Error('Duplicate sampled fraction '+cell);
  unique.add(cell);
  if(!groups.has(k))groups.set(k,[]);
  groups.get(k).push(s);
 }
 const windows=[];
 for(const points of groups.values()){
  const p=points[0];
  for(const w of WINDOWS){
   windows.push({courseId:p.courseId,fieldSize:p.fieldSize,
    scenario:p.scenario,mode:p.mode,style:p.style,
    windowId:w.id,timingCode:w.condition,phase:w.phase,
    startRate:w.startRate,endRate:w.endRate,
    rankSplit:'order_rate<=50 / order_rate>50; model round('+p.fieldSize+'*0.5)',
    ...integrate(points,w)});
  }
 }
 windows.sort((a,b)=>a.courseId-b.courseId||a.fieldSize-b.fieldSize||
  a.scenario.localeCompare(b.scenario)||a.mode.localeCompare(b.mode)||
  a.style.localeCompare(b.style)||a.startRate-b.startRate||
  a.endRate-b.endRate||a.windowId.localeCompare(b.windowId));
 return {schemaVersion:1,status:'model-window-rank-occupancy-estimate-not-skill-activation-rate',
  sourceRevision:pilot.PIN,sourceSummarySchema:source.schemaVersion,
  sourceRaceCount:source.raceCount,sourceSeedCount:source.seedCount,
  method:'trapezoidal-integration-of-nine-sampled-position-proportions',
  assumptions:[
   'Conditional on a hypothetical uniformly selected location within each source-defined random phase window.',
   'Rank of each runner is measured at the time that runner crosses its own selected location.',
   'Piecewise-linear interpolation between sparse sampled locations; not an exact integration of full replay frames.',
   'Does not include other activation restrictions, position lottery, skill triggers, or skill effects.',
   'Observed-prior cohort percentages are scenario sensitivities, not a population-wide mean.',
   'Does not authorize changing production P2 style labels or infer current JP-game activation rates.'
  ],windows};
}
function main(){
 const [input,output]=process.argv.slice(2);
 if(!input||!output)throw Error('Usage: globalsim_window_profile.cjs expanded-summary.json window-profile.json');
 const report=analyze(JSON.parse(fs.readFileSync(input,'utf8')));
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({windows:report.windows.length,
  estimated:report.windows.filter(x=>x.status==='estimate').length,
  unresolved:report.windows.filter(x=>x.status!=='estimate').length}));
}
if(require.main===module){
 try{main();}catch(e){console.error(e);process.exitCode=1;}
}
module.exports={WINDOWS,integrate,analyze,assertSample};
