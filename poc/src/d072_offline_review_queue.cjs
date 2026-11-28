'use strict';
// Read-only mechanical review preflight. Never infer independent review
// statements, approve publication, retrieve GameTora, or mutate the ledger.
const {verify}=require('./d069_json_attempt_ledger.cjs');
const {scope}=require('./d069_review_packet_archive.cjs');
const {digest}=require('./event_release_gate.cjs');
const {findObservedCatalog}=require('./d072_catalog_prefix.cjs');
const {gitBlobSha}=require('./current_umasim_roster_delta.cjs');
const {registryFromSkillText}=require('./official_gametora_skill_id_crosswalk.cjs');
async function buildReviewQueue({store,pendingIds,existingCatalog,loadSkillText}={}){
 if(typeof store?.load!=='function'||typeof store.loadPacket!=='function'||
    typeof loadSkillText!=='function'||existingCatalog?.schemaVersion!==1||!Array.isArray(existingCatalog.cards)||
    !Array.isArray(pendingIds)||pendingIds.length>1000||new Set(pendingIds).size!==pendingIds.length||
    pendingIds.some(id=>typeof id!=='string'||!/^[1-9]\d{4}$/.test(id)))throw Error('D072 review queue: invalid scope');
 const ledger=verify(await store.load()),catalogSha=digest(existingCatalog);
 const imported=new Set(existingCatalog.cards.map(c=>c.cardId));
 const byId=new Map(ledger.rows.map(row=>[row.cardId,row])),registries=new Map(),bases=new Map(),rows=[];
 for(const cardId of pendingIds){
  if(imported.has(cardId))throw Error('D072 review queue: already imported pending ID');
  const row=byId.get(cardId);
  const base={cardId,status:row?.status??'unattempted',packetSha256:row?.packetSha256??null,
   eventCount:null,reasonCodes:[],publicationApproved:false};
  if(!row?.packetSha256){rows.push({...base,reasonCodes:row?.failureCode?[row.failureCode]:[]});continue;}
  let packet;
  try{packet=scope(await store.loadPacket(cardId),row);}
  catch{rows.push({...base,status:'packet-unavailable-or-invalid',reasonCodes:['archive-read-or-integrity-failed']});continue;}
  const observed={...base,eventCount:packet.events.length,...(packet.domEvidence?{displayEvidenceStatus:packet.domEvidence.status}:{})};
  if(row.status==='held'){rows.push({...observed,status:'held',reasonCodes:packet.reasonCodes});continue;}
  let baseStatus='exact';
  if(packet.existingCatalogSha256!==catalogSha){
   if(!bases.has(packet.existingCatalogSha256))bases.set(packet.existingCatalogSha256,findObservedCatalog(existingCatalog,packet.existingCatalogSha256));
   if(!bases.get(packet.existingCatalogSha256)){rows.push({...observed,status:'catalog-drift',reasonCodes:['catalog-reconciliation-required']});continue;}
   baseStatus='verified-append-only-prefix';
  }
  let registry;
  try{
   const blob=row.sourcePin.skillBlob;
   if(!registries.has(blob)){
    const text=await loadSkillText({...row.sourcePin});
    if(typeof text!=='string'||gitBlobSha(text)!==blob)throw Error('skill blob mismatch');
    registries.set(blob,{text,registry:registryFromSkillText(text)});
   }
   registry=registries.get(blob).registry;
  }catch{rows.push({...observed,status:'skill-dictionary-unavailable-or-invalid',reasonCodes:['pinned-skill-dictionary-failed']});continue;}
  const hints=packet.events.flatMap(e=>e.groups.flatMap(g=>g.routes.flatMap(r=>r.hints)));
  if(hints.some(h=>{const s=registry.byId.get(h.skillId.slice(6));return !s||!['normal','rare'].includes(s.rarity)||registry.byName.get(s.name)?.length!==1;})){
   rows.push({...observed,status:'skill-id-unresolved',reasonCodes:['pinned-skill-id-unresolved']});continue;
  }
  const adoption=require('./d073_json_adoption.cjs').classify({packet,row,registry});
  const ready=adoption.status==='source-facts-accepted'&&!adoption.identifyingTitlesRequired;
  let routine=null;
  if(ready){
   const input={dataKind:'d073-source-title-input',schemaVersion:1,cardId,packetSha256:digest(packet),titles:null,chainEvidence:require('./d073_json_adoption.cjs').ordinaryChainEvidence(packet)};
   try{
   const {candidate,receipt}=require('./d073_json_adoption.cjs').prepareSourceCandidate({packet,ledger,input,skillText:registries.get(row.sourcePin.skillBlob).text,existingCatalog});
   routine={input,receiptSha256:digest(receipt),eventDigestsSha256:digest({events:candidate.eventDigests}),events:candidate.eventDigests,
    nonSkillOmissionCount:candidate.omissions.length,publicationApproved:false};
   }catch{rows.push({...observed,status:'candidate-validation-held',reasonCodes:['candidate-preparation-failed']});continue;}
  }
  rows.push({...observed,adoption,sourceCandidateInputReady:ready,...(routine?{routine}:{}),
   status:ready?'ready-for-publication-decision':'ready-for-independent-review',baseCatalogStatus:baseStatus,
   reasonCodes:ready?['publication-decision-required']:['independent-titles-facts-topology-and-publication-review-required',...(packet.domEvidence?.status==='mismatch'?['display-json-mismatch-needs-adjudication']:[])],
   eventChecks:packet.events.map(e=>({sourceEventId:e.sourceEventId,exactTitleSha256:e.exactTitleSha256,
    routeFactsSha256:digest({groups:e.groups}),resultCounts:e.groups.map(g=>g.routes.length)}))});
 }
 return {dataKind:'d072-offline-review-queue',schemaVersion:1,ledgerRevision:ledger.revision,
  catalogSha256:catalogSha,rows,publicationApproved:false};
}
module.exports={buildReviewQueue};
