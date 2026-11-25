'use strict';
// Fixed source review. Context prerequisites are not additional style scores.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs');
const g6=require('./p2_g6_research_handoff_881.cjs');
const g4=require('./p2_g4_occurrence_disposition.cjs');
const PIN='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const CHECKER_BLOB='07252133a79fd0528a8cc299933239735372a720';
const CHECKER_URL='https://raw.githubusercontent.com/mee1080/umasim/'+PIN+'/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt';
const STATUS='P2.48-fixed-context-and-style-independent-logic-candidates-not-labels';
const CONTEXT=Object.freeze({
 motivation:'baseSetting.umaStatus.condition.value',
 track_id:'baseSetting.trackDetail.raceTrackId',
 distance_type:'baseSetting.trackDetail.distanceType',
 ground_type:'baseSetting.trackDetail.surface',
 ground_condition:'baseSetting.track.surfaceCondition',
 base_speed:'baseSetting.umaStatus.speed',
 base_stamina:'baseSetting.umaStatus.stamina',
 base_power:'baseSetting.umaStatus.power',
 base_guts:'baseSetting.umaStatus.guts',
 base_wiz:'baseSetting.umaStatus.wisdom'
});
const TARGETS=['motivation','track_id','weather','base_speed','base_stamina','base_power','base_guts','base_wiz'];
const hash=(v)=>crypto.createHash('sha256').update(v).digest('hex');
function verifyChecker(bytes){
 const b=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
 assert.equal(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),CHECKER_BLOB,'fixed checker blob mismatch');
 const s=b.toString('utf8');
 const active=s.split(/\r?\n/).map(x=>x.trim()).filter(x=>!x.startsWith('//'));
 for(const [key,value] of Object.entries(CONTEXT))
  assert(active.includes('"'+key+'" -> condition.preChecked('+value+')'),'missing exact static checker '+key);
 assert(active.includes('"always" -> condition.withAssert("==", 1) { { true } }'));
 assert(active.includes('"running_style" -> condition.preChecked(baseSetting.basicRunningStyle.value)'));
 assert(!active.some(x=>x.startsWith('"weather" ->')),'weather support changed');
 assert(s.includes('//        "weather" -> condition.preChecked(baseSetting.weather)'));
 assert(s.includes('val result = check(target)')&&s.includes('return { result }'));
 return true;
}
const operators=new Set(['==','!=','<','<=','>','>=']);
function sourceLogic(invokes){
 assert(Array.isArray(invokes)&&invokes.length>0);
 let context=new Set(),held=new Set(),pre=false,empty=false;
 for(const inv of invokes){
  const conditions=inv.conditions??[], preConditions=inv.preConditions??[];
  assert(Array.isArray(conditions)&&Array.isArray(preConditions));
  if(preConditions.length)pre=true;
  if(!conditions.length||conditions.some(a=>!a.length))empty=true;
  for(const and of [...conditions,...preConditions]){
   assert(Array.isArray(and));
   for(const p of and){
    assert(typeof p.type==='string'&&operators.has(p.operator)&&Number.isSafeInteger(p.value));
    if(p.type==='always'&&p.operator==='=='&&p.value===1)continue;
    if(Object.hasOwn(CONTEXT,p.type))context.add(p.type);
    else held.add(p.type);
   }
  }
 }
 // Do not simplify ORs or assume that a prerequisite is satisfied.
 let disposition='hold-other-source-logic';
 if(!held.size&&!pre&&!empty)disposition=context.size?'style-independent-conditional-context-candidate':'style-independent-always-only-candidate';
 return {disposition,contextTypes:[...context].sort(),heldTypes:[...held].sort(),
  preconditionsPresent:pre,emptyAlternativeHeld:empty,formalLabel:null,
  absoluteOpportunity:null,cardScore:null};
}
function audit(raw,checker,ledger){
 assert.equal(hash(raw),g6.SOURCE_SHA,'source registry SHA mismatch');
 verifyChecker(checker);
 assert.equal(ledger.status,g4.STATUS);
 assert.equal(ledger.source.registrySHA256,g6.SOURCE_SHA);
 const records=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,''));
 const byId=new Map(records.map(x=>[x.id,x]));assert.equal(byId.size,records.length);
 const targets=Object.fromEntries(TARGETS.map(t=>[t,{occurrences:0,skillIds:new Set()}]));
 let rows=[],matched=0,unavailable=0,occurrences=0;
 const counts={},allAbility=new Set(),ids=new Set();
 for(const l of ledger.rows){
  assert(!ids.has(l.appSkillId));ids.add(l.appSkillId);
  if(l.sourceNumericId===null){unavailable++;assert.equal(l.occurrences,null);continue;}
  matched++;
  const record=byId.get(l.sourceNumericId);assert(record&&Array.isArray(record.invokes),'missing source identity');
  const terms=[];
  record.invokes.forEach((inv,invokeOffset)=>{
   for(const sourceSide of ['conditions','preConditions'])
    (inv[sourceSide]??[]).forEach((and,orIndex)=>and.forEach((p,andIndex)=>{
     terms.push({invokeOffset,invokeIndex:inv.index??invokeOffset,sourceSide,orIndex,andIndex,type:p.type});
    }));
  });
  const key=o=>JSON.stringify([o.invokeOffset,o.invokeIndex,o.sourceSide,o.orIndex,o.andIndex,o.type]);
  assert.deepEqual(terms.map(key).sort(),l.occurrences.map(key).sort(),'exact source occurrence identity changed');
  occurrences+=terms.length;
  for(const p of terms){
   if(!Object.hasOwn(targets,p.type))continue;
   const t=targets[p.type];t.occurrences++;t.skillIds.add(l.sourceNumericId);
   if(p.type.startsWith('base_'))allAbility.add(l.sourceNumericId);
  }
  const logic=sourceLogic(record.invokes);
  counts[logic.disposition]=(counts[logic.disposition]||0)+1;
  rows.push({appSkillId:l.appSkillId,sourceNumericId:l.sourceNumericId,...logic});
 }
 assert.equal(matched,ledger.denominators.matched);assert.equal(unavailable,ledger.denominators.unavailable);
 assert.equal(occurrences,ledger.denominators.occurrenceCount);
 const targetSummary=Object.fromEntries(Object.entries(targets).map(([type,t])=>[type,{
  distinctSkills:t.skillIds.size,occurrences:t.occurrences,
  sourceHandler:type==='weather'?'unsupported-in-pinned-checker':'source-prechecked-fixed-context',
  evaluation:type==='weather'?'retain-original-gate-and-hold-runtime-interpretation':'retain-original-gate-and-compare-only-in-same-context',
  actualOmissionApproved:false
 }]));
 return {schemaVersion:1,status:STATUS,source:{revision:PIN,checkerBlob:CHECKER_BLOB,registrySHA256:g6.SOURCE_SHA},
  denominators:{matched,unavailable,occurrences,distinctAbilityConditionSkills:allAbility.size,formalLabels:0,actualOmissions:0},
  targetSummary,counts,rows,boundary:{weatherNotVerifiedByUmaSim:true,
   fixedContextNotUnconditionalGeneral:true,abilityGateNotRaceDynamics:true,noProductApproval:true}};
}
async function main(args){
 assert.equal(args.length,3,'Usage: pinned source, G4 ledger, output');
 const res=await fetch(CHECKER_URL,{signal:AbortSignal.timeout(60000)});
 assert(res.ok,'checker HTTP '+res.status);
 const x=audit(fs.readFileSync(args[0]),Buffer.from(await res.arrayBuffer()),JSON.parse(fs.readFileSync(args[1],'utf8')));
 fs.writeFileSync(args[2],JSON.stringify(x,null,2)+'\n');
 console.log('P2_48_CONTEXT_AND_LOGIC='+JSON.stringify({denominators:x.denominators,targetSummary:x.targetSummary,counts:x.counts,
  candidateIds:x.rows.filter(r=>r.disposition!=='hold-other-source-logic').map(r=>r.sourceNumericId)}));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={STATUS,sourceLogic,verifyChecker,audit};
