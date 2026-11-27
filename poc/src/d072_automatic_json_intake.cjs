'use strict';
const {excludeAttempted,runBatch}=require('./d069_json_attempt_ledger.cjs');
const {createObserver}=require('./d069_card_json_transport.cjs');
const {gitBlobSha}=require('./current_umasim_roster_delta.cjs');
// Only a verified roster plan with unattempted IDs may call the transport.
// Existing approval gate remains independent of source collection.
async function runAutomatic({plan,sourcePin,policy,existingCatalog,store,loadSkillText,observerFactory=createObserver}){
 if(policy?.automaticScheduledSiteAccessAllowed!==true||policy.automaticPublicationAllowed!==false)throw Error('D072 automatic intake policy mismatch');
 const eligible=excludeAttempted(plan,await store.load());
 if(!eligible.eligibleIds.length)return {attemptedIds:[],stopReason:null,sourceRequestsPerformed:false,publicationApproved:false};
 const skillText=await loadSkillText();
 if(gitBlobSha(skillText)!==sourcePin.skillBlob)throw Error('UmaSim skill blob mismatch');
 const observer=observerFactory({automaticAuthorized:true,knownIds:existingCatalog.cards.map(c=>c.cardId)});
 const attemptedIds=[];let stopReason=null;
 for(const targetIds of eligible.batches){
  const r=await runBatch({plan,sourcePin,policy,existingCatalog,skillText,store,targetIds,observeBatch:observer});
  attemptedIds.push(...r.selectedIds);
  if(r.stopReason){stopReason=r.stopReason;break;}
 }
 return {attemptedIds,stopReason,sourceRequestsPerformed:attemptedIds.length>0,publicationApproved:false};
}
module.exports={runAutomatic};
