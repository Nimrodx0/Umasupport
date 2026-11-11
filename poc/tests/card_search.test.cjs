'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {filterCards,routeOf,normalHintIds,approvedEventSkillIds,matches,sortCards,
 eventCatalogState,goalCandidateIds,sortByGoalCandidates}=require('../src/card_search.js');

function fixture(){
 const skills={
  'hint:右回り○':{id:'hint:右回り○',name:'右回り○'},
  'skill:夢':{id:'skill:夢',name:'夢の走り'},
  'skill:金':{id:'skill:金',name:'金の技'},
  'skill:展開':{id:'skill:展開',name:'展開'},
 };
 const cards=[
  {id:'1',name:'［青い風］架空の子',character:'架空の子',rarity:'SSR',type:'スピード',sourceStatus:'verified_hints',
   hintsByStage:{'0':['hint:右回り○'],'1':['hint:右回り○'],'2':[],'3':[],'4':[]},
   hints:[],searchAliases:['blue wind'],referenceSkills:['金の技'],
   events:[{type:'choice',choices:[{rewards:[{skillId:'skill:金'}]}]}]},
  {id:'2',name:'［光］もう一人',character:'もう一人',rarity:'SR',type:'賢さ',sourceStatus:'verified_hints',
   hints:['skill:夢'],events:[]},
  {id:'3',name:'［花］三人目',character:'三人目',rarity:'SSR',type:'スピード',sourceStatus:'verified_hints',
   hints:['skill:金'],events:[{type:'auto',rewards:[{skillId:'skill:金'}],
    outcomes:[{rewards:[{skillId:'skill:展開'}]}]}]},
  {id:'4',name:'［灰］四人目',character:'四人目',rarity:'R',type:'根性',sourceStatus:'unverified',
   hints:['skill:夢'],events:[],referenceSkills:['skill:金']},
 ];
 return {cards,meta:{reviewedEventRecords:2},skillById:skills};
}
test('multi-filter combines text, rarity, type, ownership and normal-hint route',()=>{
 const m=fixture(),owned={'1':{status:'owned',stage:2},'2':{status:'unowned'}};
 assert.deepEqual(filterCards(m.cards,m,{query:'ｂｌｕｅ',skillQuery:'右回り',rarity:'SSR',type:'スピード',ownership:'owned',route:'hint'},owned).map(x=>x.id),['1']);
 assert.deepEqual([...normalHintIds(m.cards[0],m)],['hint:右回り○']);
 assert.ok(!matches(m.cards[3],m,{skillQuery:'夢'},{}),'unverified hints are not trusted');
 assert.deepEqual(filterCards(m.cards,m,{ownership:'unregistered'},owned).map(x=>x.id),['3','4']);
 assert.deepEqual(filterCards(m.cards,m,{query:'架空の子'},owned).map(x=>x.id),['1']);
});
test('reviewed event outcomes and choices participate, but historical referenceSkills never do',()=>{
 const m=fixture();
 assert.deepEqual(filterCards(m.cards,m,{skillQuery:'金の技',route:'event'}).map(c=>c.id),['1','3']);
 assert.deepEqual(filterCards(m.cards,m,{skillQuery:'展開',route:'event'}).map(c=>c.id),['3']);
 assert.deepEqual(filterCards(m.cards,m,{skillQuery:'金の技',route:'hint'}).map(c=>c.id),['3']);
 assert.deepEqual(filterCards(m.cards,m,{skillQuery:'金の技',route:'both'}).map(c=>c.id),['3']);
 assert.deepEqual([...approvedEventSkillIds(m.cards[2],m)].sort(),['skill:展開','skill:金'].sort());
 assert.equal(routeOf(m.cards[0],m,'金の技').kind,'event');
});
test('zero approved events is an empty event search, not a false proof of game absence',()=>{
 const m=fixture();m.meta.reviewedEventRecords=0;
 assert.deepEqual(filterCards(m.cards,m,{route:'event'}),[]);
 assert.deepEqual(filterCards(m.cards,m,{route:'both'}),[]);
 assert.deepEqual(filterCards(m.cards,m,{skillQuery:'金の技',route:'all'}).map(x=>x.id),['3']);
 assert.equal(approvedEventSkillIds(m.cards[0],m).size,0);
});
test('unknown skill IDs and unreviewed titles cannot bypass search filters',()=>{
 const m=fixture();
 m.cards[0].events.push({type:'auto',rewards:[{skillId:'skill:unverified'}]});
 m.cards[0].referenceSkills.push('skill:unverified');
 assert.equal(matches(m.cards[0],m,{skillQuery:'unverified',route:'all'}),false);
 assert.equal(matches(m.cards[0],m,{route:'nonsense'}),false);
 assert.equal(matches(m.cards[0],m,{query:'blue WIND'}),true);
});
test('563-card search reaches every card and never caps the result at 120',()=>{
 const m=fixture(),base=m.cards[0];
 const many=Array.from({length:563},(_,i)=>({...base,id:String(30001+i),name:'サポカ'+i}));
 assert.equal(filterCards(many,m,{},{}).length,563);
 assert.deepEqual(filterCards(many,m,{query:'サポカ562'},{}).map(c=>c.id),['30563']);
});

