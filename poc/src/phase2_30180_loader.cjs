'use strict';
const loader=require('./public_event_catalog.js');
const core=require('./core.js');
function accept({assembled,model,skillText},{strict=false}={}){
 if(assembled.publicationApproved!==false||assembled.noAutomaticRuntimeAdoption!==true)throw Error('not approved');
 const before=JSON.stringify(model);
 const p=loader.preflight(model,assembled.catalog,{skillText,fullRegistry:false});
 const clone=JSON.parse(before);clone.cards=clone.cards.map(c=>clone.cardById[c.id]||c);
 const summary=loader.attach(clone,assembled.catalog,{skillText,fullRegistry:false});
 if(summary.eventsWithRecords!==p.summary.eventsWithRecords||summary.eventsWithRecords!==assembled.summary.totalCandidateEvents)throw Error('count mismatch');
 const card=clone.cardById['30180'];const event=card.events.find(e=>e.id==='usl:30180:special:checker-007');
 if(!event||event.type!=='auto'||event.availabilityKind!=='special-trigger'||event.rewards.length!==1||event.rewards[0].level!==1)throw Error('event missing');
 const routes=core.directRoutes(card,{stage:4,choices:{},outcomes:{}}).filter(r=>r.eventId===event.id);
 if(routes.length!==1||routes[0].skillId!==event.rewards[0].skillId)throw Error('route mismatch');
 if(!['コーナー巧者○','コーナー巧者◯'].includes(clone.skillById[routes[0].skillId]?.name))throw Error('skill name mismatch');
 if(JSON.stringify(model)!==before)throw Error('source model changed');
 if(strict&&(summary.cardsWithRecords!==563||summary.eventsWithRecords!==2512))throw Error('full count mismatch');
 return {status:'PRIVATE_2512_FULL_LOADER_VERIFIED',cards:summary.cardsWithRecords,events:summary.eventsWithRecords,publicationApproved:false};
}
module.exports={accept};
