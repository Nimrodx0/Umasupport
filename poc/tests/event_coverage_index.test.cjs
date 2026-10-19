'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {build,verifySnapshot}=require('../src/event_coverage_index.cjs');
function roster(spec){
 return spec.flatMap(([id,rarity])=>Array.from({length:5},(_,i)=>{
  const f=Array(62).fill('0');f[0]=id;f[1]='test '+id;f[3]=rarity;f[4]=String(i);
  return f.join('\t');
 })).join('\n');
}
const rosterText=roster([['10001','1'],['20001','2'],['30001','3']]);
const facts={schemaVersion:1,dataKind:'umasupport-choice-result-facts',productionApproval:false,cards:[
 {cardId:'20001',rarity:'SR',events:[{sourceKey:'checker:20001:a',sourceEventOrdinal:1,candidateStatus:'no-observed-skill-hints',choices:[]}]},
 {cardId:'30001',rarity:'SSR',events:[{sourceKey:'checker:30001:b',sourceEventOrdinal:1,candidateStatus:'numeric-choice-candidate',choices:[{}]}]}
]};
const curation={schemaVersion:1,cards:[{cardId:'10001',recordStatus:'draft'}]};
test('full roster retains absent R and 0-hint candidates without claiming no event',()=>{
 const x=build({rosterText,choiceFacts:facts,curationIndex:curation});
 a.equal(x.stats.rosterCards,3);
 a.deepEqual(x.stats.rarityCounts,{R:1,SR:1,SSR:1});
 a.equal(x.stats.cardsWithCuratedDraft,1);
 a.equal(x.stats.observedCheckerCandidates,2);
 a.equal(x.cards[0].expectedEventCount,null);
 a.ok(x.cards[0].gaps.includes('R_SOURCE_NOT_INCLUDED'));
 a.ok(x.cards.every(c=>c.expectedEventListStatus==='unknown'));
 a.equal(x.cards[1].observedCandidates[0].candidateStatus,'no-observed-skill-hints');
});
test('strict 563 target differs from synthetic 3-card fixture',()=>{
 const x=build({rosterText,choiceFacts:facts,curationIndex:curation});
 a.throws(()=>verifySnapshot(x),/固定スナップショット/);
 a.equal(verifySnapshot(x,{cards:3,R:1,SR:1,SSR:1,candidateCards:2,events:2}).rosterCards,3);
});
test('duplicate, orphan and rarity mismatched candidate records are rejected',()=>{
 const base={rosterText,choiceFacts:facts,curationIndex:curation};
 a.throws(()=>build({...base,choiceFacts:{...facts,cards:[{...facts.cards[0],cardId:'99999'}]}}),/母集団/);
 a.throws(()=>build({...base,choiceFacts:{...facts,cards:[{...facts.cards[0],rarity:'SSR'}]}}),/レアリティ/);
 a.throws(()=>build({...base,curationIndex:{...curation,cards:[...curation.cards,...curation.cards]}}),/重複/);
});
