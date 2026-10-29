'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {registryFromSkillText}=
 require('../src/official_gametora_skill_id_crosswalk.cjs');
const {assembleLiveEvent}=require('../src/official_gametora_live_event_assembler.cjs');
const {projectSiteEvent,projectNewCardSite,summarizeCardProjection}=
 require('../src/official_gametora_private_schema_projection.cjs');
const {validateEvents}=require('../src/event_schema.js');
const {discoverNewCards,stageNewCardEvents}=
 require('../src/new_card_event_incremental.cjs');
const registry=registryFromSkillText(JSON.stringify([
 ...Array.from({length:101},(_,i)=>({
  id:String(900000+i),name:'合成スキル'+i,rarity:'normal',group:i
 })),
 {id:'200516',name:'登山家',rarity:'normal',group:500},
 {id:'200517',name:'星空',rarity:'rare',group:501}
]));
const piece=(choiceOrdinal,outcomeOrdinal,{texts=['スピード +10'],
 groupOwnTextFragments=['共通の表示グループ'],
 directOwnTexts=[],flowOwnTexts=[],unresolvedOr=false}={})=>({
 choiceOrdinal,outcomeOrdinal,
 numericEffectTexts:texts,
 numericEffectContexts:texts.map(t=>[t]),
 groupOwnTextFragments,
 hints:texts.filter(t=>t.includes('ヒント')).map(t=>({text:t,contexts:[t]})),
 directOwnTexts,flowOwnTexts,unresolvedOr
});
function assembled(id='30324',ordinal=1){
 const routes=[
  piece(1,1,{texts:['体力 +15','「登山家」のヒントLv +2'],
   directOwnTexts:['「星空」を獲得'],
   groupOwnTextFragments:['同一グループの構造情報']}),
  piece(1,2,{texts:['体力 +5','「登山家」のヒントLv +1'],
   flowOwnTexts:['連続イベント打ち切り'],
   groupOwnTextFragments:['同一グループの構造情報']}),
  piece(2,1,{texts:['スキルPt +30'],
   groupOwnTextFragments:['別グループの構造情報']})
 ];
 return assembleLiveEvent({
  cardId:id,siteEventOrdinal:ordinal,routePieces:routes,registry
 });
}
test('generic page-only projection maps ordinal groups and 3 reward routes',()=>{
 const x=projectSiteEvent(assembled());
 assert.equal(x.status,'private-schema-shaped');
 assert.equal(x.previewEvent.id,'gt-site:30324:1');
 assert.equal(x.previewEvent.name,'イベント1');
 assert.equal(x.previewEvent.type,'choice');
 const [a,b]=x.previewEvent.choices;
 assert.equal(a.label,'選択肢1');
 assert.deepEqual(a.outcomes.map(o=>o.label),['結果1','結果2']);
 assert.deepEqual(a.outcomes[0].effects,[{
  kind:'energy',delta:15,sourceEffectOrdinal:1
 }]);
 assert.deepEqual(a.outcomes[0].rewards,[
  {skillId:'skill:200516',kind:'hint',level:2},
  {skillId:'skill:200517',kind:'obtained'}
 ]);
 assert.deepEqual(a.outcomes[1].rewards,[
  {skillId:'skill:200516',kind:'hint',level:1}
 ]);
 assert.equal(a.outcomes[0].terminal,undefined);
 assert.equal(a.outcomes[1].terminal,true);
 assert.equal(b.label,'選択肢2');
 assert.equal(b.outcomes,undefined);
 assert.equal(b.effects[0].kind,'skill_points');
 assert.equal(x.numericEffects,3);
 assert.equal(x.hints,2);
 assert.equal(x.directSkills,1);
 assert.equal(x.flowMarkers,1);
 assert.equal(x.gameChoiceSemanticsVerified,false);
 assert.equal(x.allRewardsVerified,false);
 assert.equal(x.appEventSchemaAdoptable,false);
 assert.equal(x.publicationApproved,false);
 assert.doesNotMatch(JSON.stringify(x.previewEvent),/登山家|星空|成功|失敗/);
});
test('private projection does not turn an event into an approved catalog',()=>{
 const item=assembled();
 const none=assembleLiveEvent({
  cardId:'30324',siteEventOrdinal:2,routePieces:[],registry
 });
 const card=projectNewCardSite({cardId:'30324',
  siteEventPanelCount:2,eventObservations:[item,none]});
 assert.equal(card.schemaShapedEventCount,1);
 assert.equal(card.noVisibleOrAmbiguousEventCount,1);
 assert.equal(card.schemaShapedResults,3);
 assert.equal(card.schemaShapedNumericEffects,3);
 assert.equal(card.schemaShapedHints,2);
 assert.equal(card.intakeCandidate.convertedEventCount,0);
 assert.equal(card.intakeCandidate.unresolvedEventCount,2);
 assert.deepEqual(card.intakeCandidate.events,[]);
 assert.equal(card.existingDatabaseTouched,false);
 const summary=summarizeCardProjection(card);
 assert.equal(summary.pendingEventCount,2);
 assert.equal(summary.schemaShapedResults,3);
 const discovered=discoverNewCards({
  previousRosterIds:['30001'],currentRosterIds:['30001','30324']
 });
 const stage=stageNewCardEvents({discovery:discovered,
  existingCatalog:{schemaVersion:1,cards:[]},
  candidates:[card.intakeCandidate]});
 assert.deepEqual(stage.pending.map(x=>({card:x.cardId,why:x.reason})),
  [{card:'30324',why:'gametora-source-unresolved'}]);
 assert.equal(stage.ready.length,0);
});
test('new-card projector rejects missing, duplicated or foreign event panels',()=>{
 const joined=assembled();
 assert.throws(()=>projectNewCardSite({cardId:'30324',
  siteEventPanelCount:2,eventObservations:[joined]}),/抽出件数が一致しない/);
 assert.throws(()=>projectNewCardSite({cardId:'30325',
  siteEventPanelCount:1,eventObservations:[joined]}),/混入/);
 assert.throws(()=>projectNewCardSite({cardId:'30324',
  siteEventPanelCount:2,eventObservations:[joined,joined]}),/混入/);
});
test('unknown OR layout stays pending and never fabricates a flat reward',()=>{
 const src=assembled();
 const bad={...src,status:'unresolved-or-layout',
  routeCount:3};
 const projection=projectSiteEvent(bad);
 assert.equal(projection.status,'pending');
 assert.equal(projection.previewEvent,null);
 assert.deepEqual(projection.blockers,['unresolved-or-layout']);
});
test('reordered outcome route or modified aggregate source counts fail closed',()=>{
 const src=assembled();
 const a=structuredClone(src);
 a.joined.routes[1].resultOrdinal=4;
 assert.throws(()=>projectSiteEvent(a),/結果番号/);
 const b=structuredClone(src);
 b.joined.numericEffectCount++;
 assert.throws(()=>projectSiteEvent(b),/元サイトと不一致/);
});
test('source stop is strictly positive, not default false or invented next event',()=>{
 const event=projectSiteEvent(assembled()).previewEvent;
 assert.equal(event.choices[0].outcomes[1].terminal,true);
 assert.equal(Object.hasOwn(event.choices[0].outcomes[0],'terminal'),false);
 assert.equal(Object.hasOwn(event,'requires'),false);
 assert.equal(Object.hasOwn(event.choices[1],'requires'),false);
});

test('projected numeric reward paths fit actual app event validator in memory',()=>{
 const projected=projectSiteEvent(assembled());
 const mockModel={skillById:{
  'skill:200516':{id:'skill:200516',name:'synthetic hint'},
  'skill:200517':{id:'skill:200517',name:'synthetic direct'}
 }};
 assert.doesNotThrow(()=>validateEvents(
  [projected.previewEvent],mockModel,'30324'
 ));
 // Passing a structural validator NEVER lifts source or release gates.
 assert.equal(projected.gameChoiceSemanticsVerified,false);
 assert.equal(projected.publicationApproved,false);
 assert.equal(projected.appEventSchemaAdoptable,false);
});
