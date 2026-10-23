'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {acceptance}=require('../src/phase2_integrated_private_loader.cjs');
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
function fixture(){
 const skill=[
  {id:'201591',name:'ウマ好み',rarity:'normal',group:201590},
  {id:'200152',name:'良バ場○',rarity:'normal',group:200150}
 ];
 for(let i=0;i<110;i++)skill.push({
  id:String(990000+i),name:'合成スキル'+i,rarity:'normal',group:990000+i
 });
 const cards=[{id:'30080',hints:[],events:[]},{id:'30318',hints:[],events:[]}];
 const e={id:'gt-30080-event-006',name:'テスト特殊イベント',
  type:'choice',availabilityKind:'special-trigger',
  choices:[1,2,3].map(i=>({
   id:'option'+i,label:'位置'+i,rewards:[{skillId:'skill:201591',
    verifiedSkillName:'ウマ好み',level:3}]
  }))};
 const extra=[
  {id:'usl:30318:random:4',name:'通常の第1イベント',type:'choice',
   choices:[{id:'option1',label:'上',rewards:[]},
    {id:'option2',label:'下',rewards:[]}]},
  {id:'usl:30318:random:5',name:'通常の第2イベント',type:'choice',
   choices:[{id:'option1',label:'上',rewards:[]},
    {id:'option2',label:'下',rewards:[{
     skillId:'skill:200152',verifiedSkillName:'良バ場○',level:1
    }]}]}
 ];
 const catalog={schemaVersion:1,cards:[
  {cardId:'30080',coverageStatus:'partial',events:[e]},
  {cardId:'30318',coverageStatus:'partial',events:extra}
 ]};
 const model={cards,cardById:Object.fromEntries(cards.map(c=>[c.id,c])),
  skills:[],skillById:{},meta:{}};
 return {assembled:{
  dataKind:'phase2-nonpublishing-2496-event-assembled-runtime',
  publicationApproved:false,noAutomaticRuntimeAdoption:true,
  reviewedEventsPublished:0,sourceNarrativeOrChoiceProseIncluded:false,
  catalog,summary:{rosterCards:2,totalCandidateEvents:3,catalogSha256:hash(catalog)}
 },model,skillText:JSON.stringify(skill)};
}
test('real attach reads corrected special choice and GameWith choice hints through numeric name bridge',()=>{
 const f=fixture(),original=structuredClone(f);
 const a=acceptance(f);
 assert.equal(a.status,'PRIVATE_PRODUCTION_LOADER_ACCEPTED');
 assert.equal(a.attachesOnlyToDisposableModel,true);
 assert.equal(a.temporaryRuntimeMarkedReviewedButNotPublished,true);
 assert.equal(a.approvedEvents,0);
 assert.equal(a.summary.cards,2);
 assert.equal(a.summary.events,3);
 assert.equal(a.summary.extraCards,1);
 assert.equal(a.summary.extraEvents,2);
 assert.equal(a.summary.extraChoices,4);
 assert.equal(a.summary.extraHints,1);
 assert.match(a.summary.originalCatalogSha256,/^[a-f0-9]{64}$/);
 assert.match(a.summary.attachedPreparedCatalogSha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(f,original,'source JSON, skill model and source dictionary are unchanged');
 assert.deepEqual(require('../data/reviewed_events.v1.json').cards,[]);
 assert.deepEqual(require('../config/event-release-approvals.v1.json').entries,[]);
});
test('a swapped skill ID, name, missing registry row and false release flags all fail',()=>{
 const changes=[
  f=>{f.assembled.publicationApproved=true},
  f=>{f.assembled.noAutomaticRuntimeAdoption=false},
  f=>{f.assembled.summary.catalogSha256='a'.repeat(64)},
  f=>{f.assembled.catalog.cards[1].events[1].choices[1].rewards[0].verifiedSkillName='違う名前';
   f.assembled.summary.catalogSha256=hash(f.assembled.catalog)},
  f=>{const x=JSON.parse(f.skillText);x.find(y=>y.id==='200152').rarity='minus';f.skillText=JSON.stringify(x)},
  f=>{const x=JSON.parse(f.skillText);x.splice(x.findIndex(y=>y.id==='201591'),1);
   f.skillText=JSON.stringify(x)},
  f=>{f.model.cards.push({id:'not-expected'});}
 ];
 for(const alter of changes){
  const f=fixture();alter(f);
  assert.throws(()=>acceptance(f),'must reject: '+alter.toString());
 }
});
test('strict full-population mode refuses to infer 2496 acceptance from a small synthetic fixture',()=>{
 assert.throws(()=>acceptance(fixture(),{strict:true}),
  /固定563枚／統合2,496件/);
});
