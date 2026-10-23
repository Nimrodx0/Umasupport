'use strict';
/*
 * Editorially adopted, non-skill scenario effects are separate from the
 * SKILL-ONLY event runtime. A title replacement must never become a second
 * executable event; an overseas-only R/SSR event must not be projected
 * into an always-available empty reward event.
 */
const FACTS=require('../data/curation/adjudicated/phase2_p1_scenario_event_facts.v1.json');
const {TARGETS}=require('./phase2_p1_source_title_join.cjs');
const fail=x=>{throw Error('Phase2 P1シナリオ別イベント台帳: '+x);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const GT="6e38b54af4fad397ff4491e63007a90705a4fe67";
const CHECKER="8cf9fcb3cc7239041161be75c84daf9f8f22d29f";
const GROUP_IDS=['30067','30081','30137'];
const OTHER_IDS=['10094','30160'];
function verify({comparison,gtDocuments,ledger=FACTS},{strict=false}={}){
 if(ledger?.schemaVersion!==1||
    ledger.dataKind!=='phase2-p1-scenario-specific-event-fact-ledger'||
    ledger.sourcePins?.gameToraDerived!==GT||
    ledger.sourcePins?.checker!==CHECKER||
    ledger.sourceNarrativeOrChoiceProseIncluded!==false||
    ledger.publicationApproved!==false||
    ledger.automaticPublicAdoption!==false||
    ledger.runtimeCatalogAdoption!==false||
    ledger.baselinePrivateEventCount!==2512||
    !Array.isArray(ledger.commonReplacements)||ledger.commonReplacements.length!==3||
    !Array.isArray(gtDocuments)||gtDocuments.length!==5||
    comparison?.dataKind!=='phase2-p1-scoped-title-key-join'||
    comparison.publicationApproved!==false||
    comparison.originalCrossSourceQueueUnchanged!==true||
    comparison.skillGrantsAdded!==0||
    comparison.chainFlagsChanged!==0||
    comparison.sourcePins?.gameToraDerived!==GT||
    comparison.sourcePins?.checker!==CHECKER||
    comparison.summary?.targetPositions!==4||
    comparison.summary?.checkerCategoryTitlesVerified!==4||
    comparison.summary?.sharedContextRowsVerified!==3||
    comparison.summary?.separateOverseasEventRowsVerified!==1||
    comparison.summary?.GTEventIdentityPairsAdded!==0||
    comparison.summary?.resultPathsCertified!==0||
    comparison.summary?.publicEventsAdded!==0||
    comparison.rows?.length!==4)
  fail('出典分類4件／固定版／未承認カタログの全体ゲート不正');
 if(new Set(gtDocuments.map(d=>d?.id)).size!==5||
    gtDocuments.some(d=>!OTHER_IDS.concat(GROUP_IDS).includes(String(d.id))))
  fail('固定GT5カードのID集合と一意性が一致しない');
 const byCard=new Map(gtDocuments.map(d=>[String(d.id),d]));
 let replacements=0;
 for(let i=0;i<GROUP_IDS.length;i++){
  const id=GROUP_IDS[i],fact=ledger.commonReplacements[i];
  const target=TARGETS.find(t=>t.cardId===id);
  const observed=comparison.rows.find(r=>r.cardId===id);
  const originals=Object.values(byCard.get(id)?.events_ja||{});
  const orig=originals[target.gtOrdinal-1];
  if(fact?.cardId!==id||fact.checkerOrdinal!==target.checkerOrdinal||
     fact.referenceGTOrdinal!==target.gtOrdinal||
     fact.referenceGTLocalId!==target.gtLocalId||
     fact.originalGTEventName!==target.gtName||
     fact.displayName!=='温かなメッセージ'||
     fact.context!=='PROJECT_LARC_SUMMER_EXPEDITION'||
     fact.behavior!=='REPLACES_VISIBLE_TITLE_WITH_SAME_EFFECTS'||
     fact.outcomeMultiplicity!=='SOURCE_CONDITIONAL_CHOICES'||
     fact.sourceUrl!=='https://gamewith.jp/uma-musume/article/show/414606'||
     fact.noAdditionalEvent!==true||fact.noAdditionalSkillGrant!==true||
     fact.publicationApproved!==false||
     observed?.checkerSourceHeadingMatchesKnownCategory!==true||
     observed.checkerTitleCategory!=='COMMON_GROUP_CONTEXT'||
     observed.individualGTEventIdentityPaired!==false||
     observed.outcomeSemanticsProvenEquivalent!==false||
     observed.gameToraLocalId!==target.gtLocalId||
     observed.gameToraSourceOrdinal!==target.gtOrdinal||
     !orig||orig.id!==target.gtLocalId||orig.name!==target.gtName||
     orig.section!=='special'||orig.choices.length!==3)
   fail('グループ共通イベントの置換・無加算／無重複が不一致: '+id);
  replacements++;
 }
 const mei=ledger.overseasSeparate;
 const expected={GREAT_SUCCESS:{guts:3,mood:1,bond:5},
  SUCCESS:{guts:3,mood:0,bond:5}};
 if(mei?.eventFamilyId!=='usl:mei:larc:overseas-cheer:review-only'||
    mei.title!=='労いのエール'||
    mei.context!=='PROJECT_LARC_OVERSEAS_ONLY'||
    mei.alternativeToDomesticEvent!=='お疲れ様！！'||
    !same(mei.cardIds,OTHER_IDS)||
    !same(mei.checkerSSR,{cardId:'30160',ordinal:10})||
    mei.domesticGtSourceOrdinal!==2||mei.domesticGtLocalId!==1411||
    mei.playerSelectableChoiceCount!==0||
    !same(mei.resultKinds,['GREAT_SUCCESS','SUCCESS'])||
    !same(mei.results,expected)||
    !same(mei.projectLarcAdditionalEffects,{
     skillPoints:3,aptitudePoints:50,bond:2})||
    !same(mei.skillHints,[])||mei.chainEnd!=='NOT_REPORTED'||
    mei.gameWithUrl!=='https://gamewith.jp/uma-musume/article/show/414373'||
    !same(mei.gameWithCardUrls,[
      'https://gamewith.jp/uma-musume/article/show/414258',
      'https://gamewith.jp/uma-musume/article/show/413773'])||
    !same(mei.gameToraCardUrls,[
      'https://gametora.com/ja/umamusume/supports/10094-mei-satake',
      'https://gametora.com/ja/umamusume/supports/30160-mei-satake'])||
    mei.sourceEditorialDecision!=='ADOPT_EXPLICIT_NONSKILL_FACTS'||
    mei.runtimeRepresentation!=='STAGED_METADATA_ONLY_NOT_AN_EMPTY_REWARD_EVENT'||
    mei.publicationApproved!==false)
   fail('海外版の2結果・シナリオ効果・スキルなし・掲載URLが不一致');
 const source=comparison.rows.find(x=>x.cardId==='30160');
 if(source?.checkerSourceHeadingMatchesKnownCategory!==true||
    source.checkerTitleCategory!=='OVERSEAS_SEPARATE_EVENT'||
    source.individualGTEventIdentityPaired!==false||
    source.outcomeSemanticsProvenEquivalent!==false||
    source.checkerOrdinal!==10)
  fail('海外の別イベントと国内GTイベントを同じIDにしてはいけない');
 for(const id of OTHER_IDS){
  const values=Object.values(byCard.get(id)?.events_ja||{});
  if(values.length!==12||values[1]?.id!==1411||
     values[1]?.name!=='お疲れ様！！'||
     values[1]?.section!=='special'||
     values.some(x=>x.name==='労いのエール'))
   fail('固定GTの国内イベントと海外側の欠損が変化: '+id);
 }
 if(strict&&gtDocuments.length!==5)fail('実固定GT5カードを読んでいない');
 return {
  dataKind:'phase2-p1-scenario-events-audited-metadata',
  publicationApproved:false,sourceProseIncluded:false,
  outcomeEquivalenceVerified:false,technicalRuntimeEventAdditions:0,
  skillGrantsAdded:0,publicEventsAdded:0,
  summary:{sourceCategoryPositionsVerified:4,
   replacementContextCards:replacements,duplicateGroupEventsAdded:0,
   overseasDistinctEventFamilies:1,overseasApplicableCardIds:OTHER_IDS,
   overseasResultKinds:2,overseasSkillHints:0,
   stagedReviewOnlyEventCardScopes:2,
   privateRuntimeEventCountUnchanged:2512,
   publishedEventCountUnchanged:0}
 };
}
module.exports={verify};
