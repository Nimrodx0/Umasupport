'use strict';
/*
 * A per-card, unapproved app-SCHEMA draft from an exact Git blob-bound
 * structured GitHub GameTora source. The output is intentionally not
 * consumable by the public release gate. No third-party prose is copied.
 *
 * This adapter currently covers ordinary "random" and "arrows" events,
 * not outings, scenario triggers, alternative hints or prior-result flags.
 * Unsupported or ambiguous events are explicitly quarantined.
 */
const {validateDerivedCardSource}=require('./derived_github_card_event_preflight.cjs');
const {transformDocument}=require('./gametora_whole_event_normalize.cjs');
const {parseSource}=require('./skill_bridge.js');
const {validateEvents}=require('./event_schema.js');
const fail=s=>{throw Error('派生GitHub→アプリ草稿: '+s);};
const ordinary=new Set(['speed','stamina','power','guts','wisdom',
 'energy','max_energy','mood','bond','skill_points','aptitude_points',
 'all_stats','random_stats']);
const supported=new Set(['random','arrows']);
const reviewException=new Set(['DIRECT_SKILL_GRANT_REQUIRES_REVIEW']);
// These intermediate objects MUST NOT be sent to the public event loader:
// events retain an explicit quarantine field which verifyRelease rejects.
function projectDerivedCardDraft({plan,cardId,sourceText,skillText}={}){
 const inspection=validateDerivedCardSource({plan,cardId,sourceText});
 let registry,src;
 try{
  registry=parseSource(skillText);
  src=transformDocument(JSON.parse(sourceText));
 }catch{fail('validated-source-or-skill-registry-invalid');}
 const skillById=Object.fromEntries([...registry.byId.values()].map(x=>[
  'skill:'+x.id,{id:'skill:'+x.id,name:x.name}]));
 const events=[],pending=[],census={sourceEvents:src.sourceEventCount,
  sourceChoices:src.sourceChoiceCount,sourceRoutes:src.sourceExpandedRoutes,
  modeledEvents:0,modeledRoutes:0,modeledSkills:0,
  modeledDirectGrants:0,nonSkillSourceEffectsOmitted:0,
  excludedEvents:0};
 const chain=new Map();
 const reject=(e,code)=>{
  pending.push({sourceOrdinal:e.sourceOrdinal,eventId:e.eventId,reason:code});
  census.excludedEvents++;
 };
 for(const e of src.events){
  if(!supported.has(e.section)){reject(e,'UNSUPPORTED_EVENT_SECTION');continue;}
  const isChain=e.section==='arrows';
  const previous=isChain&&e.sourceChainOrdinal>1?
   chain.get(e.sourceChainOrdinal-1):null;
  if(isChain&&e.sourceChainOrdinal>1&&!previous){
   reject(e,'CHAIN_PREDECESSOR_NOT_PROJECTED');continue;
  }
  if(e.reviewReasons.some(code=>!reviewException.has(code))){
   reject(e,'AMBIGUOUS_OR_UNSUPPORTED_SOURCE_FACT');continue;
  }
  if(!Array.isArray(e.choices)||!e.choices.length){
   reject(e,'NO_SOURCE_CHOICES');continue;
  }
  const choices=[];
  let reason=null,routeCount=0,skillCount=0,directCount=0,nonSkills=0;
  for(const ch of e.choices){
   if(!Array.isArray(ch.routes)||!ch.routes.length){
    reason='MISSING_RESULT_ROUTE';break;
   }
   if(ch.reportedRandomAlternative&&ch.routes.length<2){
    reason='INCOMPLETE_RANDOM_ALTERNATIVES';break;
   }
   const outs=[],knownRewards=new Set();
   for(const route of ch.routes){
    if(route.guardKinds.length||route.conditionsRequiringReview.some(x=>
      !reviewException.has(x))){
     reason='CONDITIONAL_SOURCE_ROUTE';break;
    }
    const rewards=[],terminals=route.effects.filter(x=>x.type==='chain_end');
    if(terminals.length>1||terminals.length&&e.section!=='arrows'){
     reason='UNSUPPORTED_TERMINATION';break;
    }
    for(const effect of route.effects){
     if(effect.type==='skill_hint'||effect.type==='skill_hint_or'||
        effect.type==='obtain_skill'||effect.type==='chain_end')continue;
     if(!ordinary.has(effect.type)){
      reason='UNSUPPORTED_EFFECT_KIND';break;
     }
     nonSkills++;
    }
    if(reason)break;
    for(const hint of route.numericHintFacts){
     if(hint.originType!=='skill_hint'||hint.numericFactParsed!==true||
        !Number.isInteger(hint.level)||hint.level<1||hint.level>20||
        !/^\d+$/.test(hint.skillNumericId||'')){
      reason='UNRESOLVED_OR_ALTERNATIVE_HINT';break;
     }
     const found=registry.byId.get(hint.skillNumericId);
     if(!found||!['normal','rare'].includes(found.rarity)){
      reason='MISSING_OR_UNSUITABLE_SKILL_ID';break;
     }
     const key='skill:'+hint.skillNumericId;
     if(knownRewards.has(route.routeOrdinal+':'+key)){
      reason='DUPLICATE_RESULT_SKILL';break;
     }
     knownRewards.add(route.routeOrdinal+':'+key);
     rewards.push({skillId:key,verifiedSkillName:found.name,level:hint.level});
     skillCount++;
    }
    if(reason)break;
    for(const grant of route.directSkillGrantFacts){
     const id=grant.skillNumericId;
     if(!/^\d+$/.test(id||'')||!registry.byId.has(id)||
        !['normal','rare'].includes(registry.byId.get(id).rarity)){
      reason='UNRESOLVED_DIRECT_SKILL';break;
     }
     const key='skill:'+id;
     if(knownRewards.has(route.routeOrdinal+':'+key)){
      reason='DUPLICATE_RESULT_SKILL';break;
     }
     knownRewards.add(route.routeOrdinal+':'+key);
     rewards.push({skillId:key,verifiedSkillName:registry.byId.get(id).name,
      kind:'obtained'});
     skillCount++;directCount++;
    }
    if(reason)break;
    outs.push({id:route.routeId,label:'結果'+route.routeOrdinal+'（仮）',
     rewards,...(terminals.length?{terminal:true}:{})});
    routeCount++;
   }
   if(reason)break;
   if(outs.length===1){
    const x=outs[0];
    choices.push({id:ch.choiceId,label:ch.displayLabel,rewards:x.rewards,
     ...(x.terminal?{terminal:true}:{})});
   }else choices.push({id:ch.choiceId,label:ch.displayLabel,outcomes:outs});
  }
  if(reason){reject(e,reason);continue;}
  const isAuto=e.choices.length===1&&e.choices[0].sourceLabelWasEmpty;
  if(isAuto&&choices[0].terminal){
   reject(e,'AUTO_TERMINAL_REQUIRES_REVIEW');continue;
  }
  const ev=isAuto?{id:e.eventId,name:e.displayName,type:'auto',
   ...(choices[0].outcomes?{outcomes:choices[0].outcomes}:
     {rewards:choices[0].rewards})}:
   {id:e.eventId,name:e.displayName,type:'choice',choices};
  if(isChain&&previous)ev.requires={all:[{eventId:previous}]};
  // This quarantine marker is rejected even if someone manually fabricates
  // approval evidence. It cannot leak into a released event.
  ev.sourceKind='derived-github-unreviewed';
  try{
   validateEvents([...events,ev],{skillById});
  }catch{
   reject(e,'APP_SCHEMA_VALIDATION_FAILED');continue;
  }
  events.push(ev);
  if(isChain)chain.set(e.sourceChainOrdinal,e.eventId);
  census.modeledEvents++;
  census.modeledRoutes+=routeCount;
  census.modeledSkills+=skillCount;
  census.modeledDirectGrants+=directCount;
  census.nonSkillSourceEffectsOmitted+=nonSkills;
 }
 if(census.modeledEvents+census.excludedEvents!==census.sourceEvents||
    new Set(events.map(x=>x.id)).size!==events.length)
  fail('source-event-count-not-preserved');
 return {
  dataKind:'derived-github-private-app-schema-draft',version:1,
  cardId,sourceCommit:inspection.sourceRevision,
  sourceBlobSha:inspection.sourceBlobSha,
  draftCatalog:{schemaVersion:1,cards:[{
   cardId,coverageStatus:'partial',events}]},
  pendingEvents:pending,census,
  // Cannot be promoted by the caller without removing quarantine markers,
  // confirming rejected events, reviewing facts and producing approvals.
  completeCardReadyForPublication:false,
  copyrightAndReleaseReviewed:false,
  sourceLabelsCopied:false,publicationApproved:false
 };
}
module.exports={projectDerivedCardDraft};
