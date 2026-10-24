'use strict';
/*
 * Isolated NON-PUBLISHING two-card preview. No GT/GameWith prose, external
 * trigger probability, or invented chain/outing continuation is projected.
 * One family applies to R10094 and SSR30160, not a globally shared event ID.
 */
const schema=require('./event_schema.js');
const core=require('./core.js');
const facts=require('../data/curation/adjudicated/phase2_p1_scenario_event_facts.v1.json');
const fail=s=>{throw Error('佐岳メイ非スキル効果試作: '+s);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const CARD_IDS=['10094','30160'];
const EXPECTED_RESULTS={
 GREAT_SUCCESS:{guts:3,mood:1,bond:5},
 SUCCESS:{guts:3,mood:0,bond:5}
};
const EXPECTED_EXTRA={skillPoints:3,aptitudePoints:50,bond:2};
const EFFECT_NAMES={
 guts:'guts',mood:'mood',bond:'bond',
 skillPoints:'skill_points',aptitudePoints:'aptitude_points'
};
function preview({ledger=facts}={}){
 const mei=ledger?.overseasSeparate;
 if(ledger?.schemaVersion!==1||
    ledger.dataKind!=='phase2-p1-scenario-specific-event-fact-ledger'||
    ledger.sourcePins?.gameToraDerived!=='6e38b54af4fad397ff4491e63007a90705a4fe67'||
    ledger.sourcePins?.checker!=='8cf9fcb3cc7239041161be75c84daf9f8f22d29f'||
    ledger.publicationApproved!==false||
    ledger.automaticPublicAdoption!==false||
    ledger.runtimeCatalogAdoption!==false||
    ledger.sourceNarrativeOrChoiceProseIncluded!==false||
    ledger.baselinePrivateEventCount!==2512||
    mei?.eventFamilyId!=='usl:mei:larc:overseas-cheer:review-only'||
    mei.title!=='労いのエール'||
    mei.context!=='PROJECT_LARC_OVERSEAS_ONLY'||
    mei.alternativeToDomesticEvent!=='お疲れ様！！'||
    !same(mei.cardIds,CARD_IDS)||
    mei.playerSelectableChoiceCount!==0||
    !same(mei.resultKinds,['GREAT_SUCCESS','SUCCESS'])||
    !same(mei.results,EXPECTED_RESULTS)||
    !same(mei.projectLarcAdditionalEffects,EXPECTED_EXTRA)||
    !same(mei.skillHints,[])||
    mei.chainEnd!=='NOT_REPORTED'||
    mei.sourceEditorialDecision!=='ADOPT_EXPLICIT_NONSKILL_FACTS'||
    mei.runtimeRepresentation!=='STAGED_METADATA_ONLY_NOT_AN_EMPTY_REWARD_EVENT'||
    mei.publicationApproved!==false)
  fail('固定GameWithの非スキル採用事実・非公開条件が不一致');
 const outcomes=mei.resultKinds.map((kind,i)=>{
   const base=mei.results[kind],effects=[];
   for(const [name,value] of Object.entries(base)){
     if(!Object.hasOwn(EFFECT_NAMES,name))fail('未対応の結果効果');
     if(value!==0)effects.push({kind:EFFECT_NAMES[name],delta:value,
      sourceComponent:'event-result'});
   }
   for(const [name,value] of Object.entries(mei.projectLarcAdditionalEffects)){
     if(!Object.hasOwn(EFFECT_NAMES,name))fail('未対応のシナリオ効果');
     effects.push({kind:EFFECT_NAMES[name],delta:value,
      sourceComponent:'scenario-bonus'});
   }
   return {id:kind==='GREAT_SUCCESS'?'great-success':'success',
    label:kind==='GREAT_SUCCESS'?'大成功':'成功',rewards:[],effects};
 });
 const catalog={schemaVersion:1,cards:CARD_IDS.map(cardId=>({
   cardId,coverageStatus:'partial',
   events:[{id:'usl:'+cardId+':larc:overseas-cheer',
    name:mei.title,type:'auto',availabilityKind:'scenario-overseas',
    outcomes:structuredClone(outcomes)}]
 }))};
 const model={cards:CARD_IDS.map(id=>({id})),
  cardById:Object.fromEntries(CARD_IDS.map(id=>[id,{id}])),
  skillById:{}};
 const validated=schema.validateCatalog(catalog,model);
 if(validated.cardsWithRecords!==2||validated.eventsWithRecords!==2)
  fail('R/SSRそれぞれの試作イベント2レコードを保持できない');
 let outcomeRoutes=0,effectRoutes=0;
 for(const card of catalog.cards){
   const runtime={id:card.cardId,hints:[],events:card.events};
   if(core.directRoutes(runtime,{stage:4,choices:{},outcomes:{}}).length!==0)
    fail('非スキル結果をスキルカバレッジへ混入');
   const routes=core.directEffectRoutes(runtime,{choices:{},outcomes:{}});
   if(routes.length!==11||routes.some(r=>!r.conditional||
      !r.condition?.includes('海外')||r.source!=='event-effect'))
    fail('海外の未選択2結果を無条件報酬にしてはいけない');
   effectRoutes+=routes.length;
   outcomeRoutes+=card.events[0].outcomes.length;
 }
 return {
  dataKind:'phase2-two-card-mei-overseas-nonskill-outcome-preview',
  publicationApproved:false,
  noAutomaticRuntimeAdoption:true,
  sourceProseIncluded:false,
  sourceEventFamilyId:mei.eventFamilyId,
  originalSkillOnlyPrivateEventCount:2512,
  catalog,
  summary:{cards:2,previewOnlyEventRecords:2,conditionalOutcomePaths:outcomeRoutes,
   effectComponentRoutes:effectRoutes,skillRoutesAdded:0,publicEventsAdded:0,
   publishedEvents:0}
 };
}
module.exports={preview};
