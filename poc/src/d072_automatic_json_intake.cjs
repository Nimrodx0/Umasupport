'use strict';
const {excludeAttempted,runBatch}=require('./d069_json_attempt_ledger.cjs');
const {createObserver}=require('./d069_card_json_transport.cjs');
const {gitBlobSha}=require('./current_umasim_roster_delta.cjs');
// Only a verified roster plan with unattempted IDs may call the transport.
// Existing approval gate remains independent of source collection.
async function runAutomatic({plan,sourcePin,policy,existingCatalog,store,loadSkillText,observerFactory=createObserver,displayObserver=require('./d072_display_corroboration.cjs').observeHtml}){
 if(policy?.automaticScheduledSiteAccessAllowed!==true||policy.automaticPublicationAllowed!==false)throw Error('D072 automatic intake policy mismatch');
 const ledger=await store.load();
 const eligible=excludeAttempted(plan,ledger);
 if(!eligible.eligibleIds.length)return {attemptedIds:[],stopReason:null,sourceRequestsPerformed:false,publicationApproved:false};
 // A source refusal is a site-level stop, not merely a card-level retry ban.
 // Preserve the receipt across daily runs; reopening requires a reviewed policy change.
 if(ledger.rows.some(row=>row.status==='uncertain'&&row.failureCode==='source-refused'))
  return {attemptedIds:[],stopReason:'prior-source-refused',sourceRequestsPerformed:false,publicationApproved:false};
 const skillText=await loadSkillText();
 if(gitBlobSha(skillText)!==sourcePin.skillBlob)throw Error('UmaSim skill blob mismatch');
 const observer=observerFactory({automaticAuthorized:true,knownIds:existingCatalog.cards.map(c=>c.cardId),observeHtml:args=>displayObserver({...args,skillText})});
 const attemptedIds=[];let stopReason=null;
 // A card's own HTML is needed for a separate display path; singleton
 // batches stay inside the existing 5-GET cap and do not revisit a card.
 for(const id of eligible.eligibleIds){
  const targetIds=[id];
  const r=await runBatch({plan,sourcePin,policy,existingCatalog,skillText,store,targetIds,observeBatch:observer});
  attemptedIds.push(...r.selectedIds);
  if(r.stopReason){stopReason=r.stopReason;break;}
 }
 return {attemptedIds,stopReason,sourceRequestsPerformed:attemptedIds.length>0,publicationApproved:false};
}
module.exports={runAutomatic};
