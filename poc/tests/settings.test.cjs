const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('../src/settings.js');
const slot=(cardId=null)=>({cardId,stage:4,choices:{}});
const sample=()=>({version:1,decks:{main:{name:'本育成',slots:[slot('legacy-card'),...Array.from({length:5},()=>slot())]},inherit:{name:'継承',slots:Array.from({length:6},()=>slot())}},goalSets:[{id:'g1',name:'目標',goals:[{skillId:'legacy-skill',scope:'either'}]}],currentGoalSet:'g1',view:'integrated',density:'compact'});
const data={cardById:{'new-card':{id:'new-card'}},skillById:{'hint:new-skill':{id:'hint:new-skill'}},meta:{aliasCardIds:{'legacy-card':'new-card'},aliasSkillIds:{'legacy-skill':'hint:new-skill'}}};
test('reviewed aliases migrate both card and skill IDs before checking references',()=>{
 const input=sample(),r=parse(input,data);
 assert.equal(r.state.decks.main.slots[0].cardId,'new-card');
 assert.equal(r.state.goalSets[0].goals[0].skillId,'hint:new-skill');
 assert.deepEqual(r.missing,{cards:[],skills:[]});
 assert.equal(input.decks.main.slots[0].cardId,'legacy-card');
});
test('unresolved card and skill IDs survive without guessing',()=>{
 const d={...data,meta:{aliasCardIds:{'legacy-card':'does-not-exist'}}};
 const r=parse(sample(),d);
 assert.equal(r.state.decks.main.slots[0].cardId,'legacy-card');
 assert.equal(r.state.goalSets[0].goals[0].skillId,'legacy-skill');
 assert.deepEqual(r.missing,{cards:['legacy-card'],skills:['legacy-skill']});
});
test('import from JSON string preserves IDs even without loaded reference data',()=>{
 const r=parse(JSON.stringify(sample()),{cardById:{},skillById:{},meta:{}});
 assert.equal(r.state.decks.main.slots[0].cardId,'legacy-card');
 assert.deepEqual(r.missing.cards,['legacy-card']);
 assert.deepEqual(r.missing.skills,['legacy-skill']);
});
test('reject malformed or unsupported settings',()=>{
 const bad=sample();bad.decks.main.slots[0].stage=7;assert.throws(()=>parse(bad,data),/スロット/);
 const future=sample();future.version=2;assert.throws(()=>parse(future,data),/バージョン/);
 const scope=sample();scope.goalSets[0].goals[0].scope='invalid';assert.throws(()=>parse(scope,data),/目標スキル/);
});
