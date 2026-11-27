'use strict';
// Source-based editorial adoption, not independent game verification or
// publication approval. Unknown topology is never inferred from array order.
const {scope}=require('./d069_review_packet_archive.cjs');
const {digest}=require('./event_release_gate.cjs');
const {gitBlobSha}=require('./current_umasim_roster_delta.cjs');
const {registryFromSkillText}=require('./official_gametora_skill_id_crosswalk.cjs');
function classify({packet,row,skillText,registry}={}){
 scope(packet,row);
 if(!registry){
  if(typeof skillText!=='string'||gitBlobSha(skillText)!==row.sourcePin.skillBlob)throw Error('D073 pinned dictionary mismatch');
  registry=registryFromSkillText(skillText);
 }
 const cardReasons=new Set(packet.reasonCodes);
 if(!packet.sourceContext)cardReasons.add('legacy-source-context-unavailable');
 else{
  if(packet.sourceContext.levelDependent===true||packet.sourceContext.levelDependentFieldInvalid)cardReasons.add('level-dependent-or-invalid-source-flag');
 }
 if(packet.domEvidence?.status==='mismatch')cardReasons.add('recorded-source-representation-discrepancy');
 const seen=new Set(),titleHashes=new Set(),categoryNext=new Map();
 const events=packet.events.map(e=>{
  const reasons=new Set();
  if(seen.has(e.sourceEventId)||titleHashes.has(e.titleSha256))reasons.add('duplicate-event-identity');
  seen.add(e.sourceEventId);titleHashes.add(e.titleSha256);
  const next=(categoryNext.get(e.category)||0)+1;categoryNext.set(e.category,next);
  if(e.categoryOrdinal!==next)reasons.add('event-position-discontinuity');
  if(e.category!=='random'&&e.category!=='arrows')reasons.add('unsupported-event-category');
  if(e.category==='arrows')reasons.add('chain-reachability-not-established');
  if(packet.sourceContext?.historyEventIds.includes(e.sourceEventId))reasons.add('source-history-semantics-unverified');
  const selection=e.groups.length===1&&!e.groups[0].labelPresent?'auto':e.groups.length>=2&&e.groups.every(g=>g.labelPresent)?'choice':null;
  if(!selection||selection!==e.selection)reasons.add('selection-ambiguous');
  for(const [i,g] of e.groups.entries()){
   if(g.ordinal!==i+1)reasons.add('group-position-discontinuity');
   const ordinals=new Set();let last=0;
   for(const [j,r] of g.routes.entries()){
    if(r.ordinal!==j+1)reasons.add('result-position-discontinuity');
    if(r.unresolved.length)reasons.add('reward-or-flow-unresolved');
    if(r.terminal&&e.category==='random')reasons.add('stop-marker-without-established-chain');
    for(const h of r.hints){
     const s=registry.byId.get(h.skillId.slice(6));
     if(!s||!['normal','rare'].includes(s.rarity)||registry.byName.get(s.name)?.length!==1)reasons.add('skill-id-unresolved');
     if(ordinals.has(h.sourceOrdinal)||h.sourceOrdinal<=last)reasons.add('reward-position-discontinuity');
     ordinals.add(h.sourceOrdinal);last=h.sourceOrdinal;
    }
   }
  }
  const reasonCodes=[...reasons].sort();
  return {sourceEventId:e.sourceEventId,category:e.category,categoryOrdinal:e.categoryOrdinal,
   factStatus:reasonCodes.length?'exception-review':'source-facts-accepted',reasonCodes,
   titleSha256:e.exactTitleSha256,routeFactsSha256:digest({groups:e.groups})};
 });
 const reasonCodes=[...cardReasons].sort(),exceptionEventCount=events.filter(x=>x.factStatus==='exception-review').length;
 return {schemaVersion:1,dataKind:'d073-json-adoption',cardId:packet.cardId,packetSha256:digest(packet),
  status:reasonCodes.length||exceptionEventCount?'exception-review':'source-facts-accepted',
  reasonCodes,events,exceptionEventCount,identifyingTitlesRequired:true,
  independentGameVerification:false,publicationApproved:false};
}
module.exports={classify};
