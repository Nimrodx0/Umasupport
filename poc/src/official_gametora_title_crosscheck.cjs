'use strict';
/**
 * Ephemeral one-card comparison. Return only counts, never source names/text.
 * This is a cross-check of an OLD snapshot against visible original-site
 * event title headings, not an event-reward or source-reuse approval.
 */
const fail=s=>{throw Error('GameTora公式イベント見出しの限定照合: '+s);};
const key=s=>String(s||'').normalize('NFKC')
 .replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
function compareTitles(expectedDoc,observed){
 if(expectedDoc?.kind!=='support'||expectedDoc.id!==30001||
    !expectedDoc.events_ja||typeof expectedDoc.events_ja!=='object'||
    !Array.isArray(observed)||observed.length>12||
    observed.some(x=>typeof x?.title!=='string'||!Number.isSafeInteger(x.sameGroupSize)))
  fail('明示的な旧カードとDOM観測データが不正');
 const events=Object.values(expectedDoc.events_ja);
 if(events.length!==5||events.some(x=>typeof x?.name!=='string'||!['arrows','random'].includes(x.section)))
  fail('比較元旧イベント構造が既知母数に合致しない');
 const used=new Set();
 let matched=0,correctGroupSize=0,ambiguous=0;
 for(const event of events){
  const lookup=key(event.name);
  const index=observed.map((x,i)=>({i,value:key(x.title)}))
   .filter(x=>x.value.includes(lookup)).map(x=>x.i);
  if(index.length!==1||used.has(index[0])){ambiguous++;continue;}
  const ordinal=index[0];used.add(ordinal);matched++;
  if(observed[ordinal].sameGroupSize===(event.section==='arrows'?3:2))
   correctGroupSize++;
 }
 return {
  cardId:'30001',expectedEventTitles:events.length,
  renderedAccordionTitles:observed.length,
  uniquelyMatchedTitleCount:matched,
  groupSemanticsConsistentCount:correctGroupSize,
  notMatchedOrAmbiguousCount:ambiguous,
  rewardAndOutcomeFactsVerified:false,
  chainTerminationVerified:false,
  resultForPublication:false,
  thirdPartyProseInReport:false
 };
}
module.exports={compareTitles};
