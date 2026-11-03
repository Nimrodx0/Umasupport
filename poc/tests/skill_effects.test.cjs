const {test}=require('node:test');
const assert=require('node:assert/strict');
const bridge=require('../src/skill_bridge.js');
const effects=require('../src/skill_effects.js');
function dictionary(records=[]){
 const items=Array.from({length:102},(_,n)=>({
  id:String(500000+n),name:'ダミー'+n,rarity:'normal',group:50000+n
 }));
 records.forEach((x,i)=>{items[i]=x;});
 return JSON.stringify(items);
}
const skill=(id,name,sourceNumericId)=>({id,name,tier:'unknown',lowerId:null,...(sourceNumericId?{sourceNumericId}:{})});
function model(...skills){return {skills,skillById:Object.fromEntries(skills.map(x=>[x.id,x]))};}
test('parses two info strings but keeps them distinct from event rewards',()=>{
 const text=dictionary([{id:'20011',name:'直線巧者',rarity:'normal',group:2001,info:['直線で速度が上がる','発動条件と効果量']}]);
 const record=bridge.parseSource(text).byId.get('20011');
 assert.equal(record.description,'直線で速度が上がる');
 assert.equal(record.technicalDetails,'発動条件と効果量');
});
test('enriches unique named hints and numeric skills without merging duplicate names',()=>{
 const text=dictionary([
  {id:'20011',name:'直線巧者',rarity:'normal',group:2001,info:['直線で速度が上がる','速度2500']},
  {id:'20021',name:'連鎖スキル',rarity:'rare',group:2002,info:['追い抜きで速度が上がる']},
  {id:'20031',name:'同名',rarity:'normal',group:2003,info:['A']},
  {id:'20032',name:'同名',rarity:'rare',group:2003,info:['B']}
 ]);
 const m=model(skill('hint:直線巧者','直線巧者'),skill('skill:20021','連鎖スキル','20021'),skill('hint:同名','同名'));
 const report=effects.attach(m,{skillText:text});
 assert.equal(report.enriched,2);
 assert.equal(m.skillById['hint:直線巧者'].effectDescription,'直線で速度が上がる');
 assert.equal(m.skillById['skill:20021'].effectDescription,'追い抜きで速度が上がる');
 assert.equal(m.skillById['hint:同名'].effectDescription,undefined);
});
test('pinned historical descriptions require a matching numeric ID and verified name',()=>{
 const current=dictionary([{id:'20011',name:'現在名',rarity:'rare',group:2001,info:['現在効果']}]);
 const pinned=dictionary([{id:'20011',name:'旧名',rarity:'rare',group:2001,info:['旧版の効果']}]);
 const m=model(skill('skill:20011','旧名','20011'),skill('hint:旧名','旧名'));
 const r=effects.attach(m,{skillText:current,pinnedSkillText:pinned});
 assert.equal(r.pinned,1);
 assert.equal(m.skillById['skill:20011'].effectDescription,'旧版の効果');
 assert.equal(m.skillById['hint:旧名'].effectDescription,undefined);
});
test('missing effects are not fabricated and malformed sources change nothing',()=>{
 const m=model(skill('hint:unknown','unknown'));
 assert.deepEqual(effects.attach(m,{}),{enriched:0,current:0,pinned:0,total:1,missing:1});
 assert.equal(m.skills[0].effectDescription,undefined);
 assert.throws(()=>effects.attach(m,{skillText:'garbage'}),/JSON形式/);
 assert.equal(m.skills[0].effectDescription,undefined);
});
