'use strict';
/*
 * SSR30240 is absent from pinned GT chain and Checker. GameWith lists
 * "迅速果断" among event skills but the actual event table says "検証中".
 * Its stage numeric values are NOT GameWith-adjudicated. U-tools alone
 * reports the 3 numeric stages. Allow only an explicitly hypothetical
 * one-stage-at-a-time simulation, NEVER a released event or a linked chain.
 */
const {evaluateException}=require('./event_exception_adjudication.cjs');
const {FROZEN}=require('./phase2_30240_independent_chain_numeric_review.cjs');
const schema=require('./event_schema.js');
const core=require('./core.js');
const ORIGINAL=require('../data/curation/adjudicated/30240_gamewith_gap.v1.json');
const fail=s=>{throw Error('30240/GameWith欠損隔離: '+s);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(obj,keys,where)=>{
 if(!obj||typeof obj!=='object'||Array.isArray(obj)||
    !same(Object.keys(obj).sort(),[...keys].sort()))
  fail(where+': 追加または欠落フィールド');
};
const EXPECTED_STAGES=[
 {ordinal:1,effects:[{kind:'stamina',value:15},{kind:'bond',value:5}],hintCandidates:[]},
 {ordinal:2,effects:[{kind:'stamina',value:15},{kind:'bond',value:5}],hintCandidates:[]},
 {ordinal:3,effects:[{kind:'stamina',value:15},{kind:'bond',value:5}],
  hintCandidates:[{skillNumericId:200591,hintLevel:1}]}
];
const MISSING=['STAGE_AND_CHOICE_IDENTITY','STAGE_NUMERIC_EFFECTS',
 'SKILL_HINT_LEVEL_AND_STAGE','PRIOR_STAGE_BRANCH_AND_TERMINATION'];
const GT='https://gametora.com/ja/umamusume/supports/30240-jungle-pocket';
const GW='https://gamewith.jp/uma-musume/article/show/490549';
const UTOOLS='https://xn--gck1f423k.xn--1bvt37a.tools/supports/30240/event';
const NONE='NOT_ESTABLISHED_BY_SOURCE';
const UNVERIFIED='UNADJUDICATED_U_TOOLS_SINGLE_EDITORIAL_SOURCE';
function audit(doc=ORIGINAL){
 exact(doc,['schemaVersion','dataKind','cardId','cardEdition',
  'baselineRevision','baselineRandomLocalIds','baselineChainStageCount',
  'checkerRevision','checkerEventCount','gameToraWebsite','gameWith',
  'corroboration','currentEditorialDecision','unresolvedRequiredFacts',
  'sourceProseIncluded','publicationApproved','game2026Verified',
  'noAutomaticRuntimeAdoption'],'root');
 exact(doc.gameToraWebsite,['url','checkedAt','status'],'GameTora');
 exact(doc.gameWith,['url','checkedAt','factStatus','eventSection',
  'reportedTrainingEventSkillName','reportedPerStageEffectNumbers',
  'reportedHintLevel','reportedRouteTopology'],'GameWith');
 exact(doc.corroboration,['source','url','independentEditorialFamilies',
  'reportedStages','playerSelectableChoiceCountVerified',
  'predecessorConditionsVerified','branchTerminationVerified',
  'skillHintAcquisitionVerified'],'U-tools');
 if(doc.schemaVersion!==1||
  doc.dataKind!=='unresolved-gamewith-numeric-facts-and-utools-only-chain-candidate'||
  doc.cardId!=='30240'||doc.cardEdition!=='『最強は俺だ！！』'||
  doc.baselineRevision!=='6e38b54af4fad397ff4491e63007a90705a4fe67'||
  !same(doc.baselineRandomLocalIds,[167,168])||
  doc.baselineChainStageCount!==0||
  doc.checkerRevision!=='8cf9fcb3cc7239041161be75c84daf9f8f22d29f'||
  doc.checkerEventCount!==0||
  doc.gameToraWebsite.url!==GT||
  doc.gameToraWebsite.checkedAt!=='2026-10-22'||
  doc.gameToraWebsite.status!=='CARD_ONLY'||
  doc.gameWith.url!==GW||doc.gameWith.checkedAt!=='2026-10-22'||
  doc.gameWith.factStatus!=='NOT_LISTED'||
  doc.gameWith.eventSection!=='UNDER_VERIFICATION'||
  doc.gameWith.reportedTrainingEventSkillName!=='迅速果断'||
  doc.gameWith.reportedPerStageEffectNumbers!==false||
  doc.gameWith.reportedHintLevel!==false||
  doc.gameWith.reportedRouteTopology!==false||
  doc.corroboration.source!=='U-tools'||
  doc.corroboration.url!==UTOOLS||
  doc.corroboration.independentEditorialFamilies!==1||
  doc.corroboration.playerSelectableChoiceCountVerified!==false||
  doc.corroboration.predecessorConditionsVerified!==false||
  doc.corroboration.branchTerminationVerified!==false||
  doc.corroboration.skillHintAcquisitionVerified!==false||
  doc.currentEditorialDecision!=='PENDING_GAMEWITH_REQUIRED_EVENT_FACTS'||
  !same(doc.unresolvedRequiredFacts,MISSING)||
  doc.sourceProseIncluded!==false||doc.publicationApproved!==false||
  doc.game2026Verified!==false||doc.noAutomaticRuntimeAdoption!==true)
  fail('固定カード・掲載範囲・未裁定／非公開フラグに矛盾');
 if(FROZEN.cardId!=='30240'||FROZEN.externalSource!==UTOOLS||
  FROZEN.editorialSourceFamilies!==1||
  !same(FROZEN.fixedRandomEventIds,[167,168])||
  FROZEN.skillNameId!==200591||
  !same(doc.corroboration.reportedStages,EXPECTED_STAGES)||
  !same(FROZEN.independentNumericalStages.map(x=>({
   ordinal:x.ordinal,
   effects:Object.entries(x.statTypes).map(([kind,value])=>({kind,value})),
   hintCandidates:x.hint.map(([skillNumericId,hintLevel])=>({skillNumericId,hintLevel}))
  })),EXPECTED_STAGES))
  fail('既存の固定U-tools数値監査と一致しない');
 const decisions=[];
 for(let ordinal=1;ordinal<=3;ordinal++){
  const d=evaluateException({
   cardId:'30240',sourceEventOrdinal:ordinal,baseline:'MISSING',
   gtWebsite:doc.gameToraWebsite,
   gameWith:{url:doc.gameWith.url,checkedAt:doc.gameWith.checkedAt,
    factStatus:'NOT_LISTED'},
   proposedDecision:'PENDING',
   holdReason:'GAMEWITH_DOES_NOT_REPORT_REQUIRED_FACT'
  });
  if(d.editorialDecisionComplete!==false||d.publicationApproved!==false||
    d.noAutomaticRuntimeAdoption!==true||
    d.holdReason!=='GAMEWITH_DOES_NOT_REPORT_REQUIRED_FACT')
   fail('GameWithにない具体的数値を採用済みに偽装');
  decisions.push(d);
 }
 return {policyDecisions:decisions,summary:{
  cardId:'30240',missingFromBothPinnedEventSources:3,
  candidateStagesFromUTools:3,unreviewedSkillHintCandidates:1,
  gameWithAdoptedNumericStageFacts:0,unresolvedGameWithStages:3,
  verifiedChoiceAndChainPaths:0,publicEvents:0,
  game2026Verified:false,publicationApproved:false,
  noAutomaticRuntimeAdoption:true
 }};
}
function simulate({stageOrdinal,assumedStageReachedForSimulation=false,
 enableUnadjudicatedCandidateReplay=false}={},{document=ORIGINAL,model=null}={}){
 audit(document);
 if(!Number.isSafeInteger(stageOrdinal)||stageOrdinal<1||stageOrdinal>3||
  typeof assumedStageReachedForSimulation!=='boolean'||
  typeof enableUnadjudicatedCandidateReplay!=='boolean')
  fail('範囲外の段階または明示的シミュレーション指定不正');
 const base={cardId:'30240',stageOrdinal,gameWithFactStatus:NONE,
  sourceKind:UNVERIFIED,manualStageAssertionOnly:true,
  game2026Verified:false,publicationApproved:false,
  noAutomaticRuntimeAdoption:true};
 if(!assumedStageReachedForSimulation||!enableUnadjudicatedCandidateReplay)
  return {...base,status:'NO_REPLAY_WITHOUT_TWO_EXPLICIT_OPT_INS',routes:[]};
 const source=document.corroboration.reportedStages[stageOrdinal-1];
 const event={id:'private_unadjudicated_30240_chain_'+stageOrdinal,
  name:'数値仮説'+stageOrdinal,type:'auto',
  rewards:source.hintCandidates.map(h=>({
   skillId:'skill:'+h.skillNumericId,level:h.hintLevel
  }))};
 if(model)schema.validateCatalog({schemaVersion:1,cards:[{
  cardId:'30240',coverageStatus:'partial',events:[event]
 }]},model);
 const actual=core.directRoutes({id:'30240',hints:[],events:[event]},
  {stage:4,choices:{},outcomes:{}});
 return {...base,status:'UNADJUDICATED_HYPOTHETICAL_REPLAY',
  routes:actual.filter(x=>x.source==='event').map(x=>({
   ...x,conditional:true,possibleOnly:true,
   sourceKind:UNVERIFIED,manualStageAssertionOnly:true
  }))};
}
module.exports={audit,simulate,UNVERIFIED,NONE};
