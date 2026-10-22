'use strict';
/*
 * GT 30080 event 6 collapsed three selectable responses into an empty-label
 * single row. Canonical editorial exception is GameWith event article 315701.
 * This is a standalone *non-public* skill-route projection, never deployed
 * as a runtime catalog and never evidence of game-current correctness.
 */
const source=require('../data/curation/adjudicated/30080_choice_repair.v1.json');
const policy=require('./event_exception_adjudication.cjs');
const schema=require('./event_schema.js');
const {get30080SourceChoiceGap}=require('./phase2_completeness_exception_queue.cjs');
const core=require('./core.js');
const fail=s=>{throw Error('30080非公開3択構造補正: '+s);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const expected={
 cardId:'30080',revision:'6e38b54af4fad397ff4491e63007a90705a4fe67',
 gameTora:'https://gametora.com/ja/umamusume/supports/30080-sasami-anshinzawa',gameWith:'https://gamewith.jp/uma-musume/article/show/315701',
 corroborator:'https://game8.jp/umamusume/421771',
 events:[[1,201591,3],[2,201591,3],[3,201591,3]]
};
function exact(o,keys,where){
 if(!o||typeof o!=='object'||Array.isArray(o)||
    !same(Object.keys(o).sort(),[...keys].sort()))
  fail(where+': フィールドの増減を拒否');
}
function validate(doc=source){
 exact(doc,['schemaVersion','dataKind','cardId','sourceGameToraRevision',
  'sourceEventOrdinal','sourceEventLocalId','checkerEventOrdinal',
  'baselineStoredChoiceCount','playerSelectableChoiceCount',
  'gameToraWebsite','gameWith','corroboratingArticle','rewardInterpretation',
  'externalAppearanceConditionExcluded','currentGameplayVerified',
  'publicationApproved','sourceProseIncluded','noAutomaticRuntimeAdoption',
  'choices'],'root');
 exact(doc.gameToraWebsite,['url','checkedAt','status'],'GTページ');
 exact(doc.gameWith,['url','checkedAt','factStatus'],'GameWith記事');
 if(doc.schemaVersion!==1||
  doc.dataKind!=='gt-source-three-choice-topology-editorial-repair'||
  doc.cardId!==expected.cardId||doc.sourceGameToraRevision!==expected.revision||
  doc.sourceEventOrdinal!==6||doc.sourceEventLocalId!==1392||
  doc.checkerEventOrdinal!==5||doc.baselineStoredChoiceCount!==1||
  doc.playerSelectableChoiceCount!==3||
  doc.gameToraWebsite.url!==expected.gameTora||
  doc.gameToraWebsite.checkedAt!=='2026-10-22'||
  doc.gameToraWebsite.status!=='EVENT_DETAIL_UNCONFIRMED'||
  doc.gameWith.url!==expected.gameWith||
  doc.gameWith.checkedAt!=='2026-10-22'||
  doc.gameWith.factStatus!=='EXPLICIT'||
  doc.corroboratingArticle!==expected.corroborator||
  doc.rewardInterpretation!=='SAME_HINT_IN_EACH_SEPARATE_PLAYER_CHOICE'||
  doc.externalAppearanceConditionExcluded!==true||
  doc.currentGameplayVerified!==false||doc.publicationApproved!==false||
  doc.sourceProseIncluded!==false||doc.noAutomaticRuntimeAdoption!==true||
  !Array.isArray(doc.choices)||doc.choices.length!==3)
  fail('元固定GT1行・GameWith3択・正式非公開の採用契約違反');
 for(const [i,row] of doc.choices.entries()){
  exact(row,['ordinal','skillHints','reportedVariableEffects',
   'resultBranchesReported','choiceAvailabilityConditionVerified',
   'publicationApproved'],'選択肢'+(i+1));
  const expectedHint=expected.events[i];
  if(row.ordinal!==expectedHint[0]||
   !same(row.skillHints,[{skillNumericId:expectedHint[1],
      hintLevel:expectedHint[2]}])||
   !same(row.reportedVariableEffects,{
    energyRange:[10,16],randomStatCount:2,
    randomStatGainRange:[10,15],bond:5
   })||row.resultBranchesReported!==false||
   row.choiceAvailabilityConditionVerified!==false||
   row.publicationApproved!==false)
   fail('独立記事の選択位置・範囲数値・スキルID/Lvが異なる');
 }
 const audited=get30080SourceChoiceGap();
 if(audited.sourceOrdinal!==doc.sourceEventOrdinal||
  audited.checkerOrdinal!==doc.checkerEventOrdinal||
  audited.gameToraChoices!==doc.baselineStoredChoiceCount||
  audited.checkerChoices!==doc.playerSelectableChoiceCount||
  audited.gameToraLocalEventId!==doc.sourceEventLocalId||
  audited.hintSkillId!==201591||audited.hintValue!=='+3'||
  audited.sourceUrl!==doc.gameWith.url||
  audited.independentEditorialUrl!==doc.corroboratingArticle||
  !same(audited.editorialNumericChoices,doc.choices.map(c=>
    [c.ordinal,c.skillHints[0].skillNumericId,c.skillHints[0].hintLevel])))
  fail('既存GT・Checker例外の固定数値候補と不一致');
 const decision=policy.evaluateException({
  cardId:'30080',sourceEventOrdinal:6,baseline:'DISPUTED',
  // Page is checked, but its *specific event detail* is NOT asserted.
  gtWebsite:{url:doc.gameToraWebsite.url,checkedAt:doc.gameToraWebsite.checkedAt,
   status:'CARD_ONLY'},
  gameWith:{url:doc.gameWith.url,checkedAt:doc.gameWith.checkedAt,
   factStatus:'EXPLICIT',facts:{
    playerSelectableChoiceCount:3,
    reportedEffects:[], // Reported values are ranges, not exact single-point rewards.
    reportedSkillHints:doc.choices.flatMap(c=>c.skillHints)
   }},proposedDecision:'ADOPT'
 });
 if(decision.status!=='GAMEWITH_ADJUDICATED_GT_DISPUTE'||
    !decision.editorialDecisionComplete||decision.publicationApproved!==false)
  fail('共通GameWith裁定契約に合格しない');
 return {doc,decision};
}
function build(doc=source,{model=null}={}){
 const checked=validate(doc);
 const id='editorial_30080_6_three_real_choices';
 const event={id,name:'イベントの独立3択候補',type:'choice',
  choices:doc.choices.map(c=>({
   id:'option'+c.ordinal,label:'選択位置'+c.ordinal,
   rewards:c.skillHints.map(h=>({
    skillId:'skill:'+h.skillNumericId,level:h.hintLevel
   }))
  }))};
 const catalog={schemaVersion:1,cards:[{
  cardId:'30080',coverageStatus:'partial',events:[event]
 }]};
 if(model)schema.validateCatalog(catalog,model);
 return {provisionalCatalog:catalog,editorialDecision:checked.decision,
  summary:{sourceGTOptions:1,adoptedSelectableAlternatives:3,
   adoptedHintFacts:3,sourceCard:'30080',sourceEventOrdinal:6,
   publicEvents:0,game2026Verified:false,publicationApproved:false,
   noAutomaticRuntimeAdoption:true}};
}
function replay(optionOrdinal=null,{doc=source,model=null}={}){
 if(optionOrdinal!==null&&(!Number.isSafeInteger(optionOrdinal)||
    optionOrdinal<1||optionOrdinal>3))fail('存在しない選択肢位置');
 const out=build(doc,{model});
 const e=out.provisionalCatalog.cards[0].events[0];
 const choices=optionOrdinal===null?{}:{[e.id]:'option'+optionOrdinal};
 const routes=core.directRoutes({id:'30080',hints:[],events:[e]},
  {stage:4,choices,outcomes:{}})
  .filter(route=>route.source==='event')
  .map(route=>({...route,conditional:true,
   condition:'EDITORIAL_CHOICE_FACT_NOT_PUBLICLY_APPROVED',
   editorialCandidate:true}));
 return {selectedOptionOrdinal:optionOrdinal,routes,
  publicEvents:0,publicationApproved:false,game2026Verified:false,
  noAutomaticRuntimeAdoption:true};
}
module.exports={validate,build,replay};
