const {test}=require('node:test');
const assert=require('node:assert/strict');
const {audit,normalize}=require('../src/cruise_source_audit.js');
const model={cards:[
 {id:'10001',rarity:'R',name:'[トレセン学園]サンプルA'},
 {id:'20001',rarity:'SR',name:'[青空]サンプルB'},
 {id:'30001',rarity:'SSR',name:'[心をひとつに]サンプルC'}
]};
const fixture=()=>({Support:{
 SSR:{'［心をひとつに］サンプルC':{Event:[
  {'練習①':[{Option:'上',Effect:'スキルヒント+1'},{Option:'下',Effect:'連続イベント終了'}]},
  {'練習②':[{Option:'',Effect:'成功：スキル獲得'}]}
 ]}},
 SR:{'［未登録］サンプルD':{Event:[{'イベント':[{Option:'',Effect:'効果なし'}]}]}},
 R:{'［トレセン学園］サンプルA':{Event:[{'ランダム':[{Option:'',Effect:'何もなし'}]}]}}
}});
test('matches normalized full-width brackets and rarity, counts cards and events separately',()=>{
 const r=audit(fixture(),model);
 assert.equal(r.sourceCards,3);
 assert.equal(r.umaSimCards,3);
 assert.equal(r.exactMatchedCards,2);
 assert.equal(r.missingUmaCards,1);
 assert.equal(r.unmatchedSourceCards,1);
 assert.equal(r.totalEventRecords,4);
 assert.equal(r.matchedEventRecords,3);
 assert.equal(r.unmatchedEventRecords,1);
 assert.equal(r.optionRows,5);
 assert.equal(r.eventsWithChoices,1);
 assert.equal(r.eventsWithSingleRow,3);
 assert.equal(r.rawEffectMarkerCounts.stop,1);
 assert.equal(r.rawEffectMarkerCounts.success,1);
 assert.equal(r.rawEffectMarkerCounts.skill,2);
});
test('does not conflate rarity or infer IDs from similar names',()=>{
 const source=fixture();source.Support.SSR['［青空］サンプルB']=source.Support.SSR['［心をひとつに］サンプルC'];
 const r=audit(source,model);
 assert.equal(r.exactMatchedCards,2);
 assert.equal(r.unmatchedSourceCards,2);
 assert.deepEqual(r.matchedByRarity,{SSR:1,SR:0,R:1});
});
test('no-event record is counted but not described as a verified event-free card',()=>{
 const source=fixture();source.Support.SR['［青空］サンプルB']={Event:[]};
 const r=audit(source,model);
 assert.equal(r.exactMatchedCards,3);
 assert.equal(r.recordsWithNoEvents,1);
 assert.equal(r.totalEventRecords,4);
});
test('missing or malformed input fails rather than inventing coverage',()=>{
 assert.throws(()=>audit({},model),/invalid/i);
 assert.throws(()=>audit({Support:{SSR:{},SR:{}}},model),/Missing support rarity/);
});
