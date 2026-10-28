'use strict';
/*
 * Deterministic metadata-only baseline selection for the NEXT direct-site
 * parity tests. This is grounded in the pinned OLD derived GT database,
 * but cannot certify any behavior on GameTora's current website.
 */
const EXPECTED=Object.freeze({
 '30030':{eventCount:5,sections:['random','random','arrows','arrows','arrows'],
  choiceCounts:[2,2,2,1,1],resultCounts:[2,2,2,1,2],
  expectedRange:{event:3,choice:2,type:'energy'}},
 '30041':{eventCount:5,sections:['random','random','arrows','arrows','arrows'],
  choiceCounts:[2,2,2,1,1],resultCounts:[2,2,2,1,1],
  expectedRange:{event:3,choice:1,type:'skill_points'}},
 '30080':{eventCount:11,
  sections:['special','special','special','special','special','special',
   'random','random','dates','dates','dates'],
  choiceCounts:[1,1,1,1,1,1,1,3,1,1,2],
  resultCounts:[2,1,2,1,1,1,2,4,2,2,4],
  expectedBranch:{event:8,choices:3,outcomes:[2,1,1],terminals:1}}
});
const fail=s=>{throw Error('固定旧GT構造別実測候補: '+s);};
const countResults=choice=>Array.isArray(choice.outcomes)?choice.outcomes.length:
  Array.isArray(choice.effects)?1:null;
const effectsOf=choice=>Array.isArray(choice.outcomes)?choice.outcomes.flat():choice.effects||[];
function inspectOne(doc){
 const cardId=String(doc?.id||''),expected=EXPECTED[cardId];
 if(!expected||doc.kind!=='support'||!doc.events_ja||
  typeof doc.events_ja!=='object'||Array.isArray(doc.events_ja))
  fail('旧カードID・元資料が異なる');
 const events=Object.values(doc.events_ja);
 if(events.length!==expected.eventCount||
  events.some((e,i)=>e?.section!==expected.sections[i]||
   !Array.isArray(e.choices)||e.choices.length!==expected.choiceCounts[i]||
   e.choices.some(c=>countResults(c)===null))||
  events.some((e,i)=>e.choices.reduce((n,c)=>n+countResults(c),0)!==
    expected.resultCounts[i]))
  fail(cardId+'の選択・結果構造が固定版と変化');
 const rangeLocations=[];
 for(const [ei,e] of events.entries()){
  for(const [ci,ch] of e.choices.entries()){
   for(const effect of effectsOf(ch)){
    if(typeof effect?.value==='string'&&effect.value.includes('/')){
     const match=/^([+-]\d+)\/([+-]\d+)$/.exec(effect.value);
     if(!match||effect.type==='skill_hint'||effect.type==='skill_hint_or')
      fail('範囲値は元の数値スカラー分岐として扱えない');
     rangeLocations.push({eventOrdinal:ei+1,choiceOrdinal:ci+1,
      kind:effect.type,alternatives:2,absoluteDifference:
       Math.abs(Number(match[2])-Number(match[1]))});
    }
   }
  }
 }
 let branch=null;
 if(expected.expectedRange){
  if(rangeLocations.length!==1||
    rangeLocations[0].eventOrdinal!==expected.expectedRange.event||
    rangeLocations[0].choiceOrdinal!==expected.expectedRange.choice||
    rangeLocations[0].kind!==expected.expectedRange.type)
   fail(cardId+'の数値連動範囲が変化');
 }else{
  if(rangeLocations.length)fail('想定しない範囲がある');
  const b=expected.expectedBranch,choices=events[b.event-1].choices;
  const stops=choices.flatMap(c=>effectsOf(c)).filter(e=>e?.type==='chain_end').length;
  const counts=choices.map(countResults);
  if(choices.length!==b.choices||stops!==b.terminals||
   counts.join(',')!==b.outcomes.join(','))
   fail(cardId+'の出典分岐／停止が変化');
  branch={eventOrdinal:b.event,choices:counts.length,routeCount:counts.reduce((a,c)=>a+c,0),
   explicitTerminalMentions:stops};
 }
 return {cardId,sourceEvents:events.length,
  expandedResultRoutes:expected.resultCounts.reduce((a,b)=>a+b,0),
  numericRangeCount:rangeLocations.length,rangeLocations,
  ...(branch?{branch}:{}),
  sourceOriginalTextExported:false,sourceWebsiteIndependentlyCompared:false,
  completeAppJSONValidated:false,publicationApproved:false};
}
function inspectCohort(documents){
 if(!Array.isArray(documents)||documents.length!==3)
  fail('3枚の検証対象固定カードが必要');
 const ids=documents.map(d=>String(d?.id));
 if(new Set(ids).size!==3||ids.slice().sort().join(',')!=='30030,30041,30080')
  fail('異なる構造の旧カード3件が揃っていない');
 return {dataKind:'existing-gametora-old-structural-cohort',
  sourceRevision:'6e38b54af4fad397ff4491e63007a90705a4fe67',
  cards:documents.map(inspectOne).sort((a,b)=>a.cardId.localeCompare(b.cardId)),
  comparisonBasis:'historical-derivative-not-original-website',
  textOrImagesCopied:false,originalWebsiteEquivalenceVerified:false,
  productionAppJsonEquivalenceVerified:false,publicationApproved:false};
}
module.exports={inspectOne,inspectCohort,EXPECTED};
