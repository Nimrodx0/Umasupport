'use strict';
/*
 * Source-only review manifest of conditional GameTora support event segments.
 * A segment is NOT a random result and NOT a player-selectable choice. Keep
 * those guards out of the reward runtime until the relevant context and each
 * skill-result ancestry are both independently adjudicated.
 *
 * The manifest contains no source titles, choice text, or reward values.
 */
const {flattenRoutes}=require('../tools/audit_gametora_branches.cjs');
const POLICY=require('../config/event-source-priority.v1.json');
const fail=message=>{throw Error('GT条件付き分岐監査: '+message);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const SOURCE_PIN=POLICY.baselineRevision;

function classifyGuard(input){
 if(!obj(input)||typeof input.kind!=='string'||!/^[a-z_]+$/.test(input.kind))
  fail('不正な条件ガード形状');
 const kind=input.kind;
 // Scripted classes are a label for developer review, not a usable
 // condition in our UI. The pinned engine does NOT resolve scripted guards
 // from chara_info. Even numeric "class" 1..3 is not a player choice.
 if(kind==='scripted'){
  const val=input.value;
  if(Array.isArray(val)&&val.length===2&&val[0]==='class'&&
     Number.isSafeInteger(val[1])&&val[1]>0)
   return {kind,reviewClass:'opaque-scripted-class',classOrdinal:val[1],
    runtimeResolvable:false};
  return {kind,reviewClass:'opaque-scripted-other',runtimeResolvable:false};
 }
 if((kind==='mood_min'||kind==='mood_max')&&
    Number.isSafeInteger(input.value)&&input.value>=1&&input.value<=5)
  return {kind,reviewClass:'requires-current-mood',threshold:input.value,
   runtimeResolvable:false};
 if(kind==='otherwise'&&input.value===undefined)
  return {kind,reviewClass:'fallback',runtimeResolvable:false};
 return {kind,reviewClass:'unadjudicated-guard',runtimeResolvable:false};
}

function analyze({documents,index,inventory}){
 if(!Array.isArray(documents)||!obj(index)||!obj(inventory)||
    index.dataKind!=='umasupport-whole-event-provisional-index'||
    index.publicationApproval!==false||
    index.sourcePins?.gameToraDerived!==SOURCE_PIN||
    inventory.dataKind!=='phase2-gt-whole-nonskill-effect-inventory'||
    inventory.sourcePins?.gameToraDerived!==SOURCE_PIN||
    inventory.publicationApproved!==false||
    inventory.automaticRuntimeAdoption!==false||
    !Array.isArray(inventory.rows)||!Array.isArray(index.cards))
  fail('固定版・非公開契約・元監査が不正');
 const roster=new Map(index.cards.map(x=>[x.cardId,x]));
 if(roster.size!==index.cards.length)fail('重複した元サポートカードID');
 const sourceRows=new Map();
 for(const x of inventory.rows){
  const key=[x.cardId,x.sourceOrdinal,x.choiceOrdinal,x.routeOrdinal].join(':');
  if(sourceRows.has(key))fail('固定元の結果順位が重複');
  sourceRows.set(key,x);
 }
 const reviewed=[],cards=new Set(),events=new Set();
 let sourceSegments=0,segmentRoutes=0,guardedRoutes=0,
     opaqueScriptedClassGuards=0,moodGuards=0,fallbackGuards=0,
     unsupportedGuards=0,missingSourceRoutes=0;
 for(const doc of documents){
  const cardId=String(doc?.id);
  if(doc?.kind!=='support'||!roster.has(cardId))fail('元カード種別・IDが不正');
  const source=obj(doc.events_ja)&&Object.keys(doc.events_ja).length?
   doc.events_ja:doc.events;
  if(!obj(source)||roster.get(cardId)?.gameToraObservedCount!==Object.keys(source).length)
   fail('固定元イベントの件数が不一致');
  for(const [ei,event] of Object.values(source).entries()){
   if(!Array.isArray(event?.choices))fail('固定元の選択肢配列が不正');
   for(const [ci,choice] of event.choices.entries()){
    if(!Array.isArray(choice.segments)||choice.segments.length===0)continue;
    cards.add(cardId);events.add(cardId+':'+(ei+1));
    const flattened=flattenRoutes(choice);
    let running=0;
    for(const [si,seg] of choice.segments.entries()){
     if(!obj(seg)||!Array.isArray(seg.when))fail('条件付きsegmentの形状が不正');
     const groups=Array.isArray(seg.outcomes)?seg.outcomes:[seg.effects||[]];
     if(!groups.length||groups.some(g=>!Array.isArray(g)))fail('segment内の結果形状が不正');
     sourceSegments++;
     const guards=seg.when.map(classifyGuard);
     for(const guard of guards){
      if(guard.reviewClass==='opaque-scripted-class')opaqueScriptedClassGuards++;
      else if(guard.reviewClass==='requires-current-mood')moodGuards++;
      else if(guard.reviewClass==='fallback')fallbackGuards++;
      else unsupportedGuards++;
     }
     for(const group of groups){
      running++;segmentRoutes++;
      if(guards.length)guardedRoutes++;
      const fixed=sourceRows.get([cardId,ei+1,ci+1,running].join(':'));
      if(!fixed){missingSourceRoutes++;continue;}
      if(!fixed.issueCodes?.includes('CONDITIONAL_SEGMENTS_NOT_MODELED')||
         fixed.supportedProjectionEligible!==false||
         fixed.eligibleScalarEffects?.length||
         fixed.eligibleStatusEffects?.length||
         fixed.eligibleDynamicEffects?.length)
       fail('ガードが未解決なのにスキル・数値効果を昇格している');
      reviewed.push({
       cardId,sourceOrdinal:ei+1,choiceOrdinal:ci+1,
       segmentOrdinal:si+1,routeOrdinal:running,
       guardDescriptors:guards,
       sourceEffectCount:group.length,
       hasSkillCandidate:group.some(g=>['skill_hint','skill_hint_or','obtain_skill'].includes(g?.type)),
       guardContextVerified:false,
       automaticOutcomeSelectionAllowed:false,
       sourceIsPlayerChoice:false,
       sourceIsRandomResult:false,
       quarantineReasons:fixed.issueCodes.slice().sort()
      });
     }
    }
    if(running!==flattened.length)fail('固定元ガード結果の順番を復元できない');
   }
  }
 }
 if(missingSourceRoutes)fail('元条件付き分岐の結果IDが全件監査にない');
 if(reviewed.length!==segmentRoutes||
    guardedRoutes>segmentRoutes||
    cards.size>events.size||
    !reviewed.every(x=>x.guardContextVerified===false&&
       x.automaticOutcomeSelectionAllowed===false))
  fail('ガードの隔離条件が不正');
 return {
  dataKind:'phase2-gt-conditional-segment-review-only',
  sourcePin:SOURCE_PIN,
  publicationApproved:false,automaticRuntimeAdoption:false,
  sourceNarrativeIncluded:false,rawSourceEffectValuesIncluded:false,
  segmentContextVerified:false,
  summary:{sourceSegmentEvents:events.size,sourceSegmentCards:cards.size,
   sourceSegments,segmentRoutes,guardedRoutes,opaqueScriptedClassGuards,
   moodGuards,fallbackGuards,unsupportedGuards,
   quarantineConfirmedRoutes:reviewed.length},
  rows:reviewed
 };
}
module.exports={classifyGuard,analyze};
