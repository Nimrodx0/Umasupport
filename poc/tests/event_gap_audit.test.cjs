const {test}=require('node:test');
const assert=require('node:assert/strict');
const {compare}=require('../src/event_gap_audit.js');
const modelCards=[
 {id:'30001',rarity:'SSR',name:'[星の約束]アキラ'},
 {id:'30002',rarity:'SSR',name:'[閃く未来]ユウ'},
 {id:'20001',rarity:'SR',name:'[街角、風の声]ミオ'}
];
const evt=(name)=>({[name]:[{Effect:'架空の効果'}]});
test('provisionally joins punctuation-only variants but does not claim authoritative card IDs',()=>{
 const r=compare({modelCards,
  checkerCards:[{rarity:'SSR',name:'［星の約束］アキラ',events:[evt('開始！'),evt('継続')]}],
  cruiseCards:[{rarity:'SSR',name:'［星の約束!］アキラ',events:[evt('開始！'),evt('別ルート')]}]});
 assert.equal(r.totalSSR_SR,3);
 assert.equal(r.summary.bothCards,1);
 assert.equal(r.summary.matchedTitleRecords,1);
 assert.equal(r.summary.checkerOnlyEventRecords,1);
 assert.equal(r.summary.cruiseOnlyEventRecords,1);
 assert.equal(r.aliasCandidateCounts.cruise,1);
 assert.equal(r.possibleGaps[0].cardId,'30001');
 assert.equal(r.possibleGaps[0].cruiseJoin,'provisional-alias');
});
test('same-character one-edit title is a review candidate, never a confirmed game-ID mapping',()=>{
 const r=compare({modelCards,
  checkerCards:[{rarity:'SSR',name:'［閃く未來］ユウ',events:[evt('連続1')]}],
  cruiseCards:[]});
 assert.equal(r.aliasCandidateCounts.checker,1);
 assert.equal(r.summary.checkerCards,1);
});
test('ambiguous names are quarantined instead of arbitrarily assigned',()=>{
 const r=compare({modelCards,
  checkerCards:[
   {rarity:'SSR',name:'［星の約束!］アキラ',events:[evt('A')]},
   {rarity:'SSR',name:'［星の約束？］アキラ',events:[evt('B')]}
  ],cruiseCards:[]});
 assert.equal(r.summary.checkerCards,0);
 assert.ok(r.unresolvedCardIds.checker.some(x=>x.cardId==='30001'&&x.reason==='multiple-name-candidates'));
});
test('counts zero-event entries and filters out R cards',()=>{
 const r=compare({modelCards:[...modelCards,{id:'10001',rarity:'R',name:'[学園]レイ'}],
  checkerCards:[
   {rarity:'SR',name:'［街角、風の声］ミオ',events:[]},
   {rarity:'R',name:'［学園］レイ',events:[evt('無関係')]}
  ],cruiseCards:[]});
 assert.equal(r.totalSSR_SR,3);
 assert.deepEqual(r.zeroEventCardIds,['20001']);
 assert.equal(r.summary.emptyInChecker,1);
});
test('event title spelling differences are not automatically treated as equivalent',()=>{
 const r=compare({modelCards,
  checkerCards:[{rarity:'SSR',name:'[星の約束]アキラ',events:[evt('伝説の舞い')]}],
  cruiseCards:[{rarity:'SSR',name:'[星の約束]アキラ',events:[evt('伝説の舞')]}]});
 assert.equal(r.summary.matchedTitleRecords,0);
 assert.equal(r.summary.cruiseOnlyEventRecords,1);
});
