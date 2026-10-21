'use strict';
/*
 * Read-only crosswalk for ALL GameTora numeric event hints against the
 * VERSION-PINNED UmaSim skill registry and the existing app hint model.
 *
 * Input is the nonpublic intermediate event candidate, NOT raw event prose.
 * This step is NOT an approval of event conditions, skill granting, or rights.
 */
const crypto=require('node:crypto');
const bridge=require('./skill_bridge.js');
const curated=require('./curated_skill_resolution.cjs');
const POLICY=require('../config/event-source-priority.v1.json');
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=x=>{throw Error('GameToraイベント数値スキル照合: '+x);};
const norm=x=>String(x).normalize('NFKC').replace(/\s+/g,' ').trim();
const validId=x=>typeof x==='string'&&/^[1-9]\d*$/.test(x)&&Number.isSafeInteger(Number(x));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const CANONICAL_SOURCE_SHA='b7ba1d6c5dd2af9ed1f4e649f16ec1d319198e2f1ac9db07c54e14d29f0b25ec';
const CANONICAL_SOURCE_REV='cf9366f6a487bd8f197b53d8a11981207beb9f6c';
function crosswalk({candidate,skillText,model,supplemental}){
 if(POLICY.schemaVersion!==2||POLICY.baselineSource!=='GameTora-derived'||
    POLICY.canonicalExceptionSource!=='GameWith'||POLICY.automaticPublicationAllowed!==false)
   fail('正本設定と違う');
 if(!obj(candidate)||candidate.dataKind!=='gametora-whole-event-numeric-candidate'||
    candidate.releaseApproved!==false||candidate.noEventCanPublishFromThisCandidate!==true||
    candidate.sourcePins?.gameToraDerived!==POLICY.baselineRevision||
    !Array.isArray(candidate.cards)||!obj(candidate.totals))
   fail('固定GameTora由来の未承認中間DBが必要');
 if(!obj(model)||!obj(model.skillById)||!Array.isArray(model.cards))
   fail('既存スキルモデルが必要');
 const raw=bridge.parseSource(skillText);
 const extra=supplemental===undefined?{schemaVersion:1,skills:[]}:supplemental;
 const supplementalIndex=curated.indexSkills(skillText,extra);
 const supplementalById=new Map(supplementalIndex.supplementalRecords.map(r=>[r.id,r]));
 const supplementalByName=new Map(supplementalIndex.supplementalRecords.map(r=>[norm(r.name),r.id]));
 if(raw.count<100)fail('スキル辞書が短すぎます');
 const expected={...candidate.totals};
 const seenCards=new Set(),locations=[],alternativeLocations=[],unresolved=[],counts={
  cards:0,sourceEvents:0,sourceChoices:0,sourceRoutes:0,
  numericHintMentions:0,exclusiveOrHintEffects:0,exclusiveOrOptions:0,
  exclusiveOrOptionsParsed:0,matchedPinnedSkillIds:0,
  matchedAppNormalHintIds:0,matchedAppRegisteredNumericIds:0,
  ambiguousSkillNamesSafelyKeptNumeric:0,missingPinnedSkillIds:0,
  unsupportedSkillRarities:0,unresolvedInputHints:0,
  curationOnlySkillIds:0,directSkillGrantMentions:0,
  directSkillIdsInPinnedRegistry:0,directSkillIdsMissingFromPinnedRegistry:0,
  directSkillIdsOnlyInSupplement:0,directSkillIdsUnsupportedRarity:0
 };
 const mapped=new Map(),missing=new Map();
 const classify=(id,kind,info)=>{
  if(!validId(id)){
   return {status:'invalid-numeric-id',runtimeSkillId:null};
  }
  const row=raw.byId.get(id);
  if(!row){
   const extra=supplementalById.get(id);
   return extra?{status:'curation-only-not-in-runtime-registry',
    runtimeSkillId:null,sourceId:id,rarity:extra.rarity}:
    {status:'not-in-pinned-umasim-registry',runtimeSkillId:null,sourceId:id};
  }
  if(!['normal','rare'].includes(row.rarity))
   return {status:'unsupported-rarity',runtimeSkillId:null,sourceId:id,rarity:row.rarity};
  const exactName=norm(row.name),ids=raw.byName.get(exactName)||[];
  const unambiguous=ids.length===1&&!supplementalByName.has(exactName);
  const hintId='hint:'+exactName,existing=model.skillById[hintId];
  const canMerge=unambiguous&&existing&&norm(existing.name)===exactName;
  return {status:canMerge?'mapped-existing-normal-hint':'mapped-numeric-event-skill',
   runtimeSkillId:canMerge?hintId:'skill:'+row.id,
   sourceId:id,rarity:row.rarity,nameAmbiguous:!unambiguous,
   // A digest helps catch accidental spelling changes without copying names.
   nameFingerprint:'sha256:'+sha(exactName),group:row.group};
 };
 for(const card of candidate.cards){
  if(!obj(card)||typeof card.cardId!=='string'||seenCards.has(card.cardId)||
     !Array.isArray(card.events))fail('カードデータの重複か欠落');
  seenCards.add(card.cardId);counts.cards++;
  if(card.sourceMissing===true){
   if(card.events.length!==0)fail('欠損カードに仮イベントが混入');
   continue;
  }
  for(const ev of card.events){
   counts.sourceEvents++;
   if(!Number.isSafeInteger(ev.sourceOrdinal)||!Array.isArray(ev.choices))
     fail('イベント構造が不正');
   for(const choice of ev.choices){
    counts.sourceChoices++;
    if(!Number.isSafeInteger(choice.choiceOrdinal)||!Array.isArray(choice.routes))
     fail('選択肢構造が不正');
    for(const route of choice.routes){
     counts.sourceRoutes++;
     if(!Number.isSafeInteger(route.routeOrdinal)||
        !Array.isArray(route.numericHintFacts)||!Array.isArray(route.directSkillGrantFacts))
       fail('分岐情報が不正');
     const context={cardId:card.cardId,sourceOrdinal:ev.sourceOrdinal,
       choiceOrdinal:choice.choiceOrdinal,routeOrdinal:route.routeOrdinal};
     for(let i=0;i<route.numericHintFacts.length;i++){
      const h=route.numericHintFacts[i];
      if(!obj(h)||!['skill_hint','skill_hint_or'].includes(h.originType))
       fail('ヒント構造が不正');
      if(h.numericFactParsed!==true){
       if(h.originType==='skill_hint_or'){
        counts.exclusiveOrHintEffects++;
        for(let ai=0;ai<(h.alternatives||[]).length;ai++){
         const option=h.alternatives[ai];
         counts.exclusiveOrOptions++;
         const parsed=option?.numericFactParsed===true;
         if(parsed)counts.exclusiveOrOptionsParsed++;
         const matching=parsed?classify(option.skillNumericId,'exclusive-or-hint'):
          {status:'unresolved-exclusive-or-option',runtimeSkillId:null};
         alternativeLocations.push({...context,kind:'exclusive-or-hint',
          hintOrdinal:i+1,alternativeOrdinal:ai+1,
          numericId:option?.skillNumericId||null,level:option?.level??null,
          numericFactParsed:parsed,status:matching.status,
          runtimeSkillId:matching.runtimeSkillId,
          ...(matching.rarity?{rarity:matching.rarity}:{}),
          ...(matching.nameFingerprint?{nameFingerprint:matching.nameFingerprint}:{}),
          ...(matching.nameAmbiguous?{nameAmbiguous:true}:{})});
        }
       }
       counts.unresolvedInputHints++;
       unresolved.push({...context,kind:'hint',hintOrdinal:i+1,
        numericId:h.skillNumericId||null,reason:'SOURCE_HINT_EFFECT_NOT_NUMERIC_OR_AMBIGUOUS'});
       continue;
      }
      if(!validId(h.skillNumericId)||!Number.isSafeInteger(h.level)||h.level<1)
       fail('数値ヒントとして承認された入力の数値が壊れています');
      counts.numericHintMentions++;
      const result=classify(h.skillNumericId,'hint');
      const entry={...context,kind:'hint',hintOrdinal:i+1,
       numericId:h.skillNumericId,level:h.level,
       status:result.status,runtimeSkillId:result.runtimeSkillId,
       ...(result.rarity?{rarity:result.rarity}:{}),
       ...(result.nameFingerprint?{nameFingerprint:result.nameFingerprint}:{}),
       ...(result.nameAmbiguous?{nameAmbiguous:true}:{})};
      locations.push(entry);
      if(result.status==='mapped-existing-normal-hint'){
       counts.matchedPinnedSkillIds++;counts.matchedAppNormalHintIds++;
      }else if(result.status==='mapped-numeric-event-skill'){
       counts.matchedPinnedSkillIds++;counts.matchedAppRegisteredNumericIds++;
       if(result.nameAmbiguous)counts.ambiguousSkillNamesSafelyKeptNumeric++;
      }else{
       if(result.status==='curation-only-not-in-runtime-registry')counts.curationOnlySkillIds++;
       else if(result.status==='unsupported-rarity')counts.unsupportedSkillRarities++;
       else counts.missingPinnedSkillIds++;
       unresolved.push({...context,kind:'hint',hintOrdinal:i+1,
        numericId:h.skillNumericId,reason:result.status});
      }
     }
     for(let i=0;i<route.directSkillGrantFacts.length;i++){
      const d=route.directSkillGrantFacts[i];
      counts.directSkillGrantMentions++;
      const result=classify(d.skillNumericId,'direct-award');
      if(result.status==='mapped-existing-normal-hint'||result.status==='mapped-numeric-event-skill')
       counts.directSkillIdsInPinnedRegistry++;
      else if(result.status==='curation-only-not-in-runtime-registry')
       counts.directSkillIdsOnlyInSupplement++;
      else if(result.status==='unsupported-rarity')
       counts.directSkillIdsUnsupportedRarity++;
      else counts.directSkillIdsMissingFromPinnedRegistry++;
      locations.push({...context,kind:'direct-skill-award',awardOrdinal:i+1,
       numericId:d.skillNumericId||null,status:result.status,
       runtimeSkillId:result.runtimeSkillId,
       ...(result.rarity?{rarity:result.rarity}:{}),
       awardSemanticsReviewed:false});
      unresolved.push({...context,kind:'direct-skill-award',awardOrdinal:i+1,
       numericId:d.skillNumericId||null,reason:'DIRECT_SKILL_GRANT_NEEDS_SEPARATE_SEMANTICS'});
     }
    }
   }
  }
 }
 const equality=[['rosterCards','cards'],['sourceEvents','sourceEvents'],
  ['sourceChoices','sourceChoices'],['expandedRoutes','sourceRoutes'],
  ['numericHintMentions','numericHintMentions'],
  ['unresolvedHintMentions','unresolvedInputHints'],
  ['directSkillGrantMentions','directSkillGrantMentions']];
 for(const [k,l] of equality)if(expected[k]!==counts[l])
  fail('全件保存検証不一致: '+k+'/'+l+' '+expected[k]+'/'+counts[l]);
 if(counts.numericHintMentions!==counts.matchedPinnedSkillIds+
   counts.missingPinnedSkillIds+counts.unsupportedSkillRarities+counts.curationOnlySkillIds)
  fail('数値IDの分類が不足');
 if(counts.directSkillGrantMentions!==counts.directSkillIdsInPinnedRegistry+
   counts.directSkillIdsMissingFromPinnedRegistry+counts.directSkillIdsOnlyInSupplement+
   counts.directSkillIdsUnsupportedRarity)
  fail('直接獲得IDの分類が不足');
 if(locations.length!==counts.numericHintMentions+counts.directSkillGrantMentions)
  fail('全報酬位置を保持できていません');
 return {schemaVersion:1,dataKind:'gametora-event-skill-crosswalk-draft',
  sourcePins:{gameToraDerived:POLICY.baselineRevision,
   umaSimSkills:CANONICAL_SOURCE_REV,umaSimSkillsSha256:CANONICAL_SOURCE_SHA},
  sourceSkillRegistryCount:raw.count,sourceProseIncluded:false,
  crosswalkDoesNotVerifyRouteConditions:true,requiresSeparatePublicationReview:true,
  releaseApproved:false,gameVerified:false,
  stats:counts,locations,alternativeLocations,unresolved};
}
module.exports={crosswalk,CANONICAL_SOURCE_SHA,CANONICAL_SOURCE_REV};
