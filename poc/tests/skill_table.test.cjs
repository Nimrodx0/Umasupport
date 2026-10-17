'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/core.js');
const {build,matches,hasRoute,goalUncovered}=require('../src/skill_table.js');

const provider=(count,source,conditional=false)=>({
 count,providers:{p:{cardId:'card-x',slotIndex:0,routes:[{source,conditional}]}}
});
function fixtures(){
 const skills=[
  {id:'gold',name:'金の星',tier:'gold',lowerId:'white'},
  {id:'white',name:'星の欠片',tier:'white',lowerId:null},
  {id:'solo',name:'夜明け',tier:'unknown',lowerId:null},
  {id:'goal',name:'未獲得の夢',tier:'white',lowerId:null},
  {id:'conditional',name:'青い技',tier:'white',lowerId:null}
 ];
 const m=Object.fromEntries(skills.map(s=>[s.id,s]));
 const C=(kind)=>({kind,conditional:false,count:kind==='direct'?1:0});
 const row=(id,main,inherit,goal,mainKind,inheritKind)=>({
  skill:m[id],main,inherit,goal,
  mainCover:C(mainKind),inheritCover:C(inheritKind)
 });
 const rows=[
  row('gold',{count:5,providers:{a:{routes:[{source:'hint'}]},b:{routes:[{source:'event',conditional:true}]}}},null,null,'direct','missing'),
  row('white',provider(1,'hint'),null,null,'direct','indirect'),
  row('solo',provider(6,'event'),provider(2,'hint'),null,'direct','direct'),
  row('goal',null,null,{skillId:'goal',scope:'main'},'missing','indirect'),
  row('conditional',provider(1,'event',true),null,{skillId:'conditional',scope:'both'},'direct','missing')
 ];
 return {rows,data:{skills,skillById:m}};
}
test('all comparison filters only inspect direct source routes, not indirect coverage',()=>{
 const {rows,data}=fixtures();
 assert.deepEqual(build(rows,core,data,{route:'hint'}).map(r=>r.skill.id),['gold','white','solo']);
 assert.deepEqual(build(rows,core,data,{route:'event'}).map(r=>r.skill.id),['conditional','gold','solo']);
 assert.deepEqual(build(rows,core,data,{route:'both'}).map(r=>r.skill.id),['gold']);
 assert.deepEqual(build(rows,core,data,{coverage:'indirect'}).map(r=>r.skill.id),['goal']);
 assert.deepEqual(build(rows,core,data,{coverage:'uncovered'}).map(r=>r.skill.id),['goal','conditional']);
 assert.deepEqual(build(rows,core,data,{coverage:'conditional'}).map(r=>r.skill.id),['conditional','gold']);
 assert.deepEqual(build(rows,core,data,{tier:'gold'}).map(r=>r.skill.id),['gold']);
 assert.deepEqual(build(rows,core,data,{onlyGoals:true}).map(r=>r.skill.id),['goal','conditional']);
 assert.equal(hasRoute(rows[3],'hint'),false);
 assert.equal(goalUncovered(rows[4],core,data),true);
 assert.equal(matches(rows[1],{query:'星の'},core,data),true);
 assert.equal(matches(rows[1],{query:'存在しない'},core,data),false);
});
test('group-aware sorting keeps a gold parent adjacent to its white child',()=>{
 const {rows,data}=fixtures();
 const original=JSON.stringify(rows);
 const view=build(rows,core,data,{sort:'total-desc'});
 assert.deepEqual(view.map(r=>r.skill.id),['solo','gold','white','conditional','goal']);
 assert.equal(view[1].groupRole,'parent');
 assert.equal(view[2].groupRole,'child');
 assert.equal(view[2].parentSkillId,'gold');
 assert.equal(view[2].hierarchyDepth,1);
 const main=build(rows,core,data,{sort:'main-desc'});
 assert.deepEqual(main.map(r=>r.skill.id),['solo','gold','white','conditional','goal']);
 const inherit=build(rows,core,data,{sort:'inherit-desc'});
 assert.equal(inherit[0].skill.id,'solo');
 const goalFirst=build(rows,core,data,{sort:'goals-first'});
 assert.deepEqual(goalFirst.slice(0,2).map(r=>r.skill.id).sort(),['conditional','goal']);
 assert.equal(JSON.stringify(rows),original,'sort must never mutate source aggregate');
});
test('filtered-out gold leaves white as independent direct-count row',()=>{
 const {rows,data}=fixtures();
 const view=build(rows,core,data,{tier:'white',sort:'total-desc'});
 const white=view.find(r=>r.skill.id==='white');
 assert.equal(white.groupRole,'solo');
 assert.equal(white.main.count,1);
 assert.equal(white.hierarchyDepth,0);
 assert.equal(view.some(r=>r.skill.id==='gold'),false);
});
test('uncovered target is scope-sensitive, not simply both decks absent',()=>{
 const {rows,data}=fixtures();
 const desired={...rows[4],goal:{skillId:'conditional',scope:'either'}};
 assert.equal(goalUncovered(desired,core,data),false);
 assert.equal(goalUncovered({...desired,goal:{skillId:'conditional',scope:'inherit'}},core,data),true);
 assert.equal(goalUncovered({...desired,goal:{skillId:'conditional',scope:'main'}},core,data),false);
 assert.equal(goalUncovered({...desired,goal:{skillId:'conditional',scope:'both'}},core,data),true);
});
test('unknown sort and invalid view inputs fail closed',()=>{
 const {rows,data}=fixtures();
 assert.throws(()=>build(rows,core,data,{sort:'random'}),/Unsupported skill sort/);
 assert.throws(()=>build({},core,data,{}),/Invalid skill view/);
 assert.equal(matches(rows[0],{route:'invalid'},core,data),false);
 assert.equal(matches(rows[0],{coverage:'invalid'},core,data),false);
});
