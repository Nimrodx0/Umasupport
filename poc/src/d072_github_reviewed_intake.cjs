'use strict';
// GitHub-backed read-only preparation. Independent evidence and final
// content-bound release approvals are supplied by the caller, never inferred.
const {createSourceReader}=require('./d072_verified_umasim_source.cjs');
const {createStore}=require('./d069_github_attempt_store.cjs');
const {prepareIndependentCandidate,stageIndependentEvidenceAcrossVersions}=require('./d072_independent_review.cjs');
const {scope}=require('./d069_review_packet_archive.cjs');
const {verify}=require('./d069_json_attempt_ledger.cjs');
const {verifyRelease}=require('./event_release_gate.cjs');
const {buildModel}=require('./live_loader.js');
const {preflight}=require('./public_event_catalog.js');
const fail=m=>{throw Error('D072 GitHub reviewed intake: '+m);};
function createReviewedIntake({github,owner,repo,store=createStore({github,owner,repo}),source=createSourceReader(github)}={}){
 async function readItems(evidence){
  if(!Array.isArray(evidence)||!evidence.length||evidence.length>2||
     new Set(evidence.map(x=>x?.cardId)).size!==evidence.length||
     evidence.some(x=>typeof x?.cardId!=='string'||!/^[1-9]\d{4}$/.test(x.cardId)))fail('evidence batch scope');
  const ledger=verify(await store.load()),items=[],sources=new Map();
  for(const v of evidence){
   const row=ledger.rows.find(x=>x.cardId===v.cardId);
   if(!row||row.status!=='awaiting-fact-review'||row.packetSha256!==v.packetSha256)fail('review receipt unavailable');
   const packet=scope(await store.loadPacket(v.cardId),row);
   const key=row.sourcePin.commit+':'+row.sourcePin.cardBlob+':'+row.sourcePin.skillBlob;
   if(!sources.has(key))sources.set(key,await source.load(row.sourcePin));
   items.push({packet,evidence:v,source:sources.get(key)});
  }
  return {ledger,items};
 }
 function prepareItem(x,ledger,existingCatalog){
  if(x.evidence?.dataKind==='d073-source-title-input')return require('./d073_json_adoption.cjs').prepareSourceCandidate({packet:x.packet,input:x.evidence,ledger,skillText:x.source.skillText,existingCatalog});
  return prepareIndependentCandidate({packet:x.packet,evidence:x.evidence,ledger,skillText:x.source.skillText,existingCatalog});
 }
 async function prepare({evidence,existingCatalog}={}){
  const {ledger,items}=await readItems(evidence);
  return {dataKind:'d072-independent-candidate-preparation',schemaVersion:1,publicationApproved:false,
   items:items.map(x=>prepareItem(x,ledger,existingCatalog))};
 }
 async function stage({evidence,existingCatalog,existingApprovals,newApprovals,attestations,publicationDecisions,routinePublicationPolicy}={}){
  if([newApprovals,attestations,publicationDecisions,routinePublicationPolicy].filter(x=>x!==undefined).length!==1)fail('exactly one explicit approval input required');
  const {ledger,items}=await readItems(evidence);
  const hasSource=items.some(x=>x.evidence?.dataKind==='d073-source-title-input');
  if(routinePublicationPolicy!==undefined){
   publicationDecisions=require('./d073_routine_publication_policy.cjs').derive({policy:routinePublicationPolicy,ledger,items:items.map(x=>({packet:x.packet,input:x.evidence,prepared:prepareItem(x,ledger,existingCatalog)}))});
  }
  if(publicationDecisions!==undefined){
   if(items.some(x=>x.evidence?.dataKind!=='d073-source-title-input'))fail('publication decisions require source-fact candidates only');
   newApprovals=require('./d073_publication_decision.cjs').generate({items:items.map(x=>({packet:x.packet,prepared:prepareItem(x,ledger,existingCatalog)})),decisions:publicationDecisions});
  }
  if(hasSource&&attestations!==undefined)fail('source facts require explicit individual approvals');
  if(attestations!==undefined){
   const prepared=items.map(x=>prepareItem(x,ledger,existingCatalog));
   newApprovals=require('./d072_card_review_attestation.cjs').expandAttestations({prepared,attestations});
  }
  const baseline=await source.baseline(),release=await source.latest(),pinnedSkillText=await source.historicalSkill();
  if(!hasSource)return stageIndependentEvidenceAcrossVersions({items,ledger,baseline,release,existingCatalog,existingApprovals,newApprovals,pinnedSkillText});
  const matched=items.map(x=>{
   if(x.evidence?.dataKind==='d073-source-title-input'){
    const {receipt}=prepareItem(x,ledger,existingCatalog);
    return {packet:x.packet,source:x.source,sourceInput:x.evidence,receipt};
   }
   return {packet:x.packet,source:x.source,...require('./d072_independent_review.cjs').compareIndependentReview({packet:x.packet,ledger,evidence:x.evidence})};
  });
  const result=require('./d072_cross_version_reviewed_append.cjs').stageReviewedAcrossVersions({items:matched,ledger,baseline,release,existingCatalog,existingApprovals,newApprovals,pinnedSkillText});
  return {...result,independentReviewReceipts:matched.filter(x=>!x.sourceInput).map(x=>x.receipt),sourceFactReceipts:matched.filter(x=>x.sourceInput).map(x=>x.receipt)};
 }
 // Does not enumerate or fetch any event-site target. Useful for a real
 // GitHub source/production catalog preflight even when pending IDs are zero.
 async function verifyCurrent({existingCatalog,existingApprovals}={}){
  const baseline=await source.baseline(),release=await source.latest(),pinnedSkillText=await source.historicalSkill();
  const discovery=require('./new_card_event_incremental.cjs').discoverNewCardsFromUmaSim({
   previousSupportText:baseline.supportText,currentSupportText:release.supportText});
  const approved=verifyRelease(existingCatalog,existingApprovals);
  const runtime=preflight(buildModel(release.supportText),existingCatalog,{
   skillText:release.skillText,pinnedSkillText,fullRegistry:true,allowReviewedLegacy:true});
  return {releasePin:release.pin,baselineBlob:baseline.cardBlob,previousRosterCount:discovery.previousRosterCount,
   currentRosterCount:discovery.currentRosterCount,addedCardIds:discovery.addedCardIds,approved,runtimeSummary:runtime.summary,
   sourceRequestsToGameTora:0,publicationChanged:false};
 }
 return {prepare,stage,verifyCurrent};
}
module.exports={createReviewedIntake};
