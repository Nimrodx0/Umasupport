'use strict';
// Transport-independent attempt controller. Store must atomically compare
// the entire prior state and persist the next state before reporting true.
// A reservation never expires automatically: a crash may follow a visit.
// No default network implementation, no scheduling or publication.
const {canonical,digest}=require('./event_release_gate.cjs');
const {inspect}=require('./d069_json_review_bridge.cjs');
const {gitBlobSha}=require('./current_umasim_roster_delta.cjs');
const {partitionBatches}=require('./direct_pending_review.cjs');
const fail=m=>{throw Error('D069 JSON attempt: '+m);};
const ID=/^[1-9]\d{4}$/,SHA=/^[a-f0-9]{64}$/,GIT=/^[a-f0-9]{40}$/;
const same=(a,b)=>canonical(a)===canonical(b);
const states=new Set(['reserved','awaiting-fact-review','held','not-listed','uncertain']);
function empty(){return {schemaVersion:1,dataKind:'d069-json-attempt-ledger',revision:0,rows:[]};}
function verify(x){
 if(x?.schemaVersion!==1||x.dataKind!=='d069-json-attempt-ledger'||
    !Number.isSafeInteger(x.revision)||x.revision<0||!Array.isArray(x.rows)||x.rows.length>1000||
    Object.keys(x).sort().join(',')!=='dataKind,revision,rows,schemaVersion')fail('ledger shape');
 const seen=new Set();
 for(const r of x.rows){
  if(!r||Object.keys(r).sort().join(',')!=='cardId,packetSha256,sourcePin,status'||
     !ID.test(r.cardId||'')||seen.has(r.cardId)||!states.has(r.status)||
     Object.keys(r.sourcePin||{}).sort().join(',')!=='cardBlob,commit,skillBlob'||
     !Object.values(r.sourcePin).every(z=>typeof z==='string'&&GIT.test(z))||
     (['awaiting-fact-review','held'].includes(r.status)?!SHA.test(r.packetSha256||''):r.packetSha256!==null))
   fail('attempt row shape');
  seen.add(r.cardId);
 }
 return x;
}
function planBatch({plan,ledger,targetIds,sourcePin,policy,existingCatalog}={}){
 verify(ledger);
 if(plan?.dataKind!=='d069-event-driven-intake-plan'||plan.schemaVersion!==1||
    plan.siteAccessAuthorized!==false||plan.publicationApproved!==false||
    policy?.automaticScheduledSiteAccessAllowed!==false||policy.automaticPublicationAllowed!==false||
    policy.sourceVisitLimitPerInvocation!==2||
    !GIT.test(sourcePin?.skillBlob||'')||
    Object.keys(sourcePin||{}).sort().join(',')!=='cardBlob,commit,skillBlob'||
    !Object.values(sourcePin).every(z=>typeof z==='string'&&GIT.test(z))||
    !same(plan.sourcePin,{commit:sourcePin.commit,cardBlob:sourcePin.cardBlob})||
    existingCatalog?.schemaVersion!==1||!Array.isArray(existingCatalog.cards)||
    !Array.isArray(plan.eligibleIds)||!Array.isArray(plan.heldIds)||
    !same(plan.batches,partitionBatches(plan.eligibleIds,2))||
    plan.eligibleIds.some(id=>plan.heldIds.includes(id)))fail('plan or policy mismatch');
 if(!Array.isArray(targetIds)||targetIds.length>2||
    new Set(targetIds).size!==targetIds.length||targetIds.some(id=>!ID.test(id)||!plan.eligibleIds.includes(id)))
  fail('explicit batch scope');
 const imported=new Set(existingCatalog.cards.map(c=>c.cardId)),attempted=new Set(ledger.rows.map(r=>r.cardId));
 if(targetIds.some(id=>imported.has(id)))fail('already imported');
 return {selectedIds:targetIds.filter(id=>!attempted.has(id)),
  previouslyAttemptedIds:targetIds.filter(id=>attempted.has(id)),
  siteAccessAuthorized:false,publicationApproved:false};
}
async function runBatch({plan,targetIds,sourcePin,policy,existingCatalog,skillText,store,observeBatch}={}){
 if(typeof skillText!=='string'||gitBlobSha(skillText)!==sourcePin?.skillBlob||
    typeof store?.load!=='function'||typeof store.compareAndSet!=='function'||typeof observeBatch!=='function')
  fail('pinned inputs and atomic store required');
 const before=structuredClone(verify(await store.load()));
 const selection=planBatch({plan,ledger:before,targetIds,sourcePin,policy,existingCatalog});
 const ids=selection.selectedIds;
 if(!ids.length)return {...selection,results:[],stopReason:null,reviewPackets:[]};
 const reservation={...before,revision:before.revision+1,rows:[...before.rows,...ids.map(cardId=>({cardId,sourcePin:structuredClone(sourcePin),status:'reserved',packetSha256:null}))]};
 verify(reservation);
 if(await store.compareAndSet(structuredClone(before),structuredClone(reservation))!==true)fail('reservation conflict; no observation');
 let results,stopReason=null,reviewPackets=[];
 try{
  // The caller is responsible for a separately reviewed transport.
  // Only in-memory raw responses enter this callback contract.
  const raw=await observeBatch(ids.slice());
  if(!Array.isArray(raw)||raw.length!==ids.length||raw.some((r,i)=>r?.cardId!==ids[i]))fail('response scope');
  results=raw.map(r=>{
   if(r.status==='not-listed'){
    if(Object.keys(r).sort().join(',')!=='cardId,status')fail('not-listed shape');
    return {cardId:r.cardId,status:'not-listed',packetSha256:null};
   }
   if(r.status!=='json'||Object.keys(r).sort().join(',')!=='body,buildId,cardId,sourceUrl,status')fail('response shape');
   const packet=inspect({body:r.body,buildId:r.buildId,cardId:r.cardId,sourceUrl:r.sourceUrl,sourcePin,skillText,existingCatalog});
   reviewPackets.push(packet);
   return {cardId:r.cardId,status:packet.status==='held'?'held':'awaiting-fact-review',packetSha256:digest(packet)};
  });
 }catch{
  // Failure after any partial access means the whole reserved batch is
  // uncertain. No source strings or exception messages are persisted.
  results=ids.map(cardId=>({cardId,status:'uncertain',packetSha256:null}));
  stopReason='observation-failed';reviewPackets=[];
 }
 const finished={...reservation,revision:reservation.revision+1,rows:reservation.rows.map(r=>{
  const x=results.find(z=>z.cardId===r.cardId);
  return x?{...r,status:x.status,packetSha256:x.packetSha256}:r;
 })};
 verify(finished);
 if(await store.compareAndSet(structuredClone(reservation),structuredClone(finished))!==true)fail('completion conflict; reservation remains non-retryable');
 return {...selection,results,stopReason,reviewPackets};
}
// Daily roster-only reporting, no observer call. The persistent attempt
// register is additional to the manual review holds and does not remove
// a pending card before actual approved catalog append.
function excludeAttempted(plan,ledger){
 verify(ledger);
 if(plan?.dataKind!=='d069-event-driven-intake-plan'||plan.siteAccessAuthorized!==false||
    plan.publicationApproved!==false||!Array.isArray(plan.eligibleIds)||!Array.isArray(plan.heldIds)||
    !same(plan.batches,partitionBatches(plan.eligibleIds,2)))fail('invalid daily plan');
 const pending=new Set([...plan.eligibleIds,...plan.heldIds]),attempts=ledger.rows.filter(r=>pending.has(r.cardId));
 const attemptedIds=attempts.map(r=>r.cardId),eligibleIds=plan.eligibleIds.filter(id=>!attemptedIds.includes(id));
 return {...plan,eligibleIds,batches:partitionBatches(eligibleIds,2),nextBatchIds:eligibleIds.slice(0,2),
  remainingIds:eligibleIds.slice(2),heldIds:[...new Set([...plan.heldIds,...attemptedIds])].sort(),
  status:eligibleIds.length?'blocked-access-conditions':'no-eligible-cards',
  attemptedIds,attemptStates:attempts.map(r=>({cardId:r.cardId,status:r.status,packetSha256:r.packetSha256}))};
}
module.exports={empty,verify,planBatch,runBatch,excludeAttempted};
