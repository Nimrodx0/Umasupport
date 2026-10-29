'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {discoverNewCards,discoverNewCardsFromUmaSim,stageNewCardEvents,appendApprovedNewCards}=
 require('../src/new_card_event_incremental.cjs');
const {digest}=require('../src/event_release_gate.cjs');
const model={cards:[{id:'30001'},{id:'30322'},{id:'30323'}],
 cardById:{30001:{id:'30001'},30322:{id:'30322'},30323:{id:'30323'}},
 skillById:{'200101':{id:'200101'},'200202':{id:'200202'}}};
const oldEvent={id:'gt:30001:1',name:'既存イベント',type:'auto',rewards:[
 {skillId:'200101',level:1}]};
const newEvent=id=>({id:'gt:'+id+':1',name:'追加カードのイベント1',
 type:'choice',choices:[{id:'group-1',label:'選択肢1',outcomes:[
  {id:'result-1',label:'結果1',rewards:[{skillId:'200202',level:1}]},
  {id:'result-2',label:'結果2',rewards:[{skillId:'200202',level:2}]}
 ]}]});
const catalog=()=>({schemaVersion:1,cards:[
 {cardId:'30001',coverageStatus:'partial',events:[structuredClone(oldEvent)]}]});
const checks=Object.fromEntries(
 ['card','event','choices','outcomes','dependencies','publication'].map(x=>[x,true]));
const evidence=Object.fromEntries(
 Object.keys(checks).map(x=>[x,['https://example.org/evidence']]));
const approval=(cardId,event)=>({
 cardId,eventId:event.id,eventSha256:digest(event),
 reviewer:'test-reviewer',reviewedAt:'2026-10-29',
 checks:structuredClone(checks),evidence:structuredClone(evidence),
 publicationBasis:{kind:'original-factual-description',reason:'synthetic test'}
});
const approvedOld=()=>({schemaVersion:1,entries:[approval('30001',oldEvent)]});
const candidate=id=>({
 source:'GameTora-original-site',cardId:id,
 sourceSiteTextCopied:false,publicationApproved:false,
 appEventSchemaAdoptable:false,
 siteEventPanelCount:1,convertedEventCount:1,unresolvedEventCount:0,
 events:[newEvent(id)]});
const discovery=()=>discoverNewCards({
 previousRosterIds:['30001'],currentRosterIds:['30322','30001','30323']});
