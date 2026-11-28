'use strict';
const {excludeAttempted,runBatch}=require('./d069_json_attempt_ledger.cjs');
const {createObserver}=require('./d069_card_json_transport.cjs');
const {gitBlobSha}=require('./current_umasim_roster_delta.cjs');
const recovery=require('./d077_intake_recovery.cjs');
async function runAutomatic({plan,sourcePin,policy,existingCatalog,store,loadSkillText,observerFactory=createObserver,clock=()=>new Date().toISOString()}){
 if(policy?.automaticScheduledSiteAccessAllowed!==true||policy.automaticPublicationAllowed!==false)throw Error('D072 automatic intake policy mismatch');
 const ledger=await store.load(),eligible=excludeAttempted(plan,ledger),now=clock();
 const report=(attemptedIds=[],stopReason=null)=>({attemptedIds,stopReason,sourceRequestsPerformed:attemptedIds.length>0,publicationApproved:false});
 if(recovery.activeRefusal(ledger))return report([],'prior-source-refused');
 const due=ledger.rows.filter(r=>plan.eligibleIds.includes(r.cardId)&&recovery.due(r,now)).map(r=>r.cardId);
 const ids=[...new Set([...due,...eligible.eligibleIds])];
 if(!ids.length)return report();
 if(recovery.cooldown(ledger,now))return report([],'rate-limit-cooldown');
 const skillText=await loadSkillText();
 if(gitBlobSha(skillText)!==sourcePin.skillBlob)throw Error('UmaSim skill blob mismatch');
 const observer=observerFactory({automaticAuthorized:true,knownIds:existingCatalog.cards.map(c=>c.cardId)});
 const attemptedIds=[];let stopReason=null;
 for(const cardId of ids){
  // Yield before runner timeout, without reserving the remaining cards.
  if(Date.parse(clock())-Date.parse(now)>8*60000){stopReason='time-budget-deferred';break;}
  const result=await runBatch({plan,sourcePin,policy,existingCatalog,skillText,store,targetIds:[cardId],observeBatch:observer,automatic:true,now:clock()});
  attemptedIds.push(...result.selectedIds);
  if(result.stopReason){stopReason=result.stopReason;break;}
 }
 return report(attemptedIds,stopReason);
}
module.exports={runAutomatic};
