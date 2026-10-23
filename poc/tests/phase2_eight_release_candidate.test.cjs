'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build,dryRunWithSkillText,candidateId}=
 require('../src/phase2_eight_release_candidate.cjs');
const {verifyRelease,digest}=require('../src/event_release_gate.cjs');
const schema=require('../src/event_schema.js');
const bridge=require('../src/skill_bridge.js');
const {buildView,HINT_NAMES}=require('../src/phase2_eight_event_review_view.cjs');
const PUBLIC=require('../data/reviewed_events.v1.json');
const APPROVALS=require('../config/event-release-approvals.v1.json');
const clone=x=>structuredClone(x);
const source=()=>{
 const out=Object.entries(HINT_NAMES).map(([id,name])=>({
  id,name,rarity:'normal',group:Math.floor(Number(id)/10)
 }));
 for(let i=0;i<105;i++)
  out.push({id:String(900000+i),name:'合成_'+i,
   rarity:'normal',group:90000+i});
 return JSON.stringify(out);
};
test('all eight distinct editorial headings and source positions have stable non-game IDs',()=>{
 const p=build(),view=buildView();
 assert.deepEqual(p.summary,{cards:4,events:8,choices:16,hints:4,approvedEvents:0});
 assert.equal(p.status,'NOT_APPROVED_FOR_PUBLICATION');
 for(const card of p.catalog.cards){
  const src=view.cards.find(c=>c.cardId===card.cardId);
  assert.equal(card.coverageStatus,'partial');
  assert.equal(card.events.length,2);
  card.events.forEach((e,i)=>{
   const from=src.events[i];
   assert.equal(e.id,candidateId(card.cardId,from.editorialOrdinal));
   assert.equal(e.name,from.eventTitle);
   assert.equal(e.type,'choice');
   assert.equal(e.requires,undefined);
   assert.deepEqual(e.choices.map(c=>[c.id,c.label]),
    [['option1','上の選択肢'],['option2','下の選択肢']]);
   assert.equal(digest(e),p.approvalWorksheet.entries
    .find(x=>x.eventId===e.id).eventSha256);
   e.choices.forEach((choice,j)=>{
    assert.deepEqual(choice.rewards,from.choices[j].hints.map(h=>({
     skillId:h.skillId,verifiedSkillName:h.displayName,level:h.level
    })));
   });
  });
 }
 assert.deepEqual(p.catalog.cards.flatMap(c=>c.events.flatMap(e=>
  e.choices.flatMap(x=>x.rewards.map(y=>[c.cardId,e.id,y.skillId,y.level])))),
  [['30318','usl:30318:random:5','skill:200152',1],
   ['30319','usl:30319:random:5','skill:201641',1],
   ['30320','usl:30320:random:5','skill:202082',1],
   ['30321','usl:30321:random:5','skill:202602',1]]);
});
test('candidate is schema-valid but cannot pass publication without actual human review',()=>{
 const p=build();
 assert.equal(verifyRelease(PUBLIC,APPROVALS).publicEvents,0);
 assert.throws(()=>verifyRelease(p.catalog,p.approvalWorksheet),/レビュー者または確認日が不正/);
 const e=p.approvalWorksheet.entries[0];
 assert.equal(e.publicationBasis,null);
 assert.equal(e.status,'PENDING_HUMAN_RELEASE_REVIEW');
 assert.ok(p.approvalWorksheet.entries.every(x=>
  Object.values(x.checks).every(b=>b===false)&&
  x.evidence.publication.length===0));
 assert.equal(p.sourceNarrativeOrChoiceProseIncluded,false);
 assert.ok(!JSON.stringify(p).includes('体育館を借りて走ろう'));
 const model={cards:p.catalog.cards.map(c=>({id:c.cardId})),
  cardById:Object.fromEntries(p.catalog.cards.map(c=>[c.cardId,{id:c.cardId}])),
  skillById:Object.fromEntries(Object.keys(HINT_NAMES).map(id=>['skill:'+id,{id:'skill:'+id}]))};
 assert.equal(schema.validateCatalog(p.catalog,model).eventsWithRecords,8);
});
test('actual public loader preflight resolves four numeric hints against a source-style skill dictionary',()=>{
 const r=dryRunWithSkillText(source());
 assert.deepEqual(r,{matchedEvents:8,uniqueCards:4,resolvedSkills:4});
 const changed=JSON.parse(source());
 changed.find(x=>x.id==='201641').name='違う名前';
 assert.throws(()=>dryRunWithSkillText(JSON.stringify(changed)),/名称照合が失敗/);
 changed.find(x=>x.id==='201641').name=HINT_NAMES[201641];
 changed.find(x=>x.id==='201641').rarity='minus';
 assert.throws(()=>dryRunWithSkillText(JSON.stringify(changed)),/報酬種別と数値スキル分類が不一致/);
});
test('pinned card/event range is closed; public DB and approval ledger remain untouched',()=>{
 for(const [c,o] of [['30318',3],['30322',4],['30320',6],['30318',0]])
  assert.throws(()=>candidateId(c,o),/対象外/);
 const p=build();
 p.catalog.cards[0].events[0].choices[0].rewards.push({
  skillId:'skill:200152',verifiedSkillName:'良バ場○',level:9});
 assert.notEqual(digest(p.catalog.cards[0].events[0]),
  p.approvalWorksheet.entries[0].eventSha256);
 assert.throws(()=>verifyRelease(p.catalog,p.approvalWorksheet));
 assert.deepEqual(PUBLIC,{schemaVersion:1,cards:[]});
 assert.deepEqual(APPROVALS,{schemaVersion:1,entries:[]});
});
