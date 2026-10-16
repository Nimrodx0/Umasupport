const {test}=require('node:test');
const assert=require('node:assert/strict');
const bridge=require('../src/skill_bridge.js');
const hierarchy=require('../src/skill_hierarchy.js');
const publicEvents=require('../src/public_event_catalog.js');
const core=require('../src/core.js');

function records(){
 return [
  {id:'200591',name:'迅速果断',rarity:'rare',group:20059},
  {id:'200592',name:'位置取り押し上げ',rarity:'normal',group:20059},
  {id:'203561',name:'一所懸命',rarity:'rare',group:20356},
  {id:'203562',name:'奮闘',rarity:'normal',group:20356},
  {id:'203801',name:'解き放つ情念',rarity:'rare',group:20380},
  {id:'203802',name:'想い焦がれて',rarity:'normal',group:20380},
  {id:'200014',name:'右回りの鬼',rarity:'rare',group:20001},
  {id:'200011',name:'右回り◎',rarity:'normal',group:20001},
  {id:'200012',name:'右回り○',rarity:'normal',group:20001},
  {id:'201582',name:'究極のヒルクライマー',rarity:'rare',group:20158},
  {id:'201581',name:'登山家',rarity:'normal',group:20158},
  {id:'202051',name:'大逃げ',rarity:'rare',group:20205},
  ...Array.from({length:120},(_,i)=>({id:String(600000+i),name:'架空'+i,rarity:'normal',group:60000+i}))
 ];
}
const text=(xs=records())=>JSON.stringify(xs);
function model(){
 const card={id:'30001',hints:['hint:右回り○'],hintsByStage:{'4':['hint:右回り○']},events:[]};
 const skill={id:'hint:右回り○',name:'右回り○',tier:'unknown',lowerId:null};
 return {cards:[card],skills:[skill],cardById:{30001:card},
  skillById:{[skill.id]:skill},meta:{}};
}
const empty={schemaVersion:1,cards:[]};
const event=()=>({schemaVersion:1,cards:[{cardId:'30001',events:[{
 id:'fiction',name:'架空イベント',type:'auto',rewards:[
 {skillId:'skill:200014',verifiedSkillName:'右回りの鬼',level:1}
 ]}]}]});

test('full registry hydrates every normal and rare even when reviewed events are empty',()=>{
 const m=model();const before=m.cards[0].hints.slice();
 publicEvents.attach(m,empty,{skillText:text(),fullRegistry:true});
 assert.equal(m.meta.reviewedEventRecords,0);
 assert.equal(m.meta.skillHierarchy.totalRare,6);
 assert.equal(m.meta.skillHierarchy.linked,5);
 assert.equal(m.meta.skillHierarchy.withoutLower,1);
 assert.equal(m.meta.skillHierarchy.unresolved,0);
 assert.deepEqual(m.cards[0].hints,before);
 assert.equal(m.skillById['hint:右回り○'].tier,'white');
 assert.equal(m.skillById['skill:202051'].lowerId,null);
 assert.equal(m.skillById['skill:200591'].lowerId,'skill:200592');
 assert.equal(m.skillById['skill:200014'].lowerId,'skill:200011');
 assert.equal(m.skillById['skill:200011'].lowerId,'hint:右回り○');
 assert.equal(new Set(m.skills.map(s=>s.id)).size,m.skills.length);
 const count=m.skills.length;
 publicEvents.attach(m,empty,{skillText:text(),fullRegistry:true});
 assert.equal(m.skills.length,count);
});
test('source group matching supports rare-2/normal-1 exceptions without false assumptions',()=>{
 const source=bridge.parseSource(text()),r=hierarchy.derive(source);
 assert.ok(r.chains.some(c=>c.gold.id==='201582'&&c.white.id==='201581'));
 assert.equal(r.withoutLower.includes('202051'),true);
});
test('gold -> ◎ -> ○ is a transitive indirect cover, never a direct provider',()=>{
 const m=model();publicEvents.attach(m,event(),{skillText:text(),fullRegistry:true});
 const d={slots:[{cardId:'30001',stage:4,choices:{}}]};
 const got=core.aggregate(d,m);
 assert.equal(got['skill:200014'].count,1);
 // This card already directly hints ○; don't allow the hierarchy to increase it.
 assert.equal(got['hint:右回り○'].count,1);
 assert.equal(core.coverage('skill:200011',got,m).kind,'indirect');
 const goldOnly={'skill:200014':got['skill:200014']};
 assert.equal(core.coverage('hint:右回り○',goldOnly,m).kind,'indirect');
 assert.equal(core.coverage('hint:右回り○',goldOnly,m).count,0);
 const rows=core.combinedRows(got,{},[
  {skillId:'skill:200011',scope:'main'},
  {skillId:'hint:右回り○',scope:'main'}
 ],m);
 const out=core.hierarchyRows(rows,m);
 const g=out.findIndex(row=>row.skill.id==='skill:200014');
 assert.deepEqual(out.slice(g,g+3).map(x=>x.skill.id),[
  'skill:200014','skill:200011','hint:右回り○'
 ]);
 assert.equal(out[g+2].hierarchyDepth,2);
});
test('groups with extra unranked normal variants are quarantined instead of guessed',()=>{
 const xs=records();xs.push({id:'200013',name:'右回り△',rarity:'normal',group:20001});
 const m=model();publicEvents.attach(m,empty,{skillText:text(xs),fullRegistry:true});
 assert.equal(m.meta.skillHierarchy.unresolved,1);
 assert.equal(m.skillById['skill:200014'].lowerId,null);
 assert.equal(m.skillById['skill:200011'].lowerId,null);
});
test('full-registry updates are atomic when the catalog is invalid',()=>{
 const m=model(),before=m.skills.length;
 const bad={schemaVersion:1,cards:[{cardId:'30001',events:[{
 id:'a',name:'架空',type:'auto',rewards:[{skillId:'nonexistent',level:1}]}]}]};
 assert.throws(()=>publicEvents.attach(m,bad,{skillText:text(),fullRegistry:true}),/未収録/);
 assert.equal(m.skills.length,before);
 assert.equal(m.skillById['skill:200014'],undefined);
 assert.equal(m.skillById['hint:右回り○'].tier,'unknown');
});
