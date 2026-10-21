'use strict';
/*
 * Dry-run the *source-to-production-SCHEMA* transformation for the subset of
 * GT events with all numeric skills resolved and no unsupported branching.
 *
 * This module never publishes event/choice wording or a public catalog:
 * placeholders are not editorially reviewed labels, and no data has been
 * approved for redistribution. Its draft catalog remains memory-only.
 */
const bridge=require('./skill_bridge.js');
const schema=require('./event_schema.js');
const curated=require('./curated_skill_resolution.cjs');
const POLICY=require('../config/event-source-priority.v1.json');
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=x=>{throw Error('GameToraイベント実行形式草稿: '+x);};
const f=(c,e,o,r,i)=>JSON.stringify([c,e,o,r,i]);
function project({candidate,crosswalk,skillText,model,supplemental}){
 if(candidate?.dataKind!=='gametora-whole-event-numeric-candidate'||
    candidate.releaseApproved!==false||candidate.noEventCanPublishFromThisCandidate!==true||
    candidate.sourcePins?.gameToraDerived!==POLICY.baselineRevision||
    crosswalk?.dataKind!=='gametora-event-skill-crosswalk-draft'||
    crosswalk.releaseApproved!==false||
    crosswalk.sourcePins?.gameToraDerived!==POLICY.baselineRevision||
    !Array.isArray(candidate.cards)||!Array.isArray(crosswalk.locations)||
    !obj(model?.skillById)||!Array.isArray(model?.cards))
  fail('未承認GameTora入力とスキルID対応の出典が不正');
 // Source registry is immutable. A curated-only skill may be used in a
 // NONPUBLIC schema proof only after its independent ID+name evidence has
 // passed the existing strict supplement verifier. Do not promote it to the
 // pinned UmaSim registry or silently suppress its provenance.
 const supplementation=curated.indexSkills(skillText,supplemental);
 const mergedSkillText=supplementation.mergedSkillText;
 const supplementalIds=new Set(supplementation.supplementalRecords.map(x=>x.id));
 const registry=bridge.parseSource(mergedSkillText),locator=new Map();
 for(const x of crosswalk.locations){
  if(x.kind!=='hint')continue;
  const k=f(x.cardId,x.sourceOrdinal,x.choiceOrdinal,x.routeOrdinal,x.hintOrdinal);
  if(locator.has(k))fail('数値ヒント位置の重複');
  locator.set(k,x);
 }
 const visited=new Set(),reject=[],accepted=[],perCard=[],counts={
  sourceCards:candidate.cards.length,sourceEvents:0,sourceChoices:0,sourceRoutes:0,
  candidateSchemaEvents:0,candidateSchemaCards:0,
  candidateAutoEvents:0,candidateChoiceEvents:0,
  candidateRewardMentions:0,candidateTerminalPaths:0,
  candidateCurationOnlyHintMentions:0,candidateCurationOnlyEvents:0,
  candidateConditionalAvailabilityEvents:0,
  candidateSpecialTriggerEvents:0,candidateOutingSequenceEvents:0,
  candidateOutingRandomEvents:0,
  skippedEvents:0,skippedSourceMissingCards:0,blockedDependentStages:0,
  blockedDependentOutings:0
 };
 function rejectEvent(cardId,eventId,ordinal,reason){
  reject.push({cardId,eventId,sourceOrdinal:ordinal,reason});
  counts.skippedEvents++;
  if(reason==='CHAIN_PREDECESSOR_NOT_PROJECTED')counts.blockedDependentStages++;
  if(reason==='OUTING_PREDECESSOR_NOT_PROJECTED')counts.blockedDependentOutings++;
 }
 for(const c of candidate.cards){
  if(!obj(c)||typeof c.cardId!=='string'||!Array.isArray(c.events))
   fail('元カード形式不正');
  if(c.sourceMissing){
   if(c.events.length)fail('欠損カードにイベントが含まれる');
   counts.skippedSourceMissingCards++;
   perCard.push({cardId:c.cardId,eligible:0,excluded:0,sourceMissing:true});
   continue;
  }
  const converted=[],chainByOrdinal=new Map(),outingByOrdinal=new Map();
  let excluded=0,localHints=0,outingOrdinal=0;
  for(const e of c.events){
   counts.sourceEvents++;
   counts.sourceChoices+=e.choices?.length||0;
   counts.sourceRoutes+=(e.choices||[]).reduce((n,x)=>n+(x.routes?.length||0),0);
   let reason=null;
   const triggerKinds={
    special:'special-trigger',
    dates:'outing-sequence',
    dates_random:'outing-random'
   };
   if(!['random','arrows','special','dates','dates_random'].includes(e.section))
    reason='UNKNOWN_SUPPORT_EVENT_SECTION';
   const sourceOuting=e.section==='dates';
   if(sourceOuting)outingOrdinal++;
   const priorOuting=sourceOuting&&outingOrdinal>1?
    outingByOrdinal.get(outingOrdinal-1):null;
   if(sourceOuting&&outingOrdinal>1&&!priorOuting)
    reason='OUTING_PREDECESSOR_NOT_PROJECTED';
   if(!Array.isArray(e.choices)||!e.choices.length)
    reason='INVALID_SOURCE_CHOICES';
   const sourceChain=e.section==='arrows',priorId=sourceChain&&e.sourceChainOrdinal>1?
    chainByOrdinal.get(e.sourceChainOrdinal-1):null;
   if(sourceChain&&e.sourceChainOrdinal>1&&!priorId)
    reason='CHAIN_PREDECESSOR_NOT_PROJECTED';
   if(!reason&&e.reviewReasons?.some(r=>r!=='CHAIN_ADJACENCY_IS_SOURCE_ORDER_ONLY'))
    reason='SOURCE_SPECIAL_CASE_REQUIRES_REVIEW';
   const choices=[],eventHintKeys=[];let eventHintCount=0,eventCurationCount=0;
   for(const ch of e.choices||[]){
    if(reason)break;
    if(!Array.isArray(ch.routes)||!ch.routes.length){
     reason='RESULT_ROUTES_MISSING';break;
    }
    if(ch.routes.length>1&&ch.reportedRandomAlternative!==true||
       ch.routes.length===1&&ch.reportedRandomAlternative===true){
     reason='RESULT_BRANCH_KIND_AMBIGUOUS';break;
    }
    const out=[];
    for(const route of ch.routes){
     if(!Array.isArray(route.guardKinds)||route.guardKinds.length||
        !Array.isArray(route.conditionsRequiringReview)||
        route.conditionsRequiringReview.length||
        !Array.isArray(route.directSkillGrantFacts)||
        route.directSkillGrantFacts.length){
      reason='SPECIAL_ROUTE_OR_DIRECT_GRANT';break;
     }
     if(!Array.isArray(route.numericHintFacts)){
      reason='INVALID_ROUTE_HINTS';break;
     }
     const rewards=[],unique=new Set();
     for(let hi=0;hi<route.numericHintFacts.length;hi++){
      const h=route.numericHintFacts[hi];
      const k=f(c.cardId,e.sourceOrdinal,ch.choiceOrdinal,route.routeOrdinal,hi+1);
      const verified=locator.get(k);
      const isSupplement=verified?.status==='curation-only-not-in-runtime-registry'&&
        supplementalIds.has(h.skillNumericId);
      if(!h.numericFactParsed||!verified||
         !(['mapped-existing-normal-hint','mapped-numeric-event-skill'].includes(verified.status)||
           isSupplement)||
         verified.numericId!==h.skillNumericId||verified.level!==h.level){
       reason='SKILL_ID_OR_HINT_EFFECT_PENDING';break;
      }
      const source=registry.byId.get(h.skillNumericId);
      if(!source||!['normal','rare'].includes(source.rarity)||unique.has(source.id)){
       reason='MISSING_OR_DUPLICATE_RESULT_SKILL';break;
      }
      unique.add(source.id);
      if(isSupplement)eventCurationCount++;
      eventHintKeys.push(k);
      rewards.push({skillId:'skill:'+source.id,verifiedSkillName:source.name,level:h.level});
     }
     if(reason)break;
     const terminal=route.explicitChainEnd===true;
     if(terminal&&e.section!=='arrows'){
      reason='NONCHAIN_TERMINAL_REQUIRES_REVIEW';break;
     }
     out.push({id:route.routeId,label:'結果'+route.routeOrdinal+'（仮）',
       rewards,...(terminal?{terminal:true}:{})});
     eventHintCount+=rewards.length;
    }
    if(reason)break;
    // If originally a no-choice support event, do NOT fabricate an option.
    const sourceAuto=e.choices.length===1&&ch.sourceLabelWasEmpty===true;
    if(sourceAuto&&out.length===1&&out[0].terminal){
     reason='AUTO_EVENT_TERMINAL_UNSUPPORTED';break;
    }
    choices.push({id:ch.choiceId,label:ch.displayLabel,
      ...(out.length===1?{rewards:out[0].rewards,
        ...(out[0].terminal?{terminal:true}:{})}:{outcomes:out})});
   }
   if(!reason&&!choices.length)reason='NO_CHOICES_RENDERED';
   if(reason){
    rejectEvent(c.cardId,e.eventId,e.sourceOrdinal,reason);excluded++;
    continue;
   }
   const isAuto=e.choices.length===1&&e.choices[0].sourceLabelWasEmpty===true;
   let convertedEvent;
   if(isAuto){
    const src=choices[0];
    convertedEvent={id:e.eventId,name:e.displayName,type:'auto',
      ...(src.outcomes?{outcomes:src.outcomes}:{rewards:src.rewards})};
   }else convertedEvent={id:e.eventId,name:e.displayName,type:'choice',choices};
   if(triggerKinds[e.section])
    convertedEvent.availabilityKind=triggerKinds[e.section];
   if(sourceOuting&&priorOuting)
    convertedEvent.requires={all:[{eventId:priorOuting}]};
   if(sourceChain&&priorId){
    const parent=converted.find(x=>x.id===priorId);
    const branches=parent.type==='choice'?parent.choices:[parent];
    const allTerminal=branches.every(p=>p.terminal===true||
      p.outcomes?.length&&p.outcomes.every(o=>o.terminal===true));
    if(allTerminal){
     rejectEvent(c.cardId,e.eventId,e.sourceOrdinal,'CHAIN_PREDECESSOR_ALL_PATHS_END');
     excluded++;continue;
    }
    convertedEvent.requires={all:[{eventId:priorId}]};
   }
   // A last stage with no following edge is not a premature terminal.
   if(sourceChain)chainByOrdinal.set(e.sourceChainOrdinal,convertedEvent.id);
   if(sourceOuting)outingByOrdinal.set(outingOrdinal,convertedEvent.id);
   converted.push(convertedEvent);
   if(sourceOuting){
    counts.candidateOutingSequenceEvents++;
    counts.candidateConditionalAvailabilityEvents++;
   }else if(e.section==='special'){
    counts.candidateSpecialTriggerEvents++;
    counts.candidateConditionalAvailabilityEvents++;
   }else if(e.section==='dates_random'){
    counts.candidateOutingRandomEvents++;
    counts.candidateConditionalAvailabilityEvents++;
   }
   for(const key of eventHintKeys)visited.add(key);
   localHints+=eventHintCount;
   if(eventCurationCount){
    counts.candidateCurationOnlyHintMentions+=eventCurationCount;
    counts.candidateCurationOnlyEvents++;
   }
   if(isAuto)counts.candidateAutoEvents++;
   else counts.candidateChoiceEvents++;
  }
  if(converted.length){
   accepted.push({cardId:c.cardId,coverageStatus:'partial',events:converted});
   counts.candidateSchemaCards++;
   counts.candidateSchemaEvents+=converted.length;
   counts.candidateRewardMentions+=localHints;
   counts.candidateTerminalPaths+=converted.reduce((total,e)=>{
    const parts=e.type==='choice'?e.choices:[e];
    return total+parts.reduce((t,c)=>t+(c.terminal?1:0)+
      (c.outcomes||[]).filter(o=>o.terminal).length,0);
   },0);
  }
  perCard.push({cardId:c.cardId,eligible:converted.length,excluded});
 }
 if(counts.sourceEvents!==candidate.totals.sourceEvents||
    counts.sourceChoices!==candidate.totals.sourceChoices||
    counts.sourceRoutes!==candidate.totals.expandedRoutes||
    counts.candidateSchemaEvents+counts.skippedEvents!==counts.sourceEvents)
  fail('固定全件の候補変換カウント不整合');
 const catalog={schemaVersion:1,cards:accepted};
 // Independently execute the existing runtime numeric skill bridge and schema
 // over ALL projected cards in memory. No mutation of the live model.
 const prepared=bridge.prepare(model,catalog,mergedSkillText,{fullRegistry:false});
 const extraSkills=Object.fromEntries(prepared.skills.map(x=>[x.id,x]));
 const sourceSkills={...model.skillById,...extraSkills};
 for(const patch of prepared.skillPatches||[]){
  if(!sourceSkills[patch.id])fail('補正スキルが未登録');
  sourceSkills[patch.id]={...sourceSkills[patch.id],...patch};
 }
 const validated=schema.validateCatalog(prepared.catalog,
  {...model,skillById:sourceSkills});
 if(validated.eventsWithRecords!==counts.candidateSchemaEvents)
  fail('独立スキーマ検証のイベント件数が不一致');
 if(visited.size!==counts.candidateRewardMentions)
  fail('スキルの一対一対応件数が不一致');
 const reasons={};
 for(const x of reject)reasons[x.reason]=(reasons[x.reason]||0)+1;
 return {
  report:{schemaVersion:1,dataKind:'gametora-app-schema-dry-run',
   sourceProseIncluded:false,publicationApproved:false,gameVerified:false,
   sourceOrderAdjacencyVerified:false,
   allPublishedNamesAreUnreviewedPlaceholders:true,
   curatedIdsAreSeparateFromPinnedUmaSim:true,
   totals:counts,excludedReasons:Object.fromEntries(Object.entries(reasons).sort()),
   perCard,excludedSourcePositions:reject},
  // Memory-only for schema/UI regression; CLI refuses to serialize this.
  dryRunCatalog:prepared.catalog,
  runtimeValidation:validated};
}
module.exports={project};
