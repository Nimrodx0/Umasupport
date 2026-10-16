const {test}=require('node:test');
const assert=require('node:assert/strict');
const aliases=require('../config/checker-name-aliases.json');
const refs=require('../config/gamewith-ssr-review-status.json');
const {track}=require('../src/checker_gap_tracker.cjs');
test('alias map includes 24 unique explicit names',()=>{
 assert.equal(Object.keys(aliases).length,24);
 assert.equal(new Set(Object.values(aliases)).size,24);
});
test('five SSR source pages have individually checked status',()=>{
 assert.deepEqual(Object.keys(refs.cards).sort(),['30240','30269','30295','30302','30320']);
 assert.equal(refs.cards['30302'].eventDetailsStatus,'listed');
 assert.equal(refs.cards['30320'].eventDetailsStatus,'unverified');
});
test('source-empty and source-unmatched are different kinds of gaps',()=>{
 const input={model:{cards:[{id:'30001',rarity:'SSR'},{id:'30002',rarity:'SSR'},{id:'20001',rarity:'SR'}]},
 candidate:{cards:[{cardId:'30001',events:[{}]},{cardId:'30002',events:[]}]},
 gameWith:{schemaVersion:1,cards:{'30002':{url:'https://gamewith.jp/uma-musume/article/show/561920',eventDetailsStatus:'listed'}}}};
 const r=track(input);
 assert.equal(r.totalSSR_SR,3);
 assert.equal(r.cardsWithEvents,1);
 assert.deepEqual(r.noEventIds,['30002']);
 assert.deepEqual(r.unmatchedIds,['20001']);
 assert.equal(r.reviewQueue[0].gameWithEventDetails,'listed');
 assert.equal(r.reviewQueue[1].gameWithEventDetails,'needsSource');
});
test('reject unknown or mismatched URLs and duplicated cards',()=>{
 const model={cards:[{id:'30001',rarity:'SSR'}]};
 const candidate={cards:[]};
 const registry={schemaVersion:1,cards:{'30001':{url:'https://example.com/no',eventDetailsStatus:'listed'}}};
 assert.throws(()=>track({model,candidate,gameWith:registry}),/GameWith参照設定/);
 registry.cards={};
 model.cards.push({id:'30001',rarity:'SSR'});
 assert.throws(()=>track({model,candidate,gameWith:registry}),/カードIDが重複/);
});
