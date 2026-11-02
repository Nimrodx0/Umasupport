'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {project}=require('../src/phase2_title_choice_projection.cjs');
const {report}=require('../src/phase2_no_inquiry_release_audit.cjs');
const clone=x=>structuredClone(x);
function sample(){
 const catalog={schemaVersion:1,cards:[
  {cardId:'30080',coverageStatus:'partial',events:[
   {id:'gt-30080-event-006',name:'架空の長い見出し',type:'choice',
    choices:[{id:'option1',label:'保護対象かもしれない架空の選択肢文章',
     outcomes:[
      {id:'outcome1',label:'架空の成功本文',rewards:[
       {skillId:'skill:700000',level:2,verifiedSkillName:'架空スキル'}],
       effects:[{kind:'bond',delta:5,sourceEffectOrdinal:1}]},
      {id:'outcome2',label:'架空の失敗本文',rewards:[]}
     ]}]}
  ]},
  {cardId:'30081',coverageStatus:'partial',events:[
   {id:'gt-30081-event-001',name:'別の仮見出し',type:'auto',
    rewards:[],requires:{all:[{eventId:'gt-30080-event-006'}]},terminal:true},
   {id:'usl:30081:chain:1',name:'編集した架空見出し',type:'auto',rewards:[]}
  ]}
 ]};
 const lineage={
  crossSourceGtExceptionIds:[{cardId:'30080',eventId:'gt-30080-event-006'}],
  curatedOnlyEventIds:[{cardId:'30081',eventId:'usl:30081:chain:1'}]
 };
 return {catalog,projection:project(catalog).catalog,lineage};
}
test('counts rights-sensitive title, choice, result and source order dependencies without leaking phrases',()=>{
 const input=sample(),before=JSON.stringify(input);
 const r=report(input);
 assert.equal(r.total.events,3);
 assert.equal(r.total.eventTitlesRetained,3);
 assert.equal(r.total.choiceEvents,1);
 assert.equal(r.total.choicePositions,1);
 assert.equal(r.total.outcomePositions,2);
 assert.equal(r.total.sourceOrdinalReferences,1);
 assert.equal(r.total.verifiedSkillNameRows,1);
 assert.equal(r.groups.gtDerived.events,1);
 assert.equal(r.groups.gtWithCrossSourceEdit.events,1);
 assert.equal(r.groups.crossSourceAdded.events,1);
 assert.equal(r.total.eventsWithPrerequisites,1);
 assert.equal(r.disclosureBoundaries.licenseOrPublicationApproved,false);
 for(const phrase of ['架空の長い見出し','架空スキル','保護対象かもしれない','outcome1','gt-30080'])
  assert.equal(JSON.stringify(r).includes(phrase),false);
 assert.equal(JSON.stringify(input),before);
});
test('refuses a projection that changed an event title or leaked a choice label',()=>{
 const x=sample();
 x.projection.cards[0].events[0].name='違う';
 assert.throws(()=>report(x),/最終公開形/);
 const y=sample();
 y.projection.cards[0].events[0].choices[0].label='元の文章';
 assert.throws(()=>report(y),/最終公開形/);
});
test('refuses unknown prose fields, not merely replacing unknown text',()=>{
 const x=sample();
 x.catalog.cards[0].events[0].dialogue='イベント原文';
 assert.throws(()=>report(x),/未分類/);
});
test('refuses out-of-scope or duplicated cross-source review identities',()=>{
 const x=sample();
 x.lineage.crossSourceGtExceptionIds.push({cardId:'30080',eventId:'gt-30080-event-006'});
 assert.throws(()=>report(x),/出典横断編集例外/);
 const y=sample();
 y.lineage.curatedOnlyEventIds=[{cardId:'30080',eventId:'gt-30080-event-006'}];
 assert.throws(()=>report(y),/出典横断編集例外/);
 const z=sample();
 z.lineage.crossSourceGtExceptionIds=[{cardId:'99999',eventId:'gt-99999-event-001'}];
 assert.throws(()=>report(z),/出典横断編集例外/);
});
test('strict fixed-baseline check never treats a handful of samples as all 2512',()=>{
 assert.throws(()=>report(sample(),{strict:true}),/固定563枚/);
});
