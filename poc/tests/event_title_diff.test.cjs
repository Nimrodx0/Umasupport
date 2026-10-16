const {test}=require('node:test');
const assert=require('node:assert/strict');
const {compare}=require('../src/event_title_diff.js');
const model={cards:[
 {id:'30001',rarity:'SSR',name:'[仮称]甲'},
 {id:'30002',rarity:'SSR',name:'[違う表記]乙'},
 {id:'20001',rarity:'SR',name:'[別]丙'}]};
const events=(names)=>names.map(name=>({[name]:[{Title:'選択',Effect:'効果'}]}));
const base=()=>({
 checker:{Skills:{SSR:{'［仮称］甲':{Events:events(['イベントA','イベントB'])}},SR:{'［別］丙':{Events:events(['イベントC'])}}}},
 cruise:{Support:{SSR:{'［仮称］甲':{Event:events(['イベントB','イベントD'])}},SR:{'［別］丙':{Event:events(['イベントC'])}}}}
});
test('only strictly matched cards participate and names stay out of report',()=>{
 const {checker,cruise}=base();const r=compare(model,checker,cruise);
 assert.equal(r.comparedCards,2);assert.equal(r.commonTitles,2);
 assert.equal(r.checkerOnlyTitles,1);assert.equal(r.cruiseOnlyTitles,1);
 assert.equal(r.cardsWithCruiseOnly,1);assert.equal(r.cardsSameTitleSets,1);
 assert.equal(r.titleMismatchExamples[0].cardId,'30001');
 assert.equal(JSON.stringify(r).includes('イベントD'),false);
});
test('source-only cards or lookalike names cannot be silently assigned',()=>{
 const {checker,cruise}=base();
 checker.Skills.SSR['［違う表記］乙誤記']={Events:events(['未照合'])};
 const r=compare(model,checker,cruise);
 assert.equal(r.comparedCards,2);
 assert.equal(r.unmatchedCheckerNames,1);
});
test('identical titles are compared once and empty events are valid input',()=>{
 const {checker,cruise}=base();
 checker.Skills.SSR['［仮称］甲']={Events:events(['同名','同名'])};
 cruise.Support.SSR['［仮称］甲']={Event:events(['同名'])};
 const r=compare(model,checker,cruise);
 assert.equal(r.commonTitles,2);
 assert.equal(r.cardsWithCruiseOnly,0);
});
test('invalid documents and malformed event arrays fail closed',()=>{
 const {checker,cruise}=base();
 assert.throws(()=>compare(model,{},cruise),/Invalid/);
 checker.Skills.SSR['［仮称］甲']={Events:[{A:[],B:[]}]};
 const r=compare(model,checker,cruise);
 assert.equal(r.comparedCards,1);
 assert.equal(r.unmatchedCheckerNames,1);
});
