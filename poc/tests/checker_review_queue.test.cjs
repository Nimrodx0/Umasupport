'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../src/checker_review_queue.cjs');
const event=(id,ordinal,choices)=>({
 sourceKey:'checker:'+id+':'+String(ordinal).padStart(20,'a'),
 sourceDigest:'sha256:'+'b'.repeat(64),
 sourceEventOrdinal:ordinal,requiresFullReview:true,choices
});
const choice=(n,hints=[],conditional=false,unparsed=false)=>({
 ordinal:n,observedHints:hints,needsManualResultReview:conditional||unparsed,
 ...(unparsed?{unparsedHintSyntax:true}:{})
});
const candidates=()=>({
 schemaVersion:1,approvalState:'UNREVIEWED_NOT_FOR_PUBLICATION',
 cards:[
  {cardId:'30001',rarity:'SSR',events:[
   event('30001',1,[
    choice(1,[{skillId:'202992',level:1}]),
    choice(2,[{resolution:'missing',skillName:'架空',level:2}],true),
    choice(3,[{resolution:'ambiguous',skillName:'架空2',level:4}],false,true)
   ])]},
  {cardId:'20001',rarity:'SR',events:[]}
 ]
});
const gaps=()=>({
 summary:{bothCards:2},
 possibleGaps:[{cardId:'30001',cruiseOnly:2,cruiseJoin:'provisional-alias'}],
 zeroEventCardIds:['20001']
});
test('rank unparsed and unresolved skill rows before conditional and cross-source card discrepancies',()=>{
 const r=build({candidates:candidates(),gaps:gaps()});
 assert.equal(r.approvalState,'UNREVIEWED_NOT_FOR_PUBLICATION');
 assert.equal(r.comparisonScope,'present-provisional-name-matching');
 assert.equal(r.totals.eventsInspected,1);
 assert.equal(r.totals.branchesInspected,3);
 assert.equal(r.totals.queueEntries,4);
 assert.deepEqual(r.totals.priorityEntries,{P0:2,P1:0,P2:2,P3:0});
 assert.equal(r.totals.reasonEntries['conditional-result'],1);
 assert.equal(r.totals.reasonEntries['unparsed-hint'],1);
 assert.equal(r.totals.reasonEntries['missing-skill-id'],1);
 assert.equal(r.totals.reasonEntries['ambiguous-skill-id'],1);
 assert.equal(r.reviewQueue[0].choiceOrdinal,3);
 assert.equal(r.reviewQueue[0].score,100);
 assert.equal(r.reviewQueue[1].choiceOrdinal,2);
 assert.equal(r.reviewQueue[2].reasons[0],'cruise-only-title');
 assert.equal(r.reviewQueue[2].scope,'card');
 assert.equal(r.reviewQueue[3].reasons[0],'checker-empty');
 assert.ok(r.reviewQueue.every(x=>x.requiresIndependentReview));
 const json=JSON.stringify(r);
 for(const word of ['架空2','架空','イベント原文','効果文','選択肢原文'])
  assert.equal(json.includes(word),false,'source or even candidate name leaked');
});
test('missing second source is unknown, never reported as agreement',()=>{
 const r=build({candidates:candidates()});
 assert.equal(r.comparisonScope,'not-provided');
 assert.equal(r.totals.queueEntries,2);
 assert.equal(r.totals.reasonEntries['cruise-only-title'],0);
});
test('reject premature approval, duplicates, unsafe source event identity and contradictory gap list',()=>{
 for(const mutate of [
  c=>c.approvalState='RELEASED',
  c=>c.cards.push({...c.cards[0]}),
  c=>c.cards[0].events[0].sourceKey='other-site:00',
  c=>c.cards[0].events[0].choices[0].ordinal=9,
  c=>c.cards[0].events[0].choices[0].observedHints[0].skillId='fake:ID',
  c=>c.cards[0].events[0].choices[1].observedHints[0].level=0
 ]){
  const c=candidates();mutate(c);
  assert.throws(()=>build({candidates:c,gaps:gaps()}));
 }
 const g=gaps();
 g.zeroEventCardIds.push('30001');
 assert.throws(()=>build({candidates:candidates(),gaps:g}),/contradiction/);
});
test('conditional without unparsed hint stays P1',()=>{
 const c=candidates();c.cards[0].events[0].choices=[
  choice(1,[{skillId:'202992',level:1}],true)
 ];
 const r=build({candidates:c});
 assert.equal(r.reviewQueue.length,1);
 assert.equal(r.reviewQueue[0].priority,'P1');
 assert.deepEqual(r.reviewQueue[0].reasons,['conditional-result']);
});
