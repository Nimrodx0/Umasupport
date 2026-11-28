const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/core.js');
const settings=require('../src/settings.js');
const {matrixCells,pageFromHash}=require('../src/workspace_ui.js');
test('page routes are bounded and events identify exactly one deck',()=>{
 assert.deepEqual(pageFromHash('#events/inherit'),{kind:'deck-events',deckKey:'inherit',route:'events/inherit'});
 assert.equal(pageFromHash('#skills').kind,'catalog');
 assert.equal(pageFromHash('#compare').route,'compare');
 assert.equal(pageFromHash('#events/arbitrary').route,'workspace');
});
test('matrix projects all 12 slots without recounting IDs, gold/white or conditional routes',()=>{
 const skills=[{id:'gold',name:'金',tier:'gold',lowerId:'white'},{id:'white',name:'白',tier:'white'}];
 const card={id:'one',hints:['white'],events:[{id:'e',name:'分岐',type:'choice',choices:[{id:'go',label:'進行',outcomes:[{id:'success',label:'成功',rewards:[{skillId:'gold',level:1}]},{id:'stop',label:'打ち切り',terminal:true,rewards:[]}]}]}]};
 const data={skills,skillById:Object.fromEntries(skills.map(s=>[s.id,s])),cardById:{one:card}};
 const slot=choices=>({cardId:'one',stage:4,choices,outcomes:{}});
 const main=core.aggregate({slots:[slot({e:'go'}),slot({})]},data);
 const inherit=core.aggregate({slots:[slot({e:'go'})]},data);
 const before=JSON.stringify({main,inherit});
 const gold=matrixCells({main:main.gold,inherit:inherit.gold});
 assert.equal(gold.length,12);assert.equal(main.gold.count,1);assert.equal(main.white.count,1);
 assert.equal(gold[0].event,true);assert.equal(gold[0].conditionalOnly,true);
 assert.equal(gold[1].event,false,'unselected route stays absent');
 assert.equal(gold[6].event,true);assert.equal(gold[6].conditional,true);
 const white=matrixCells({main:main.white,inherit:inherit.white});
 assert.equal(white.filter(c=>c.hint).length,3,'same ID appears in each occupied slot');
 assert.equal(white.filter(c=>c.event).length,0,'gold does not become direct white');
 assert.equal(JSON.stringify({main,inherit}),before,'projection is read-only');
});
test('matrix preference round-trips through current settings and preserves old views',()=>{
 const deck={id:'d',name:'test',slots:Array.from({length:6},()=>({cardId:null,stage:4,choices:{}}))};
 const base={version:3,ownedCards:{},decks:{main:[deck],inherit:[{...deck,id:'i'}]},activeDecks:{main:'d',inherit:'i'},nextDeckId:1,goalSets:[{id:'g',name:'g',goals:[]}],currentGoalSet:'g',density:'compact'};
 for(const view of ['integrated','split','matrix'])assert.equal(settings.parse({...base,view},{cardById:{},skillById:{}}).view,view);
});
