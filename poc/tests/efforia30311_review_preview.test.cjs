const {test}=require('node:test');
const assert=require('node:assert/strict');
const preview=require('../src/efforia30311_review_preview.cjs');
const core=require('../src/core.js');
const schema=require('../src/event_schema.js');
const bridge=require('../src/skill_bridge.js');
const publicCatalog=require('../src/public_event_catalog.js');
const ids={
 chain1:'evt_30311_830311001',chain2:'evt_30311_830311002',
 finale:'evt_30311_830311003',other1:'evt_30311_801146001',
 other2:'evt_30311_801146002'
};
function prepared(){
 const catalog=preview.buildUnpublishedPreview();
 const events=catalog.cards[0].events;
 const skillById=Object.fromEntries(Object.entries(preview.SKILLS).map(([n,name])=>
  ['skill:'+n,{id:'skill:'+n,name}]));
 return {catalog,events,model:{cards:[{id:'30311'}],
  cardById:{30311:{id:'30311'}},skillById}};
}
test('five ordered Wiki ID candidates and all eleven GameWith choice positions are represented',()=>{
 const x=preview.inspect();
 assert.equal(x.previewOnly,true);
 assert.equal(x.releaseEligible,false);
 assert.equal(x.sourceEvents,5);
 assert.equal(x.choicePositions,11);
 assert.equal(x.outcomeGroups,6);
 assert.equal(x.finaleSkillHintRows,16);
 assert.equal(x.conditionalRouteRows,16);
 assert.equal(x.allSelectedOption1RouteRows,18);
 assert.equal(x.blockers.length,6);
 assert.deepEqual(prepared().events.map(e=>e.id),[
  ids.chain1,ids.chain2,ids.finale,ids.other1,ids.other2]);
 assert.equal(x.coverage.perCard['30311'].coverageStatus,'partial');
});
test('no choice means zero event skill routes; chain progression requires prior selection',()=>{
 const {events}=prepared();
 const card={events,hints:[]};
 assert.deepEqual(core.directRoutes(card,{choices:{}}),[]);
 assert.deepEqual(core.directRoutes(card,{choices:{[ids.finale]:'option1'}}),[]);
 assert.deepEqual(core.directRoutes(card,{choices:{
  [ids.chain1]:'option1',[ids.chain2]:'option2',[ids.finale]:'option1'
 }}).map(r=>r.skillId),['skill:204532','skill:204701','skill:204531',
                           'skill:204532','skill:204701','skill:204531']);
});
test('success and great-success levels remain conditional, distinct and never get flattened',()=>{
 const {events}=prepared(),card={events,hints:[]};
 const choices={[ids.chain1]:'option1',[ids.chain2]:'option1',
                [ids.finale]:'option2',[ids.other2]:'option2'};
 const routes=core.directRoutes(card,{choices});
 const finale=routes.filter(r=>r.eventId===ids.finale);
 assert.equal(finale.length,4);
 assert.deepEqual(finale.map(r=>r.level),[1,1,2,2]);
 assert.ok(finale.every(r=>r.conditional&&/成功時/.test(r.condition)));
 assert.ok(routes.some(r=>r.eventId===ids.chain2&&r.skillId==='skill:204072'&&!r.conditional));
 assert.ok(!routes.some(r=>r.eventId===ids.other2));
});
test('each finale choice has GameWith-first numeric skill/hint matrix and no unconditional rewards',()=>{
 const {events}=prepared();
 const e=events[2];
 const observed=e.choices.map(c=>c.outcomes.map(o=>o.rewards.map(r=>[
  r.skillId.replace('skill:',''),r.level
 ])));
 assert.deepEqual(observed,[
  [
   [['204532',1],['204701',1],['204531',1]],
   [['204532',5],['204701',2],['204531',2]]
  ],
  [
   [['204701',1],['204571',1]],
   [['204701',2],['204571',2]]
  ],
  [
   [['203712',1],['204701',1],['203711',1]],
   [['203712',5],['204701',2],['203711',2]]
  ]
 ]);
 for(const c of e.choices)assert.equal(c.rewards,undefined);
});
test('runtime numeric bridge accepts numeric IDs/names only against supplied registry',()=>{
 const sample=prepared(),m={
  cards:[{id:'30311',hints:[],events:[]}],
  cardById:{},skillById:{},skills:[],meta:{}
 };
 m.cardById['30311']=m.cards[0];
 const registry=[
  ...Object.entries(preview.SKILLS).map(([id,name])=>({
   id,name,group:Number(id.slice(0,5)),rarity:'normal'
  })),
  ...Array.from({length:110},(_,i)=>({
   id:String(600000+i),name:'架空スキル'+i,group:9000+i,rarity:'normal'
  }))
 ];
 const source=JSON.stringify(registry);
 const summary=publicCatalog.attach(m,sample.catalog,{skillText:source});
 assert.equal(summary.eventsWithRecords,5);
 assert.equal(m.meta.reviewedEventRecords,5); // ONLY in-memory test model
 assert.deepEqual(core.directRoutes(m.cards[0],{choices:{}}),[]);
 const e=m.cards[0].events[2];
 assert.equal(e.choices[0].outcomes[1].rewards[0].skillId,'skill:204532');
 assert.equal(e.choices[0].outcomes[1].rewards[0].verifiedSkillName,undefined);
 const corrupted=JSON.parse(source);
 corrupted[0].name='別スキル';
 const broken={cards:[{id:'30311',hints:[],events:[]}],skillById:{},skills:[],meta:{}};
 broken.cardById={'30311':broken.cards[0]};
 assert.throws(()=>publicCatalog.attach(broken,preview.buildUnpublishedPreview(),
  {skillText:JSON.stringify(corrupted)}),/名称照合が失敗/);
 assert.equal(broken.cards[0].events.length,0);
});
test('ordinary success tiers cannot be mistaken for unconditional bonus and source labels are ordinal only',()=>{
 const {events,model}=prepared();
 schema.validateCatalog(preview.buildUnpublishedPreview(),model);
 for(const e of events){
  for(const [i,c] of e.choices.entries()){
   assert.equal(c.label,'選択肢'+(i+1)+'（位置のみ、仮表示）');
   assert.equal(c.rewards!==undefined&&c.outcomes!==undefined,false);
  }
 }
});
