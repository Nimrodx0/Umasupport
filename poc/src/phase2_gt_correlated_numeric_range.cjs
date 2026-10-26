'use strict';
/*
 * GT +/-n/+/-m effects are one JOINT low/high draw across a single choice,
 * never a Cartesian product of independent per-effect draws. Private only.
 * Source text and original skill descriptions are not retained.
 */
const POLICY=require('../config/event-source-priority.v1.json');
const fail=s=>{throw Error('GT連動数値範囲監査: '+s);};
const valid=obj=>obj!==null&&typeof obj==='object'&&!Array.isArray(obj);
const TYPES=new Set(['speed','stamina','power','guts','wisdom',
 'energy','max_energy','mood','bond','skill_points','aptitude_points','all_stats']);
const STATS=['speed','stamina','power','guts','wisdom'];
const SKILLS=new Set(['skill_hint','obtain_skill','skill_hint_or']);
const RANGE=/^([+-]?\d+)\/([+-]?\d+)$/;
const SINGLE=/^[+-]?\d+$/;
function numeric(value){
 if(typeof value!=='string'&&typeof value!=='number')return null;
 const s=String(value);
 if(SINGLE.test(s)&&Number.isSafeInteger(Number(s)))return [Number(s),Number(s)];
 const m=RANGE.exec(s);
 return m&&m.slice(1).every(v=>Number.isSafeInteger(Number(v)))?
  m.slice(1).map(Number):null;
}
const isRange=effect=>typeof effect?.value==='string'&&effect.value.includes('/');
function candidates({documents,index}){
 if(!Array.isArray(documents)||!valid(index)||
    index.dataKind!=='umasupport-whole-event-provisional-index'||
    index.publicationApproval!==false||
    index.sourcePins?.gameToraDerived!==POLICY.baselineRevision||
    POLICY.automaticPublicationAllowed!==false)
  fail('固定版・未公開入力が不正');
 const roster=new Map(index.cards.map(x=>[x.cardId,x]));
 if(roster.size!==index.cards.length)fail('ロスターの重複');
 let rangedValueMentions=0,sourceRangeEvents=0,sourceRangeChoices=0,
  rangeOutcomeCandidates=0,rangeEffectComponents=0,uncertainChoices=0;
 const review=[], byCard=new Map(),coveredCards=new Set();
 for(const doc of documents){
  const cardId=String(doc?.id),row=roster.get(cardId);
  if(!valid(doc)||doc.kind!=='support'||!row||row.sourceMissing!==false)
   fail('出典カードID・種別が不正');
  const source=valid(doc.events_ja)&&Object.keys(doc.events_ja).length?doc.events_ja:doc.events;
  if(!valid(source)||Object.keys(source).length!==row.gameToraObservedCount)
   fail('出典カード内のイベント件数が不正');
  let ordinal=0;
  for(const event of Object.values(source)){
   ordinal++;
   if(!Array.isArray(event.choices))fail('元イベント選択配列が不正');
   let counted=false;
   for(const [ci,choice] of event.choices.entries()){
    const effects=choice.effects||[];
    if(!Array.isArray(effects))fail('元イベント効果形状が不正');
    // Segmented, already-split or random_either routes are not a
    // plain range choice; count only literal range effects in the
    // flattened source where they can be unambiguously located.
    const parts=Array.isArray(choice.segments)&&choice.segments.length?
     choice.segments:[choice];
    const appearances=parts.flatMap(p=>
     Array.isArray(p.outcomes)?p.outcomes.flat():p.effects||[])
      .filter(isRange);
    if(!appearances.length)continue;
    rangedValueMentions+=appearances.length;
    if(!counted){sourceRangeEvents++;counted=true;}
    sourceRangeChoices++;coveredCards.add(cardId);
    const reasons=[];
    if(parts.length!==1||parts[0]!==choice)reasons.push('CONDITIONAL_SEGMENTS');
    if(choice.random_either===true||Array.isArray(choice.outcomes))
     reasons.push('RANDOM_RESULT_ALREADY_SPLIT');
    if(!effects.length)reasons.push('NO_FLAT_EFFECTS');
    const effectRows=[],tierParts=[[],[]];
    for(const [ei,e] of effects.entries()){
     if(!valid(e)||typeof e.type!=='string'){
      reasons.push('INVALID_EFFECT_SHAPE');continue;
     }
     const values=numeric(e.value);
     if(SKILLS.has(e.type)){
      if(e.type==='skill_hint_or'&&Array.isArray(e.options)){
       if(e.options.some(o=>isRange(o)&&!numeric(o.value)))
        reasons.push('INVALID_SKILL_OR_RANGE');
      }else if(isRange(e)&&!values)reasons.push('INVALID_SKILL_RANGE');
      continue;
     }
     if(!TYPES.has(e.type)){reasons.push('UNSUPPORTED_OTHER_EFFECT');continue;}
     if(!values){reasons.push('UNSUPPORTED_NUMERIC_EFFECT');continue;}
     if(Object.keys(e).some(k=>!['type','value','char_id'].includes(k))||
       e.char_id!==undefined&&
        (e.type!=='bond'||!Number.isSafeInteger(e.char_id)||e.char_id<=0)){
      reasons.push('INVALID_TARGET_OR_FIELDS');continue;
     }
     if(values[0]!==values[1])rangeEffectComponents+=(e.type==='all_stats'?5:1);
     for(const tier of [0,1]){
      const v=values[tier];
      if(!v)continue;
      if(e.type==='all_stats'){
       for(const kind of STATS)tierParts[tier].push({kind,delta:v,sourceBundle:'all_stats',
        sourceEffectOrdinal:ei+1});
      }else tierParts[tier].push({kind:e.type,delta:v,
       ...(e.char_id?{recipientCharId:e.char_id}:{}),
       sourceEffectOrdinal:ei+1});
     }
     effectRows.push({sourceEffectOrdinal:ei+1,
       type:e.type,hasRange:values[0]!==values[1],tierDelta:values});
    }
    if(!tierParts.every(x=>x.length))reasons.push('NO_NUMERIC_PARTS');
    const uniqueReasons=[...new Set(reasons)].sort();
    const projected=uniqueReasons.length===0;
    if(projected)rangeOutcomeCandidates++;
    else uncertainChoices++;
    const record={cardId,sourceOrdinal:ordinal,choiceOrdinal:ci+1,
     sourceRangeEffectCount:appearances.length,
     sourceNumericEffects:effectRows.length,
     canProjectNumericTiers:projected,blockers:uniqueReasons,
     sourceIsRandomEither:false,sourceHasTwoCorrelatedTiers:true,
     unapproved:true,
     // Values used only within a CI ephemeral experiment; no prose included.
     numericTiers:projected?tierParts:[]};
    review.push(record);
    const arr=byCard.get(cardId)||[];arr.push(record);byCard.set(cardId,arr);
  }
 }
 }
 if(review.length!==sourceRangeChoices||
    rangeOutcomeCandidates+uncertainChoices!==sourceRangeChoices||
    coveredCards.size!==byCard.size)
  fail('連動範囲の位置と母数が不一致');
 return {dataKind:'phase2-gt-correlated-numeric-range-review',
  sourcePin:POLICY.baselineRevision,publicationApproved:false,
  automaticRuntimeAdoption:false,sourceNarrativeIncluded:false,
  sourceRangeProseIncluded:false,
  summary:{sourceRangeEvents,sourceRangeCards:coveredCards.size,
   sourceRangeChoices,rangedValueMentions,rangeEffectComponents,
   rangeOutcomeCandidates,uncertainChoices},
  rows:review};
}
module.exports={numeric,candidates};
