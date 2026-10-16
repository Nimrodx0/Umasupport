const {test}=require('node:test');
const assert=require('node:assert/strict');
const hierarchy=require('../src/skill_hierarchy.js');
const events=require('../src/public_event_catalog.js');
const bridge=require('../src/skill_bridge.js');
const core=require('../src/core.js');
const fixtureSource=()=>[
 {id:'200591',name:'迅速果断',rarity:'rare',group:20059},
 {id:'200592',name:'位置取り押し上げ',rarity:'normal',group:20059},
 {id:'203561',name:'一所懸命',rarity:'rare',group:20356},
 {id:'203562',name:'奮闘',rarity:'normal',group:20356},
 {id:'203801',name:'解き放つ情念',rarity:'rare',group:20380},
 {id:'203802',name:'想い焦がれて',rarity:'normal',group:20380},
 {id:'999991',name:'未承認の金',rarity:'rare',group:99999},
 {id:'999992',name:'未承認の白',rarity:'normal',group:99999},
 ...Array.from({length:110},(_,i)=>({id:String(80000+i),name:'別の架空スキル'+i,rarity:'normal',group:80000+i}))
];
const text=rows=>JSON.stringify(rows||fixtureSource());
function model(withHint=false){
 const card={id:'30001',hints:[],events:[]},skills=[],skillById={};
 if(withHint){
  const white={id:'hint:位置取り押し上げ',name:'位置取り押し上げ',tier:'unknown',lowerId:null};
  skills.push(white);skillById[white.id]=white;
 }
 return {cards:[card],skills,cardById:{30001:card},skillById,meta:{}};
}
const numeric=(id,name)=>({skillId:'skill:'+id,verifiedSkillName:name,level:1});
const catalog=(reward)=>({schemaVersion:1,cards:[{cardId:'30001',coverageStatus:'partial',events:[
 {id:'verified-fictional-event',name:'架空イベント',type:'auto',rewards:[reward]}]}]});

test('three reviewed pairs have unique numeric keys and provenance',()=>{
 assert.equal(hierarchy.PAIRS.length,3);
 const ids=new Set();
 for(const pair of hierarchy.PAIRS){
  assert.ok(!ids.has(pair.goldId));ids.add(pair.goldId);
  assert.ok(pair.evidence.every(url=>url.startsWith('https://')));
  assert.equal(pair.group,Math.floor(Number(pair.goldId)/10));
  assert.equal(pair.group,Math.floor(Number(pair.whiteId)/10));
 }
});
test('reviewed gold links to existing hint when available, without inflating direct providers',()=>{
 const m=model(true);
 events.attach(m,catalog(numeric('200591','迅速果断')),{skillText:text()});
 assert.equal(m.skillById['skill:200591'].lowerId,'hint:位置取り押し上げ');
 assert.equal(m.skills.length,2);
 assert.equal(m.meta.reviewedHierarchyPairs,1);
 const aggregated=core.aggregate({slots:[{cardId:'30001',stage:4,choices:{}}]},m);
 assert.equal(core.coverage('hint:位置取り押し上げ',aggregated,m).kind,'indirect');
 assert.equal(aggregated['hint:位置取り押し上げ'],undefined);
 const rows=core.combinedRows(aggregated,{},[{skillId:'hint:位置取り押し上げ'}],m);
 assert.deepEqual(core.hierarchyRows(rows,m).map(r=>r.skill.id),['skill:200591','hint:位置取り押し上げ']);
});
test('when no normal hint exists, a separately addressable white skill is staged',()=>{
 const m=model();
 events.attach(m,catalog(numeric('203561','一所懸命')),{skillText:text()});
 assert.equal(m.skillById['skill:203561'].lowerId,'skill:203562');
 assert.equal(m.skillById['skill:203562'].tier,'white');
 assert.equal(m.skillById['skill:203562'].name,'奮闘');
 assert.equal(m.skills.length,2);
 const main=core.aggregate({slots:[{cardId:'30001',stage:4,choices:{}}]},m);
 assert.equal(core.coverage('skill:203562',main,m).kind,'indirect');
 // Reattachment is idempotent with respect to the skill dictionary.
 events.attach(m,catalog(numeric('203561','一所懸命')),{skillText:text()});
 assert.equal(m.skills.length,2);
});
test('one rare and one normal in one stable group can be paired by source data',()=>{
 const m=model();
 events.attach(m,catalog(numeric('999991','未承認の金')),{skillText:text()});
 assert.equal(m.skillById['skill:999991'].lowerId,'skill:999992');
 assert.equal(m.meta.reviewedHierarchyPairs,1);
});
test('approved links fail closed on unexpected source name, rarity, group or ambiguous names',()=>{
 const edits=[
  rows=>{rows[1].name='無関係';},
  rows=>{rows[1].group=999;},
  rows=>{rows[0].rarity='normal';},
  rows=>{rows[8].name='位置取り押し上げ';}
 ];
 for(const edit of edits){
  const rows=fixtureSource();edit(rows);
  const m=model(),incoming=catalog(numeric('200591','迅速果断'));
  assert.throws(()=>events.attach(m,incoming,{skillText:text(rows)}),/上下関係/);
  assert.equal(m.skills.length,0);
  assert.equal(m.cards[0].events.length,0);
  assert.equal(m.meta.reviewedHierarchyPairs,undefined);
  assert.equal(incoming.cards[0].events[0].rewards[0].verifiedSkillName,'迅速果断');
 }
});
test('an existing incompatible gold-to-white relation is rejected atomically',()=>{
 const m=model();
 const old={id:'skill:203801',name:'解き放つ情念',tier:'gold',lowerId:'unrelated'};
 m.skills.push(old);m.skillById[old.id]=old;
 assert.throws(()=>events.attach(m,catalog(numeric('203801','解き放つ情念')),{skillText:text()}),/既存の上下関係/);
 assert.equal(m.skillById['skill:203801'].lowerId,'unrelated');
 assert.equal(m.skillById['skill:203802'],undefined);
 assert.equal(m.cards[0].events.length,0);
});
test('source parser reports reviewed pair IDs unambiguously in the fixture',()=>{
 const s=bridge.parseSource(text());
 for(const p of hierarchy.PAIRS){
  assert.equal(s.byId.get(p.goldId).name,p.goldName);
  assert.equal(s.byId.get(p.whiteId).name,p.whiteName);
 }
});
