#!/usr/bin/env node
'use strict';
/* Controlled position tendency experiment. Only seeded GlobalSim v77 model
 * trajectories; neither official game positions nor skill activation chances. */
const fs=require('node:fs');
const readline=require('node:readline');
const {spawn}=require('node:child_process');
const expanded=require('./globalsim_position_expanded.cjs');
const rankDist=require('./globalsim_rank_distribution.cjs');
const pilot=require('./globalsim_position_pilot.cjs');
const SCENARIOS=['balanced','noFront'];
const PAIRS=[
 {id:'1600m-course-geometry',a:10502,b:10304},
 {id:'2000m-course-geometry',a:10504,b:10604},
 {id:'1200m-vs-1600m',a:10501,b:10502},
 {id:'1600m-vs-2000m',a:10502,b:10504},
 {id:'2000m-vs-2500m',a:10504,b:10506}
];
const BANDS=[20,30,40,50,60,70,80];
const round=x=>Number(x.toFixed(6));
const key=(row,fields)=>fields.map(f=>String(row[f])).join('|');
const fields=['courseId','fieldSize','scenario','mode','rep','phase','style'];
function plans(seedsPerCell=30){
 if(!Number.isSafeInteger(seedsPerCell)||seedsPerCell<2||seedsPerCell>60)
  throw Error('Experiment requires 2..60 matched seeds per condition');
 const raw=expanded.makePlan({seedsPerCell})
  .filter(x=>SCENARIOS.includes(x.scenario));
 const paired=raw.map(p=>({...p,
  // The same seed and horse order/stats for every course in a stratum.
  seed:expanded.seedFor(10504,p.fieldSize,p.scenario,p.rep)}));
 const reference=new Map();
 for(const p of paired){
  if(p.scenario==='noFront'&&p.counts[0]!==0)
   throw Error('No-front control contained Nige');
  const id=key(p,['fieldSize','scenario','mode','rep']);
  if(!reference.has(id))reference.set(id,p);
  else{
   const other=reference.get(id);
   if(other.seed!==p.seed||
    JSON.stringify(other.strategies)!==JSON.stringify(p.strategies)||
    JSON.stringify(other.counts)!==JSON.stringify(p.counts))
    throw Error('Matched course plans differ in roster or seed '+id);
  }
 }
 return paired;
}
function perRace(rows,observations,thresholds=BANDS){
 if(!Array.isArray(rows)||!rows.length||
  !Array.isArray(observations))throw Error('Missing matched races');
 const plansByKey=new Map();
 for(const plan of rows){
  const k=key({courseId:plan.course.id,...plan},
   ['courseId','fieldSize','scenario','mode','rep']);
  if(plansByKey.has(k))throw Error('Duplicate course/seed plan');
  plansByKey.set(k,plan);
 }
 const expected=rows.reduce((n,p)=>n+p.fieldSize*rankDist.PHASES.length,0);
 if(observations.length!==expected)throw Error('Incomplete observations');
 const raceCells=new Map(),seen=new Set();
 for(const obs of observations){
  const id=key(obs,['courseId','fieldSize','scenario','mode','rep','runnerIndex','phase']);
  if(seen.has(id))throw Error('Duplicate runner observation');
  seen.add(id);
  const p=plansByKey.get(key(obs,['courseId','fieldSize','scenario','mode','rep']));
  if(!p||!rankDist.PHASES.some(x=>x.phase===obs.phase)||
   !Number.isInteger(obs.runnerIndex)||obs.runnerIndex<0||
   obs.runnerIndex>=p.fieldSize||p.seed!==obs.seed||
   p.strategies[obs.runnerIndex]!==obs.style)
   throw Error('Observation does not match controlled source plan');
  const gk=key(obs,fields);
  if(!raceCells.has(gk))raceCells.set(gk,{courseId:obs.courseId,
   fieldSize:obs.fieldSize,scenario:obs.scenario,mode:obs.mode,
   rep:obs.rep,phase:obs.phase,style:obs.style,runners:0,
   invalid:0,sums:Array(p.fieldSize).fill(0)});
  const cell=raceCells.get(gk);
  cell.runners++;
  if(obs.status==='estimate'){
   if(!Array.isArray(obs.rankFractions)||
    obs.rankFractions.length!==p.fieldSize||
    obs.rankFractions.some(v=>!Number.isFinite(v)||v<0||v>1)||
    Math.abs(obs.rankFractions.reduce((a,b)=>a+b,0)-1)>1e-6)
    throw Error('Invalid rank occupation fraction');
   for(let i=0;i<cell.sums.length;i++)
    cell.sums[i]+=obs.rankFractions[i];
  }else if(['ambiguous-ties','incomplete-replay'].includes(obs.status)&&
   obs.rankFractions===null)cell.invalid++;
  else throw Error('Unsupported runner state');
 }
 const output=[];
 for(const cell of raceCells.values()){
  for(const cut of thresholds){
   const cutoff=pilot.threshold(cell.fieldSize,cut);
   const valid=cell.runners>0&&cell.invalid===0;
   output.push({...cell,cutoffPercent:cut,rankCutoff:cutoff,
    fraction:valid?cell.sums.slice(0,cutoff).reduce((a,b)=>a+b,0)/cell.runners:null,
    status:!cell.runners?'no-runner':cell.invalid?
     'held-unresolved':'estimate'});
  }
 }
 return output;
}
const mean=a=>a.length?a.reduce((sum,x)=>sum+x,0)/a.length:null;
function compare(rows,observations,{thresholds=BANDS,strict=false}={}){
 const samples=perRace(rows,observations,thresholds);
 const cohorts=new Map();
 for(const r of samples){
  const k=key(r,['courseId','fieldSize','scenario','mode','phase','cutoffPercent']);
  if(!cohorts.has(k))cohorts.set(k,{courseId:r.courseId,
   fieldSize:r.fieldSize,scenario:r.scenario,mode:r.mode,phase:r.phase,
   cutoffPercent:r.cutoffPercent,styles:new Map()});
  const c=cohorts.get(k);
  if(!c.styles.has(r.style))c.styles.set(r.style,[]);
  c.styles.get(r.style).push(r);
 }
 const comparisons=[];
 const statsFor=(style,items)=>{
  const nonzero=items.filter(x=>x.status==='estimate');
  const total=nonzero.reduce((sum,x)=>sum+x.runners,0);
  const val=total?nonzero.reduce((sum,x)=>sum+x.fraction*x.runners,0)/total:null;
  const half=Math.floor(rows.filter(p=>p.course.id===items[0]?.courseId&&
   p.fieldSize===items[0]?.fieldSize&&p.scenario===items[0]?.scenario&&
   p.mode===items[0]?.mode).length/2);
  const batch=n=>nonzero.filter(x=>n==='first'?x.rep<half:x.rep>=half);
  const weighted=arr=>{
   const d=arr.reduce((n,x)=>n+x.runners,0);
   return d?arr.reduce((s,x)=>s+x.fraction*x.runners,0)/d:null;
  };
  return {style,observedRaces:nonzero.length,runners:total,
   heldRaces:items.filter(x=>x.status==='held-unresolved').length,
   percent:val===null?null:round(val*100),
   firstHalfPercent:weighted(batch('first'))===null?null:round(weighted(batch('first'))*100),
   lastHalfPercent:weighted(batch('last'))===null?null:round(weighted(batch('last'))*100)};
 };
 for(const c of cohorts.values()){
  const styles=Object.fromEntries(expanded.STYLES.map(style=>[
   style,statsFor(style,c.styles.get(style)||[])]));
  const required=c.scenario==='noFront'?
   ['Senkou','Sasi','Oikomi']:expanded.STYLES;
  const ready=required.every(style=>styles[style].percent!==null&&
   styles[style].heldRaces===0);
  const front=['Nige','Senkou'].filter(s=>required.includes(s));
  const gap=ready?Math.min(...front.map(x=>styles[x].percent))-
    Math.max(styles.Sasi.percent,styles.Oikomi.percent):null;
  comparisons.push({courseId:c.courseId,fieldSize:c.fieldSize,
   scenario:c.scenario,mode:c.mode,phase:c.phase,
   cutoffPercent:c.cutoffPercent,styleStats:styles,
   status:ready?'comparable':'held-incomplete',
   frontMinusRearPoints:gap===null?null:round(gap),
   direction:gap===null?'unresolved':gap>1e-8?'front-ahead':
    gap< -1e-8?'rear-counterexample':'tie'});
 }
 const index=new Map(samples.map(s=>[key(s,fields.concat('cutoffPercent')),s]));
 const paired=[];
 for(const pair of PAIRS){
  for(const fieldSize of [9,12])for(const scenario of SCENARIOS)
   for(const mode of expanded.MODES)for(const phase of rankDist.PHASES)
    for(const cut of thresholds)for(const style of expanded.STYLES){
     if(scenario==='noFront'&&style==='Nige')continue;
     const plan=rows.filter(p=>p.course.id===pair.a&&
      p.fieldSize===fieldSize&&p.scenario===scenario&&p.mode===mode);
     const diffs=[],half=[];
     for(const p of plan){
      const shared={fieldSize,scenario,mode,rep:p.rep,phase:phase.phase,
       style,cutoffPercent:cut};
      const a=index.get(key({courseId:pair.a,...shared},fields.concat('cutoffPercent'))),
       b=index.get(key({courseId:pair.b,...shared},fields.concat('cutoffPercent')));
      if(a?.status==='estimate'&&b?.status==='estimate'&&
       a.runners===b.runners&&a.runners>0){
       const diff=100*(a.fraction-b.fraction);
       diffs.push(diff);
       half.push({rep:p.rep,diff});
      }
     }
     paired.push({comparison:pair.id,courseA:pair.a,courseB:pair.b,
      fieldSize,scenario,mode,phase:phase.phase,cutoffPercent:cut,style,
      pairedRaces:diffs.length,meanAminusBPoints:diffs.length?
       round(mean(diffs)):null,
      firstHalfPoints:half.some(x=>x.rep<plan.length/2)?
       round(mean(half.filter(x=>x.rep<plan.length/2).map(x=>x.diff))):null,
      lastHalfPoints:half.some(x=>x.rep>=plan.length/2)?
       round(mean(half.filter(x=>x.rep>=plan.length/2).map(x=>x.diff))):null});
    }
 }
 const byPhaseCutoff=[];
 for(const phase of rankDist.PHASES)for(const cut of thresholds){
  const x=comparisons.filter(q=>q.phase===phase.phase&&q.cutoffPercent===cut);
  byPhaseCutoff.push({phase:phase.phase,phaseName:phase.phaseName,cutoffPercent:cut,
   contexts:x.length,comparable:x.filter(y=>y.status==='comparable').length,
   frontAhead:x.filter(y=>y.direction==='front-ahead').length,
   rearCounterexample:x.filter(y=>y.direction==='rear-counterexample').length,
   ties:x.filter(y=>y.direction==='tie').length,
   unresolved:x.filter(y=>y.direction==='unresolved').length,
   minGapPoints:x.filter(y=>y.frontMinusRearPoints!==null).length?
    Math.min(...x.filter(y=>y.frontMinusRearPoints!==null)
     .map(y=>y.frontMinusRearPoints)):null});
 }
 const lowCoverage=comparisons.filter(c=>c.status==='comparable'&&
  Object.values(c.styleStats).some(s=>s.runners>0&&s.runners<30));
 const worst=comparisons.filter(x=>x.direction==='rear-counterexample')
  .sort((a,b)=>a.frontMinusRearPoints-b.frontMinusRearPoints);
 if(strict){
  const expected=6*2*SCENARIOS.length*expanded.MODES.length*
   rankDist.PHASES.length*thresholds.length;
  if(comparisons.length!==expected)
   throw Error('Incomplete fixed-course comparisons '+comparisons.length+'/'+expected);
 }
 return {schemaVersion:1,status:'pinned-GlobalSim-controlled-roster-paired-course-not-real-game',
  sourceRevision:pilot.PIN,seedCount:new Set(rows.map(x=>x.rep)).size,
  raceCount:rows.length,thresholds,rosterTypes:SCENARIOS,
  byPhaseCutoff,counts:{contextComparisons:comparisons.length,
   rearCounterexamples:worst.length,
   lowRunnerCoverage:lowCoverage.length,
   matchedCourseDifferences:paired.length,
   held:comparisons.filter(x=>x.status!=='comparable').length},
  worstReverseCases:worst.slice(0,25),pairedCourseContrasts:paired,
  modelComparisons:comparisons,
  limitations:[
   'Same seeded setup/rosters per course, but different course dynamics need not consume identical RNG draws.',
   'Same-distance track differences are paired in seed and horse initial stats; track geometry and other encoded course data may vary.',
   'Different-distance contrasts also change course shape; no pure distance causal effect is identified.',
   'Only fixed balanced and no-front rosters; no representative real match composition.',
   'Within-race runners and four phase observations are correlated.',
   'Paired seed counts are descriptive; estimates are not Japanese-game activation rates.',
   'No automatic change to skill style labels, support cards, or live UI.'
  ]};
}
async function execute(template,enginePath,{seedsPerCell=30}={}){
 const rows=plans(seedsPerCell),obs=[];
 const child=spawn(enginePath,[],{stdio:['pipe','pipe','pipe']});
 let stderr='';
 child.stderr.setEncoding('utf8');
 child.stderr.on('data',x=>{stderr=(stderr+x).slice(-3000)});
 const done=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
 const input=(async()=>{
  for(const p of rows){
   const line=JSON.stringify(expanded.makeRace(template,p))+'\n';
   if(!child.stdin.write(line))await new Promise(resolve=>child.stdin.once('drain',resolve));
  }
  child.stdin.end();
 })();
 const lines=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
 let seen=0,error=null;
 try{
  for await(const text of lines){
   if(!text.trim())continue;
   if(seen>=rows.length)throw Error('Extra simulated race');
   const p=rows[seen],reply=JSON.parse(text);
   if(reply?.error||reply?.seed!==undefined&&reply.seed!==p.seed)
    throw Error('Wrong simulator reply seed '+p.seed);
   pilot.checkFrames(reply.frames,p.fieldSize);
   for(let runnerIndex=0;runnerIndex<p.fieldSize;runnerIndex++)
    for(const phase of rankDist.PHASES){
     const result=rankDist.histogram(reply.frames,runnerIndex,p.course.distance,
      phase.startRate,phase.endRate,true);
     obs.push({courseId:p.course.id,fieldSize:p.fieldSize,
      scenario:p.scenario,mode:p.mode,rep:p.rep,seed:p.seed,
      runnerIndex,style:p.strategies[runnerIndex],phase:phase.phase,
      status:result.status,rankFractions:result.rankFractions});
    }
   seen++;
  }
  await input;
 }catch(e){error=e;child.kill()}
 const exit=await done;
 if(error)throw error;
 if(exit.code!==0||seen!==rows.length)throw Error('Missing simulator results '+
  JSON.stringify({seen,expected:rows.length,exit,stderr}));
 rankDist.analyze(rows,obs,BANDS); // Independent source identity, rank-bin and population checks.
 return compare(rows,obs,{strict:true});
}
async function main(args){
 const [templatePath,enginePath,outputPath,count]=args;
 if(!templatePath||!enginePath||!outputPath)
  throw Error('Usage: globalsim_paired_rank_controls.cjs template.jsonl engine output.json [seedCount]');
 const raw=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(raw.length!==1)throw Error('Expected pinned GlobalSim v77 template');
 const out=await execute(JSON.parse(raw[0]),enginePath,
  {seedsPerCell:Number(count||30)});
 fs.writeFileSync(outputPath,JSON.stringify(out,null,2)+'\n');
 console.log(JSON.stringify({races:out.raceCount,counts:out.counts,
  byPhaseCutoff:out.byPhaseCutoff.filter(x=>[20,50,80].includes(x.cutoffPercent)),
  worst:out.worstReverseCases.slice(0,5).map(x=>({
   courseId:x.courseId,fieldSize:x.fieldSize,scenario:x.scenario,
   mode:x.mode,phase:x.phase,cut:x.cutoffPercent,
   gap:x.frontMinusRearPoints}))},null,2));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{
 console.error(e);process.exitCode=1});
module.exports={SCENARIOS,PAIRS,BANDS,plans,perRace,compare,execute};