test('discovery handles new card IDs, not changes to old cards',()=>{
 const p=discovery();
 assert.deepEqual(p.addedCardIds,['30322','30323']);
 assert.deepEqual(p.existingCardIds,['30001']);
 assert.equal(p.sourceEventFactsVerified,false);
 assert.equal(p.publicationApproved,false);
});
test('staging lists missing cards separately and never pretends to publish',()=>{
 const s=stageNewCardEvents({discovery:discovery(),existingCatalog:catalog(),
  candidates:[candidate('30322')]});
 assert.deepEqual(s.ready.map(x=>x.cardId),['30322']);
 assert.deepEqual(s.pending,[{cardId:'30323',reason:'not-yet-fetched'}]);
 assert.equal(s.appEventSchemaAdoptable,false);
 assert.equal(s.publicationApproved,false);
});
test('stage rejects partial source instead of inventing empty rewards',()=>{
 const item=candidate('30322');
 item.siteEventPanelCount=2;
 item.unresolvedEventCount=1;
 const s=stageNewCardEvents({discovery:discovery(),existingCatalog:catalog(),
  candidates:[item,candidate('30323')]});
 assert.equal(s.ready.length,1);
 assert.deepEqual(s.pending.map(x=>x.cardId),['30322']);
 const committed=appendApprovedNewCards({discovery:discovery(),
  existingCatalog:catalog(),candidates:[item,candidate('30323')],
  existingApprovals:approvedOld(),
  newApprovals:{schemaVersion:1,entries:[approval('30323',newEvent('30323'))]},
  model});
 assert.equal(committed.status,'pending');
 assert.equal(committed.catalog,null);
 assert.equal(committed.existingCatalogUnchanged,true);
});
test('append two NEW approved cards while preserving existing blocks exactly',()=>{
 const before=catalog(),old=approvedOld();
 const beforeJson=JSON.stringify(before),oldJson=JSON.stringify(old);
 const next=appendApprovedNewCards({discovery:discovery(),existingCatalog:before,
  candidates:[candidate('30323'),candidate('30322')],
  existingApprovals:old,
  newApprovals:{schemaVersion:1,entries:[
   approval('30322',newEvent('30322')),approval('30323',newEvent('30323'))]},
  model});
 assert.equal(next.status,'ready-to-append');
 assert.equal(next.appendedCardCount,2);
 assert.equal(next.appendedEventCount,2);
 assert.deepEqual(next.catalog.cards.map(x=>x.cardId),['30001','30322','30323']);
 assert.equal(JSON.stringify(next.catalog.cards[0]),JSON.stringify(before.cards[0]));
 assert.equal(JSON.stringify(next.approvals.entries[0]),JSON.stringify(old.entries[0]));
 assert.equal(JSON.stringify(before),beforeJson);
 assert.equal(JSON.stringify(old),oldJson);
 assert.equal(next.catalog.cards[1].events[0].choices[0].outcomes[0].label,'結果1');
 assert.equal(next.catalog.cards[1].events[0].choices[0].outcomes[1].rewards[0].level,2);
});
test('same roster on second run is idempotent (no reimport, no overwrite)',()=>{
 const now=discoverNewCards({
  previousRosterIds:['30001','30322','30323'],
  currentRosterIds:['30001','30322','30323']});
 const full=appendApprovedNewCards({discovery:now,
  existingCatalog:{schemaVersion:1,cards:[
   catalog().cards[0],{cardId:'30322',coverageStatus:'partial',events:[newEvent('30322')]},
   {cardId:'30323',coverageStatus:'partial',events:[newEvent('30323')]}]},
  candidates:[],
  existingApprovals:{schemaVersion:1,entries:[
   approval('30001',oldEvent),approval('30322',newEvent('30322')),
   approval('30323',newEvent('30323'))]},
  newApprovals:{schemaVersion:1,entries:[]},model});
 assert.equal(full.status,'unchanged');
 assert.equal(full.catalog.cards.length,3);
});
test('existing card cannot be replaced or smuggled in as newly added',()=>{
 const c=catalog();
 assert.throws(()=>stageNewCardEvents({discovery:discovery(),
  existingCatalog:c,candidates:[candidate('30001')]}),/置換・追加対象外/);
 assert.throws(()=>stageNewCardEvents({discovery:discovery(),
  existingCatalog:c,candidates:[candidate('30322'),candidate('30322')]}),/重複/);
 assert.throws(()=>stageNewCardEvents({discovery:discovery(),
  existingCatalog:c,candidates:[candidate('30002')]}),/置換・追加対象外/);
});
test('failure on one new card must not mutate existing catalog or approvals',()=>{
 const before=catalog(),old=approvedOld();
 const initial=JSON.stringify({before,old});
 const broken=candidate('30323');
 broken.events[0].choices[0].outcomes[0].rewards[0].skillId='999999';
 assert.throws(()=>appendApprovedNewCards({discovery:discovery(),
  existingCatalog:before,candidates:[candidate('30322'),broken],
  existingApprovals:old,newApprovals:{schemaVersion:1,entries:[
   approval('30322',newEvent('30322')),approval('30323',broken.events[0])]},
  model}),/未収録スキルID/);
 assert.equal(JSON.stringify({before,old}),initial);
});
test('missing or tampered per-event release approval must fail closed',()=>{
 const input={discovery:discovery(),existingCatalog:catalog(),
  candidates:[candidate('30322'),candidate('30323')],
  existingApprovals:approvedOld(),
  newApprovals:{schemaVersion:1,entries:[approval('30322',newEvent('30322'))]},
  model};
 assert.throws(()=>appendApprovedNewCards(input),/全イベントの個別公開承認/);
 input.newApprovals.entries.push(approval('30323',newEvent('30323')));
 input.newApprovals.entries[1].eventSha256='0'.repeat(64);
 assert.throws(()=>appendApprovedNewCards(input),/SHA不一致/);
});
test('outage, roster truncation and bad source classification never delete cards',()=>{
 assert.throws(()=>discoverNewCards({previousRosterIds:['30001','30322'],
  currentRosterIds:['30001']}),/旧カードが消滅/);
 assert.throws(()=>discoverNewCards({previousRosterIds:[],
  currentRosterIds:['30322']}),/名簿が空/);
 const bad=candidate('30322');
 bad.source='GameWith';
 assert.throws(()=>stageNewCardEvents({discovery:discovery(),
  existingCatalog:catalog(),candidates:[bad]}),/元サイトカード別入力/);
 const other=candidate('30323');other.siteEventPanelCount=0;
 assert.throws(()=>stageNewCardEvents({discovery:discovery(),
  existingCatalog:catalog(),candidates:[other]}),/元サイトカード別入力/);
});
test('unapproved event draft never bypasses publication verification',()=>{
 const n=discovery();
 const item=candidate('30322');
 item.events[0].choices[0].outcomes[0].unresolvedRewards=[{skillId:'200202'}];
 const s=stageNewCardEvents({discovery:n,existingCatalog:catalog(),
  candidates:[item,candidate('30323')]});
 assert.equal(s.ready.length,2,'stage may hold opaque candidate, not publish');
 const input={discovery:n,existingCatalog:catalog(),candidates:[
  item,candidate('30323')],existingApprovals:approvedOld(),
  newApprovals:{schemaVersion:1,entries:[
   approval('30322',item.events[0]),approval('30323',newEvent('30323'))]},
  model};
 assert.throws(()=>appendApprovedNewCards(input),/未照合報酬|未承認/);
});

