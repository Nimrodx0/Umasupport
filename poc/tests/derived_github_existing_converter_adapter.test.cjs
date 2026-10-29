'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {projectExistingConverterForNewCard:project}=
 require('../src/derived_github_existing_converter_adapter.cjs');
const {planDerivedNewCardIntake}=require('../src/derived_github_new_card_source_plan.cjs');
const {blobSha}=require('../src/derived_github_card_event_preflight.cjs');
const core=require('../src/core.js');
const skills=()=>JSON.stringify([
 {id:'200532',name:'Numeric skill',rarity:'normal',group:20053},
 {id:'201272',name:'Rare skill',rarity:'rare',group:20127},
 ...Array.from({length:105},(_,i)=>({id:String(400000+i),
  name:'Synthetic '+i,rarity:'normal',group:40000+i}))
]);
function input(body,cardId='30322'){
 const sourceText=JSON.stringify({kind:'support',id:Number(cardId),events_ja:body});
 const discovery={dataKind:'new-umamusume-support-card-ids',
  schemaVersion:1,publicationApproved:false,existingCardIds:['30001'],
  addedCardIds:[cardId]};
 const plan=planDerivedNewCardIntake({discovery,
  existingCatalog:{schemaVersion:1,cards:[]},
  sourceCommit:'b'.repeat(40),sourceTree:{sha:'a'.repeat(40),truncated:false,
   tree:[{type:'blob',sha:blobSha(sourceText),
    path:'server/data/events/gametora/support_'+cardId+'.json'}]}});
 return {plan,cardId,sourceText,skillText:skills(),skillRevision:'c'.repeat(40)};
}
test('reuses canonical converter for ordered outings and chain termination, not new ad-hoc projector',()=>{
 const x=input({
  s:{section:'special',name:'source original A',choices:[
   {label:'',effects:[{type:'skill_hint',skill_id:200532,value:'+1'}]}]},
  d1:{section:'dates',name:'source original B',choices:[
   {label:'',effects:[{type:'energy',value:'+10'}]}]},
  d2:{section:'dates',name:'source original C',choices:[
   {label:'',effects:[{type:'skill_hint',skill_id:201272,value:'+2'}]}]}
 });
 const r=project(x),e=r.draftCatalog.cards[0].events;
 assert.equal(r.sourceConverter,'gametora_app_schema_dry_run.project');
 assert.equal(r.census.sourceEvents,3);
 assert.equal(r.census.modeledEvents,3);
 assert.equal(r.census.excludedEvents,0);
 assert.equal(e[0].availabilityKind,'special-trigger');
 assert.equal(e[1].availabilityKind,'outing-sequence');
 assert.equal(e[2].availabilityKind,'outing-sequence');
 assert.deepEqual(e[2].requires,{all:[{eventId:e[1].id}]});
 assert.equal(e.every(x=>x.sourceKind==='derived-github-unreviewed'),true);
 const routes=core.directRoutes({id:'30322',hints:[],events:e},{
  stage:4,choices:{},outcomes:{}});
 assert.equal(routes.every(x=>x.conditional),true);
 assert.ok(!JSON.stringify(r).includes('source original'));
 assert.equal(r.publicationApproved,false);
});
test('all ambiguous source positions are recorded even if other events convert',()=>{
 const x=input({
  a:{section:'random',name:'Private exact source A',choices:[
   {label:'A',effects:[{type:'skill_hint',skill_id:200532,value:'+1'}]}]},
  b:{section:'arrows',name:'Private exact source B',choices:[
   {label:'',effects:[{type:'skill_hint',skill_id:999999,value:'+2'}]}]},
  c:{section:'arrows',name:'Private exact source C',choices:[
   {label:'',effects:[{type:'skill_hint',skill_id:200532,value:'+2'}]}]}
 });
 const r=project(x);
 assert.equal(r.census.sourceEvents,3);
 assert.equal(r.census.modeledEvents+r.census.excludedEvents,3);
 assert.ok(r.pendingEvents.length>=1);
 assert.ok(r.reviewItems.some(e=>e.origin==='schema-projection'));
 assert.ok(r.reviewItems.some(e=>e.reason==='CHAIN_ORDER_REQUIRES_CONFIRMATION'));
 assert.ok(!JSON.stringify(r).includes('Private exact source'));
});
test('source blob tampering and independent numeric source without commit fail closed',()=>{
 const x=input({a:{section:'random',name:'P',choices:[
  {label:'',effects:[{type:'skill_hint',skill_id:200532,value:'+1'}]}]}});
 assert.throws(()=>project({...x,sourceText:x.sourceText+' '}),
  /source-blob-content-not-identical/);
 assert.throws(()=>project({...x,skillRevision:null}),
  /version-pinned-independent-skill-registry-required/);
 assert.throws(()=>project({...x,plan:{
  ...x.plan,primarySourceCommit:'0'.repeat(40)
 }}),/source-blob-content|card-not-source-pinned|source-plan-scope-invalid|normalized-card-source-drift/);
});
