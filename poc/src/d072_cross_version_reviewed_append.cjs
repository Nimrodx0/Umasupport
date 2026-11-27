'use strict';
// Independently reviewed archived packets may have different observation
// pins. Validate each at its own immutable pin, then the exact unchanged
// target card and referenced skill identities at the proposed release pin.
// No network, no approval creation, no writes.
const {canonical,digest}=require('./event_release_gate.cjs');
const {gitBlobSha}=require('./current_umasim_roster_delta.cjs');
const {parseSupportCards,buildModel}=require('./live_loader.js');
const {registryFromSkillText}=require('./official_gametora_skill_id_crosswalk.cjs');
const {discoverNewCardsFromUmaSim,appendApprovedNewCards}=require('./new_card_event_incremental.cjs');
const {resumeForCurrentCatalog}=require('./d069_json_review_bridge.cjs');
const {preflight}=require('./public_event_catalog.js');
const fail=m=>{throw Error('D072 cross-version append: '+m);};
const same=(a,b)=>canonical(a)===canonical(b);
const SHA=/^[a-f0-9]{40}$/;
function verifyPin({pin,supportText,skillText}={}){
 if(Object.keys(pin||{}).sort().join(',')!=='cardBlob,commit,skillBlob'||
    !Object.values(pin).every(v=>typeof v==='string'&&SHA.test(v))||
    typeof supportText!=='string'||gitBlobSha(supportText)!==pin.cardBlob||
    typeof skillText!=='string'||gitBlobSha(skillText)!==pin.skillBlob)fail('immutable source pin mismatch');
 return {pin,supportText,skillText,cards:parseSupportCards(supportText).cards,skills:registryFromSkillText(skillText)};
}
function uniqueSkill(registry,id){
 const s=registry.byId.get(id);
 if(!s||!['normal','rare'].includes(s.rarity)||registry.byName.get(s.name)?.length!==1)fail('unresolved skill identity: '+id);
 return {id:s.id,name:s.name,rarity:s.rarity,group:s.group};
}
function stageReviewedAcrossVersions({items,ledger,baseline,release,existingCatalog,existingApprovals,newApprovals,pinnedSkillText=null}={}){
 if(!Array.isArray(items)||!items.length||items.length>2||
    new Set(items.map(x=>x?.packet?.cardId)).size!==items.length||
    typeof baseline?.supportText!=='string'||!SHA.test(baseline?.cardBlob||'')||
    gitBlobSha(baseline.supportText)!==baseline.cardBlob)fail('batch or baseline scope');
 const latest=verifyPin(release);
 const discovery=discoverNewCardsFromUmaSim({previousSupportText:baseline.supportText,currentSupportText:latest.supportText});
 const newIds=new Set(discovery.addedCardIds),observed=new Map(),proofs=[];
 const candidates=items.map(({packet,titles,review,source})=>{
  if(!newIds.has(packet?.cardId)||!same(packet.sourcePin,source?.pin))fail('not a verified new ID or observation pin mismatch');
  const key=source.pin.commit+':'+source.pin.cardBlob+':'+source.pin.skillBlob;
  if(!observed.has(key)){
   const old=verifyPin(source);
   const original=discoverNewCardsFromUmaSim({previousSupportText:baseline.supportText,currentSupportText:old.supportText});
   observed.set(key,{...old,newIds:new Set(original.addedCardIds)});
  }else if(source.supportText!==observed.get(key).supportText||source.skillText!==observed.get(key).skillText)fail('inconsistent observation inputs');
  const old=observed.get(key),id=packet.cardId;
  if(!old.newIds.has(id)||!old.cards.has(id)||!latest.cards.has(id))fail('target not present in both new-card rosters');
  // A removed ID anywhere signals a partial or incompatible roster.
  if([...old.cards.keys()].some(x=>!latest.cards.has(x)))fail('observed roster IDs missing from release');
  if(!same(old.cards.get(id),latest.cards.get(id)))fail('target card changed since observation: '+id);
  const prepared=resumeForCurrentCatalog({packet,titles,skillText:old.skillText,existingCatalog,ledger,review});
  const ids=[...new Set(packet.events.flatMap(e=>e.groups.flatMap(g=>g.routes.flatMap(r=>r.hints.map(h=>h.skillId.slice(6))))))].sort();
  for(const skillId of ids)if(!same(uniqueSkill(old.skills,skillId),uniqueSkill(latest.skills,skillId)))fail('skill identity changed since observation: '+skillId);
  proofs.push({cardId:id,packetSha256:prepared.packetSha256,sourcePin:prepared.sourcePin,releasePin:latest.pin,matchedSkillIds:ids});
  return {source:'GameTora-original-site',cardId:id,sourceSiteTextCopied:false,publicationApproved:false,
   appEventSchemaAdoptable:false,siteEventPanelCount:prepared.card.events.length,convertedEventCount:prepared.card.events.length,
   unresolvedEventCount:0,events:prepared.card.events};
 });
 const model=buildModel(latest.supportText);
 const result=appendApprovedNewCards({discovery,existingCatalog,existingApprovals,newApprovals,model,
  skillText:latest.skillText,pinnedSkillText,candidates,allowReviewedLegacy:true});
 // Exercise the full runtime dictionary path as well as the existing gate.
 preflight(model,result.catalog,{skillText:latest.skillText,pinnedSkillText,fullRegistry:true,allowReviewedLegacy:true});
 return {...result,proofs,releasePin:latest.pin,existingCatalogSha256:digest(existingCatalog)};
}
module.exports={stageReviewedAcrossVersions};
