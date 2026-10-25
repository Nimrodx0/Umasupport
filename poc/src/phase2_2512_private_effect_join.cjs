'use strict';
/*
 * Fail-closed join: 2512 skill-only private candidate + separately isolated
 * GT non-skill candidate. SAME card & fixed GT ordinal; SAME choice/result
 * topology. Do not invent outcome identities, chain edges, publication consent,
 * or map GameWith-only events to unrelated GameTora positions.
 */
const crypto=require('node:crypto');
const schema=require('./event_schema.js');
const core=require('./core.js');
const POLICY=require('../config/event-source-priority.v1.json');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('Phase2スキル非スキル統合: '+s);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validGTEventId=(id,cardId)=>new RegExp('^gt-'+cardId+'-event-\\d{3}$').test(id);
const baseGTId=(cardId,ordinal)=>'gt-'+cardId+'-event-'+String(ordinal).padStart(3,'0');
function ordinalOf(id,cardId){
 const match=/^gt:(\d{5}):(\d{3}):effect-only$/.exec(id||'');
 return match&&match[1]===cardId?Number(match[2]):null;
}
function sourcePartFor(skill,eff){
 if(!obj(skill)||!obj(eff))return {parts:null,reason:'INVALID_PART'};
 const skillOut=Array.isArray(skill.outcomes);
 const effOut=Array.isArray(eff.outcomes);
 if(!skillOut){
  if(effOut)return {parts:null,reason:'RESULT_TOPOLOGY_MISMATCH'};
  if(!Array.isArray(skill.rewards)||skill.effects!==undefined||
     !Array.isArray(eff.effects)&&eff.effects!==undefined)
   return {parts:null,reason:'FLAT_LEAF_SHAPE_MISMATCH'};
  return {parts:[{skill,effect:eff}]};
 }
 // The source is one result per reported random branch. The skill
 // projector may split ONE source result into several exclusive hint
 // alternatives, named route-NN-or-M, without changing its stat award.
 // Match source-route ancestry, never zip by overall flattened indices.
 const sourceLeaves=effOut?eff.outcomes:[eff];
 if(!sourceLeaves.length||effOut&&sourceLeaves.some((x,i)=>
    x.id!=='result-'+(i+1)))
  return {parts:null,reason:'SOURCE_RESULT_IDENTITY_AMBIGUOUS'};
 const groups=sourceLeaves.map(()=>[]);
 let lastGroup=-1;
 for(const item of skill.outcomes){
  const match=/^route-(\d{2})(?:-or-(\d+))?$/.exec(item.id||'');
  if(!match)return {parts:null,reason:'RESULT_IDENTITY_AMBIGUOUS'};
  const index=Number(match[1])-1,alternative=match[2]?Number(match[2]):null;
  if(index<0||index>=sourceLeaves.length||index<lastGroup)
   return {parts:null,reason:'RESULT_SOURCE_ORDINAL_MISMATCH'};
  if(alternative!==null&&(!Number.isSafeInteger(alternative)||alternative<1))
   return {parts:null,reason:'RESULT_IDENTITY_AMBIGUOUS'};
  const g=groups[index],prior=g[g.length-1];
  if(g.length===0&&alternative!==null&&alternative!==1||
     g.length>0&&(alternative===null||!prior?.alternative||
       alternative!==prior.alternative+1))
   return {parts:null,reason:'RESULT_ALTERNATIVE_SEQUENCE_AMBIGUOUS'};
  g.push({skill:item,effect:sourceLeaves[index],alternative});
  lastGroup=index;
 }
 if(groups.some(g=>g.length===0))
  return {parts:null,reason:'RESULT_SOURCE_ROUTE_MISSING'};
 if(groups.some(g=>g.length===1&&g[0].alternative!==null))
  return {parts:null,reason:'SINGLE_ALT_WITHOUT_SOURCE_RESULT'};
 return {parts:groups.flat().map(({skill:leaf,effect})=>({skill:leaf,effect}))};
}
function mergeEvent(skill,eff){
 if(skill.type!==eff.type)return {event:null,reason:'EVENT_TYPE_MISMATCH'};
 const matches=[];
 if(skill.type==='auto'){
  const mapped=sourcePartFor(skill,eff);
  if(!mapped.parts)return {event:null,reason:mapped.reason};
  matches.push(...mapped.parts);
 }else if(skill.type==='choice'){
  if(!Array.isArray(skill.choices)||!Array.isArray(eff.choices)||
     skill.choices.length!==eff.choices.length)
   return {event:null,reason:'CHOICE_COUNT_MISMATCH'};
  for(let i=0;i<skill.choices.length;i++){
   const sc=skill.choices[i],ec=eff.choices[i];
   if(sc.id!=='choice-'+String(i+1).padStart(2,'0')||
      ec.id!=='choice-'+(i+1))
    return {event:null,reason:'CHOICE_IDENTITY_AMBIGUOUS'};
   const mapped=sourcePartFor(sc,ec);
   if(!mapped.parts)return {event:null,reason:mapped.reason};
   matches.push(...mapped.parts);
  }
 }else return {event:null,reason:'UNKNOWN_TYPE'};
 let attached=0;
 const copy=structuredClone(skill);
 const parts=copy.type==='auto'?[copy]:copy.choices;
 let slot=0;
 for(const p of parts){
  const leaves=p.outcomes||[p];
  for(const leaf of leaves){
   const {effect}=matches[slot++];
   if(leaf.effects!==undefined||leaf.unresolvedRewards!==undefined)
    return {event:null,reason:'SKILL_LEAF_HAS_EFFECTS'};
   if(effect.effects!==undefined){
    if(!Array.isArray(effect.effects)||!effect.effects.length)
     return {event:null,reason:'INVALID_EFFECT_LEAF'};
    leaf.effects=structuredClone(effect.effects);
    attached+=leaf.effects.length;
   }
  }
 }
 if(slot!==matches.length)return {event:null,reason:'TOPOLOGY_CONSUMPTION_MISMATCH'};
 if(!attached)return {event:null,reason:'NO_NUMERIC_EFFECTS'};
 return {event:copy,effectRows:attached};
}
function assemble({skillRuntime,effectInventory},{strict=false}={}){
 if(skillRuntime?.dataKind!=='phase2-2512-nonpublishing-with-30180-special-hint'||
    skillRuntime.publicationApproved!==false||
    skillRuntime.noAutomaticRuntimeAdoption!==true||
    skillRuntime.reviewedEventsPublished!==0||
    skillRuntime.sourceNarrativeOrChoiceProseIncluded!==false||
    skillRuntime.catalog?.schemaVersion!==1||
    hash(skillRuntime.catalog)!==skillRuntime.summary?.catalogSha256||
    effectInventory?.dataKind!=='phase2-gt-whole-nonskill-effect-inventory'||
    effectInventory.publicationApproved!==false||
    effectInventory.automaticRuntimeAdoption!==false||
    effectInventory.sourceProseIncluded!==false||
    effectInventory.chainTopologyVerified!==false||
    effectInventory.onlyIsolatedEffectShapePreview!==true||
    effectInventory.sourcePins?.gameToraDerived!==POLICY.baselineRevision||
    effectInventory.isolatedPreview?.schemaVersion!==1||
    !Array.isArray(effectInventory.isolatedPreview.cards))
  fail('2512件の元本番候補・GT固定出典・未公開フラグ・SHAが不正');
 const original=skillRuntime.catalog;
 const result=structuredClone(original);
 const sourceByCard=new Map(effectInventory.isolatedPreview.cards.map(c=>[c.cardId,c]));
 const cardMap=new Map(result.cards.map(c=>[c.cardId,c]));
 if(sourceByCard.size!==effectInventory.isolatedPreview.cards.length||
    cardMap.size!==result.cards.length)
  fail('出典カードIDに重複');
 const blocked={},addReason=k=>blocked[k]=(blocked[k]||0)+1;
 let candidateEvents=0,joinedEvents=0,joinedEffects=0,unchangedEvents=0,
  exactEventIdentityMatched=0;
 const touchedCards=new Set(),mergedIds=new Set(),reviewPositions=[];
 const originalEvents=new Map();
 for(const card of original.cards)for(const event of card.events){
  const key=card.cardId+'|'+event.id;
  if(originalEvents.has(key))fail('元イベントのID重複');
  originalEvents.set(key,hash(event));
 }
 for(const [cardId,sourceCard] of sourceByCard){
  const card=cardMap.get(cardId);
  if(!card||!Array.isArray(sourceCard.events)||!Array.isArray(card.events))
   fail('元効果データにないサポカ');
  const indices=new Map(card.events.map((x,i)=>[x.id,i]));
  for(const effectEvent of sourceCard.events){
   candidateEvents++;
   const ordinal=ordinalOf(effectEvent.id,cardId);
   if(!ordinal)fail('固定GT位置を特定できません');
   const originalId=baseGTId(cardId,ordinal);
   const idx=indices.get(originalId);
   if(idx===undefined){addReason('GT_RUNTIME_EVENT_ID_NOT_FOUND');continue;}
   const before=card.events[idx];exactEventIdentityMatched++;
   if(!validGTEventId(before.id,cardId)){
    addReason('GT_RUNTIME_EVENT_ID_NOT_FOUND');continue;
   }
   const attempt=mergeEvent(before,effectEvent);
   if(!attempt.event){
    addReason(attempt.reason);
    reviewPositions.push({cardId,sourceOrdinal:ordinal,reason:attempt.reason});
    continue;
   }
   card.events[idx]=attempt.event;
   const key=cardId+'|'+before.id;
   mergedIds.add(key);joinedEvents++;joinedEffects+=attempt.effectRows;
   touchedCards.add(cardId);
  }
 }
 for(const card of result.cards){
  const orig=original.cards.find(x=>x.cardId===card.cardId);
  if(!orig||card.events.length!==orig.events.length)fail('元イベント数を破壊');
  for(let i=0;i<card.events.length;i++){
   const old=orig.events[i],now=card.events[i],key=card.cardId+'|'+old.id;
   if(now.id!==old.id||now.name!==old.name||
      now.type!==old.type||hash(old)!==originalEvents.get(key))
    fail('元イベントIDと名前が変化');
   const strip=e=>{
    const x=structuredClone(e);
    const remove=p=>{
     delete p.effects;
     for(const o of p.outcomes||[])remove(o);
    };
    if(x.type==='choice')for(const c of x.choices)remove(c);
    else remove(x);
    return x;
   };
   if(hash(strip(now))!==hash(old))fail('既存スキル経路・分岐・連続依存が変化');
   if(!mergedIds.has(key)){
    unchangedEvents++;
    if(hash(now)!==hash(old))fail('無関係の既存イベントが変化');
   }
  }
 }
 if(joinedEvents+unchangedEvents!==originalEvents.size||
    joinedEvents!==mergedIds.size||
    joinedEffects<=0||
    candidateEvents!==effectInventory.summary?.isolatedPreviewEventRecords||
    joinedEvents>candidateEvents)
  fail('出典候補数・結合数・無関係イベントの保存則不一致');
 const skills=new Set();
 for(const c of result.cards)for(const e of c.events)
  for(const part of e.type==='choice'?e.choices:[e])
   for(const outcome of part.outcomes||[part])
    for(const reward of outcome.rewards||[])skills.add(reward.skillId);
 const model={cards:result.cards.map(c=>({id:c.cardId})),
  cardById:Object.fromEntries(result.cards.map(c=>[c.cardId,{id:c.cardId}])),
  skillById:Object.fromEntries([...skills].map(id=>[id,{id}]))};
 const validation=schema.validateCatalog(result,model);
 if(validation.eventsWithRecords!==skillRuntime.summary.totalCandidateEvents)
  fail('統合後の全本番スキーマイベント数が不一致');
 if(strict&&(result.cards.length!==563||validation.eventsWithRecords!==2512||
    effectInventory.summary.isolatedPreviewEventRecords!==2220||
    effectInventory.summary.sourceEvents!==2488||
    originalEvents.size!==2512||
    candidateEvents!==2220||exactEventIdentityMatched!==2220||
    joinedEvents<2209||joinedEffects<9835||
    unchangedEvents>303||touchedCards.size<558||
    Object.values(blocked).reduce((n,c)=>n+c,0,)>11))
  fail('固定全件の2512/2220統合数と11件の分岐不整合が変化');
 // Confirm every *selected route* has unchanged skill semantics without
 // assuming an event has occurred or an RNG outcome was selected.
 let cardChecks=0;
 for(const card of result.cards){
  const oldCard=original.cards.find(c=>c.cardId===card.cardId);
  const setting={stage:4,choices:{},outcomes:{}};
  for(const event of card.events){
   if(event.type==='choice'){
    setting.choices[event.id]=event.choices[0].id;
    const p=event.choices[0];
    if(p.outcomes?.length)setting.outcomes[event.id]=p.outcomes[0].id;
   }else if(event.outcomes?.length)
    setting.outcomes[event.id]=event.outcomes[0].id;
  }
  const before=core.directRoutes({id:card.cardId,hints:[],events:oldCard.events},setting);
  const after=core.directRoutes({id:card.cardId,hints:[],events:card.events},setting);
  if(hash(before)!==hash(after))fail('報酬結合で既存スキルの候補が変化');
  cardChecks++;
 }
 return {
  dataKind:'phase2-2512-private-combined-skill-and-nonskill-review',
  publicationApproved:false,noAutomaticRuntimeAdoption:true,
  reviewedEventsPublished:0,sourceNarrativeOrChoiceProseIncluded:false,
  fullEventRewardOrChainCoverageVerified:false,
  effectSourcePin:POLICY.baselineRevision,
  catalog:result,
  summary:{cards:result.cards.length,events:validation.eventsWithRecords,
   isolatedEffectCandidates:candidateEvents,
   matchedSourceEventIdentity:exactEventIdentityMatched,
   combinedEventRecords:joinedEvents,combinedNumericComponents:joinedEffects,
   untouchedEventRecords:unchangedEvents,touchedCards:touchedCards.size,
   originalRuntimeSha256:hash(original),mergedRuntimeSha256:hash(result),
   cardCoreSkillRouteChecks:cardChecks,
   blockedReasons:Object.fromEntries(Object.entries(blocked).sort()),
   reviewPositions:reviewPositions.sort((a,b)=>a.cardId.localeCompare(b.cardId)||a.sourceOrdinal-b.sourceOrdinal),
   sourceDatasetPublished:false,publicEventsAdded:0}
 };
}
module.exports={assemble,mergeEvent};
