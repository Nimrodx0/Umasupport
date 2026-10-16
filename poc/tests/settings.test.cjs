const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('../src/settings.js');
const slot=(cardId=null)=>({cardId,stage:4,choices:{}});
const sample=()=>({
 version:1,decks:{
  main:{name:'本育成',slots:[slot('card-1'),...Array.from({length:5},()=>slot())]},
  inherit:{name:'継承',slots:Array.from({length:6},()=>slot())}
 },
 goalSets:[{id:'g1',name:'目標',goals:[{skillId:'skill-1',scope:'either'}]}],
 currentGoalSet:'g1',view:'integrated',density:'compact'
});
const data={cardById:{'card-1':{id:'card-1'}},skillById:{'skill-1':{id:'skill-1'}}};
test('loads valid current settings without ID conversion',()=>{
 const input=sample();assert.deepEqual(parse(JSON.stringify(input),data),input);
});
test('rejects unknown card IDs even if an alias table is present',()=>{
 const s=sample();s.decks.main.slots[0].cardId='legacy-card';
 assert.throws(()=>parse(s,{...data,meta:{aliasCardIds:{'legacy-card':'card-1'}}}),/存在しないサポカID/);
});
test('rejects unknown skill IDs even if an alias table is present',()=>{
 const s=sample();s.goalSets[0].goals[0].skillId='legacy-skill';
 assert.throws(()=>parse(s,{...data,meta:{aliasSkillIds:{'legacy-skill':'skill-1'}}}),/存在しないスキルID/);
});
test('rejects corrupted JSON, unsupported versions and invalid fields',()=>{
 assert.throws(()=>parse('{bad',data),SyntaxError);
 const s=sample();s.decks.main.slots[0].stage=7;assert.throws(()=>parse(s,data),/スロット/);
 const future=sample();future.version=2;assert.throws(()=>parse(future,data),/バージョン/);
 const scope=sample();scope.goalSets[0].goals[0].scope='invalid';assert.throws(()=>parse(scope,data),/目標スキル/);
 const selection=sample();selection.currentGoalSet='missing';assert.throws(()=>parse(selection,data),/目標セット/);
});
