'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {readUmaSim,checkIndependent}=require('../tools/audit_card_coverage.cjs');
function makeText(cards){
 const rows=[];
 for(const card of cards)for(let stage=0;stage<=4;stage++){
  const f=Array(62).fill('0');
  f[0]=String(card.id);f[1]=card.name;f[3]=String(card.rarity);f[4]=String(stage);f[6]='友人';
  rows.push(f.join('\t'));
 }
 return rows.join('\n');
}
const sample=makeText([{id:10128,name:'[無人島PJ責任者]タッカーブライン',rarity:1},
 {id:30257,name:'[本能は吼えているか！？]タッカーブライン',rarity:3}]);
test('one id per card, not five limit break rows',()=>{
 assert.equal(readUmaSim(sample).size,2);
});
test('same ID, rarity and Japanese full name match in independent subset',()=>{
 const r=checkIndependent({umasim:sample,
  japan:[{id:30257,name:'[本能は吼えているか！？]タッカーブライン',rarity:'SSR'}],
  english:[{support_id:10128,rarity:1}]});
 assert.equal(r.independentUnion,2);
 assert.equal(r.independentOverlapBetweenSources,0);
 assert.ok(r.checks.every(c=>!c.absentFromUmaSim.length&&!c.nameConflicts.length&&!c.rarityConflicts.length));
 assert.equal(r.tucker.R.present,true);
});
test('missing and conflicting IDs are NOT silently accepted',()=>{
 const r=checkIndependent({umasim:sample,
  japan:[{id:12345,rarity:'SSR',name:'欠損'}],
  english:[{support_id:10128,rarity:2}]});
 assert.deepEqual(r.checks[0].absentFromUmaSim,[12345]);
 assert.deepEqual(r.checks[1].rarityConflicts,[10128]);
});
test('Japanese name conflicts are distinct from missing IDs',()=>{
 const r=checkIndependent({umasim:sample,
  japan:[{id:30257,name:'別名',rarity:'SSR'}],
  english:[{support_id:30257,rarity:3}]});
 assert.deepEqual(r.checks[0].nameConflicts,[30257]);
 assert.equal(r.independentOverlapBetweenSources,1);
});
test('duplicate stage and incomplete stage reject invalid source',()=>{
 assert.throws(()=>readUmaSim(sample+'\n'+sample.split('\n')[0]),/Repeated limit break/);
 assert.throws(()=>readUmaSim(sample.split('\n').slice(1).join('\n')),/Incomplete limit break/);
});
