'use strict';
// Conditional owner authorization is not a substitute for the actual
// content-bound review. This builder is limited to the individually
// assessed D068 first batch; future batches must carry their own evidence.
const {digest,canonical,verifyRelease}=require('./event_release_gate.cjs');
const {appendApprovedNewCards}=require('./new_card_event_incremental.cjs');
const manifest=require('../config/direct-event-fact-review.v1.json');
const reviewed=require('../config/direct-named-release-d068-20261127.v1.json');
const fail=s=>{throw Error('D068 reviewed release: '+s);};
function entriesFor(candidates){
 if(reviewed.decision!=='D-068'||reviewed.schemaVersion!==1||
    reviewed.publicationBasis.kind!=='original-factual-description'||
    !Array.isArray(candidates)||candidates.length!==reviewed.cards.length)fail('scope mismatch');
 const out=[];
 for(const spec of reviewed.cards){
  const c=candidates.find(x=>x.cardId===spec.cardId),ref=manifest.cards.find(x=>x.cardId===spec.cardId);
  if(!c||!ref||c.publicationApproved!==false||c.source!=='GameTora-original-site'||
     c.unresolvedEventCount!==0||canonical(c.events.map(e=>({eventId:e.id,sha256:digest(e)})))!==canonical(spec.eventDigests))fail('reviewed content mismatch '+spec.cardId);
  const fact='https://github.com/Nimrodx0/Umasupport/actions/runs/'+reviewed.factReviewRun;
  const runtime='https://github.com/Nimrodx0/Umasupport/actions/runs/'+reviewed.rehearsalRun;
  const source=[ref.sourceUrl,ref.adjudicatorUrl,fact,runtime];
  const policy=['https://github.com/Nimrodx0/Umasupport/blob/112ef8b1b74565539adacc85faeb497e0c8c9684/docs/decisions/log.md#decision-d-068','https://gametora.com/robots.txt','https://gametora.com/docs/cla','https://umamusume.jp/derivativework_guidelines','https://github.com/Nimrodx0/Umasupport/blob/48e9072dba84dfa6e6335522071b6a24073ad288/docs/evidence/events/d067-azuma-and-release-review-20261127.md'];
  for(const e of c.events)out.push({cardId:c.cardId,eventId:e.id,eventSha256:digest(e),
   reviewer:'ChatGPT technical/editorial review under project-owner D-068 conditional approval',reviewedAt:reviewed.reviewedAt,
   checks:{card:true,event:true,choices:true,outcomes:true,dependencies:true,publication:true},
   evidence:{card:source,event:source,choices:source,outcomes:source,dependencies:source,publication:policy},
   publicationBasis:structuredClone(reviewed.publicationBasis)});
 }
 return {schemaVersion:1,entries:out};
}
function prepare(input){
 const newApprovals=entriesFor(input.candidates);
 const result=appendApprovedNewCards({...input,newApprovals});
 if(result.appendedCardCount!==3||result.appendedEventCount!==12||result.existingCatalogUnchanged!==true)fail('append count mismatch');
 const verification=verifyRelease(result.catalog,result.approvals);
 return {cards:result.catalog.cards.slice(input.existingCatalog.cards.length),entries:newApprovals.entries,verification};
}
module.exports={entriesFor,prepare};
