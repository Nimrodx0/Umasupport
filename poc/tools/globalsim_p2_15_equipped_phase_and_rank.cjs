#!/usr/bin/env node
'use strict';
/*
 * Fixed 8 equipped GlobalSim model races, 3 independently built engines:
 * unmodified, sampled-window+pre-priority-position, pre-priority-rank-cache.
 *
 * This experiment intentionally evaluates only the three installed
 * GlobalSim example skill expressions. The original UmaSim's 102-skill
 * phase_random cohort remains a SEPARATE unverified source mapping.
 */
const fs=require('node:fs');
const legacy=require('./globalsim_change_order_internal_probe.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const equipped=require('./globalsim_p2_15_equipped_runtime_windows.cjs');
const model=require('../src/skill_equipped_phase_model_and.cjs');
const PIN=legacy.PIN;
const STATUS=model.STATUS;
const fail=(x,msg)=>{if(!x)throw Error('P2.15 equipped phase-rank replay: '+msg)};
function verifyPinnedGlobalSimSource(conditionsCode,retailCode,solverCode){
 fail(typeof conditionsCode==='string'&&typeof retailCode==='string'&&
  typeof solverCode==='string','missing frozen source files');
 const anchors=[
  'fn order_rate_get_pos(rate: f64, _s: &RaceSolver, field: Option<&RaceField>) -> f64',
  '(n * (rate / 100.0)).round()',
  'c.insert("phase_random".into(), random_cond().eq(Box::new(phase_random_filter_eq)))',
  '"distance_type".into(),',
  'fn distance_type_filter_eq(regions: &[Region], distance_type: f64, course: &CourseData',
  'course.distance_type as f64 == distance_type'
 ];
 for(const code of anchors)fail(conditionsCode.includes(code),
  'pinned v77 original condition runtime changed: '+code);
 for(const code of ['fn distance_window(rng:&mut RetailRandom,start:f32,end:f32)',
  'let value=rng.real_distance(start,start.max(end-10.0));(value,value+10.0)',
  '"phase_random" | "phase_firsthalf_random" | "phase_laterhalf_random"']){
  fail(retailCode.includes(code),'pinned v77 sampled window source changed: '+code);
 }
 for(const code of ['pos >= sk.trigger.start && pos < sk.trigger.end',
  'self.process_pending_full(self.pos, field, priority)']){
  fail(solverCode.includes(code),
   'pinned v77 actual model skill check stage changed: '+code);
 }
 return {globalSimRevision:PIN,modelRankSourceAnchored:true,
  originalModelPhaseRandomRngAnchored:true,
  modelRuntimeIntervalSemanticsAnchored:true,
  sourceUmaSimPhaseRandomModelEquivalenceVerified:false,
  actualGameProcRateMeasured:false};
}
function run(template,plans,original,probe,rank,originalCode){
 const source=verifyPinnedGlobalSimSource(...originalCode);
 fail(Array.isArray(plans)&&plans.length===8,
  'fixed eight model race panel required');
 const report=model.analyze(plans,original,probe,rank);
 fail(report.status===STATUS&&
  report.totals.equippedModelRunnerRaces===
    plans.reduce((n,p)=>n+p.fieldSize*equipped.IDS.length,0),
  'fixed three-equipped-source-skills denominator drift');
 return {schemaVersion:1,status:STATUS,
  sourceVerification:source,originalModel:report};
}
function main(args){
 if(args[0]!=='replay'||args.length!==9)throw Error(
  'replay template.jsonl original-engine window-position-engine rank-engine original-conditions.rs original-retail-initialization.rs original-race-solver.rs output.json');
 const [_,templatePath,baseEngine,windowEngine,rankEngine,
  conditionsFile,retailFile,solverFile,outFile]=args;
 const templateLines=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 fail(templateLines.length===1,'expected one pinned retail model template');
 const template=JSON.parse(templateLines[0]);
 equipped.validateTemplate(template);
 const plans=legacy.plans().filter((_,i)=>i%4===0);
 fail(plans.length===8&&plans.every(p=>[9,12].includes(p.fieldSize)),
  'fixed 8 equipped races and 9/12 field-size model panel drift');
 const inputs=plans.map(p=>equipped.makeEquippedRace(template,p));
 fail(inputs.every(r=>r.horses.every(h=>h.skills.length===3)),
  'model skills were not really equipped for replay');
 const a=legacy.replay(baseEngine,inputs);
 const b=legacy.replay(windowEngine,inputs);
 const c=legacy.replay(rankEngine,inputs);
 const report=run(template,plans,a,b,c,[
  fs.readFileSync(conditionsFile,'utf8'),
  fs.readFileSync(retailFile,'utf8'),
  fs.readFileSync(solverFile,'utf8')]);
 fs.writeFileSync(outFile,JSON.stringify(report,null,2)+'\n');
 console.log('P2_15_ACTUAL_EQUIPPED_AND='+JSON.stringify({
  source:report.sourceVerification,
  model:report.originalModel.modelDesign,
  evidence:report.originalModel.threeEngineValidation,
  totals:report.originalModel.totals,
  skills:report.originalModel.skills,
  gates:report.originalModel.evidenceGates
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={PIN,STATUS,verifyPinnedGlobalSimSource,run,main};
