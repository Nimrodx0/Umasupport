const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parse,activeDeck,selectDeck,addDeck,renameDeck,deleteDeck,ownedStatus,setOwnedCard,setOwnedBulk,addGoalSet,renameGoalSet,deleteGoalSet,merge,MAX_DECKS,MAX_GOAL_SETS}=require('../src/settings.js');
const slot=(cardId=null)=>({cardId,stage:4,choices:{}});
const sample=()=>({
 version:3,ownedCards:{},decks:{
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
 const s=sample();s.decks.main[0].slots[0].stage=7;assert.throws(()=>parse(s,data),/スロット/);
 const future=sample();future.version=4;assert.throws(()=>parse(future,data),/バージョン/);
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
    window:{UmaDemoData:data,UmaCore:core,UmaSettings:require('../src/settings.js'),UmaCardSearch:require('../src/card_search.js'),UmaSkillTable:require('../src/skill_table.js'),UmaSourceHealth:require('../src/source_health.js'),UmaDeckEvents:require('../src/deck_events.js')},
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
  assert.equal(JSON.parse(app.values.get('uma-support-lab-runtime-umasim-v1')).version,3);
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
 assert.equal(migrated.version,3);
 assert.deepEqual(migrated.ownedCards,{});
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

test('v2 deck-library settings migrate losslessly to v3 without inventing ownership',()=>{
 const before=sample();before.version=2;delete before.ownedCards;
 before.decks.main[0].slots[0].stage=3;
 const migrated=parse(JSON.stringify(before),data);
 assert.equal(migrated.version,3);
 assert.deepEqual(migrated.ownedCards,{});
 assert.equal(migrated.decks.main[0].slots[0].stage,3);
 assert.equal(migrated.goalSets[0].goals[0].skillId,'skill-1');
 assert.equal(before.version,2);
});
test('ownership has 3 distinct states and independent owned vs deck stages',()=>{
 const s=sample();
 assert.equal(ownedStatus(s,'card-1'),'unregistered');
 setOwnedCard(s,data,'card-1','owned',2);
 assert.deepEqual(s.ownedCards['card-1'],{status:'owned',stage:2});
 assert.equal(activeDeck(s,'main').slots[0].stage,4);
 activeDeck(s,'main').slots[0].stage=1;
 assert.equal(s.ownedCards['card-1'].stage,2);
 assert.equal(parse(JSON.stringify(s),data).ownedCards['card-1'].stage,2);
 setOwnedCard(s,data,'card-1','unowned');
 assert.equal(ownedStatus(s,'card-1'),'unowned');
 assert.deepEqual(s.ownedCards['card-1'],{status:'unowned'});
 assert.equal(activeDeck(s,'main').slots[0].cardId,'card-1');
 setOwnedCard(s,data,'card-1','unregistered');
 assert.equal(ownedStatus(s,'card-1'),'unregistered');
 assert.ok(!Object.hasOwn(s.ownedCards,'card-1'));
});
test('ownership batch is atomic, retains stages for already-owned cards',()=>{
 const cards={cardById:{'card-1':{},'card-2':{},'card-3':{}},skillById:data.skillById};
 const s=sample();
 setOwnedCard(s,cards,'card-1','owned',4);
 assert.equal(setOwnedBulk(s,cards,['card-1','card-2','card-3'],'owned'),3);
 assert.deepEqual(s.ownedCards['card-1'],{status:'owned',stage:4});
 assert.deepEqual(s.ownedCards['card-2'],{status:'owned',stage:0});
 const before=JSON.stringify(s);
 assert.throws(()=>setOwnedBulk(s,cards,['card-2','not-in-data'],'unowned'),/不正/);
 assert.throws(()=>setOwnedBulk(s,cards,['card-1','card-1'],'owned'),/不正/);
 assert.throws(()=>setOwnedBulk(s,cards,['card-1'],'invalid'),/不正/);
 assert.equal(JSON.stringify(s),before);
 setOwnedBulk(s,cards,['card-2','card-3'],'unregistered');
 assert.equal(ownedStatus(s,'card-2'),'unregistered');
 assert.equal(ownedStatus(s,'card-1'),'owned');
});
test('all malformed owned records and unknown IDs are rejected before storage',()=>{
 const edits=[
  x=>{x.ownedCards['unknown']={status:'owned',stage:1};},
  x=>{x.ownedCards['card-1']={status:'owned',stage:5};},
  x=>{x.ownedCards['card-1']={status:'owned',stage:-1};},
  x=>{x.ownedCards['card-1']={status:'owned',stage:'2'};},
  x=>{x.ownedCards['card-1']={status:'owned'};},
  x=>{x.ownedCards['card-1']={status:'unowned',stage:0};},
  x=>{x.ownedCards['card-1']={status:'unregistered'};},
  x=>{x.ownedCards['card-1']={status:'owned',stage:1,level:50};},
  x=>{x.ownedCards=[];},
  x=>{delete x.ownedCards;},
 ];
 for(const fn of edits){const s=sample();fn(s);assert.throws(()=>parse(s,data),/所持サポカ/);}
 const s=sample();
 assert.throws(()=>setOwnedCard(s,data,'unknown','owned'),/不正/);
 assert.throws(()=>setOwnedCard(s,data,'card-1','owned',5),/不正/);
 assert.throws(()=>setOwnedCard(s,data,'card-1','invalid'),/不正/);
 assert.deepEqual(s.ownedCards,{});
});

test('merge retains all existing deck selections, goal sets, conflicting ownership and display mode',()=>{
 const current=sample(),incoming=sample();
 current.decks.main[0].slots[0].stage=0;
 current.decks.main[0].slots[0].choices={e:'keep'};
 current.ownedCards['card-1']={status:'unowned'};
 incoming.decks.main[0].slots[0].stage=4;
 incoming.decks.main[0].slots[0].choices={e:'import'};
 incoming.ownedCards['card-1']={status:'owned',stage:3};
 incoming.goalSets[0].name='読込目標';
 incoming.view='split';incoming.density='detailed';
 const original=JSON.stringify(current),originalIncoming=JSON.stringify(incoming);
 const {settings:r,report}=merge(current,incoming,data);
 assert.equal(r.version,3);
 assert.equal(r.decks.main.length,2);
 assert.equal(r.decks.inherit.length,2);
 assert.equal(new Set([...r.decks.main,...r.decks.inherit].map(d=>d.id)).size,4);
 assert.equal(r.activeDecks.main,'main-default');
 assert.equal(r.activeDecks.inherit,'inherit-default');
 assert.deepEqual(r.decks.main[0].slots[0].choices,{e:'keep'});
 assert.deepEqual(r.decks.main[1].slots[0].choices,{e:'import'});
 assert.equal(r.decks.main[1].slots[0].stage,4);
 assert.equal(r.goalSets.length,2);
 assert.equal(r.goalSets[1].name,'読込目標');
 assert.notEqual(r.goalSets[1].id,'g1');
 assert.equal(r.currentGoalSet,'g1');
 assert.deepEqual(r.ownedCards['card-1'],{status:'unowned'});
 assert.equal(r.view,'integrated');
 assert.equal(r.density,'compact');
 assert.deepEqual(report,{decksAdded:2,goalSetsAdded:1,ownershipAdded:0,
  ownershipConflictsKept:1,activeSelectionsPreserved:true,displayPreferencesPreserved:true});
 assert.equal(JSON.stringify(current),original,'merge must not mutate existing saved object');
 assert.equal(JSON.stringify(incoming),originalIncoming,'merge must not mutate file payload');
 assert.deepEqual(parse(JSON.stringify(r),data),r);
});
test('merge imports new ownership but keeps explicit unowned vs unregistered distinct',()=>{
 const current=sample(),incoming=sample();
 const extended={cardById:{...data.cardById,'card-2':{},'card-3':{}},skillById:data.skillById};
 current.ownedCards['card-1']={status:'owned',stage:2};
 current.ownedCards['card-3']={status:'unowned'};
 incoming.ownedCards['card-1']={status:'unowned'};
 incoming.ownedCards['card-2']={status:'owned',stage:4};
 incoming.ownedCards['card-3']={status:'owned',stage:1};
 const {settings:r,report}=merge(current,incoming,extended);
 assert.deepEqual(r.ownedCards['card-1'],{status:'owned',stage:2});
 assert.deepEqual(r.ownedCards['card-2'],{status:'owned',stage:4});
 assert.deepEqual(r.ownedCards['card-3'],{status:'unowned'});
 assert.equal(report.ownershipAdded,1);
 assert.equal(report.ownershipConflictsKept,2);
});
test('failed merge rejects full input without changing either input or adding partial decks',()=>{
 const a=sample(),b=sample();
 const before=JSON.stringify(a),file=JSON.stringify(b);
 const bad=JSON.parse(file);bad.goalSets[0].goals[0].skillId='unknown-skill';
 assert.throws(()=>merge(a,bad,data),/存在しないスキルID/);
 assert.equal(JSON.stringify(a),before);
 assert.equal(JSON.stringify(b),file);
 const tooMany=sample();
 for(let i=1;i<MAX_DECKS;i++)tooMany.decks.main.push({...tooMany.decks.main[0],id:'many-'+i});
 const full=JSON.stringify(tooMany);
 assert.throws(()=>merge(tooMany,b,data),/50件/);
 assert.equal(JSON.stringify(tooMany),full);
 const huge=sample();
 for(let i=1;i<MAX_GOAL_SETS;i++)huge.goalSets.push({id:'g-'+i,name:'more',goals:[]});
 const hugeBefore=JSON.stringify(huge);
 assert.throws(()=>merge(huge,b,data),/100件/);
 assert.equal(JSON.stringify(huge),hugeBefore);
});
test('legacy v1 / v2 incoming snapshots migrate before merging, with stable IDs',()=>{
 const current=sample(),old=sample();
 old.version=1;delete old.ownedCards;
 old.decks={main:{name:'from-v1',slots:old.decks.main[0].slots},
  inherit:{name:'from-v1-inherit',slots:old.decks.inherit[0].slots}};
 delete old.activeDecks;delete old.nextDeckId;
 const r=merge(current,old,data).settings;
 assert.equal(r.decks.main[1].name,'from-v1');
 assert.equal(r.decks.inherit[1].name,'from-v1-inherit');
 assert.equal(r.decks.main[1].slots[0].cardId,'card-1');
 const v2=sample();v2.version=2;delete v2.ownedCards;
 assert.equal(merge(current,v2,data).settings.decks.main.length,2);
});
test('goal-set lifecycle uses bounded collision-free IDs, preserves goals, and guards deletion',()=>{
 const s=sample();
 const copy=addGoalSet(s,true);
 assert.equal(copy.name,'目標（複製）');
 assert.deepEqual(copy.goals,[{skillId:'skill-1',scope:'either'}]);
 assert.notEqual(copy.id,'g1');
 copy.goals[0].scope='both';
 assert.equal(s.goalSets[0].goals[0].scope,'either');
 renameGoalSet(s,'  周回目標  ');
 assert.equal(s.goalSets[1].name,'周回目標');
 const blank=addGoalSet(s);
 assert.deepEqual(blank.goals,[]);
 assert.notEqual(blank.id,copy.id);
 const selected=deleteGoalSet(s);
 assert.equal(selected.id,copy.id);
 assert.equal(s.goalSets.length,2);
 assert.throws(()=>renameGoalSet(s,' '),/1～60/);
 assert.throws(()=>renameGoalSet(s,'x'.repeat(61)),/1～60/);
 deleteGoalSet(s);
 assert.throws(()=>deleteGoalSet(s),/最後/);
 const full=sample();
 for(let i=1;i<MAX_GOAL_SETS;i++)full.goalSets.push({id:'g'+(i+1),name:'g'+i,goals:[]});
 assert.throws(()=>addGoalSet(full,true),/100件/);
 assert.throws(()=>parse({...sample(),goalSets:[...full.goalSets,{id:'overflow',name:'test',goals:[]}]},data),/バージョン/);
});
