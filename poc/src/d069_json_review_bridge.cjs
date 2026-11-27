'use strict';
// Offline bridge: observations, independent review, and approved append
// remain separate. No networking, signing, publication or file writing.
const {inspectCardJson}=require('./official_gametora_card_json.cjs');
const {canonical,digest,verifyRelease}=require('./event_release_gate.cjs');
const {validateEvents}=require('./event_schema.js');
const {project}=require('./phase2_title_choice_projection.cjs');
const {appendApprovedNewCards}=require('./new_card_event_incremental.cjs');
const {registryFromSkillText}=require('./official_gametora_skill_id_crosswalk.cjs');
const {gitBlobSha}=require('./current_umasim_roster_delta.cjs');
const fail=m=>{throw Error('D069 JSON review: '+m);};
const same=(a,b)=>canonical(a)===canonical(b);
const GIT=/^[a-f0-9]{40}$/;
function inspect({body,cardId,sourceUrl,buildId,skillText,sourcePin,existingCatalog}={}){
 if(!GIT.test(sourcePin?.commit||'')||!GIT.test(sourcePin?.cardBlob||'')||
    !GIT.test(sourcePin?.skillBlob||'')||typeof skillText!=='string'||gitBlobSha(skillText)!==sourcePin.skillBlob||
    existingCatalog?.schemaVersion!==1||!Array.isArray(existingCatalog.cards)||existingCatalog.cards.some(c=>c.cardId===cardId))
  fail('source pin or already imported card');
 const registry=registryFromSkillText(skillText),o=inspectCardJson({body,cardId,sourceUrl,buildId});
 const reasons=new Set();
 const events=o.events.map(e=>{
  if(!['random','arrows'].includes(e.category))reasons.add('unsupported-event-category');
  if(e.eventType!==null||e.blockers.some(x=>!['selection-semantics-unverified','publication-not-reviewed','internal-reachability-unverified'].includes(x)))reasons.add('event-semantics-unresolved');
  const selection=e.groups.length===1&&!e.groups[0].labelPresent?'auto':
    e.groups.length>=2&&e.groups.every(g=>g.labelPresent)?'choice':null;
  if(!selection)reasons.add('selection-ambiguous');
  const groups=e.groups.map(g=>{
   if(g.blockers.length)reasons.add('group-shape-unresolved');
   return {ordinal:g.ordinal,labelPresent:g.labelPresent,routes:g.routes.map(r=>{
    if(r.unresolved.length||r.directGrants.length||r.statusCandidates.length||
       r.markers.some(m=>m.kind!=='explicit-chain-stop'))reasons.add('reward-or-flow-unresolved');
    for(const h of r.hints){
     const skill=registry.byId.get(h.skillId.slice(6));
     if(!skill||!['normal','rare'].includes(skill.rarity)||registry.byName.get(skill.name)?.length!==1)
      reasons.add('skill-id-unresolved');
    }
    return {ordinal:r.ordinal,hints:r.hints,terminal:r.markers.some(m=>m.kind==='explicit-chain-stop'),
      nonSkillCount:r.effects.length+r.dynamicEffects.length,unresolved:r.unresolved};
   })};
  });
  return {sourceEventId:e.sourceEventId,category:e.category,categoryOrdinal:e.categoryOrdinal,
   titleSha256:e.titleSha256,selection,groups};
 });
 if(new Set(events.map(e=>e.titleSha256)).size!==events.length)reasons.add('ambiguous-event-title');
 return {dataKind:'d069-json-review-packet',schemaVersion:1,cardId,sourceUrl,buildId,bodySha256:o.bodySha256,
  sourcePin:{commit:sourcePin.commit,cardBlob:sourcePin.cardBlob,skillBlob:sourcePin.skillBlob},
  existingCatalogSha256:digest(existingCatalog),events,
  status:reasons.size?'held':'awaiting-independent-fact-review',reasonCodes:[...reasons].sort(),
  sourceSiteTextCopied:false,publicationApproved:false};
}
function prepare(input,review){
 const p=inspect(input);
 if(p.status!=='awaiting-independent-fact-review')fail('held observation');
 if(review?.schemaVersion!==1||review.publicationApproved!==false||
    review.packetSha256!==digest(p)||review.cardId!==p.cardId||
    review.nonSkillPolicy!=='omit-explicitly-skill-path-only'||
    !Array.isArray(review.events)||review.events.length!==p.events.length)
  fail('independent review missing or stale');
 // Reviewer supplies exact selection, result counts and topology.
 // Never generate review statements from source order in production.
 const registry=registryFromSkillText(input.skillText);
 const raw=JSON.parse(JSON.parse(input.body).pageProps.eventData.ja);
 const titles=new Map(Object.values(raw).flatMap(es=>es.map(e=>[e.i,e.n])));
 const id=n=>'gt-json:'+p.cardId+':'+n,omissions=[];
 const events=p.events.map((e,i)=>{
  const v=review.events[i];
  if(!v||v.sourceEventId!==e.sourceEventId||v.titleSha256!==e.titleSha256||
     v.selection!==e.selection||!same(v.resultCounts,e.groups.map(g=>g.routes.length))||
     v.routeFactsSha256!==digest({groups:e.groups})||
     !Object.hasOwn(v,'previousSourceEventId')||
     Object.keys(v).some(k=>!['sourceEventId','titleSha256','selection','resultCounts','routeFactsSha256','previousSourceEventId'].includes(k)))
   fail('event or route review mismatch');
  const previous=v.previousSourceEventId;
  // One ordinary sequential chain, independently reviewed. Other
  // reachability models remain held; absence of a marker proves nothing.
  const predecessor=e.category==='arrows'&&e.categoryOrdinal>1?
    p.events.find(x=>x.category==='arrows'&&x.categoryOrdinal===e.categoryOrdinal-1)?.sourceEventId:null;
  if(previous!==predecessor)fail('unsupported or missing reviewed predecessor');
  const name=titles.get(e.sourceEventId);
  if(typeof name!=='string'||!name.trim()||name.length>80||/[\r\n\u0000-\u001f]/.test(name))fail('invalid identifying title');
  const parts=e.groups.map(g=>{
   const routes=g.routes.map(r=>{
    const rewards=r.hints.map(h=>({skillId:h.skillId,kind:'hint',level:h.level,verifiedSkillName:registry.byId.get(h.skillId.slice(6)).name}));
    if(r.nonSkillCount)omissions.push({sourceEventId:e.sourceEventId,groupOrdinal:g.ordinal,resultOrdinal:r.ordinal,nonSkillCount:r.nonSkillCount});
    return {rewards,...(r.terminal?{terminal:true}:{})};
   });
   return routes.length===1?routes[0]:{outcomes:routes.map((r,j)=>({id:'r'+(j+1),label:'結果'+(j+1)+'（仮）',...r}))};
  });
  const result={id:id(e.sourceEventId),name,type:e.selection};
  if(e.selection==='auto')Object.assign(result,parts[0]);
  else result.choices=parts.map((part,j)=>({id:'c'+(j+1),label:'選択肢'+(j+1)+'（仮）',...part}));
  if(previous!==null)result.requires={all:[{eventId:id(previous)}]};
  return result;
 });
 const card=project({schemaVersion:1,cards:[{cardId:p.cardId,coverageStatus:'partial',events}]}).catalog.cards[0];
 validateEvents(card.events,{skillById:Object.fromEntries([...registry.byId].map(([k,v])=>['skill:'+k,v]))},p.cardId);
 let blocked=false;try{verifyRelease({schemaVersion:1,cards:[card]},{schemaVersion:1,entries:[]});}catch(e){if(!String(e).includes('承認証跡'))throw e;blocked=true;}
 if(!blocked)fail('unsigned candidate escaped release gate');
 return {dataKind:'d069-json-private-reviewed-shape',packetSha256:digest(p),sourceBodySha256:p.bodySha256,
  sourcePin:p.sourcePin,existingCatalogSha256:p.existingCatalogSha256,card,omissions,
  eventDigests:card.events.map(e=>({eventId:e.id,sha256:digest(e)})),publicationApproved:false,skillPathOnly:true};
}
function append({inputs,reviews,existingCatalog,existingApprovals,newApprovals,discovery,model,skillText,currentSupportText,previousSupportText,pinnedSkillText,pendingCardIds=[]}={}){
 if(!Array.isArray(inputs)||!inputs.length||inputs.length>2||!Array.isArray(reviews)||reviews.length!==inputs.length)
  fail('batch scope');
 const prepared=inputs.map((input,i)=>{
  if(input.skillText!==skillText||digest(input.existingCatalog)!==digest(existingCatalog))fail('catalog/registry drift');
  return prepare(input,reviews[i]);
 });
 if(new Set(prepared.map(x=>x.card.cardId)).size!==prepared.length||
    prepared.some(x=>!same(x.sourcePin,prepared[0].sourcePin)))fail('duplicate card or mixed source pins');
 if(typeof currentSupportText!=='string'||gitBlobSha(currentSupportText)!==prepared[0].sourcePin.cardBlob||
    typeof previousSupportText!=='string')fail('roster blob mismatch');
 const actual=require('./new_card_event_incremental.cjs').discoverNewCardsFromUmaSim({previousSupportText,currentSupportText});
 if(!same(discovery,actual))fail('roster discovery mismatch');
 const candidates=prepared.map(x=>({source:'GameTora-original-site',cardId:x.card.cardId,sourceSiteTextCopied:false,
  publicationApproved:false,appEventSchemaAdoptable:false,siteEventPanelCount:x.card.events.length,
  convertedEventCount:x.card.events.length,unresolvedEventCount:0,events:x.card.events}));
 // Supplied independent, content-bound approval ledger is mandatory.
 return appendApprovedNewCards({discovery,existingCatalog,existingApprovals,newApprovals,model,skillText,pinnedSkillText,
  pendingCardIds,candidates,allowReviewedLegacy:true});
}
module.exports={inspect,prepare,append};
