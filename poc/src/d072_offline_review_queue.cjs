'use strict';
// Read-only mechanical review preflight. Never infer independent review
// statements, approve publication, retrieve GameTora, or mutate the ledger.
const {verify}=require('./d069_json_attempt_ledger.cjs');
const {scope}=require('./d069_review_packet_archive.cjs');
const {digest}=require('./event_release_gate.cjs');
const {gitBlobSha}=require('./current_umasim_roster_delta.cjs');
const {registryFromSkillText}=require('./official_gametora_skill_id_crosswalk.cjs');
async function buildReviewQueue({store,pendingIds,existingCatalog,loadSkillText}={}){
 if(typeof store?.load!=='function'||typeof store.loadPacket!=='function'||
    typeof loadSkillText!=='function'||existingCatalog?.schemaVersion!==1||!Array.isArray(existingCatalog.cards)||
    !Array.isArray(pendingIds)||pendingIds.length>1000||new Set(pendingIds).size!==pendingIds.length||
    pendingIds.some(id=>typeof id!=='string'||!/^[1-9]\d{4}$/.test(id)))throw Error('D072 review queue: invalid scope');
 const ledger=verify(await store.load()),catalogSha=digest(existingCatalog);
 const imported=new Set(existingCatalog.cards.map(c=>c.cardId));
 const byId=new Map(ledger.rows.map(row=>[row.cardId,row])),registries=new Map(),rows=[];
 for(const cardId of pendingIds){
  if(imported.has(cardId))throw Error('D072 review queue: already imported pending ID');
  const row=byId.get(cardId);
  const base={cardId,status:row?.status??'unattempted',packetSha256:row?.packetSha256??null,
   eventCount:null,reasonCodes:[],publicationApproved:false};
  if(!row?.packetSha256){rows.push({...base,reasonCodes:row?.failureCode?[row.failureCode]:[]});continue;}
  let packet;
  try{packet=scope(await store.loadPacket(cardId),row);}
  catch{rows.push({...base,status:'packet-unavailable-or-invalid',reasonCodes:['archive-read-or-integrity-failed']});continue;}
  const observed={...base,eventCount:packet.events.length};
  if(row.status==='held'){rows.push({...observed,status:'held',reasonCodes:packet.reasonCodes});continue;}
  if(packet.existingCatalogSha256!==catalogSha){
   rows.push({...observed,status:'catalog-drift',reasonCodes:['catalog-reconciliation-required']});continue;
  }
  let registry;
  try{
   const blob=row.sourcePin.skillBlob;
   if(!registries.has(blob)){
    const text=await loadSkillText({...row.sourcePin});
    if(typeof text!=='string'||gitBlobSha(text)!==blob)throw Error('skill blob mismatch');
    registries.set(blob,registryFromSkillText(text));
   }
   registry=registries.get(blob);
  }catch{rows.push({...observed,status:'skill-dictionary-unavailable-or-invalid',reasonCodes:['pinned-skill-dictionary-failed']});continue;}
  const hints=packet.events.flatMap(e=>e.groups.flatMap(g=>g.routes.flatMap(r=>r.hints)));
  if(hints.some(h=>{const s=registry.byId.get(h.skillId.slice(6));return !s||!['normal','rare'].includes(s.rarity)||registry.byName.get(s.name)?.length!==1;})){
   rows.push({...observed,status:'skill-id-unresolved',reasonCodes:['pinned-skill-id-unresolved']});continue;
  }
  rows.push({...observed,status:'ready-for-independent-review',reasonCodes:['independent-titles-facts-topology-and-publication-review-required'],
   eventChecks:packet.events.map(e=>({sourceEventId:e.sourceEventId,exactTitleSha256:e.exactTitleSha256,
    routeFactsSha256:digest({groups:e.groups}),resultCounts:e.groups.map(g=>g.routes.length)}))});
 }
 return {dataKind:'d072-offline-review-queue',schemaVersion:1,ledgerRevision:ledger.revision,
  catalogSha256:catalogSha,rows,publicationApproved:false};
}
module.exports={buildReviewQueue};