test('explicit preview mode exposes selectable candidate events to route/skill filters without counting approvals',()=>{
 const m=fixture();
 m.meta.reviewedEventRecords=0;
 m.meta.runtimeSources={events:{mode:'preview'}};
 assert.equal(m.meta.reviewedEventRecords,0);
 assert.deepEqual(filterCards(m.cards,m,{route:'event'}).map(x=>x.id),['1','3']);
 assert.deepEqual(filterCards(m.cards,m,{skillQuery:'金の技',route:'event'}).map(x=>x.id),['1','3']);
 assert.equal(approvedEventSkillIds(m.cards[0],m).has('skill:金'),true);
 m.meta.runtimeSources.events.mode='preview-failed';
 assert.deepEqual(filterCards(m.cards,m,{route:'event'}),[]);
});

test('sorting is nonmutating and treats card IDs as IDs, never inferred release dates',()=>{
 const m=fixture(),original=m.cards.map(c=>c.id),owned={'2':{status:'owned'},'4':{status:'unowned'}};
 const order=mode=>sortCards(m.cards,mode,owned).map(c=>c.id);
 assert.deepEqual(order('source'),original);
 assert.deepEqual(order('id-desc'),['4','3','2','1']);
 assert.deepEqual(order('id-asc'),original);
 assert.deepEqual(order('rarity-desc'),['1','3','2','4']);
 assert.deepEqual(order('rarity-asc'),['4','2','1','3']);
 assert.deepEqual(order('owned-first'),['2','1','3','4']);
 assert.deepEqual(order('hints-desc'),['2','3','4','1']);
 assert.deepEqual(order('name-asc'),['2','1','3','4']);
 assert.deepEqual(order('type'),['1','3','4','2']);
 assert.deepEqual(m.cards.map(c=>c.id),original);
 assert.throws(()=>sortCards(m.cards,'release-desc'),/Unknown support-card sort/);
 assert.throws(()=>sortCards(m.cards,'calendar-guessed-from-id'),/Unknown support-card sort/);
});

test('new cards with no reviewed event records are missing-data, never confirmed zero game events',()=>{
 const m=fixture();m.meta.runtimeSources={events:{mode:'reviewed'}};
 assert.deepEqual(eventCatalogState(m.cards[0],m),{status:'recorded',count:1,preview:false});
 assert.deepEqual(eventCatalogState(m.cards[1],m),{status:'unrecorded',count:0,preview:false});
 m.meta.runtimeSources.events.mode='failed';
 assert.deepEqual(eventCatalogState(m.cards[1],m),{status:'unverified',count:null});
 assert.deepEqual([...approvedEventSkillIds(m.cards[0],m)],[],
  'A stale event record count must not defeat an explicit failed verification status');
 m.meta.runtimeSources.events.mode='preview';
 assert.deepEqual(eventCatalogState(m.cards[0],m),{status:'recorded',count:1,preview:true});
});
test('goal candidate ranking only uses stage-4 normal hints and source-backed event skills',()=>{
 const m=fixture();m.meta.runtimeSources={events:{mode:'reviewed'}};
 const goals=[{skillId:'skill:金',scope:'main'},
  {skillId:'skill:夢',scope:'inherit'},
  {skillId:'hint:右回り○',scope:'both'}];
 assert.deepEqual(goalCandidateIds(m.cards[0],m,goals,'main'),['skill:金'],
  'Earlier-stage-only hints cannot count as a 4-limit-break match');
 assert.deepEqual(goalCandidateIds(m.cards[0],m,goals,'inherit'),['hint:右回り○'].filter(()=>false));
 assert.deepEqual(goalCandidateIds(m.cards[1],m,goals,'main'),[]);
 assert.deepEqual(goalCandidateIds(m.cards[1],m,goals,'inherit'),['skill:夢']);
 assert.deepEqual(goalCandidateIds(m.cards[2],m,goals,'main'),['skill:金'],
  'A hint and an event route to the same skill count as ONE goal candidate');
 assert.deepEqual(sortByGoalCandidates(m.cards,m,goals,'main').map(c=>c.id),['1','3','2','4'],
  'Equal score cards preserve original roster order');
 assert.deepEqual(sortByGoalCandidates(m.cards,m,goals,'inherit').map(c=>c.id),['2','1','3','4']);
 assert.deepEqual(sortByGoalCandidates(m.cards,m,[], 'main').map(c=>c.id),
  ['1','2','3','4']);
 assert.deepEqual(m.cards.map(c=>c.id),['1','2','3','4'],
  'Sorting must not mutate card data');
 const invalid=[{skillId:'unknown',scope:'both'},{skillId:'skill:金',scope:'other'}];
 assert.deepEqual(goalCandidateIds(m.cards[0],m,invalid,'main'),[]);
});
test('negative event skill effects never appear as recommended skill candidates',()=>{
 const m=fixture();m.meta.runtimeSources={events:{mode:'reviewed'}};
 m.cards[0].events[0].choices[0].rewards.push({skillId:'skill:展開',kind:'negative'});
 assert.equal(approvedEventSkillIds(m.cards[0],m).has('skill:展開'),false);
 assert.deepEqual(goalCandidateIds(m.cards[0],m,
  [{skillId:'skill:展開',scope:'both'}],'main'),[]);
 assert.deepEqual(filterCards(m.cards,m,{skillQuery:'展開',route:'event'}).map(c=>c.id),['3']);
});
