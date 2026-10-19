'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {extract,buildRegistry}=require('../src/checker_hint_fact_extract.cjs');
const skillArray=Array.from({length:110},(_,i)=>({id:String(900000+i),name:'無関係'+i,rarity:'normal'}));
skillArray.push({id:'202992',name:'架空スキル○',rarity:'normal'});
const card=(id,name,rarity)=>({id,name,rarity});
const cards=[card('30001','架空SSR','SSR'),card('20001','架空SR','SR')];
const model={cards,cardById:Object.fromEntries(cards.map(x=>[x.id,x]))};
const source={Skills:{
 SSR:{'架空SSR':{Events:[
  {'秘匿イベント名':[ 
   {Title:'原文の第一選択肢',Effect:'成功時：『架空スキル◯』のヒントLv+3'},
   {Title:'原文の第二選択肢',Effect:'失敗時：体力+5'}
  ]}
 ]}},
 SR:{'架空SR':{Events:[
  {'原文イベント名':[ 
   {Title:'原文の上',Effect:'『未知の技』のヒントLv+1'},
   {Title:'原文の下',Effect:'『架空スキル○』のヒントLv不明'}
  ]}
 ]}}
}};
test('offline full-batch extraction returns only ordinal numeric hint facts',()=>{
 const r=extract({source,model,skillText:JSON.stringify(skillArray)});
 assert.equal(r.approvalState,'UNREVIEWED_NOT_FOR_PUBLICATION');
 assert.equal(r.stats.cardsWithCandidates,2);
 assert.equal(r.stats.eventsObserved,2);
 assert.equal(r.stats.choiceRowsObserved,4);
 assert.equal(r.stats.extractedHintRows,2);
 assert.equal(r.stats.matchedNumericHints,1);
 assert.equal(r.stats.unresolvedHints,1);
 assert.equal(r.stats.conditionalChoiceRows,2);
 assert.equal(r.stats.unparsedHintChoiceRows,1);
 const ssr=r.cards.find(x=>x.cardId==='30001');
 assert.equal(ssr.events[0].choices[0].observedHints[0].skillId,'202992');
 assert.equal(ssr.events[0].choices[0].observedHints[0].level,3);
 assert.equal(ssr.events[0].choices[0].needsManualResultReview,true);
 const sr=r.cards.find(x=>x.cardId==='20001');
 assert.equal(sr.events[0].choices[0].observedHints[0].resolution,'missing');
 assert.equal(sr.events[0].choices[1].unparsedHintSyntax,true);
 const printed=JSON.stringify(r);
 for(const text of ['原文の第一選択肢','原文の第二選択肢','秘匿イベント名','原文イベント名','失敗時：体力+5']){
  assert.ok(!printed.includes(text),'raw copyrighted source text leaked: '+text);
 }
 assert.equal(r.cards.flatMap(c=>c.events).every(e=>e.requiresFullReview),true);
});
test('ambiguous IDs are retained as uncertainty instead of guessed numeric mapping',()=>{
 const dup=[...skillArray,{id:'999999',name:'架空スキル○',rarity:'normal'}];
 const r=extract({source,model,skillText:JSON.stringify(dup)});
 const fact=r.cards.find(x=>x.cardId==='30001').events[0].choices[0].observedHints[0];
 assert.equal(fact.skillId,undefined);
 assert.equal(fact.resolution,'ambiguous');
 assert.equal(r.stats.ambiguousHints,1);
});
test('unknown card join and missing numeric registry rejected',()=>{
 assert.throws(()=>extract({source,model,skillText:'[]'}),/full skill registry/);
 assert.throws(()=>extract({source:{Skills:{...source.Skills,SR:{}}},model,
  skillText:JSON.stringify(skillArray),aliases:{'20001':'不存在'}}),/Checker取り込み|エイリアス/);
 assert.throws(()=>buildRegistry(JSON.stringify([...skillArray,skillArray[0]])),/duplicated skill/);
});

test('obsolete alias is ignored when its source card now matches exactly',()=>{
 const r=extract({source,model,skillText:JSON.stringify(skillArray),
   aliases:{'30001':'古いSSR表記','20001':'架空SR'}});
 assert.equal(r.stats.cardsWithCandidates,2);
 assert.equal(r.stats.staleAliasRecords,2);
 assert.equal(r.stats.reviewedAliases,0);
});
