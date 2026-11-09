#!/usr/bin/env node
'use strict';
/* Research-only replay of the exact 1,440 fixed balanced v77 races.
 * Three independent aggregation dictionaries: 30 seeds, first 15, last 15.
 * Reuse the P2 exact source rank/time/surface/distance and 10m window geometry.
 * The 30-seed derived JSON must hash identically to PR #370 source evidence.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const readline=require('node:readline');
const source=require('./globalsim_roster32.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const EXPECTED_BALANCED_SHA='63a6e44656684bf94cebe4dba7c2118a1c9668e8d4623c02321876949ec2a6b2';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const json=o=>JSON.stringify(o,null,2)+'\n';
function validateHalfReconciliation(full,first,second){
 const expected=full.contextRows.length;
 if(full.schemaVersion!==2||full.scenario!=='balanced'||
  full.seedsPerCell!==30||full.simulations!==1440||
  full.heldContextCells!==0||full.unresolvedRunnerWindows!==0||
  expected!==1200)
  throw Error('Nonmatching fixed full balanced source replay');
 for(const half of [first,second])
  if(half.schemaVersion!==2||half.scenario!=='balanced'||
   half.seedsPerCell!==15||half.simulations!==720||
   half.contextRows.length!==expected||
   half.unresolvedRunnerWindows!==0)
   throw Error('Incomplete source-verifiable 15-seed half');
 const find=report=>new Map(report.contextRows.map(r=>[
  [r.surface,r.courseId,r.fieldSize,r.mode,r.timing,r.bandId,r.style].join('|'),r]));
 const lookupA=find(first),lookupB=find(second);
 if(lookupA.size!==expected||lookupB.size!==expected)
  throw Error('Duplicate seed-half context key');
 for(const row of full.contextRows){
  const key=[row.surface,row.courseId,row.fieldSize,row.mode,row.timing,
   row.bandId,row.style].join('|');
  const a=lookupA.get(key),b=lookupB.get(key);
  if(!a||!b||row.status!=='complete-model-measurement'||
   a.status!=='complete-model-measurement'||
   b.status!=='complete-model-measurement'||
   row.runners!==a.runners+b.runners||
   Math.abs(row.opportunityPercent-(a.opportunityPercent+b.opportunityPercent)/2)>0.000003||
   Math.abs(row.pointOccupancyPercent-(a.pointOccupancyPercent+b.pointOccupancyPercent)/2)>0.000003)
   throw Error('Source 30-seed full average does not reconcile both seed halves '+key);
 }
 return true;
}
async function execute(template,engine,manifest){
 source.verifyManifest(manifest);
 const plans=source.plans('balanced',{seedsPerCell:30});
 const full=new Map(),first=new Map(),second=new Map();
 const child=spawn(engine,[],{stdio:['pipe','pipe','pipe']});
 let stderr='',inputError=null;
 child.stderr.setEncoding('utf8');
 child.stderr.on('data',s=>{stderr=(stderr+s).slice(-5000)});
 child.stdin.on('error',e=>{inputError=e});
 const closed=new Promise(resolve=>child.once('close',
  (code,signal)=>resolve({code,signal})));
 const reader=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
 const writing=(async()=>{
  for(const plan of plans){
   if(child.killed||child.stdin.destroyed||child.exitCode!==null)break;
   const request=expanded.makeRace(template,plan);
   if(!child.stdin.write(JSON.stringify(request)+'\n'))
    await new Promise(resolve=>{
     const done=()=>{
      child.stdin.off('drain',done);
      child.stdin.off('close',done);
      child.off('close',done);
      resolve();
     };
     child.stdin.once('drain',done);
     child.stdin.once('close',done);
     child.once('close',done);
    });
  }
  if(!child.stdin.destroyed)child.stdin.end();
 })();
 let received=0,error=null;
 try{
  for await(const line of reader){
   if(!line.trim())continue;
   if(received>=plans.length)throw Error('Unexpected pinned model output count');
   const plan=plans[received],reply=JSON.parse(line);
   if(reply.error||reply.seed!==undefined&&reply.seed!==plan.seed)
    throw Error('Source-pinned model reply or seed error at '+received);
   // Independent full 30 replay preserves original numerical sum order.
   source.observe(plan,reply.frames,manifest,full);
   source.observe(plan,reply.frames,manifest,
    plan.rep<15?first:second);
   received++;
  }
  await writing;
 }catch(e){error=e;child.kill()}
 const exit=await closed;
 if(error)throw error;
 if(inputError&&inputError.code!=='EPIPE')throw inputError;
 if(exit.code!==0||received!==plans.length)
  throw Error('Source-v77 fixed 1440 races were not completed '+
   JSON.stringify({exit,received,wanted:plans.length,stderr}));
 const entire=source.report(manifest,full,'balanced',30);
 const early=source.report(manifest,first,'balanced',15);
 const late=source.report(manifest,second,'balanced',15);
 validateHalfReconciliation(entire,early,late);
 const fullSha=hash(json(entire));
 if(fullSha!==EXPECTED_BALANCED_SHA)
  throw Error('Replay drift from PR #370 fixed balanced full report: '+fullSha);
 return {schemaVersion:1,
  status:'p2-32-conditions-balanced-v77-30-seeds-and-paired-15-seed-halves',
  source:{modelRevision:source.PIN,
   sourceSkillRegistrySha256:source.SOURCE_SHA,
   derivedManifestSha256:manifest.source.previousArtifactSha256,
   fullReportSha256:fullSha,
   referenceArtifact:'GitHub Actions run 42413671565 / p2-roster32-balanced'},
  design:{scenario:'balanced',raceCases:1440,
   fullSeeds:30,splitSeeds:[15,15],conditions:32,
   contexts:1200,
   compareSeedHalvesWithinSameCourseFieldAndMode:true},
  full:entire,
  splitSeedHalves:{first:early,second:late}};
}
async function main([manifestPath,templatePath,engine,outPath]){
 if(!outPath)throw Error('Usage: globalsim_specificity32_split_replay.cjs manifest.json pinned-template.jsonl engine output.json');
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 const lines=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(lines.length!==1)throw Error('Pinned GlobalSim template must be exactly one race');
 const report=await execute(JSON.parse(lines[0]),engine,manifest);
 fs.writeFileSync(outPath,json(report));
 console.log(JSON.stringify({status:report.status,
  design:report.design,source:report.source},null,2));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{
 console.error(e.stack||e);process.exitCode=1;
});
module.exports={EXPECTED_BALANCED_SHA,hash,json,
 validateHalfReconciliation,execute,main};
