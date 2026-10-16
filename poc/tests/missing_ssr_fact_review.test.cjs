const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate}=require('../src/missing_ssr_fact_review.cjs');
const facts=require('../config/missing-ssr-event-facts.v1.json');
const ids=['30240','30269','30295','30302','30320'];
const copy=x=>JSON.parse(JSON.stringify(x));

test('five SSR fact candidates validate and are not a published event catalog',()=>{
 const report=validate(facts,ids);
 assert.deepEqual(report,{cards:5,events:25,choiceEvents:15,autoEvents:5,unknownEvents:5,skillHintRows:14,structuralOnly:1});
 assert.equal(facts.kind,'review-candidates-only');
 assert.equal(JSON.stringify(facts).includes('GameWith'),false);
 assert.equal(JSON.stringify(facts).includes('U-tools'),false);
});
test('partial card cannot be mistaken for complete options or confirmed hints',()=>{
 const x=copy(facts);
 x.cards[0].chain[0].mode='choice';
 assert.throws(()=>validate(x,ids),/構造だけ確認したカード/);
});
test('unknown hint and source prose fields are rejected',()=>{
 const x=copy(facts);
 x.cards[1].random[0].hints.push({skillName:'架空',hintLevel:1,choiceIndex:9});
 assert.throws(()=>validate(x,ids),/選択位置が不正/);
 x.cards[1].random[0].hints.pop();
 x.cards[1].random[0].originalEventText='転載すべきでない文章';
 assert.throws(()=>validate(x,ids),/不許可フィールド/);
});
test('no silently skipped card or fallback source without evidence',()=>{
 const x=copy(facts);x.cards.pop();
 assert.throws(()=>validate(x,ids),/対象カードの一部が未掲載/);
 const y=copy(facts);y.cards[0].sourceUrls=['https://example.org/data'];
 assert.throws(()=>validate(y,ids),/出典URL不正/);
});
test('event hint row duplicates and misassigned auto choices fail',()=>{
 const x=copy(facts);
 const e=x.cards.find(c=>c.cardId==='30320').chain[2];
 e.hints[0].choiceIndex=1;
 assert.throws(()=>validate(x,ids),/自動報酬に選択位置/);
 const y=copy(facts);
 const event=y.cards.find(c=>c.cardId==='30320').chain[2];
 event.hints.push({...event.hints[0]});
 assert.throws(()=>validate(y,ids),/重複スキル報酬/);
});
