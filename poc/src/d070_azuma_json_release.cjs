'use strict';
const {canonical,digest,verifyRelease}=require('./event_release_gate.cjs');
const {appendApprovedNewCards}=require('./new_card_event_incremental.cjs');
const review=require('../config/d070-azuma-json-release.v1.json');
const fail=x=>{throw Error('D070 scoped release: '+x);};
function prepare(input){
 const {reviewed}=input;
 if(!Array.isArray(reviewed)||reviewed.length!==2||review.cards.length!==2)fail('card scope');
 const candidates=[],entries=[];
 for(const pin of review.cards){
  const r=reviewed.find(x=>x.card?.cardId===pin.cardId);
  if(!r||r.publicationApproved!==false||r.skillPathOnly!==true||r.sourceBodySha256!==pin.bodySha256||
     r.summary.namesArePlaceholders!==false||r.card.coverageStatus!=='partial'||
     canonical(r.card.events.map(e=>({eventId:e.id,sha256:digest(e)})))!==canonical(pin.eventDigests))
   fail('named content digest mismatch '+pin.cardId);
  const source=['https://gametora.com/ja/umamusume/supports/'+pin.cardId+'-azuma',
    'https://github.com/Nimrodx0/Umasupport/actions/runs/'+review.factReviewRun,
    'https://github.com/Nimrodx0/Umasupport/actions/runs/'+review.namedRehearsalRun];
  const policy=['https://github.com/Nimrodx0/Umasupport/blob/302cf98f03b58b8809b8991316babe85ba3bf073/docs/decisions/log.md#decision-d-070','https://github.com/Nimrodx0/Umasupport/blob/302cf98f03b58b8809b8991316babe85ba3bf073/docs/decisions/log.md#decision-d-068','https://gametora.com/robots.txt','https://gametora.com/docs/cla','https://umamusume.jp/derivativework_guidelines'];
  for(const e of r.card.events)entries.push({cardId:pin.cardId,eventId:e.id,eventSha256:digest(e),
    reviewer:'ChatGPT technical/editorial review under D-068 and D-070',reviewedAt:review.reviewedAt,
    checks:{card:true,event:true,choices:true,outcomes:true,dependencies:true,publication:true},
    evidence:{card:source,event:source,choices:source,outcomes:source,dependencies:source,publication:policy},
    publicationBasis:structuredClone(review.publicationBasis)});
  candidates.push({source:'GameTora-original-site',cardId:pin.cardId,sourceSiteTextCopied:false,publicationApproved:false,appEventSchemaAdoptable:false,siteEventPanelCount:11,convertedEventCount:11,unresolvedEventCount:0,events:r.card.events});
 }
 const {reviewed:_,...rest}=input;
 const result=appendApprovedNewCards({...rest,candidates,newApprovals:{schemaVersion:1,entries}});
 if(result.appendedCardCount!==2||result.appendedEventCount!==22||result.existingCatalogUnchanged!==true||result.pending.length)fail('append scope');
 return {cards:result.catalog.cards.slice(input.existingCatalog.cards.length),entries,verification:verifyRelease(result.catalog,result.approvals)};
}
module.exports={prepare};
