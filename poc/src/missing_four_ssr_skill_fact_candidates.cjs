'use strict';
/*
 * Temporary numeric-only backfill of four cards absent from the pinned GT
 * event snapshot. Source is Checker (derivative of GameWith), so this is NOT
 * yet independent, current-game-verified, or publication-approved data.
 * No event title, option label, raw reward prose or skill name is serialized.
 */
const GT='6e38b54af4fad397ff4491e63007a90705a4fe67';
const CHECKER='8cf9fcb3cc7239041161be75c84daf9f8f22d29f';
const SKILL_REV='0cacbb1aaf9dca10283d5b9ea20b205b9d204535';
const IDS=['30318','30319','30320','30321'];
const fail=s=>{throw Error('4SSR未収録スキル候補: '+s);};
const norm=x=>String(x).normalize('NFKC').replace(/\s+/g,' ').trim();
const glyphAlias=Object.freeze({'良バ場◯':{name:'良バ場○',id:200152}});
function make({index,cards,skills,strict=true}){
 if(index?.schemaVersion!==1||
   index.dataKind!=='umasupport-whole-event-provisional-index'||
   index.publicationApproval!==false||index.gameVerified!==false||
   index.sourcePins?.checker!==CHECKER||
   index.sourcePins?.gameToraDerived!==GT||
   !Array.isArray(index.cards)||!Array.isArray(cards)||!Array.isArray(skills))
  fail('固定出典／未承認母集団の証拠が不正');
 const byId=new Map();
 for(const card of index.cards){
  if(byId.has(card.cardId))fail('カードID重複');
  byId.set(card.cardId,card);
 }
 const names=new Map(),seenSkillIds=new Set();
 for(const skill of skills){
  if(!Number.isSafeInteger(skill?.id)||skill.id<1||
     typeof skill.name!=='string'||!norm(skill.name)||
     seenSkillIds.has(skill.id))fail('独立スキル名称辞書が不正');
  seenSkillIds.add(skill.id);
  const key=norm(skill.name),arr=names.get(key)||[];
  arr.push(skill.id);names.set(key,arr);
 }
 const actual=new Map();
 for(const card of cards){
  if(!IDS.includes(card?.cardId)||actual.has(card.cardId)||!Array.isArray(card.events))
   fail('対象外・重複カード／イベント配列');
  actual.set(card.cardId,card);
 }
 const totals={missingCards:0,candidateEvents:0,candidateChoiceRows:0,
  numericHintMentions:0,exactNameHintMentions:0,reviewedGlyphHintMentions:0,
  candidateChainStages:0,candidateRandomEvents:0,unresolvedRouteSemantics:0};
 const output=[];
 for(const id of IDS){
  const record=byId.get(id),raw=actual.get(id);
  if(!record||record.rarity!=='SSR'||record.sourceMissing!==true||
     record.checkerMissing!==false||record.gameToraObservedCount!==0||
     record.checkerObservedCount!==5||
     !Array.isArray(record.checkerOnly)||record.checkerOnly.length!==5||
     !raw||raw.events.length!==5)fail('GT未収録・Checker候補5件の条件に不一致 '+id);
  totals.missingCards++;
  const events=[];
  for(let i=0;i<5;i++){
   const original=raw.events[i],pointer=record.checkerOnly[i];
   if(!original||pointer.checkerOrdinal!==i+1||
      original.sourceKey!==pointer.sourceKey||
      !/^checker:[0-9]+:[0-9a-f]{20}$/.test(original.sourceKey||'')||
      !/^sha256:[0-9a-f]{64}$/.test(original.sourceDigest||'')||
      !/^sha256:[0-9a-f]{64}$/.test(original.titleFingerprint||'')||
      !Array.isArray(original.options)||!original.options.length)
    fail('元レコードに対する一意の位置／ハッシュが不一致 '+id+':'+(i+1));
   totals.candidateEvents++;totals.candidateChoiceRows+=original.options.length;
   if(i<3)totals.candidateChainStages++;else totals.candidateRandomEvents++;
   totals.unresolvedRouteSemantics++;
   const mentions=[];
   for(let j=0;j<original.options.length;j++){
    const option=original.options[j];
    if(typeof option?.Effect!=='string')fail('元の候補報酬形式が不正');
    const text=option.Effect;
    const found=[...text.matchAll(/『([^』]+)』のヒントLv\s*\+?([1-9]\d*)/gu)];
    if(found.length!==(text.match(/ヒントLv/gu)||[]).length)
     fail('未対応のヒント表記が混在: '+id+':'+(i+1)+':'+(j+1));
    for(const match of found){
     const sourceName=norm(match[1]),alias=glyphAlias[sourceName],
      candidateName=alias?.name||sourceName;
     const matchedIds=names.get(candidateName)||[];
     if(matchedIds.length!==1||(alias&&matchedIds[0]!==alias.id)||
        !Number.isSafeInteger(+match[2])||+match[2]>9)
      fail('スキルID・名前の一意解決ができません: '+id+':'+(i+1));
     totals.numericHintMentions++;
     totals[alias?'reviewedGlyphHintMentions':'exactNameHintMentions']++;
     mentions.push({checkerOptionOrdinal:j+1,skillNumericId:matchedIds[0],
      hintLevel:+match[2],sourceNameResolution:alias?'REVIEWED_GLYPH_DIFFERENCE':'2026_METADATA_EXACT_NAME',
      rewardConditionVerified:false,choiceIsPlayerSelectableVerified:false});
    }
   }
   events.push({checkerOrdinal:i+1,sourceKey:original.sourceKey,
    sourceDigest:original.sourceDigest,titleFingerprint:original.titleFingerprint,
    checkerChoiceRows:original.options.length,
    orderingHypothesis:i<3?'CHAIN_STAGE_CANDIDATE':'RANDOM_EVENT_CANDIDATE',
    hintMentions:mentions,sourceEffectAlternativesUnverified:true,
    actualGameplaySelectionVerified:false,
    currentGameVerified:false,publicationApproved:false});
  }
  output.push({cardId:id,rarity:'SSR',sourceCardMissing:true,
   upstreamCandidateOrigin:'CHECKER_GAMEWITH_DERIVATIVE',
   eventCount:5,currentGameVerified:false,publicationApproved:false,events});
 }
 if(strict&&(totals.missingCards!==4||totals.candidateEvents!==20||
    totals.candidateChainStages!==12||totals.candidateRandomEvents!==8||
    totals.numericHintMentions!==12||totals.exactNameHintMentions!==11||
    totals.reviewedGlyphHintMentions!==1))
  fail('固定元4SSRのスキル候補母集団が変化');
 return {schemaVersion:1,dataKind:'missing-gt-four-ssr-numeric-skill-candidate-backfill',
  sourcePins:{gameToraDerived:GT,checker:CHECKER,independentSkills:SKILL_REV},
  totals,cards:output,sourceProseIncluded:false,currentGameVerified:false,
  allGameEventsVerified:false,selectionSemanticsVerified:false,
  publicationApproved:false,noAutomaticRuntimeAdoption:true};
}
module.exports={make,IDS};
