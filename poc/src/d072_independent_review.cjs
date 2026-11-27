'use strict';
// Convert separately reviewed structured observations into the existing
// packet-bound review contract. Matching is mechanical, not evidence of
// actual review or permission. This never issues final release approvals.
const crypto=require('node:crypto');
const {canonical,digest,secureUrl}=require('./event_release_gate.cjs');
const {scope}=require('./d069_review_packet_archive.cjs');
const {verify}=require('./d069_json_attempt_ledger.cjs');
const fail=m=>{throw Error('D072 independent review: '+m);};
const same=(a,b)=>canonical(a)===canonical(b);
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys.split(',').sort().join(',');
function routeFacts(r){
 return {ordinal:r.ordinal,hints:r.hints.map(h=>({skillId:h.skillId,level:h.level})),
  terminal:r.terminal,nonSkillCount:r.nonSkillCount};
}
function compareIndependentReview({packet,ledger,evidence}={}){
 verify(ledger);
 const row=ledger.rows.find(r=>r.cardId===packet?.cardId);
 if(!row||row.status!=='awaiting-fact-review')fail('no reviewable receipt');
 scope(packet,row);
 if(packet.reasonCodes.length||packet.status!=='awaiting-independent-fact-review')fail('held packet');
 if(!exact(evidence,'schemaVersion,cardId,packetSha256,reviewer,reviewedAt,evidenceUrls,nonSkillPolicy,events')||
    evidence.schemaVersion!==1||evidence.cardId!==packet.cardId||evidence.packetSha256!==digest(packet)||
    typeof evidence.reviewer!=='string'||!evidence.reviewer.trim()||evidence.reviewer.length>120||
    typeof evidence.reviewedAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(evidence.reviewedAt)||
    !Number.isFinite(Date.parse(evidence.reviewedAt+'T00:00:00Z'))||
    new Date(evidence.reviewedAt+'T00:00:00Z').toISOString().slice(0,10)!==evidence.reviewedAt||
    !Array.isArray(evidence.evidenceUrls)||!evidence.evidenceUrls.length||evidence.evidenceUrls.length>20||
    evidence.evidenceUrls.some(x=>typeof x!=='string'||!secureUrl(x))||
    evidence.nonSkillPolicy!=='omit-explicitly-skill-path-only'||!Array.isArray(evidence.events)||
    evidence.events.length!==packet.events.length)fail('independent evidence missing or stale');
 const titles=new Map();
 const events=packet.events.map((e,i)=>{
  const v=evidence.events[i];
  if(!exact(v,'sourceEventId,title,category,categoryOrdinal,selection,previousSourceEventId,groups')||
     v.sourceEventId!==e.sourceEventId||v.category!==e.category||v.categoryOrdinal!==e.categoryOrdinal||
     v.selection!==e.selection||typeof v.title!=='string'||!v.title.trim()||v.title.length>80||
     /[\r\n\u0000-\u001f]/.test(v.title)||crypto.createHash('sha256').update(v.title).digest('hex')!==e.exactTitleSha256||
     titles.has(e.sourceEventId))fail('event identity or title mismatch');
  const predecessor=e.category==='arrows'&&e.categoryOrdinal>1?
    packet.events.find(x=>x.category==='arrows'&&x.categoryOrdinal===e.categoryOrdinal-1)?.sourceEventId:null;
  if(predecessor===undefined||v.previousSourceEventId!==predecessor)fail('independently reviewed topology mismatch');
  const expected=e.groups.map(g=>({ordinal:g.ordinal,labelPresent:g.labelPresent,routes:g.routes.map(routeFacts)}));
  if(!same(v.groups,expected))fail('independently reviewed route facts mismatch');
  titles.set(e.sourceEventId,v.title);
  return {sourceEventId:e.sourceEventId,titleSha256:e.titleSha256,selection:e.selection,
   resultCounts:e.groups.map(g=>g.routes.length),routeFactsSha256:digest({groups:e.groups}),
   previousSourceEventId:v.previousSourceEventId};
 });
 return {titles,review:{schemaVersion:1,publicationApproved:false,cardId:packet.cardId,packetSha256:digest(packet),
  nonSkillPolicy:evidence.nonSkillPolicy,events},
  receipt:{schemaVersion:1,cardId:packet.cardId,packetSha256:digest(packet),independentEvidenceSha256:digest(evidence),
   reviewer:evidence.reviewer,reviewedAt:evidence.reviewedAt,evidenceUrls:evidence.evidenceUrls.slice(),publicationApproved:false}};
}
module.exports={compareIndependentReview};
