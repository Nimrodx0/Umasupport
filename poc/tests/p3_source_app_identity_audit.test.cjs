'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const audit=require('../src/p3_source_app_identity_audit.cjs');
const project=require('../src/skill_condition_profiles.js');
const names=['位置取り','高揚感','中盤強者','ずっと追い越し','砂の王者',
 '進化の種','エンジン','後方勝負','キープ','運試し'];
const sources=()=>names.map((name,i)=>({
 id:String(i+100),name,info:['元の説明'],
 invokes:[{index:0,conditions:[[
  {type:'order_rate',operator:'>=',value:i+30},
  {type:'phase_random',operator:'==',value:1}
 ]],preConditions:[[{
  type:'running_style',operator:'>=',value:1
 }]],effects:[{type:'speed'}]}]
}));
const studied=()=>sources().map(x=>({
 originalSourceCondition:{
  originalSourceNumericId:x.id,groundType:'turf',
  distanceScope:'all',timing:'phase_random:1',bandId:'from40'
 }
}));
const app=(source,id,name,{override=null,profile=true}={})=>({
 id,name,activationProfile:profile?override||project.project(source,'current'):
  {status:'unavailable',reason:'unsupported-source'},
});
function model(skills){
 return {skills,
  skillById:Object.fromEntries(skills.map(x=>[x.id,x])),
  cards:[{id:'card-unmodified',events:[]}]};
}
test('exact source identity requires numeric ID + NFKC name + all original Invoke/OR/preconditions and effects',()=>{
 const raw=sources(),ref=studied();
 const cards=[
  app(raw[0],'skill:100','位置取り'),
  app(raw[1],'hint:高揚感','高揚感'),
  app(raw[2],'hint:中盤強者','中盤強者'),
  app(raw[3],'skill:103','ずっと追い越し')
 ];
 const m=model(cards),before=JSON.stringify(m);
 const result=audit.reconcile(ref,raw,m);
 assert.equal(JSON.stringify(m),before,'report should not mutate app cards or source');
 assert.equal(result.summary.originalSourceConditions,10);
 assert.equal(result.summary[audit.SOURCE_MATCH],4);
 assert.equal(result.summary['not-in-app-catalog'],6);
 assert.equal(result.summary.productEligibleSkillRatings,0);
 assert.equal(result.rows[0].result,audit.SOURCE_MATCH);
 assert.equal(result.rows[0].appSkillId,'skill:100');
 assert.equal(result.rows[1].appSkillId,'hint:高揚感');
 assert.equal(result.rows[0].verifiedSupportCardAcquisition,'not-evaluated');
 assert.equal(result.rows[0].verifiedOriginalFullSkillProc,'not-measured');
 assert.equal(result.rows[0].W,'source-partial-condition-research-only');
 assert.equal(result.rows[0].D,'not-measured-in-this-study');
 assert.equal(result.rows[0].cardScore,null);
 assert.equal(result.rows[0].suitabilityLabel,null);
 assert.equal(result.rows[0].eligibleForP3CardScoring,false);
 assert.match(result.rows[0].originalActivationInvokesSha256,/^[0-9a-f]{64}$/);
});
test('source name similarity, same numeric ID but different name, and condition drift never count as exact',()=>{
 const raw=sources(),ref=studied(),alt=sources();
 alt[0].name='別名';
 const different=app(raw[0],'skill:100','別名');
 const sameNameDifferentId=app(raw[1],'skill:980','高揚感',{
  override:{...project.project(raw[1],'current'),sourceNumericId:'980'}
 });
 const badCondition=app(raw[2],'skill:102','中盤強者');
 badCondition.activationProfile.invokes[0].conditions[0][0].value=1000;
 const withoutProfile=app(raw[3],'hint:ずっと追い越し','ずっと追い越し',
  {profile:false});
 const result=audit.reconcile(ref,raw,
  model([different,sameNameDifferentId,badCondition,withoutProfile]));
 assert.equal(result.rows[0].result,'same-id-name-mismatch');
 assert.equal(result.rows[1].result,'same-name-other-or-unverified-id');
 assert.equal(result.rows[2].result,'same-id-condition-mismatch');
 assert.equal(result.rows[3].result,'same-name-other-or-unverified-id');
 assert(result.rows.slice(0,4).every(x=>x.appSkillId===null));
 assert.equal(result.summary[audit.SOURCE_MATCH],0);
});
test('duplicate numeric candidates and malformed app identity must fail closed without inventing card acquisition',()=>{
 const raw=sources(),ref=studied();
 const duplicate1=app(raw[0],'skill:100','位置取り');
 const duplicate2=app(raw[0],'hint:位置取り','位置取り');
 const report=audit.reconcile(ref,raw,model([duplicate1,duplicate2]));
 assert.equal(report.rows[0].result,'duplicate-app-source-id');
 assert.equal(report.rows[0].appSkillId,null);
 assert.equal(report.summary['duplicate-app-source-id'],1);
 assert.equal(report.summary.confirmedSupportCardAcquisitionRoutes,0);
 assert.equal(report.summary.confirmedWholeSkillActivationRates,0);
 const conflict=app(raw[0],'skill:999','位置取り');
 conflict.activationProfile.sourceNumericId='100';
 assert.throws(()=>audit.reconcile(ref,raw,model([conflict])),
  /conflicting numeric identity/);
 const malformed=model([duplicate1]);
 malformed.skillById['skill:100']={...duplicate1};
 assert.throws(()=>audit.reconcile(ref,raw,malformed),
  /invalid app skill key/);
 const duplicateKeys=model([duplicate1,duplicate1]);
 assert.throws(()=>audit.reconcile(ref,raw,duplicateKeys),
  /duplicate\/invalid app skill key/);
});
test('wrong original source ID, malformed source OR and repeated research record fail closed',()=>{
 const raw=sources(),ref=studied();
 assert.throws(()=>audit.reconcile(ref.slice(0,9),raw,model([])),
  /exactly ten/);
 const unknown=structuredClone(ref);
 unknown[0].originalSourceCondition.originalSourceNumericId='999999999';
 assert.throws(()=>audit.reconcile(unknown,raw,model([])),/absent in pinned registry/);
 const repeated=structuredClone(ref);
 repeated[0]=structuredClone(repeated[1]);
 assert.throws(()=>audit.reconcile(repeated,raw,model([])),/duplicate or invalid/);
 const bad=structuredClone(raw);
 bad[0].invokes[0].preConditions=[[{
  type:'invalid',operator:'===',value:1
 }]];
 assert.throws(()=>audit.reconcile(ref,bad,model([])),/Invalid preConditions/);
 const original=structuredClone(raw);
 original[1].id=original[0].id;
 assert.throws(()=>audit.reconcile(ref,original,model([])),/duplicate original/);
});
