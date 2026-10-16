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


const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const core=require('../src/core.js');
const appSource=fs.readFileSync(path.join(__dirname,'../src/live_app.js'),'utf8');
function mountApp(raw) {
  const key='uma-support-lab-runtime-umasim-v1';
  const values=new Map(raw===null?[]:[[key,raw]]);
  let writes=0,allowReset=false;
  const nodes={app:{innerHTML:''},'modal-layer':{innerHTML:''}};
  const handlers={};
  const data={cards:[],skills:[],cardById:{},skillById:{},meta:{totalHints:0}};
  const context={
    window:{UmaDemoData:data,UmaCore:core,UmaSettings:{parse}},
    localStorage:{
      getItem:k=>values.get(k)??null,
      setItem:(k,v)=>{writes++;values.set(k,v)}
    },
    document:{
      getElementById:id=>nodes[id]||{innerHTML:''},
      addEventListener:(name,handler)=>{handlers[name]=handler}
    },
    console:{warn(){}},
    confirm:()=>allowReset
  };
  vm.runInNewContext(appSource,context,{timeout:1000});
  return {
    nodes,values,get writes(){return writes},
    setAllowReset:v=>{allowReset=v},
    clickReset:()=>handlers.click({target:{closest:()=>({dataset:{action:'reset'}})}})
  };
}
test('invalid stored settings show an error without an automatic overwrite',()=>{
  const bad='{broken json';
  const app=mountApp(bad);
  assert.match(app.nodes.app.innerHTML,/保存設定を読み込めませんでした/);
  assert.match(app.nodes.app.innerHTML,/設定を初期化して続ける/);
  assert.equal(app.writes,0);
  assert.equal(app.values.get('uma-support-lab-runtime-umasim-v1'),bad);
  app.clickReset();
  assert.equal(app.writes,0);
  app.setAllowReset(true);
  app.clickReset();
  assert.equal(app.writes,1);
  assert.match(app.nodes.app.innerHTML,/サポカ編成/);
  assert.equal(JSON.parse(app.values.get('uma-support-lab-runtime-umasim-v1')).version,1);
});
test('fresh development settings launch directly without a recovery UI',()=>{
  const app=mountApp(null);
  assert.match(app.nodes.app.innerHTML,/サポカ編成/);
  assert.doesNotMatch(app.nodes.app.innerHTML,/読めなかったJSONを保存/);
  assert.equal(app.writes,0);
});
