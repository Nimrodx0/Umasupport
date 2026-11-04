#!/usr/bin/env node
'use strict';
/* Isolated GlobalSim v77 position pilot. Results are MODEL ESTIMATES, not JP
 * race truths; never feed them into the production suitability classifier. */
const fs=require('node:fs');
const PATHS={balanced:[2,2,3,2],frontHeavy:[3,3,2,1],
 backHeavy:[1,2,3,3],noFront:[0,3,3,3]};
const STYLES=['Nige','Senkou','Sasi','Oikomi'];
const POINTS=[1/6,1/3,1/2,2/3,0.7,0.75,0.8,5/6,0.9];
const PIN='80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1';
function threshold(n,pct){
 if(!Number.isInteger(n)||n<2||!Number.isFinite(pct))
  throw Error('Invalid rank threshold');
 // Matches GlobalSim's source-side round(n * rate/100) for these baseline
 // tests. Not an independent guarantee of current JP game semantics.
 return Math.floor(n*pct/100+0.5);
}
function create(template,{seedsPerScenario=6}={}){
 if(template.courseId!==10504||!template.skillData||
  !Array.isArray(template.horses)||template.horses.length!==9)
  throw Error('Need fixed v77 example with nine runners and skillData');
 if(!Number.isInteger(seedsPerScenario)||seedsPerScenario<1||seedsPerScenario>200)
  throw Error('Pilot seed count must be 1..200');
 const rows=[];
 for(const [scenario,counts] of Object.entries(PATHS)){
  const styles=counts.flatMap((count,i)=>Array(count).fill(STYLES[i]));
  if(styles.length!==9)throw Error('Invalid nine-runner scenario');
  for(let j=0;j<seedsPerScenario;j++){
   const horses=template.horses.map((h,gateIndex)=>({
    ...h,strategy:styles[(gateIndex+j)%9],gateIndex,skills:[]}));
   const seed=450000+rows.length;
   rows.push({scenario,seed,race:{...template,seed,retainAllFrames:true,horses},
    horses:horses.map(h=>({strategy:h.strategy,gateIndex:h.gateIndex}))});
  }
 }
 return rows;
}
function crossing(frames,runner,metres){
 for(let k=1;k<frames.length;k++){
  const a=frames[k-1],b=frames[k];
  const x=a.horses[runner][0],y=b.horses[runner][0];
  if(y<metres||x>metres||y<=x)continue;
  const t=(metres-x)/(y-x);
  const positions=a.horses.map((row,i)=>row[0]+t*(b.horses[i][0]-row[0]));
  const here=positions[runner];
  if(positions.some((z,i)=>i!==runner&&Math.abs(z-here)<1e-5))return null;
  return 1+positions.filter((z,i)=>i!==runner&&z>here).length;
 }
 return null;
}
function checkFrames(frames,n){
 if(!Array.isArray(frames)||frames.length<2)throw Error('Missing dense replay frames');
 let last=-Infinity;
 for(const f of frames){
  if(!Number.isFinite(f.t)||f.t<=last||!Array.isArray(f.horses)||f.horses.length!==n)
   throw Error('Malformed replay frame');
  if(f.horses.some(h=>!Array.isArray(h)||!Number.isFinite(h[0])))
   throw Error('Missing runner position');
  last=f.t;
 }
}
function analyze(manifest,replies){
 if(manifest.sourceRevision!==PIN||manifest.courseId!==10504||
  manifest.courseDistance!==2000||!Array.isArray(manifest.trials))
  throw Error('Pilot manifest drift');
 if(replies.length!==manifest.trials.length)throw Error('Reply count mismatch');
 const groups=new Map();
 for(const [k,reply] of replies.entries()){
  const trial=manifest.trials[k],n=trial.horses.length;
  if(reply.error)throw Error('Engine failed for seed '+trial.seed);
  if(reply.seed!==undefined&&reply.seed!==trial.seed)throw Error('Wrong seed');
  checkFrames(reply.frames,n);
  for(const [runner,h] of trial.horses.entries()){
   if(!STYLES.includes(h.strategy))throw Error('Unknown running style');
   for(const fraction of POINTS){
    // Each runner's own course fraction is sampled at its crossing time;
    // every other horse is compared at that same absolute instant.
    const rank=crossing(reply.frames,runner,manifest.courseDistance*fraction);
    const key=trial.scenario+'|'+h.strategy+'|'+fraction;
    if(!groups.has(key))groups.set(key,{scenario:trial.scenario,
     style:h.strategy,fraction,valid:0,unknown:0,topHalf:0,backHalf:0});
    const g=groups.get(key);
    if(rank===null){g.unknown++;continue;}
    g.valid++;
    g.topHalf+=Number(rank<=threshold(n,50));
    g.backHalf+=Number(rank>threshold(n,50));
   }
  }
 }
 return {status:'simulator-estimate-not-JP-game-activation-rate',
  schemaVersion:1,sourceRevision:PIN,courseId:manifest.courseId,
  courseDistance:2000,fieldSize:9,trialCount:manifest.trials.length,
  samples:[...groups.values()].map(g=>({...g,
   pTopHalf:g.valid?g.topHalf/g.valid:null,
   pBackHalf:g.valid?g.backHalf/g.valid:null}))
   .sort((a,b)=>a.scenario.localeCompare(b.scenario)||
    a.fraction-b.fraction||STYLES.indexOf(a.style)-STYLES.indexOf(b.style))};
}
function prepare(templateFile,requests,manifestFile,seedsPerScenario){
 const contents=fs.readFileSync(templateFile,'utf8').trim().split(/\r?\n/);
 if(contents.length!==1)throw Error('Expected one frozen v77 JSONL example');
 const rows=create(JSON.parse(contents[0]),{seedsPerScenario});
 fs.writeFileSync(requests,rows.map(x=>JSON.stringify(x.race)).join('\n')+'\n');
 fs.writeFileSync(manifestFile,JSON.stringify({sourceRevision:PIN,courseId:10504,
  courseDistance:2000,trials:rows.map(({scenario,seed,horses})=>
   ({scenario,seed,horses}))},null,2)+'\n');
 return rows.length;
}
function finish(manifestFile,replyFile,reportFile){
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 const replies=fs.readFileSync(replyFile,'utf8').trim().split(/\r?\n/).map(JSON.parse);
 const report=analyze(manifest,replies);
 fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
 return report;
}
if(require.main===module){
 const [cmd,...args]=process.argv.slice(2);
 if(cmd==='prepare')console.log('Prepared '+prepare(...args.slice(0,3),Number(args[3]||6))+' races');
 else if(cmd==='finish')console.log('Report rows '+finish(...args).samples.length);
 else throw Error('Usage: prepare pinned-example requests.jsonl manifest.json [seeds] | finish manifest.json replies.jsonl report.json');
}
module.exports={threshold,create,crossing,checkFrames,analyze,prepare,finish,POINTS,PIN};
