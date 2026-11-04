const {test}=require('node:test');
const assert=require('node:assert/strict');
const scope=require('../src/skill_scope.js');
const core=require('../src/core.js');
const search=require('../src/card_search.js');
function registry(entries=[]){
 const rows=Array.from({length:101},(_,i)=>({
  id:String(800000+i),name:'架空スキル'+i,rarity:'normal',group:10000+i
 }));
 rows.splice(0,entries.length,...entries);
 return JSON.stringify(rows);
}
const entry=(id,name)=>({id,name,rarity:'normal',group:Number(id)});
function fixture(){
 const skills=[
  {id:'hint:直線巧者',name:'直線巧者'},
  {id:'hint:旧デバフ',name:'旧デバフ'},
  {id:'skill:700200',name:'現行イベント',sourceNumericId:'700200'},
  {id:'skill:700300',name:'旧版イベント',sourceNumericId:'700300'},
  {id:'skill:700500',name:'旧版の同ID名',sourceNumericId:'700500'},
  {id:'skill:200801',name:'先行駆け引き',sourceNumericId:'200801'}
 ];
 const card={id:'30001',name:'確認用カード',sourceStatus:'verified_hints',
  hintsByStage:Object.fromEntries([0,1,2,3,4].map(i=>[String(i),['hint:直線巧者','hint:旧デバフ']])),
  hints:['hint:直線巧者','hint:旧デバフ'],
  events:[{id:'e1',name:'検証イベント',type:'auto',rewards:[
   {skillId:'skill:700200',level:1},{skillId:'skill:700300',level:1},
   {skillId:'skill:200801',level:1}
  ]}]
 };
 return {skills,card,model:{skills,skillById:Object.fromEntries(skills.map(s=>[s.id,s])),
  cards:[card],cardById:{30001:card},meta:{reviewedEventRecords:1}}};
}
function sources(){
 const current=registry([
  entry('700100','直線巧者'),entry('700200','現行イベント'),
  entry('700500','改名済みの別名')
 ]);
 const pinned=registry([
  entry('700300','旧版イベント'),entry('700500','旧版の同ID名')
 ]);
 return {skillText:current,pinnedSkillText:pinned};
}
test('unlisted skill hints and event IDs are excluded without mutating reviewed events',()=>{
 const {card,model}=fixture(),eventBefore=JSON.stringify(card.events);
 const goals=[{skillId:'skill:200801',scope:'either'}];
 const result=scope.apply(model,sources());
 assert.deepEqual(result,{applied:true,excluded:2,registered:4,excludedHints:1,
  excludedNumeric:1,source:'UmaSim skill_data.txt, unique name or matched numeric ID'});
 assert.deepEqual(model.skills.map(s=>s.id),[
  'hint:直線巧者','skill:700200','skill:700300','skill:700500'
 ]);
 assert.equal(model.skillById['skill:200801'].excludedFromUmaSim,true);
 assert.equal(model.skillById['hint:旧デバフ'].excludedFromUmaSim,true);
 assert.deepEqual(card.hintsByStage['0'],['hint:直線巧者']);
 assert.deepEqual(card.hints,['hint:直線巧者']);
 assert.equal(JSON.stringify(card.events),eventBefore,
  'Validated original event records and their reward identities must be unchanged');
 assert.deepEqual(core.directRoutes(card,{stage:4,choices:{}}).map(r=>r.skillId),
  ['hint:直線巧者','skill:700200','skill:700300']);
 assert.deepEqual([...search.approvedEventSkillIds(card,model)],
  ['skill:700200','skill:700300']);
 assert.deepEqual([...search.normalHintIds(card,model)],['hint:直線巧者']);
 const deck={slots:[{cardId:card.id,stage:4,choices:{},outcomes:{}}]};
 assert.deepEqual(Object.keys(core.aggregate(deck,model)),
  ['hint:直線巧者','skill:700200','skill:700300']);
 assert.deepEqual(goals,[{skillId:'skill:200801',scope:'either'}],
  'Previously saved goals must not be silently rewritten');
});
test('missing skill source does not guess that verified hints are absent',()=>{
 const {model}=fixture();
 assert.deepEqual(scope.apply(model,{}),{applied:false,
  reason:'skill-data-unavailable',excluded:0,registered:6});
 assert.equal(model.skills.length,6);
 assert.equal(model.cards[0].hints.length,2);
});
test('invalid dictionary is rejected before changing any skill or card',()=>{
 const {model,card}=fixture(),before=JSON.stringify({skills:model.skills,card});
 assert.throws(()=>scope.apply(model,{skillText:'invalid'}),/JSON形式/);
 assert.equal(JSON.stringify({skills:model.skills,card}),before);
});
