'use strict';
// Compare a private direct-site observation with independently checked,
// content-bound route fingerprints. No source text, approval, or publishing.
const crypto=require('node:crypto');
const {canonical,digest,verifyRelease}=require('./event_release_gate.cjs');
const {project}=require('./phase2_title_choice_projection.cjs');
const {validateEvents}=require('./event_schema.js');
const fail=s=>{throw Error('Direct event review: '+s);};
const sha=x=>crypto.createHash('sha256').update(canonical(x)).digest('hex');
const isSha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const normalize=x=>String(x).normalize('NFKC').trim();
function headingIdentity(raw){
 if(typeof raw!=='string'||!raw.trim()||raw.length>300)fail('invalid heading');
 const value=raw.trim();
 const prefix=/^\s*\(?\s*([❯›»>→]+)\s*\)?\s*/u.exec(value);
 const title=(prefix?value.slice(prefix[0].length):value).trim();
 if(!title)fail('missing title');
 return {title,sha256:sha(normalize(title)),stage:prefix?Array.from(prefix[1]).length:null};
}
function headingFingerprint(raw){const {sha256,stage}=headingIdentity(raw);return {sha256,stage};}
function routeFingerprint(route,registry){
 if(!route||route.terminal===true||route.requires!==undefined||
    route.statusEffects!==undefined||route.dynamicEffects!==undefined||
    !Array.isArray(route.effects||[])||!Array.isArray(route.rewards||[]))
  fail('unreviewed route semantics');
 const effects=(route.effects||[]).map(x=>{
  if(!x||!['speed','stamina','power','guts','wisdom','energy','max_energy','skill_points','mood','bond'].includes(x.kind)||
     !Number.isSafeInteger(x.delta)||x.delta===0)fail('invalid scalar effect');
  return x.kind+':'+x.delta;
 }).sort();
 const hints=(route.rewards||[]).map(x=>{
  if(x?.kind!=='hint'||!/^skill:[1-9]\d*$/.test(x.skillId)||!Number.isInteger(x.level)||x.level<1||x.level>10||x.condition!==undefined)fail('unreviewed reward semantics');
  const skill=registry.byId.get(x.skillId.slice(6));
  if(!skill||registry.byName.get(skill.name)?.length!==1)fail('nonunique independent skill ID');
  return normalize(skill.name)+':'+x.level;
 }).sort();
 return sha({effects,hints});
}
function reviewCard(record,spec,registry){
 const id=spec?.cardId;
 if(!/^[1-9]\d{4}$/.test(id||'')||record?.cardId!==id||
    record.sourceUrl!==spec.sourceUrl||record.layout!=='visible-sections'||
    record.publicationApproved!==false||record.projected?.publicationApproved!==false||
    record.projected?.appEventSchemaAdoptable!==false||
    record.projected?.sourceSiteTextCopied!==false||
    !Array.isArray(record.structure)||!Array.isArray(record.projected.perEvent)||
    !Array.isArray(spec.events)||spec.events.length!==record.structure.length||
    spec.events.length!==record.projected.perEvent.length||
    !(registry?.byId instanceof Map)||!(registry?.byName instanceof Map))
  fail('card, evidence, or scope mismatch '+id);
 const events=[],hashes=[];
 let routeCount=0,hintCount=0,scalarCount=0;
 const permittedBlockers=new Set(['site-groups-not-proven-player-choices','all-event-skill-awards-not-proven-exhaustive','next-event-internal-reachability-not-proven','source-wording-publication-rights-not-approved','site-choice-versus-result-meaning-unverified','all-skill-rewards-not-verified','numeric-effect-recipients-not-verified','event-chain-reachability-not-verified','event-and-choice-wording-not-reviewed','publication-rights-not-reviewed']);
 for(let i=0;i<spec.events.length;i++){
  const expected=spec.events[i],obs=record.projected.perEvent[i],s=record.structure[i],ordinal=i+1;
  const at=id+':'+ordinal;
  if(!isSha(expected.titleSha256)||s?.ordinal!==ordinal||s.category!==expected.category||
     s.titleSha256!==expected.titleSha256||s.ambiguous!==false||
     obs?.siteEventOrdinal!==ordinal||obs.status!=='private-schema-shaped'||obs.publicationApproved!==false||
     obs.blockers.some(x=>!permittedBlockers.has(x))||obs.flowMarkers!==0||obs.directSkills!==0||
     !['連続イベント','ランダムイベント'].includes(expected.category)||
     !['auto','choice'].includes(expected.selection)||
     !Array.isArray(expected.groups)||!expected.groups.length||
     !Array.isArray(obs.previewEvent?.choices)||obs.previewEvent.choices.length!==expected.groups.length)
    fail('event identity, layout or unresolved fact '+at);
  // Ordinary sequential chain only; no speculative result-specific link.
  if(expected.category==='連続イベント'){
   const prev=expected.previousOrdinal;
   if(prev!==null&&(prev!==i||spec.events[prev-1]?.category!=='連続イベント'))fail('invalid sequence '+at);
   if(s.chainStage!==null&&s.chainStage!==ordinal)fail('source stage mismatch '+at);
  }else if(expected.previousOrdinal!==null||s.chainStage!==null)fail('unexpected random prerequisite '+at);
  const groups=obs.previewEvent.choices;
  for(let j=0;j<groups.length;j++){
   const routeList=groups[j].outcomes||[groups[j]],expectedRoutes=expected.groups[j];
   if(!Array.isArray(expectedRoutes)||routeList.length!==expectedRoutes.length||!expectedRoutes.every(isSha))fail('result count '+at+':'+(j+1));
   for(let k=0;k<routeList.length;k++){
    const route=routeList[k];
    if(routeFingerprint(route,registry)!==expectedRoutes[k])fail('result fact mismatch '+at+':'+(j+1)+':'+(k+1));
    routeCount++;hintCount+=(route.rewards||[]).length;scalarCount+=(route.effects||[]).length;
   }
  }
  let event={id:'gt-site:'+id+':'+ordinal,name:'イベント'+ordinal,type:expected.selection};
  if(expected.selection==='auto'){
   if(groups.length!==1||expected.groups[0].length!==1)fail('ambiguous auto '+at);
   const {rewards,effects}=groups[0];if(rewards)event.rewards=structuredClone(rewards);if(effects)event.effects=structuredClone(effects);
  }else event.choices=structuredClone(groups);
  if(expected.previousOrdinal!==null)event.requires={all:[{eventId:'gt-site:'+id+':'+expected.previousOrdinal}]};
  events.push(event);
 }
 const candidate=project({schemaVersion:1,cards:[{cardId:id,coverageStatus:'partial',events}]}).catalog.cards[0];
 validateEvents(candidate.events,{skillById:Object.fromEntries([...registry.byId].map(([key,v])=>['skill:'+key,v]))},id);
 let releaseBlocked=false;
 try{verifyRelease({schemaVersion:1,cards:[candidate]},{schemaVersion:1,entries:[]});}catch(e){if(!String(e).includes('承認証跡'))throw e;releaseBlocked=true;}
 if(!releaseBlocked)fail('review must not approve publication');
 return {candidate,summary:{cardId:id,events:events.length,routeCount,hintCount,scalarCount,autoEvents:events.filter(x=>x.type==='auto').length,chainEdges:events.filter(x=>x.requires).length,eventDigests:candidate.events.map(e=>({eventId:e.id,sha256:digest(e)})),sourceUrl:spec.sourceUrl,adjudicatorUrl:spec.adjudicatorUrl,ordinaryChainRuleApplied:true,publicationApproved:false,releaseGateBlocked:true}};
}
function verifyObservedDigest(summary,evidence){
 const match=evidence?.cards?.find(c=>c.cardId===summary?.cardId);
 if(evidence?.schemaVersion!==1||evidence.publicationApproved!==false||!match||
    summary.publicationApproved!==false||summary.releaseGateBlocked!==true||
    ['events','routeCount','hintCount','scalarCount','autoEvents','chainEdges'].some(k=>summary[k]!==match[k])||
    canonical(summary.eventDigests)!==canonical(match.eventDigests))
  fail('candidate digest drift: '+(summary?.cardId||'unknown'));
 return true;
}
function toUnapprovedIntakeCandidate(checked,evidence){
 verifyObservedDigest(checked?.summary,evidence);
 const card=checked.candidate;
 if(card?.cardId!==checked.summary.cardId||card.coverageStatus!=='partial'||
    canonical(card.events.map(e=>({eventId:e.id,sha256:digest(e)})))!==canonical(checked.summary.eventDigests))
  fail('candidate changed after fact review');
 // Acceptable as an input to the existing append stage, NOT a release.
 // The separate per-event approval ledger remains mandatory.
 return {source:'GameTora-original-site',cardId:card.cardId,
  sourceSiteTextCopied:false,publicationApproved:false,appEventSchemaAdoptable:false,
  siteEventPanelCount:card.events.length,convertedEventCount:card.events.length,
  unresolvedEventCount:0,events:structuredClone(card.events)};
}
function prepareNamedCandidate(checked,spec,registry,titles,evidence){
 const candidate=toUnapprovedIntakeCandidate(checked,evidence);
 if(spec?.cardId!==candidate.cardId||!Array.isArray(titles)||titles.length!==candidate.events.length||
    spec.events.length!==titles.length)fail('title scope mismatch');
 const events=candidate.events.map((event,i)=>{
  const title=headingIdentity(titles[i]);
  if(title.sha256!==spec.events[i].titleSha256||title.title.length>80||
     /[\r\n\u0000-\u001f]/.test(title.title))fail('reviewed title mismatch '+candidate.cardId+':'+(i+1));
  const e=structuredClone(event);e.name=title.title;
  function enrich(part){
   for(const reward of part.rewards||[]){
    const skill=registry.byId.get(reward.skillId.slice(6));
    if(!skill||registry.byName.get(skill.name)?.length!==1||!['normal','rare'].includes(skill.rarity))fail('runtime skill name mismatch');
    reward.verifiedSkillName=skill.name;
   }
   for(const o of part.outcomes||[])enrich(o);
   for(const c of part.choices||[])enrich(c);
  }
  enrich(e);
  return e;
 });
 const out={...candidate,events};
 const normalized=project({schemaVersion:1,cards:[{cardId:out.cardId,coverageStatus:'partial',events}]}).catalog.cards[0];
 if(canonical(normalized.events)!==canonical(events))fail('production labels not normalized');
 // Retain original fact hashes as a different namespace; never overwrite them.
 return {candidate:out,summary:{cardId:out.cardId,events:events.length,
  titlesPreserved:events.length,verifiedSkillNames:checked.summary.hintCount,
  eventDigests:events.map(e=>({eventId:e.id,sha256:digest(e)})),
  publicationApproved:false}};
}
module.exports={headingFingerprint,routeFingerprint,reviewCard,verifyObservedDigest,toUnapprovedIntakeCandidate,prepareNamedCandidate};
