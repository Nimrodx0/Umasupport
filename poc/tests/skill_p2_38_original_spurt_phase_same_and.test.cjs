'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const study=require('../src/skill_p2_38_original_spurt_phase_same_and.cjs');
const p237=require('../src/skill_p2_37_dynamic_state_evidence.cjs');
function input(){
 const skills=[],rows=[],observed=[];
 for(let k=0;k<881;k++){
  const matched=k<818;
  const id=k===0?'200511':k===1?'200512':String(300000+k);
  const skillId=k===1?'hint:末脚':'skill:'+id;
  if(!matched){
   skills.push({id:skillId,name:'unknown '+k});
   rows.push({skillId,sourceNumericId:null,
    status:'source-unavailable',routeFamilies:[]});
   continue;
  }
  const conditions=k<2?[
   {type:'is_lastspurt',operator:'==',value:1},
   {type:'phase_firsthalf_random',operator:'==',value:3}]:[];
  skills.push({id:skillId,name:k===1?'末脚':'source '+k,
   activationProfile:{status:'source-structure',sourceNumericId:id,
    invokes:[{index:1,conditions:[conditions],preConditions:[]}]}});
  const routeFamilies=k<2?[{
   invokeOffset:0,invokeIndex:1,conditionOrIndex:0,
   preconditionOrIndex:null,conditionOrCount:1,preconditionOrCount:0,
   finiteCompatibleStyles:['逃げ','先行','差し','追込']}]:[];
  rows.push({skillId,sourceNumericId:id,
   status:'source-route-research-candidates-only',routeFamilies});
  if(k<2)observed.push({skillId,sourceNumericId:id,invokeOffset:0,
   invokeIndex:1,conditionOrIndex:0,preconditionOrIndex:null,
   hasOtherInvokes:false,sourcePredicates:[{side:'conditions',
    andOffset:0,operator:'==',value:1}]});
 }
 return {model:{skills,skillById:Object.fromEntries(skills.map(x=>[x.id,x]))},
  queue:{status:'P2.32-source-route-research-selection-not-complete-skill-suitability',
   denominators:{sourceMatchedSkills:818,originalRouteFamilies:970},rows},
  p237:{status:p237.STATUS,
   source:{revision:p237.PIN,mechanismSourceVerified:true},
   rows:{is_lastspurt:observed}}};
}
const run=x=>study.audit(x.model,x.queue,x.p237);
test('two exact source routes share same original AND, output source-defined window without score',()=>{
 const x=input(),old=JSON.stringify(x),out=run(x);
 assert.equal(JSON.stringify(x),old);
 assert.equal(out.status,study.STATUS);
 assert.equal(out.summary.skills,2);
 assert.equal(out.summary.distinctCurrentAndMechanisms,1);
 assert.equal(out.summary.originalSkillRaceFullANDTrueObservations,0);
 assert.equal(out.rows[0].sourcePhase,3);
 assert.equal(out.rows[1].sourceNumericId,'200512');
 assert.equal(out.rows[1].skillName,'末脚');
 assert(out.rows.every(z=>z.sourceANDPredicates.length===2&&
  z.productSkillOrCardScore===null&&
  z.originalDynamicSpurtIncidenceMeasured===0));
 assert.deepEqual(out.rows[0].sourceWindow,
  out.rows[1].sourceWindow);
});
test('different original phase values, extra AND, OR or precondition are not silently reusable',()=>{
 const a=input();
 a.model.skills[1].activationProfile.invokes[0].conditions[0][1].value=2;
 assert.throws(()=>run(a),/do not share the same exact source AND/);
 const x=input();x.model.skills[0].activationProfile.invokes[0]
  .conditions[0].push({type:'order_rate',operator:'<=',value:50});
 assert.throws(()=>run(x),/two-condition original AND\/OR required/);
 const y=input();y.model.skills[0].activationProfile.invokes[0]
  .preConditions=[[{type:'phase',operator:'==',value:1}]];
 assert.throws(()=>run(y),/two-condition original AND\/OR required/);
 const z=input();z.model.skills[0].activationProfile.invokes[0]
  .conditions.push([]);
 assert.throws(()=>run(z),/two-condition original AND\/OR required/);
});
test('altered source ID, comparator, runtime source cohort fail closed',()=>{
 const a=input();a.p237.rows.is_lastspurt[1].sourceNumericId='200513';
 assert.throws(()=>run(a),/one original source per intended ID/);
 const b=input();b.model.skills[0].activationProfile.invokes[0]
  .conditions[0][0].operator='>=';
 assert.throws(()=>run(b),/original AND source predicate meaning mismatch/);
 const c=input();c.p237.source.mechanismSourceVerified=false;
 assert.throws(()=>run(c),/source cohort or independent fixed/);
});
