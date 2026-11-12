#!/usr/bin/env node
'use strict';
/*
 * Source-pinned FULL-REGISTRY P2.15 logical replay contract.
 * Fetches third-party source only inside CI; never emits source expressions.
 * This is structural+counterfactual static-context research, NOT model ticks.
 */
const fs=require('node:fs'),crypto=require('node:crypto');
const profiles=require('../src/skill_condition_profiles.js');
const tool=require('../src/skill_source_whole_tick_monitor.cjs');
const PIN='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const BASE='https://raw.githubusercontent.com/mee1080/umasim/'+PIN+'/';
const CHECKER_PATH='race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt';
const STATUS='P2.15-full-original-source-logical-context-sweep-not-model-or-game';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function checkChecker(text){
 if(typeof text!=='string'||text.length<2000)throw Error('Pinned SkillChecker source unavailable');
 const anchors=[
  'val checks = conditions.map { andConditions ->',
  'andConditions.mapNotNull { checkCondition(skill, it, setting, calculatedConditions) }',
  'if (checks.isEmpty()) return { true }',
  'checks.any { andConditions ->',
  'andConditions.all { it.invoke(this) }',
  'if (!it.preChecked) {',
  'it.preChecked = it.preCheck(this)',
  'if (!it.preChecked) {',
  'return@forEach',
  'if (it.check(this)) {'
 ];
 for(const a of anchors)if(!text.includes(a))throw Error('Pinned source semantics changed: '+a);
 if((text.match(/fun RaceState\.checkSkillTrigger\(\)/g)||[]).length!==1)
  throw Error('Ambiguous fixed source skill check');
 return {revision:PIN,
  originalSourceOrOfAndSourceCodeAnchored:true,
  originalPreconditionTrueLatchCodeAnchored:true,
  ignoredUnsupportedPredicatesPossibleInOriginalSource:true,
  originalActualGameRuntimeObserved:false};
}
async function get(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('Source HTTP '+response.status);
 return response.text();
}
function audit(sourceText,checkerText){
 if(hash(sourceText)!==SHA)throw Error('Pinned original registry SHA mismatch');
 const verified=checkChecker(checkerText);
 const rows=JSON.parse(sourceText.replace(/^\uFEFF/,''));
 if(!Array.isArray(rows)||rows.length!==2162)
  throw Error('Pinned original source registry count changed');
 const styles=[1,2,3,4],tally={};
 let structured=0,unrecorded=0,compiledPredicates=0,invokes=0;
 const shapes={withPrecondition:0,preconditionMultipleOr:0,
  conditionsMultipleOr:0,multipleInvokes:0};
 for(const style of styles)tally[style]={true:0,false:0,unknown:0};
 const ids=new Set();
 for(const row of rows){
  if(!row||typeof row.id!=='string'||!/^\d+$/.test(row.id)||
   ids.has(row.id))throw Error('Malformed/duplicate pinned original skill ID');
  ids.add(row.id);
  const p=profiles.project(row,'pinned');
  if(p.status==='no-activation-record'){unrecorded++;continue;}
  if(p.status!=='source-structure')throw Error('Unknown source profile status');
  const compiled=tool.compile(p);
  if(compiled.sourceNumericId!==row.id||compiled.invokes.length!==p.invokes.length)
   throw Error('Source structure lost during compile');
  structured++;compiledPredicates+=compiled.predicateCount;
  invokes+=p.invokes.length;
  if(p.invokes.length>1)shapes.multipleInvokes++;
  if(p.invokes.some(i=>i.preConditions.length))shapes.withPrecondition++;
  if(p.invokes.some(i=>i.preConditions.length>1))shapes.preconditionMultipleOr++;
  if(p.invokes.some(i=>i.conditions.length>1))shapes.conditionsMultipleOr++;
  for(const style of styles){
   const observation=tool.run(p,[{tickIndex:0,
    staticContext:{running_style:style,distance_type:2,
     ground_type:1,ground_condition:1,track_id:10005}}]);
   // All DYNAMIC source predicates remain unknown in this artificial
   // one-tick context. No compiled source row may be silently dropped.
   const k=observation.ticks[0].overallCondition;
   tally[style][k]++;
   if(observation.eligibleForP3CardScoring!==false||
    observation.skillProcRate!==null||observation.ticks[0].gameProcMeasured!==false)
    throw Error('Premature product/global proc promotion');
  }
 }
 if(structured<1500||compiledPredicates<1000||
  Object.values(tally).some(x=>Object.values(x).reduce((a,b)=>a+b,0)!==structured))
  throw Error('Full-source mathematical sweep incomplete');
 return {schemaVersion:1,status:STATUS,
  provenance:{originalUmaSimRevision:PIN,originalRegistrySHA256:SHA,
   originalCheckerSemantics:verified,sourceRawDataIncluded:false},
  denominators:{allOriginalSkills:rows.length,
   sourceSkillsWithInvokeStructure:structured,withoutInvokes:unrecorded,
   originalInvokes:invokes,originalPredicateOccurrences:compiledPredicates},
  sourceShapeCounts:shapes,
  artificialContext:{
   source:'constant synthetic explicit context',
   runnerStyles:[...styles],distanceType:2,groundType:1,
   groundCondition:1,raceTrackId:10005,
   oneTickNoDynamicObservations:true,
   outcomeCountsNotLikelihood:tally},
  proofGates:{allOriginalSourceInvokesCompiled:true,
   ORANDAndLatchedPreconditionLogicExercisedBySyntheticTests:true,
   sourceDynamicPredicatesActuallyMeasured:false,
   liveGlobalSimWholeSkillJoin:false,gameSkillProcObserved:false,
   eligibleForP3CardScoring:false,cardScore:null,suitabilityLabel:null},
  limitations:[
   'Fixed original source structure and one static artificial context are evaluated; this is NOT a simulated race, game skill proc or empirical whole-source occurrence.',
   'The original checker mapNotNull may ignore unsupported predicates. Here unknown measurements MUST remain unknown, never true.',
   'No dynamic predicate, random drawn window, real precondition history, model-current condition join, or effect usefulness is measured.',
   'Multiple Invoke conditions are ORed as logical opportunities only. Cooldowns and skill events are NOT included; no rates or suitability are approved.'
  ]};
}
async function main(){
 if(process.argv.length!==3)throw Error('Usage: node audit_p2_15_source_tick_contract.cjs output.json');
 const [source,checker]=await Promise.all([
  get(BASE+'data/skill_data.txt'),get(BASE+CHECKER_PATH)
 ]);
 const out=audit(source,checker);
 fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n');
 console.log('P2_15_FULL_TICK_CONTRACT='+JSON.stringify({
  denominators:out.denominators,shapes:out.sourceShapeCounts,
  artificialContext:out.artificialContext,proofGates:out.proofGates}));
}
if(require.main===module)main().catch(e=>{
 console.error(e.stack||e);process.exitCode=1;
});
module.exports={PIN,SHA,STATUS,checkChecker,audit};