function supportRow(id,stage){
 const f=Array(62).fill('0');
 f[0]=id;f[1]='[Synthetic]カタログ'+id;f[3]='2';
 f[4]=String(stage);f[6]='スピード';f[59]='末脚';
 return f.join('\t');
}
test('actual live UmaSim TSV parser discovers any new five-digit card ID',()=>{
 const old=Array.from({length:500},(_,i)=>String(10000+i))
  .flatMap(id=>Array.from({length:5},(_,stage)=>supportRow(id,stage)));
 const next=old.concat(Array.from({length:5},(_,stage)=>supportRow('30323',stage)));
 const delta=discoverNewCardsFromUmaSim({
  previousSupportText:old.join('\n')+'\n',
  currentSupportText:next.join('\n')+'\n'
 });
 assert.deepEqual(delta.addedCardIds,['30323']);
 assert.equal(delta.previousRosterCount,500);
 assert.equal(delta.currentRosterCount,501);
 assert.equal(delta.previousRosterStageRows,2500);
 assert.equal(delta.currentRosterStageRows,2505);
});

test('real public skill bridge validates original numeric skill ID and name on append',()=>{
 const registry=JSON.stringify(Array.from({length:101},(_,i)=>({
  id:String(300000+i),name:'合成数値スキル'+i,rarity:'normal',group:i
 })));
 const newCards=[candidate('30322'),candidate('30323')];
 newCards[0].events[0].choices[0].outcomes[0].rewards=[{
  skillId:'skill:300000',verifiedSkillName:'合成数値スキル0',level:1
 }];
 const incoming={schemaVersion:1,entries:[
  approval('30322',newCards[0].events[0]),
  approval('30323',newCards[1].events[0])
 ]};
 const next=appendApprovedNewCards({discovery:discovery(),
  existingCatalog:catalog(),candidates:newCards,
  existingApprovals:approvedOld(),newApprovals:incoming,
  model,skillText:registry});
 assert.equal(next.status,'ready-to-append');
 assert.equal(next.catalog.cards[1].events[0].choices[0].outcomes[0]
  .rewards[0].skillId,'skill:300000');
 assert.equal(next.existingCatalogUnchanged,true);
 const bad=structuredClone(newCards);
 bad[0].events[0].choices[0].outcomes[0].rewards[0].verifiedSkillName=
  '違うスキル';
 const wrongApproval={schemaVersion:1,entries:[
  approval('30322',bad[0].events[0]),
  approval('30323',bad[1].events[0])
 ]};
 assert.throws(()=>appendApprovedNewCards({discovery:discovery(),
  existingCatalog:catalog(),candidates:bad,
  existingApprovals:approvedOld(),newApprovals:wrongApproval,
  model,skillText:registry}),/名称照合が失敗/);
});
