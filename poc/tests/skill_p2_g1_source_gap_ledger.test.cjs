'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const g1=require('../src/skill_p2_g1_source_gap_ledger.cjs');
function idx(records){
 const byId=new Map(records.map(x=>[x.id,x])),byName=new Map();
 for(const x of records)byName.set(x.name,[...(byName.get(x.name)||[]),x]);
 return {byId,byName};
}
const match=(id,name,source)=>({id:'skill:'+id,name,
 activationProfile:{status:'source-structure',sourceNumericId:id,source,invokes:[]}});
const missing=(id,name,sourceNumericId)=>({id,name,
 ...(sourceNumericId?{sourceNumericId}:{}),
 activationProfile:{status:'unavailable',reason:'skill-dictionary-id-name-unmatched',
  invokes:[]}});
function fixture(){
 const current=idx([{id:'10',name:'A'},{id:'11',name:'B'},
  {id:'12',name:'B'},{id:'13',name:'C'}]);
 const pinned=idx([{id:'10',name:'Previous A'},{id:'14',name:'D'}]);
 const skills=[
  match('10','A','current'),
  match('14','D','pinned'),
  {id:'hint:C',name:'C',
   activationProfile:{status:'source-structure',sourceNumericId:'13',
    source:'current',invokes:[]}},
  missing('skill:15','Absent'),
  missing('skill:11','Different name'),
  missing('hint:B','B'),
  missing('hint:Unknown','Unknown'),
  missing('event:unresolved','Event unresolved')];
 return {current,pinned,model:{skills,skillById:Object.fromEntries(
  skills.map(s=>[s.id,s])),cards:[{id:'card:1',events:[]}]}};
}
test('classifies every fixed app skill into exact matched or held source identity',()=>{
 const {model,current,pinned}=fixture(),before=JSON.stringify(model);
 const x=g1.audit(model,current,pinned);
 assert.equal(x.status,g1.STATUS);
 assert.deepEqual(x.denominators,{appSkills:8,sourceStructureMatched:3,
  matchedWithoutActivationRecord:0,sourceUnavailable:5});
 assert.equal(x.byReason['matched-current-or-pinned'],3);
 for(const code of ['numeric-id-absent-from-both-dictionaries',
  'numeric-id-present-but-name-conflicts',
  'hint-name-ambiguous-in-current','hint-name-absent-from-current',
  'no-supported-numeric-or-hint-source-key'])assert.equal(x.byReason[code],1);
 assert.equal(x.rows.length,8);
 assert(x.rows.every(r=>r.eligibleForP3CardScoring===false&&
  r.cardScore===null&&r.originalFullSkillANDProven===false));
 assert.equal(JSON.stringify(model),before);
 assert(!JSON.stringify(x).includes('Different name'),
  'Do not copy names from source into public audit output');
});
test('a current name conflict can be resolved only by an exact pinned ID/name',()=>{
 const f=fixture();
 f.model.skills[0].activationProfile.source='pinned';
 assert.throws(()=>g1.audit(f.model,f.current,f.pinned),/P1\/source ID or provenance drift/);
 const n=f.model.skills[0];
 n.name='Previous A';n.activationProfile.source='pinned';
 const x=g1.audit(f.model,f.current,f.pinned);
 assert.equal(x.rows[0].matchedSource,'pinned');
});
test('fail closed on duplicate skills, malformed sources and false unavailable status',()=>{
 const f=fixture();
 assert.throws(()=>g1.audit(f.model,{},f.pinned),/parsed skill dictionary/);
 f.model.skills[3].activationProfile.status='source-structure';
 assert.throws(()=>g1.audit(f.model,f.current,f.pinned),/P1\/source ID or provenance drift/);
 f.model.skills[3].activationProfile.status='unavailable';
 f.model.skills.push(f.model.skills[3]);
 assert.throws(()=>g1.audit(f.model,f.current,f.pinned),/duplicate or unmatched app skill/);
});
