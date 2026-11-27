'use strict';
// Source-based editorial adoption, not independent game verification or
// publication approval. Unknown topology is never inferred from array order.
const {scope}=require('./d069_review_packet_archive.cjs');
const {digest,secureUrl}=require('./event_release_gate.cjs');
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
  reasonCodes,events,exceptionEventCount,identifyingTitlesRequired:!packet.identifyingTitles,
  independentGameVerification:false,publicationApproved:false};
}
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys.split(',').sort().join(',');
const fail=m=>{throw Error('D073 source facts: '+m);};
function checkChainEvidence({packet,classification,chainEvidence=null}){
 if(classification.packetSha256!==digest(packet)||classification.reasonCodes.length||
    classification.events.some(e=>e.reasonCodes.some(x=>x!=='chain-reachability-not-established')))
  fail('unresolved source facts');
 const chain=packet.events.filter(e=>e.category==='arrows');
 const topology=new Map(packet.events.filter(e=>e.category==='random').map(e=>[e.sourceEventId,null]));
 if(!chain.length){if(chainEvidence!==null)fail('unexpected chain evidence');return topology;}
 if(!exact(chainEvidence,'reviewer,reviewedAt,evidenceUrls,events')||
    typeof chainEvidence.reviewer!=='string'||!chainEvidence.reviewer.trim()||chainEvidence.reviewer.length>120||
    typeof chainEvidence.reviewedAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(chainEvidence.reviewedAt)||
    !Number.isFinite(Date.parse(chainEvidence.reviewedAt+'T00:00:00Z'))||
    new Date(chainEvidence.reviewedAt+'T00:00:00Z').toISOString().slice(0,10)!==chainEvidence.reviewedAt||
    !Array.isArray(chainEvidence.evidenceUrls)||!chainEvidence.evidenceUrls.length||chainEvidence.evidenceUrls.length>20||
    chainEvidence.evidenceUrls.some(x=>!secureUrl(x))||!Array.isArray(chainEvidence.events)||chainEvidence.events.length!==chain.length)
  fail('explicit chain evidence required');
 for(const [i,e] of chain.entries()){
  const v=chainEvidence.events[i];
  if(!exact(v,'sourceEventId,previousSourceEventId')||v.sourceEventId!==e.sourceEventId||
     v.previousSourceEventId!==(i===0?null:chain[i-1].sourceEventId))fail('unsupported or incomplete chain topology');
  topology.set(e.sourceEventId,v.previousSourceEventId);
 }
 return topology;
}
function parseSourceInput({packet,input}){
 if(!exact(input,'dataKind,schemaVersion,cardId,packetSha256,titles,chainEvidence')||
    input.dataKind!=='d073-source-title-input'||input.schemaVersion!==1||
    input.cardId!==packet.cardId||input.packetSha256!==digest(packet)||
    !(input.titles===null&&Array.isArray(packet.identifyingTitles)||Array.isArray(input.titles))||(input.titles??packet.identifyingTitles).length!==packet.events.length)fail('source input scope');
 const titles=new Map();
 for(const [i,v] of (input.titles??packet.identifyingTitles).entries()){
  if(!exact(v,'sourceEventId,title')||v.sourceEventId!==packet.events[i].sourceEventId||
     typeof v.title!=='string'||titles.has(v.sourceEventId))fail('title input scope');
  titles.set(v.sourceEventId,v.title);
 }
 return {titles,chainEvidence:input.chainEvidence};
}
function prepareSourceCandidate({packet,ledger,input,skillText,existingCatalog}){
 const {titles,chainEvidence}=parseSourceInput({packet,input});
 const row=ledger.rows.find(r=>r.cardId===packet.cardId);
 const classification=classify({packet,row,skillText});
 const candidate=require('./d069_json_review_bridge.cjs').resumeSourceFacts({packet,titles,chainEvidence,skillText,existingCatalog,ledger});
 const receipt={dataKind:'d073-source-fact-receipt',schemaVersion:1,cardId:packet.cardId,packetSha256:digest(packet),
  sourceFactsSha256:digest(classification),titleInputSha256:digest({titles:input.titles??packet.identifyingTitles}),
  chainEvidenceSha256:chainEvidence===null?null:digest(chainEvidence),
  chainEvidenceUrls:chainEvidence===null?[]:chainEvidence.evidenceUrls.slice(),
  independentGameVerification:false,publicationApproved:false};
 return {candidate,receipt};
}
module.exports={classify,checkChainEvidence,parseSourceInput,prepareSourceCandidate};
