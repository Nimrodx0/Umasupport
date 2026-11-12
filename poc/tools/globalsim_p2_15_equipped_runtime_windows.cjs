#!/usr/bin/env node
'use strict';
// P2.15: actual EQUIPPED GlobalSim v77 retail sampled windows. Model only.
// This temporary source probe does not touch RNG, skills, physics or app UI.
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto');
const pre=require('./globalsim_p2_15_preskill_phase_position.cjs');
const legacy=require('./globalsim_change_order_internal_probe.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const STATUS='P2.15-equipped-GlobalSim-v77-runtime-windows-not-game';
const EXPRESSIONS=Object.freeze({
 '200451':'phase_random==0',
 '200501':'phase_random==2',
 '200701':'distance_type==2&phase_random==2&order_rate>50'
});
const IDS=Object.keys(EXPRESSIONS);
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function once(s,needle,value,site){
 if(s.split(needle).length!==2)throw Error('Pinned GlobalSim site changed: '+site);
 return s.replace(needle,value);
}
function patch(root){
 const positionProbe=pre.patch(root);
 const file=path.join(root,'src/lib.rs'),before=fs.readFileSync(file,'utf8');
 const windowCode=[
 '    // P2.15 temporary read-only observation of REAL model skill windows.',
 '    // These were sampled by the pinned GlobalSim retail initialization.',
 '    let p2_sampled_windows: Vec<Value> = solvers.iter().enumerate().map(|(i, solver)| {',
 '        json::arr(solver.pending_skills.iter()',
 '            .filter(|p| spec.horses[i].skills.iter().any(|(id, _, _)| id == &p.skill_id))',
 '            .map(|p| json::obj(vec![',
 '                ("skillId", Value::String(p.skill_id.clone())),',
 '                ("detailIndex", json::num(p.detail_index as f64)),',
 '                ("hasPrerequisite", json::num(if p.prerequisite.is_some() {1.0} else {0.0})),',
 '                ("windows", json::arr(p.windows.iter().map(|w|',
 '                    json::arr(vec![json::num(w.start), json::num(w.end)])',
 '                ).collect())),',
 '            ])).collect())',
 '    }).collect();',
 '    let mut field = RaceField::new(solvers);'
 ].join('\n');
 let next=once(before,'    let mut field = RaceField::new(solvers);',
  windowCode,'PendingSkill.windows');
 next=once(next,'    match frames.finish()? {',
  '    if let Value::Object(map) = &mut result {\n'+
  '        map.insert("p2SampledSkillWindows".into(), json::arr(p2_sampled_windows));\n'+
  '    }\n    match frames.finish()? {','response field');
 next=once(next,
  'for key in ["results", "finishFrames", "conservePowerDiagnostics"]',
  'for key in ["results", "finishFrames", "conservePowerDiagnostics", "p2SampledSkillWindows"]',
  'gate-order restoration');
 fs.writeFileSync(file,next);
 return {globalSimRevision:pre.PIN,positionProbe,
  libSourceSha256:sha(before),libInstrumentedSha256:sha(next),
  noNewRngOrSkillDecisions:true,readOnlyPendingSkillWindows:true};
}
function validateTemplate(t){
 if(!t?.experimentalRetailRuntime||!t?.experimentalRetailInitialization||
  !Array.isArray(t.horses)||t.horses.length!==9||!t.skillData)
  throw Error('Fixed retail model example required');
 for(const [id,expression] of Object.entries(EXPRESSIONS)){
  const d=t.skillData[id];
  if(d?.alternatives?.length!==1||
   d.alternatives[0].condition!==expression||
   d.alternatives[0].precondition!==''||
   !d.alternatives[0].effects?.length)
   throw Error('Pinned source skill changed: '+id);
 }
}
function makeEquippedRace(template,plan){
 const r=expanded.makeRace(template,plan);
 for(const h of r.horses)h.skills=IDS.map(skillId=>({skillId,level:1,isUnique:false}));
 return r;
}
function checkedWindows(reply,i,distance){
 if(!Number.isFinite(distance)||distance<=0||distance>=9999)
  throw Error('Fixed model distance cannot certify reserved sample ranges');
 const rows=reply.p2SampledSkillWindows;
 if(!Array.isArray(rows)||!Array.isArray(rows[i]))throw Error('Missing runtime sampled window array');
 const seen=new Set();
 return rows[i].map(r=>{
  if(!IDS.includes(r?.skillId)||r.detailIndex!==0||
   !Array.isArray(r.windows)||r.windows.length===0)
   throw Error('Malformed model pending skill detail');
  if(seen.has(r.skillId))throw Error('Duplicate runtime skill detail');
  seen.add(r.skillId);
  for(const w of r.windows)
   if(!Array.isArray(w)||w.length!==2||!w.every(Number.isFinite)||w[0]>w[1])
    throw Error('Invalid model sampled interval');
  // The pinned builder inserts Region(9999,9999) when detail zero
  // has no eligible region. It is a disabled sentinel, never a random draw.
  const reserved=r.windows.length===1&&r.windows[0][0]===9999&&r.windows[0][1]===9999;
  if(!reserved&&r.windows.some(w=>w[0]<0||w[1]>distance||w[0]===w[1]))
   throw Error('Unknown out-of-course model skill window; not a sample');
  return {...r,researchSampleStatus:reserved?'reserved-inactive-detail':'valid-in-course-runtime-window'};
 });
}
function analyze(plans,original,probe){
 if(!Array.isArray(plans)||!plans.length||plans.length!==original?.length||
  plans.length!==probe?.length)throw Error('Matched equipped model races required');
 const totals={races:plans.length,frames:0,identicalPhysicalValues:0,
  identicalOriginalSkillEvents:0,observedSkillStagePositions:0,
  positionsMatchingPriorPostFrame:0,instantiatedSkillDetails:0,
  pendingWindowEntriesIncludingInactive:0,sampledWindows:0,
  reservedInactiveDetails:0,sampledWindowMemberRunnerTicks:0,
  modelSkillEvents:0,missingDetailContexts:0};
 const skills=Object.fromEntries(IDS.map(id=>[id,{
  instantiatedDetails:0,modelSampledWindows:0,reservedInactiveDetails:0,
  windowMemberRunnerTicks:0,
  modelSkillEvents:0,missingDetailContexts:0
 }]));
 for(let k=0;k<plans.length;k++){
  const p=plans[k],a=original[k],b=probe[k],n=p.fieldSize;
  if(a?.seed!==p.seed||b?.seed!==p.seed||
   !Array.isArray(a.frames)||a.frames.length<2||
   a.frames.length!==b.frames?.length||
   b.p2SampledSkillWindows?.length!==n)
   throw Error('Equipped source replay identity or frame mismatch');
  if(JSON.stringify(a.skillEvents)!==JSON.stringify(b.skillEvents))
   throw Error('Probe changed original model skill events');
  totals.identicalOriginalSkillEvents+=(a.skillEvents||[]).length;
  for(const ev of a.skillEvents||[]){
   const s=skills[String(ev.skillId)];
   if(s){s.modelSkillEvents++;totals.modelSkillEvents++;}
  }
  const details=Array.from({length:n},(_,i)=>{
   const rows=checkedWindows(b,i,p.course.distance);
   for(const id of IDS)if(!rows.some(r=>r.skillId===id)){
    skills[id].missingDetailContexts++;totals.missingDetailContexts++;
   }
   for(const r of rows){
    skills[r.skillId].instantiatedDetails++;
    totals.instantiatedSkillDetails++;
    totals.pendingWindowEntriesIncludingInactive+=r.windows.length;
    if(r.researchSampleStatus==='reserved-inactive-detail'){
     skills[r.skillId].reservedInactiveDetails++;
     totals.reservedInactiveDetails++;
    } else {
     skills[r.skillId].modelSampledWindows+=r.windows.length;
     totals.sampledWindows+=r.windows.length;
    }
   }
   return rows;
  });
  for(let j=0;j<a.frames.length;j++){
   const A=a.frames[j],B=b.frames[j];
   if(A.t!==B.t||A.horses.length!==n||B.horses.length!==n)
    throw Error('Equipped replay timestep/horse drift');
   totals.frames++;
   for(let i=0;i<n;i++){
    for(let c=0;c<4;c++){
     if(!Number.isFinite(legacy.get(A.horses[i],c))||
      legacy.get(A.horses[i],c)!==legacy.get(B.horses[i],c))
      throw Error('Read-only window probe changed model race physics');
     totals.identicalPhysicalValues++;
    }
    if(j===0)continue; // retail t=0 initial frame has no skill-stage probe
    const first=legacy.get(B.horses[i],4),last=legacy.get(B.horses[i],5);
    if(first===pre.SENTINEL&&last===pre.SENTINEL)continue;
    if(!Number.isFinite(first)||first===pre.SENTINEL||first!==last)
     throw Error('Original skill-priority stage positions diverged');
    totals.observedSkillStagePositions++;
    if(first!==legacy.get(a.frames[j-1].horses[i],0))
     throw Error('Equipped pre-skill stage is not prior post frame');
    totals.positionsMatchingPriorPostFrame++;
    for(const r of details[i]){
     if(r.researchSampleStatus==='reserved-inactive-detail')continue;
     if(r.windows.some(([start,end])=>start<=first&&first<end)){
      skills[r.skillId].windowMemberRunnerTicks++;
      totals.sampledWindowMemberRunnerTicks++;
     }
    }
   }
  }
 }
 if(!totals.sampledWindows||!totals.observedSkillStagePositions||
  totals.observedSkillStagePositions!==totals.positionsMatchingPriorPostFrame)
  throw Error('No verified source-model sampled-window evidence');
 return {schemaVersion:1,status:STATUS,
  provenance:{globalSimRevision:pre.PIN,
   observation:'GlobalSim v77 retail initialized PendingSkill.windows',
   originalUmaSimRandomDrawsObserved:false,
   originalSourceAndLiveGameEquivalent:false},
  experiment:{sourceSkillIds:IDS,modelExpressions:EXPRESSIONS,
   fixedModelRaces:plans.length,originalEquippedModelIsControl:true,
   physicalAndSkillEventsMustMatchExactly:true},
  totals,skills,
  gates:{modelEquippedAndSampled:true,modelSkillEventsCompared:true,
   actualUmaSimSamplesObserved:false,fullUmaSimConditionsMeasured:false,
   gameProcRateEstablished:false,P3Suitable:false,P4UiChanged:false},
  limitations:[
   'These are actual sampled intervals in pinned GlobalSim retail runtime, not a fixed artificial 0.5 draw, but they are NOT UmaSim or live-game draws.',
   'Source GlobalSim builder can insert an inactive 9999m reserved detail when the normal source path has no eligible region; this is excluded from sampled window counts.',
   'One source model skill also has a distance_type and order_rate AND; the runtime pending interval alone does not certify the whole condition.',
   'The emitted skillEvents are GlobalSim model events, not game activation probabilities. Shared runner-ticks are not independent trials.',
   'Fixed external example skillData is used only by CI. No third-party source corpus is redistributed and no card evaluation/UI changes.'
  ]};
}
function main(args){
 if(args[0]==='patch'){
  if(args.length!==2)throw Error('patch <temporary-original-model-source>');
  console.log(JSON.stringify(patch(args[1]),null,2));return;
 }
 if(args[0]!=='replay'||args.length!==5)
  throw Error('replay <example> <original-engine> <probe-engine> <output>');
 const [,templateFile,originalEngine,probeEngine,output]=args;
 const lines=fs.readFileSync(templateFile,'utf8').trim().split(/\r?\n/);
 if(lines.length!==1)throw Error('One fixed example expected');
 const template=JSON.parse(lines[0]);validateTemplate(template);
 const plans=legacy.plans().filter((_,i)=>i%4===0);
 if(plans.length!==8)throw Error('Pinned eight-case model matrix drift');
 const races=plans.map(p=>makeEquippedRace(template,p));
 const a=legacy.replay(originalEngine,races),b=legacy.replay(probeEngine,races);
 const result=analyze(plans,a,b);
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log('P2_15_EQUIPPED_RUNTIME='+JSON.stringify({
  totals:result.totals,skills:result.skills,status:result.status}));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={STATUS,IDS,EXPRESSIONS,once,patch,validateTemplate,
 makeEquippedRace,checkedWindows,analyze,main};
