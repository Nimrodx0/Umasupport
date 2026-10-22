'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {exercise}=require('../src/gametora_full_runtime_integration.cjs');
const source=()=>({
 catalog:{schemaVersion:1,cards:[{cardId:'30026',events:[
  {id:'event-a',name:'仮A',type:'auto',rewards:[{skillId:'skill:200532',level:1}]},
  {id:'event-b',name:'仮B',type:'choice',choices:[
   {id:'opt-1',label:'仮選択1',outcomes:[
    {id:'success',label:'成功',rewards:[{skillId:'skill:201272',level:3}]},
    {id:'failure',label:'失敗',terminal:true,rewards:[]}]},
   {id:'opt-2',label:'仮選択2',terminal:true,rewards:[]}
  ]},
  {id:'event-c',name:'仮C',type:'auto',
   requires:{all:[{eventId:'event-b',choiceId:'opt-1',outcomeId:'success'}]},
   rewards:[{skillId:'skill:200532',level:2}]}
 ]}]},
 report:{dataKind:'gametora-app-schema-dry-run',publicationApproved:false,
  gameVerified:false,sourceProseIncluded:false,
  allPublishedNamesAreUnreviewedPlaceholders:true,
  totals:{sourceCards:2,sourceEvents:3,candidateSchemaCards:1,
   candidateSchemaEvents:3,skippedEvents:0,candidateAutoEvents:2,
   candidateChoiceEvents:1}},
 model:{cards:[{id:'30026'},{id:'30080'}],cardById:{
  '30026':{id:'30026',hints:['hint:手動の通常ヒント'],events:[]},
  '30080':{id:'30080',hints:[],events:[]}
 }}
});
test('production core exercises every projected choice/outcome/chain with normal hint and duplicate card',()=>{
 const x=source(),z=exercise(x);const t=z.totals;
 assert.equal(z.status,'CORE_AGGREGATION_EXECUTED_IN_MEMORY');
 assert.equal(t.projectedEvents,3);
 assert.equal(t.choiceEvents,1);
 assert.equal(t.autoEvents,2);
 assert.equal(t.choiceOptions,2);
 assert.equal(t.outcomeVariants,2);
 assert.equal(t.unselectedEventRoutes,1);
 assert.equal(t.plannedEventRoutes,3);
 assert.equal(t.plannedNormalHints,1);
 assert.equal(t.checkedUnselectedChoiceEvents,1);
 assert.equal(t.checkedSelectedChoiceRoutes,1);
 assert.equal(t.checkedBlockedByTerminal,1);
 assert.equal(t.checkedDuplicateCardAggregations,1);
 assert.equal(t.checkedProviderSkillCounts,3);
 assert.equal(z.eventTextOrPrivateCatalogReturned,false);
 assert.equal(z.publicationApproved,false);
 assert.equal(z.gameVerified,false);
 assert.ok(!JSON.stringify(z).includes('仮'));
});
test('model mismatch, source counts, publication approvals and malformed hints never get a passing smoke report',()=>{
 const mutations=[
  x=>{x.report.gameVerified=true;},
  x=>{x.report.publicationApproved=true;},
  x=>{x.report.sourceProseIncluded=true;},
  x=>{x.report.allPublishedNamesAreUnreviewedPlaceholders=false;},
  x=>{x.catalog.cards[0].cardId='wrong';},
  x=>{x.catalog.cards.push(x.catalog.cards[0]);},
  x=>{x.report.totals.candidateSchemaEvents=2;},
  x=>{x.report.totals.candidateAutoEvents=0;},
  x=>{x.report.totals.sourceEvents=4;},
  x=>{x.catalog.cards[0].events[1].choices=[];},
  x=>{x.catalog.cards[0].events[0].rewards[0].skillId=null;},
  x=>{x.catalog.cards[0].events[0].rewards[0].level=-1;}
 ];
 for(const change of mutations){
  const x=source();change(x);
  assert.throws(()=>exercise(x),/GT全イベント集計統合試験|TypeError|Cannot/);
 }
});
test('terminal choice blocks a dependent stage rather than counting its reward',()=>{
 const x=source(),e=x.catalog.cards[0].events;
 const core=require('../src/core.js');
 const card={...x.model.cardById['30026'],events:e};
 const closed=core.directRoutes(card,{stage:4,
  choices:{'event-b':'opt-2'},outcomes:{}});
 assert.equal(closed.some(y=>y.eventId==='event-c'),false);
 assert.equal(closed.some(y=>y.eventId==='event-b'),false);
 assert.equal(closed.some(y=>y.eventId==='event-a'),true);
 assert.equal(exercise(x).totals.checkedBlockedByTerminal,1);
});

function attachFixture(){
 const x=source();
 // The full normalizer's ORIGINAL pre-bridge catalog carries numeric IDs
 // with independently checked names; the projected version does not.
 const raw=JSON.parse(JSON.stringify(x.catalog));
 const names={'200532':'速度維持','201272':'金の加速'};
 for(const card of raw.cards)for(const e of card.events){
  const parts=e.type==='choice'?e.choices:[e];
  for(const part of parts)for(const obj of [part,...(part.outcomes||[])]){
   for(const reward of obj.rewards||[]){
    if(reward.skillId.startsWith('skill:'))
     reward.verifiedSkillName=names[reward.skillId.slice(6)];
   }
  }
 }
 const dictionary=[
  {id:'200532',name:'速度維持',rarity:'normal',group:20053},
  {id:'201272',name:'金の加速',rarity:'rare',group:20127},
  ...Array.from({length:120},(_,i)=>({
   id:String(400000+i),name:'補助試験用'+i,
   rarity:'normal',group:40000+i
  }))
 ];
 const common={id:'hint:手動の通常ヒント',name:'手動の通常ヒント',
  lowerId:null,tier:'unknown'};
 x.model.meta={};
 x.model.skills=[common];
 x.model.skillById={[common.id]:common};
 x.report.runtimeSkillProjectionSha256=require('node:crypto')
  .createHash('sha256').update(JSON.stringify(x.catalog)).digest('hex');
 return {...x,rawCatalog:raw,mergedSkillText:JSON.stringify(dictionary)};
}
test('the real production catalog attach loads every ephemeral projected event with byte-equivalent route graph',()=>{
 const x=attachFixture(),before=JSON.stringify(x.model);
 const result=exercise(x);
 assert.equal(result.actualProductionCatalogAttachExercised,true);
 assert.equal(result.attachedOnlyToTemporaryModel,true);
 assert.equal(result.totals.projectedEvents,3);
 assert.equal(result.totals.checkedDuplicateCardAggregations,1);
 assert.equal(JSON.stringify(x.model),before);
 assert.deepEqual(x.model.cardById['30026'].events,[]);
 assert.equal(x.model.meta.eventStatus,undefined);
 assert.equal(result.eventTextOrPrivateCatalogReturned,false);
});
test('the production loader cannot silently relabel or remap a numeric skill in unpublished GT proof',()=>{
 const wrong=attachFixture();
 wrong.rawCatalog.cards[0].events[0].rewards[0].verifiedSkillName='他の名前';
 assert.throws(()=>exercise(wrong),/数値スキルIDの名称照合が失敗/);
 const bad=attachFixture();
 bad.rawCatalog.cards[0].events[0].rewards[0].level=7;
 assert.throws(()=>exercise(bad),/GT全イベント集計統合試験/);
 const missing=attachFixture();
 delete missing.report.runtimeSkillProjectionSha256;
 assert.throws(()=>exercise(missing),/GT全イベント集計統合試験/);
});
