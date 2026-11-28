'use strict';
// Explicit correction only: no source contact, no implicit new approval.
const {verifyRelease,digest,secureUrl,indexPublished}=require('./event_release_gate.cjs');
const {inventory}=require('./event_release_cohorts.cjs');
const fail=m=>{throw Error('D077 correction: '+m);};
const key=(cardId,eventId)=>JSON.stringify([cardId,eventId]);
const match=(k,s)=>{const [c,e]=JSON.parse(k);return e.startsWith(s.eventIdPrefix)&&(!s.cardIds||s.cardIds.includes(c));};
const pair=k=>{const [cardId,eventId]=JSON.parse(k);return {cardId,eventId};};
function correction({catalog,approvals,bundle}){
 verifyRelease(catalog,approvals);
 if(approvals.schemaVersion!==2||!bundle||Object.keys(bundle).sort().join(',')!=='approvals,cardId,events,evidenceUrls,expectedCardSha256,reason'||
    !/^[1-9]\d{4}$/.test(bundle.cardId||'')||typeof bundle.reason!=='string'||!bundle.reason.trim()||bundle.reason.length>1000||
    !Array.isArray(bundle.evidenceUrls)||!bundle.evidenceUrls.length||bundle.evidenceUrls.length>20||!bundle.evidenceUrls.every(secureUrl)||
    !Array.isArray(bundle.events)||bundle.events.length>100||!Array.isArray(bundle.approvals))fail('explicit correction bundle required');
 const card=catalog.cards.find(c=>c.cardId===bundle.cardId);
 if(!card||digest(card)!==bundle.expectedCardSha256)fail('prior card digest mismatch');
 const replacement={...card,events:structuredClone(bundle.events)};
 if(digest(card)===digest(replacement))fail('no changes');
 // Retain the card entry even when all events are removed: discovery must
 // not interpret an intentional withdrawal as a new unimported card.
 const next={...catalog,cards:catalog.cards.map(c=>c===card?replacement:c)};
 const oldIndex=indexPublished(catalog),newIndex=indexPublished(next);
 const changed=new Set([...new Set([...oldIndex.keys(),...newIndex.keys()])].filter(k=>oldIndex.get(k)!==newIndex.get(k)));
 if(!changed.size)fail('no event content changes');
 const need=[...changed].filter(k=>newIndex.has(k)).sort();
 const inputKeys=bundle.approvals.map(x=>key(x.cardId,x.eventId)).sort();
 if(JSON.stringify(inputKeys)!==JSON.stringify(need))fail('new approvals must cover exactly changed or added events');
 if(need.length){
  verifyRelease({schemaVersion:1,cards:[{...replacement,events:replacement.events.filter(e=>changed.has(key(card.cardId,e.id)))}]},{schemaVersion:1,entries:bundle.approvals});
 }
 const entries=[...approvals.entries.filter(x=>!changed.has(key(x.cardId,x.eventId))),...structuredClone(bundle.approvals)];
 const oldIndividual=new Set(approvals.entries.map(x=>key(x.cardId,x.eventId)));
 const cohorts=[];
 for(const c of approvals.cohorts){
  let old=inventory(catalog,[c.selector]);
  if(old.groups[0].eventsSha256!==c.eventsSha256||old.groups[0].events!==c.expectedEvents){
   const excluded=new Set((c.selector.excludedEventKeys??[]).map(x=>key(x.cardId,x.eventId)));
   for(const k of oldIndividual)if(match(k,c.selector))excluded.add(k);
   const selector={...c.selector,excludedEventKeys:[...excluded].map(pair)};
   old=inventory(catalog,[selector]);
  }
  if(old.groups[0].eventsSha256!==c.eventsSha256||old.groups[0].events!==c.expectedEvents)fail('old cohort membership mismatch');
  const keep=[...old.matchedKeys].filter(k=>!changed.has(k)).sort();
  if(!keep.length)continue;
  const excluded=[...newIndex.keys()].filter(k=>match(k,c.selector)&&!keep.includes(k));
  const {excludedEventKeys,...base}=c.selector;
  const selector=excluded.length?{...base,excludedEventKeys:excluded.map(pair)}:base;
  const current=inventory(next,[selector]);
  if(JSON.stringify([...current.matchedKeys].sort())!==JSON.stringify(keep))fail('cohort membership drift');
  if(current.groups[0].eventsSha256===c.eventsSha256&&current.groups[0].events===c.expectedEvents){
   // Preserve existing exact cohort if its historic selector remains valid.
   try{const x=inventory(next,[c.selector]);if(x.groups[0].eventsSha256===c.eventsSha256&&x.groups[0].events===c.expectedEvents){cohorts.push(c);continue;}}catch{}
  }
  cohorts.push({...c,selector,expectedEvents:current.groups[0].events,eventsSha256:current.groups[0].eventsSha256});
 }
 const nextApprovals={schemaVersion:2,cohorts,entries};
 verifyRelease(next,nextApprovals);
 return {catalog:next,approvals:nextApprovals,changedEventKeys:[...changed].sort()};
}
module.exports={correction};
