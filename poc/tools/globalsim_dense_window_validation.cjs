#!/usr/bin/env node
'use strict';
/* P2 standalone reproducibility experiment; NEVER a game activation-rate estimate.
 * Reference: integrate runner rank across dense replay frame segments, splitting
 * segments at every linearized overtake. This remains FRAME-LINEAR, not an
 * official continuously-sampled game trajectory. Never ship raw frames. */
const fs=require('node:fs');
const readline=require('node:readline');
const {spawn}=require('node:child_process');
const pilot=require('./globalsim_position_pilot.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const windowProfile=require('./globalsim_window_profile.cjs');

const COURSE_IDS=[10501,10504,10506];
const SCENARIOS=['balanced','jan2026'];
const EPS=1e-9;
const position=h=>Array.isArray(h)?h[0]:h?.pos;
const identity=(plan,style,windowId)=>[
 plan.course.id,plan.fieldSize,plan.scenario,plan.mode,style,windowId].join('|');
const clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
function integrateDense(frames,runner,distance,startRate,endRate,validatedFrames=false){
 const n=frames?.[0]?.horses?.length;
 if(!Number.isInteger(n)||n<2||!Number.isInteger(runner)||
  runner<0||runner>=n||!Number.isFinite(distance)||distance<=0||
  !Number.isFinite(startRate)||!Number.isFinite(endRate)||
  startRate<0||endRate>1||endRate<=startRate)
  throw Error('Invalid dense window arguments');
 if(!validatedFrames)pilot.checkFrames(frames,n);
 const start=distance*startRate,end=distance*endRate,width=end-start;
 let front=0,back=0,unknown=0;
 for(let k=1;k<frames.length;k++){
  const prev=frames[k-1].horses,now=frames[k].horses;
  const a=position(prev[runner]),b=position(now[runner]),speed=b-a;
  if(speed< -EPS)throw Error('Runner position moved backwards');
  if(speed<=EPS||b<start-EPS||a>end+EPS)continue;
  const lo=clamp((start-a)/speed,0,1),hi=clamp((end-a)/speed,0,1);
  if(hi<=lo+1e-12)continue;
  const cuts=[lo,hi];
  for(let j=0;j<n;j++){
   if(j===runner)continue;
   const d0=position(prev[j])-a,d1=position(now[j])-b;
   const change=d1-d0;
   if(Math.abs(change)<=1e-14)continue;
   const cross=-d0/change;
   if(cross>lo+1e-12&&cross<hi-1e-12)cuts.push(cross);
  }
  cuts.sort((x,y)=>x-y);
  for(let j=1;j<cuts.length;j++){
   const u0=cuts[j-1],u1=cuts[j],span=(u1-u0)*speed;
   if(span<=1e-12)continue;
   const mid=(u0+u1)/2,here=a+speed*mid;
   let ahead=0,ambiguous=false;
   for(let opponent=0;opponent<n;opponent++){
    if(opponent===runner)continue;
    const x=position(prev[opponent]),y=position(now[opponent]);
    const other=x+(y-x)*mid;
    if(Math.abs(other-here)<=1e-8){ambiguous=true;break;}
    if(other>here)ahead++;
   }
   if(ambiguous)unknown+=span;
   else if(1+ahead<=pilot.threshold(n,50))front+=span;
   else back+=span;
  }
 }
 const known=front+back,observed=known+unknown;
 if(Math.abs(observed-width)>1e-4)
  return {status:'incomplete-replay',pTopHalf:null,pBackHalf:null,
   observedDistance:observed,expectedDistance:width,unknownDistance:unknown};
 if(unknown>1e-5)
  return {status:'ambiguous-ties',pTopHalf:null,pBackHalf:null,
   observedDistance:observed,expectedDistance:width,unknownDistance:unknown};
 const pTopHalf=front/width,pBackHalf=back/width;
 if(Math.abs(pTopHalf+pBackHalf-1)>1e-5)
  throw Error('Dense integral does not partition the window');
 return {status:'estimate',pTopHalf,pBackHalf,
  observedDistance:observed,expectedDistance:width,unknownDistance:unknown};
}
function plansFor(seedsPerCell){
 if(!Number.isInteger(seedsPerCell)||seedsPerCell<1||seedsPerCell>20)
  throw Error('seedsPerCell must be 1..20');
 return expanded.makePlan({seedsPerCell}).filter(p=>
  COURSE_IDS.includes(p.course.id)&&SCENARIOS.includes(p.scenario));
}
function analyzeReply(plan,reply,coarse,dense,onRunnerWindow){
 if(reply?.error)throw Error('GlobalSim reported an error for '+plan.seed);
 if(reply?.seed!==undefined&&reply.seed!==plan.seed)
  throw Error('Wrong simulator seed');
 pilot.checkFrames(reply?.frames,plan.fieldSize);
 expanded.observe(coarse,plan,reply);
 for(let runner=0;runner<plan.fieldSize;runner++){
  const style=plan.strategies[runner];
  for(const win of windowProfile.WINDOWS){
   const k=identity(plan,style,win.id);
   if(!dense.has(k))dense.set(k,{courseId:plan.course.id,
    fieldSize:plan.fieldSize,scenario:plan.scenario,mode:plan.mode,
    style,windowId:win.id,valid:0,unknown:0,sumTop:0,sumBack:0,
    statusReasons:{}});
   const group=dense.get(k),result=integrateDense(reply.frames,runner,
    plan.course.distance,win.startRate,win.endRate,true);
   if(onRunnerWindow)onRunnerWindow({courseId:plan.course.id,
    fieldSize:plan.fieldSize,scenario:plan.scenario,mode:plan.mode,
    rep:plan.rep,seed:plan.seed,runnerIndex:runner,
    style,windowId:win.id,status:result.status,
    pTopHalf:result.status==='estimate'?result.pTopHalf:null});
   if(result.status==='estimate'){
    group.valid++;group.sumTop+=result.pTopHalf;group.sumBack+=result.pBackHalf;
   }else{
    group.unknown++;
    group.statusReasons[result.status]=(group.statusReasons[result.status]||0)+1;
   }
  }
 }
}
function reportFrom(plans,coarse,dense,seedsPerCell){
 const samples=[...coarse.values()].map(g=>({...g,
  pTopHalf:g.n?g.front/g.n:null,pBackHalf:g.n?g.back/g.n:null,
  meanRank:g.n?g.rankSum/g.n:null}));
 const report=windowProfile.analyze({schemaVersion:2,sourceRevision:pilot.PIN,
  status:'experimental-GlobalSim-v77-probabilities-not-actual-skill-rates',
  raceCount:plans.length,seedCount:seedsPerCell,samples});
 const pairs=report.windows.map(w=>{
  const k=[w.courseId,w.fieldSize,w.scenario,w.mode,w.style,w.windowId].join('|');
  const d=dense.get(k);
  if(!d)throw Error('Missing direct-frame comparison group '+k);
  const eligible=w.status==='estimate'&&d.valid>0&&d.unknown===0&&
   w.minValidRunners===d.valid&&w.maxValidRunners===d.valid;
  const direct=eligible?d.sumTop/d.valid:null;
  return {courseId:w.courseId,fieldSize:w.fieldSize,scenario:w.scenario,
   mode:w.mode,style:w.style,windowId:w.windowId,
   coarseStatus:w.status,frameValidRunners:d.valid,
   frameUnknownRunners:d.unknown,unknownReasons:d.statusReasons,
   coarseMinValidRunners:w.minValidRunners??null,
   coarseMaxValidRunners:w.maxValidRunners??null,
   coarseTopPercent:w.pTopHalf===null?null:Number((w.pTopHalf*100).toFixed(6)),
   denseFrameTopPercent:direct===null?null:Number((direct*100).toFixed(6)),
   differencePercentagePoints:eligible?
    Number(((direct-w.pTopHalf)*100).toFixed(6)):null,
   status:eligible?'comparable':'insufficient-comparable-runners'};
 }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
 const ready=pairs.filter(p=>p.status==='comparable');
 const absolute=ready.map(p=>Math.abs(p.differencePercentagePoints)).sort((a,b)=>a-b);
 const groups=[...new Set(pairs.map(p=>[
  p.courseId,p.fieldSize,p.scenario,p.mode].join('|')))].length;
 return {schemaVersion:1,
  status:'frame-linear-vs-sparse-position-window-model-validation-only',
  sourceRevision:pilot.PIN,raceCount:plans.length,seedCount:seedsPerCell,
  courseIds:COURSE_IDS,scenarios:SCENARIOS,modes:expanded.MODES,
  comparedModelCells:groups,
  counts:{windowCells:pairs.length,comparable:ready.length,
   withheld:pairs.length-ready.length},
  absoluteErrorPercentagePoints:ready.length?{
   median:absolute[Math.floor(absolute.length/2)],maximum:absolute.at(-1),
   mean:Number((absolute.reduce((a,b)=>a+b,0)/absolute.length).toFixed(6))
  }:null,
  limitations:[
   'Dense reference assumes linear motion between recorded simulator frames.',
   'Runner positions/relative overtakes are integrated over each own-distance window.',
   'A tie over a nonzero distance or incomplete replay excludes a runner, rather than treating it as a probability zero.',
   'Comparison excludes any group with unresolved runners to avoid different populations.',
   'Multiple course/style/seed cells are not independent real race observations.',
   'GlobalSim v77 model positions are not verified Japanese-game skill activation probabilities.',
   'No production label, P2 threshold, skill effects, card scores or UI changes.'
  ],pairs};
}
async function execute(template,enginePath,{seedsPerCell=3,onRunnerWindow}={}){
 const plans=plansFor(seedsPerCell),coarse=new Map(),dense=new Map();
 if(!plans.length)throw Error('No dense validation race plans');
 const child=spawn(enginePath,[],{stdio:['pipe','pipe','pipe']});
 let stderr='';
 child.stderr.setEncoding('utf8');
 child.stderr.on('data',s=>{stderr=(stderr+s).slice(-3000)});
 const closed=new Promise(resolve=>child.once('close',
  (code,signal)=>resolve({code,signal})));
 const lines=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
 const input=(async()=>{
  for(const plan of plans){
   const line=JSON.stringify(expanded.makeRace(template,plan))+'\n';
   if(!child.stdin.write(line))await new Promise(resolve=>child.stdin.once('drain',resolve));
  }
  child.stdin.end();
 })();
 let n=0,error=null;
 try{
  for await(const line of lines){
   if(!line.trim())continue;
   if(n>=plans.length)throw Error('Unexpected extra GlobalSim response');
   analyzeReply(plans[n],JSON.parse(line),coarse,dense,onRunnerWindow);n++;
  }
  await input;
 }catch(e){error=e;child.kill()}
 const exit=await closed;
 if(error)throw error;
 if(exit.code!==0||n!==plans.length)
  throw Error('GlobalSim dense replay failure '+JSON.stringify({
   code:exit.code,n,expected:plans.length,stderr}));
 return reportFrom(plans,coarse,dense,seedsPerCell);
}
async function main(){
 const [templatePath,enginePath,reportPath,count]=process.argv.slice(2);
 if(!templatePath||!enginePath||!reportPath)
  throw Error('Usage: globalsim_dense_window_validation.cjs source.jsonl engine output.json [seedsPerCell]');
 const lines=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(lines.length!==1)throw Error('Expected pinned v77-race.jsonl');
 const result=await execute(JSON.parse(lines[0]),enginePath,
  {seedsPerCell:Number(count||3)});
 fs.writeFileSync(reportPath,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({races:result.raceCount,
  counts:result.counts,error:result.absoluteErrorPercentagePoints}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={integrateDense,plansFor,analyzeReply,reportFrom,execute};
