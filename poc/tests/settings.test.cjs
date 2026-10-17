const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parse,activeDeck,selectDeck,addDeck,renameDeck,deleteDeck,MAX_DECKS}=require('../src/settings.js');
const slot=(cardId=null)=>({cardId,stage:4,choices:{}});
const sample=()=>({
 version:2,decks:{
  main:[{id:'main-default',name:'本育成',slots:[slot('card-1'),...Array.from({length:5},()=>slot())]}],
  inherit:[{id:'inherit-default',name:'継承',slots:Array.from({length:6},()=>slot())}]
 },activeDecks:{main:'main-default',inherit:'inherit-default'},nextDeckId:1,
 goalSets:[{id:'g1',name:'目標',goals:[{skillId:'skill-1',scope:'either'}]}],
 currentGoalSet:'g1',view:'integrated',density:'compact'
});
const data={cardById:{'card-1':{id:'card-1'}},skillById:{'skill-1':{id:'skill-1'}}};
test('loads valid current settings without ID conversion',()=>{
 const input=sample();assert.deepEqual(parse(JSON.stringify(input),data),input);
});
test('rejects unknown card IDs even if an alias table is present',()=>{
 const s=sample();s.decks.main[0].slots[0].cardId='legacy-card';
 assert.throws(()=>parse(s,{...data,meta:{aliasCardIds:{'legacy-card':'card-1'}}}),/存在しないサポカID/);
});
test('rejects unknown skill IDs even if an alias table is present',()=>{
 const s=sample();s.goalSets[0].goals[0].skillId='legacy-skill';
 assert.throws(()=>parse(s,{...data,meta:{aliasSkillIds:{'legacy-skill':'skill-1'}}}),/存在しないスキルID/);
});
test('rejects corrupted JSON, unsupported versions and invalid fields',()=>{
 assert.throws(()=>parse('{bad',data),SyntaxError);
 const s=sample();s.decks.main.slots[0].stage=7;assert.throws(()=>parse(s,data),/スロット/);
 const future=sample();future.version=3;assert.throws(()=>parse(future,data),/バージョン/);
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
  assert.equal(JSON.parse(app.values.get('uma-support-lab-runtime-umasim-v1')).version,2);
});
test('fresh development settings launch directly without a recovery UI',()=>{
  const app=mountApp(null);
  assert.match(app.nodes.app.innerHTML,/サポカ編成/);
  assert.doesNotMatch(app.nodes.app.innerHTML,/読めなかったJSONを保存/);
  assert.equal(app.writes,0);
});

test('valid v1 settings migrate every slot, stage and event choice without mutating source',()=>{
 const v2=sample();
 v2.decks.main[0].slots[0].stage=2;
 v2.decks.main[0].slots[0].choices={'old-event':'keep'};
 const old={version:1,decks:{main:v2.decks.main[0],inherit:v2.decks.inherit[0]},
   goalSets:v2.goalSets,currentGoalSet:v2.currentGoalSet,view:v2.view,density:v2.density};
 const before=JSON.stringify(old);
 const migrated=parse(before,data);
 assert.equal(migrated.version,2);
 assert.equal(migrated.decks.main[0].id,'main-default');
 assert.equal(migrated.activeDecks.main,'main-default');
 assert.deepEqual(migrated.decks.main[0].slots[0].choices,{'old-event':'keep'});
 assert.equal(migrated.decks.main[0].slots[0].stage,2);
 assert.equal(migrated.decks.main[0].slots[0].cardId,'card-1');
 assert.deepEqual(migrated.goalSets,old.goalSets);
 assert.equal(JSON.stringify(old),before);
});
test('independent names, selections and copy are deep and stable',()=>{
 const s=parse(sample(),data),goal=s.currentGoalSet;
 const main=activeDeck(s,'main');
 main.slots[0].choices={'a':'continue'};
 main.slots[0].stage=1;
 const copy=addDeck(s,'main',true);
 assert.equal(copy.name,'本育成（複製）');
 assert.notEqual(copy.slots[0],main.slots[0]);
 assert.deepEqual(copy.slots[0].choices,main.slots[0].choices);
 renameDeck(s,'main','  デッキ案B  ');
 assert.equal(activeDeck(s,'main').name,'デッキ案B');
 copy.slots[0].choices.a='stop';copy.slots[0].stage=4;
 assert.deepEqual(main.slots[0].choices,{a:'continue'});
 assert.equal(main.slots[0].stage,1);
 const blank=addDeck(s,'inherit');
 assert.equal(blank.slots.filter(x=>x.cardId!==null).length,0);
 assert.equal(s.decks.inherit.length,2);
 assert.equal(s.currentGoalSet,goal);
 selectDeck(s,'main','main-default');
 assert.equal(activeDeck(s,'main').slots[0].stage,1);
 assert.equal(activeDeck(s,'inherit'),blank);
 assert.equal(deleteDeck(s,'main').id,copy.id);
 assert.equal(s.decks.main.length,1);
 assert.equal(parse(JSON.stringify(s),data).decks.inherit.length,2);
 assert.throws(()=>deleteDeck(s,'main'),/最後/);
});
test('invalid deck state is rejected before local save, including hidden decks',()=>{
 const list=[
  x=>{x.decks.main[0].slots[2].cardId='unknown';},
  x=>{x.decks.main[0].slots[3].stage=-1;},
  x=>{x.decks.inherit[0].slots[0].choices.x=42;},
  x=>{x.activeDecks.main='missing';},
  x=>{x.decks.main[0].name='   ';},
  x=>{x.decks.main[0].id=x.decks.inherit[0].id;},
  x=>{x.decks.main.push(x.decks.main[0]);},
  x=>{x.nextDeckId=-2;}
 ];
 for(const mutate of list){const s=sample();mutate(s);assert.throws(()=>parse(s,data));}
 const s=sample();
 assert.throws(()=>selectDeck(s,'main','missing'),/見つかりません/);
 assert.throws(()=>renameDeck(s,'main',' '),/1～60/);
 assert.throws(()=>renameDeck(s,'main','x'.repeat(61)),/1～60/);
 assert.equal(s.decks.main.length,1);
});
test('limit each deck type independently to 50 named decks',()=>{
 const s=parse(sample(),data);
 for(let n=1;n<MAX_DECKS;n++)addDeck(s,'main');
 assert.equal(s.decks.main.length,50);
 assert.equal(s.decks.inherit.length,1);
 assert.throws(()=>addDeck(s,'main'),/50件/);
 assert.equal(s.decks.main.length,50);
});
