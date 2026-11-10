'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const m=require('../tools/globalsim_change_order_skill_tick.cjs');
const legacy=require('../tools/globalsim_change_order_internal_probe.cjs');
const P=32;
const c=(current,previous)=>({current,previous});
function packed(...ranks){
 assert.equal(ranks.length,6);
 return ranks.reduce((n,x)=>n*P+x,0);
}
function cohort(){
 return {schemaVersion:1,
  status:'P2-source-change-order-path-structure-not-complete-proc',
  matchedSkillDenominator:818,source:{sha256:m.U_SHA},
  summary:{sourceSkills:30},paths:[
   {sourceNumericId:'200001',invokeOffset:0,side:'conditions',orIndex:0,
    sameAndOtherTypes:['phase'],hasPreconditions:false,invokeCount:1,
    conditions:[{operator:'<',value:0}],fullSkillEvaluated:false},
   {sourceNumericId:'200002',invokeOffset:0,side:'conditions',orIndex:0,
    sameAndOtherTypes:[],hasPreconditions:false,invokeCount:1,
    conditions:[{operator:'>=',value:1}],fullSkillEvaluated:false}
  ]};
}
test('decode exact pre-priority and post-update source ranks and signed operators',()=>{
 const r=m.unpack(packed(1,2,1,2,2,1),9);
 assert.deepEqual(r,{priority1:c(1,2),priority0:c(1,2),
  afterUpdate:c(2,1)});
 assert(m.compare(-1,'<',0));
 assert(m.compare(-1,'<=',-1));
 assert(!m.compare(-1,'>=',0));
 assert.throws(()=>m.unpack(12,9),/Malformed/);
 assert.throws(()=>m.unpack(packed(1,2,0,2,2,1),9),/Out-of-range/);
 assert.throws(()=>m.compare(-1,'~=',0),/Unstudied/);
});
test('source signature aggregation keeps original AND/OR paths separate',()=>{
 const r=m.predicates(cohort());
 assert.equal(r.measurable.length,2);
 assert.equal(r.held.length,0);
 assert.equal(r.sourceSkills,30);
 const altered=cohort();altered.source.sha256='unknown';
 assert.throws(()=>m.predicates(altered),/Unpinned/);
});
test('temporary instrumentation works for pinned CRLF Rust files and fails on changed revision',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'p2-tick-'));
 try{
  for(const [name,items] of Object.entries(m.replacements)){
   const dest=path.join(root,name);
   fs.mkdirSync(path.dirname(dest),{recursive:true});
   const parts=items.map(x=>x[0]).join('\nresearch\n');
   fs.writeFileSync(dest,parts.replace(/\n/g,'\r\n'));
  }
  const before={};
  for(const name of Object.keys(m.replacements))
   before[name]=fs.readFileSync(path.join(root,name),'utf8');
  const patched=m.patch(root);
  assert.equal(patched.modifiedTemporaryFiles.length,3);
  const lib=fs.readFileSync(path.join(root,'src/lib.rs'),'utf8');
  assert.match(lib,/p2_priority_rank/);
  const field=fs.readFileSync(path.join(root,'src/race_field.rs'),'utf8');
  assert.match(field,/p2_priority_rank: RefCell/);
  const retail=fs.readFileSync(path.join(root,'src/race_field_retail.rs'),'utf8');
  assert.match(retail,/process_skill_priority|slot = if priority/);
  for(const name of Object.keys(m.replacements))
   assert.notEqual(before[name],fs.readFileSync(path.join(root,name),'utf8'));
  assert.throws(()=>m.patch(root),/source patch site moved/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('pinned post-update rank change belongs to the NEXT pre-skill check',()=>{
 const plans=legacy.plans(),original=[],instrumented=[];
 assert.equal(plans.length,32);
 const make=(n,stage,t)=>({
  t,horses:Array.from({length:n},(_,i)=>{
   const rank=i+1;
   const prev=rank;
   const moved=i===0?2:i===1?1:rank;
   const raw=[(n-i)*10,15,100,1.0,0,-1];
   if(stage==='t0')return raw;
   let a,b,e,f;
   if(stage==='t1'){a=rank;b=0;e=rank;f=rank}
   if(stage==='t2'){a=rank;b=rank;e=moved;f=rank}
   if(stage==='t3'){a=moved;b=rank;e=moved;f=moved}
   return [...raw.slice(0,4),a-b,packed(a,b,a,b,e,f)];
  })
 });
 for(const p of plans){
  const n=p.fieldSize;
  const a=[0,1,2,3].map(t=>make(n,'t'+t,t));
  original.push({frames:a.map(x=>({...x,
   horses:x.horses.map(h=>[...h.slice(0,4),0,-1])}))});
  instrumented.push({frames:a});
 }
 const r=m.analyze(original,instrumented,plans,cohort());
 assert.equal(r.design.races,32);
 assert.equal(r.validation.priorityCallRankStateMismatches,0);
 assert.equal(r.validation.prePriorityDisagreesWithPreviousPostRankCache,0);
 assert(r.validation.prePriorityMatchesPreviousPostRankCache>0);
 assert(r.validation.firstTickPreviousRankZeroHeld>0);
 assert(r.partialConditionOpportunity.preSkillNonzeroRankChangeRunnerTicks>0);
 assert(r.partialConditionOpportunity.sameTickPreAndPostDifferenceRunnerTicks>0);
 const broken=structuredClone(instrumented);
 broken[0].frames[2].horses[0][4]=2;
 assert.throws(()=>m.analyze(original,broken,plans,cohort()),/priority-1/);
 const physical=structuredClone(instrumented);
 physical[0].frames[1].horses[0][0]+=1;
 assert.throws(()=>m.analyze(original,physical,plans,cohort()),/changed physical race/);
});
