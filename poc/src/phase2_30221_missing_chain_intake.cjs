'use strict';
/*
 * Card-specific GameWith numeric facts for 30221; not public and not a
 * reconstructed chain graph. The pinned GT has only its two random events.
 * Source check MUST use the correct KFC card, not another Satono Diamond SSR.
 */
const {evaluateException}=require('./event_exception_adjudication.cjs');
const core=require('./core.js');
const schema=require('./event_schema.js');
const SOURCE=require('../data/curation/adjudicated/30221_chain.v1.json');
const fail=s=>{throw Error('SSR30221連続イベント採用: '+s);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(o,keys,label)=>{if(!o||typeof o!=='object'||Array.isArray(o)||
 !same(Object.keys(o).sort(),keys.slice().sort()))fail(label+': 余分または欠損フィールド');};
const GT='https://gametora.com/ja/umamusume/supports/30221-satono-diamond';
const GW='https://gamewith.jp/uma-musume/article/show/461418';
const GTPIN='6e38b54af4fad397ff4491e63007a90705a4fe67';
const CHECKERPIN='8cf9fcb3cc7239041161be75c84daf9f8f22d29f';
const checkerKeys=['checker:30221:96a9b18141d8cf7ce729',
 'checker:30221:142abc4e048db36f56b9',
 'checker:30221:c56290b839ef7bbc1c85'];
const NUMERIC=[
 {effects:[['energy',5],['stamina',5],['bond',5]],hints:[]},
 {effects:[['energy',10],['stamina',5],['bond',5]],hints:[]},
 {effects:[['energy',10],['stamina',5],['bond',5]],hints:[[201351,1]]}
];
const BASE_FIELDS=['schemaVersion','dataKind','cardId','cardTitleIdentity',
 'gameToraBaselineRevision','gameToraBaselineEventIds',
 'gameToraBaselineChainStages','checkerRevision','checkerOnlySourceKeys',
 'gameToraWebsite','gameWith','skillIdentityEvidence','events',
 'game2026Verified','chainRouteVerified','publicationApproved',
 'noAutomaticRuntimeAdoption','sourceProseIncluded'];
const STAGE_FIELDS=['checkerOrdinal','chainStageOrdinal',
 'playerSelectableChoices','numericEffects','skillHints','continuationDecision'];
function audit(doc=SOURCE){
 exact(doc,BASE_FIELDS,'root');
 if(doc.schemaVersion!==1||doc.dataKind!=='phase2-missing-gt-chain-editorial-numeric-adoption'||
 doc.cardId!=='30221'||doc.cardTitleIdentity!=='今日もたのしく、おいしく。'||
 doc.gameToraBaselineRevision!==GTPIN||
 !same(doc.gameToraBaselineEventIds,[107,108])||
 doc.gameToraBaselineChainStages!==0||
 doc.checkerRevision!==CHECKERPIN||
 !same(doc.checkerOnlySourceKeys,checkerKeys)||
 doc.game2026Verified!==false||doc.chainRouteVerified!==false||
 doc.publicationApproved!==false||doc.noAutomaticRuntimeAdoption!==true||
 doc.sourceProseIncluded!==false||!Array.isArray(doc.events)||doc.events.length!==3)
  fail('KFCサトノダイヤモンドの固定ID／収録漏れ／非公開境界が不正');
 exact(doc.gameToraWebsite,['url','checkedAt','status'],'GT');
 exact(doc.gameWith,['url','checkedAt'],'GameWith');
 exact(doc.skillIdentityEvidence,['skillNumericId','skillName','url'],'skill');
 if(doc.gameToraWebsite.url!==GT||doc.gameToraWebsite.status!=='CARD_ONLY'||
 doc.gameToraWebsite.checkedAt!=='2026-10-22'||
 doc.gameWith.url!==GW||doc.gameWith.checkedAt!=='2026-10-22'||
 doc.skillIdentityEvidence.skillNumericId!==201351||
 doc.skillIdentityEvidence.skillName!=='食いしん坊'||
 doc.skillIdentityEvidence.url!==
  'https://xn--gck1f423k.xn--1bvt37a.tools/skills/201351')
 fail('カード別記事またはスキルの数値ID照合先が不正');
 const decisions=[];
 for(const [i,e] of doc.events.entries()){
  const expected=NUMERIC[i],ordinal=i+1;
  exact(e,STAGE_FIELDS,'stage'+ordinal);
  if(e.checkerOrdinal!==ordinal||e.chainStageOrdinal!==ordinal||
  e.playerSelectableChoices!==0||
  e.continuationDecision!==(i<2?'NOT_ESTABLISHED_BY_SOURCE':
   'FINAL_REPORTED_STAGE_NO_NEXT_STAGE')||
  !same(e.numericEffects,expected.effects.map(([kind,value])=>({kind,value})))||
  !same(e.skillHints,expected.hints.map(([skillNumericId,hintLevel])=>
   ({skillNumericId,hintLevel}))))
  fail('GameWith明示数値／Checker順序／連続未確証が不正: '+ordinal);
  const decision=evaluateException({cardId:'30221',sourceEventOrdinal:ordinal,
   baseline:'MISSING',gtWebsite:doc.gameToraWebsite,
   gameWith:{...doc.gameWith,factStatus:'EXPLICIT',facts:{
    playerSelectableChoiceCount:0,reportedEffects:e.numericEffects,
    reportedSkillHints:e.skillHints
   }},proposedDecision:'ADOPT'});
  if(!decision.editorialDecisionComplete||decision.publicationApproved!==false||
   decision.game2026Verified!==false||decision.noAutomaticRuntimeAdoption!==true)
   fail('編集数値を無条件の公開イベントに昇格');
  decisions.push(decision);
 }
 return {policyDecisions:decisions,summary:{
  cardId:'30221',missingGtChainStages:3,
  editoriallyAdoptedChainStages:3,nonSkillNumericEffectFacts:9,
  numericSkillHintFacts:1,checkerOnlyPositionsReused:3,
  newlyDiscoveredEventsOutsideBothSources:0,
  verifiedContinuationEdges:0,publicEvents:0,
  chainRouteVerified:false,game2026Verified:false,
  publicationApproved:false,noAutomaticRuntimeAdoption:true
 }};
}
function replay({stageOrdinal,observed}={},{document=SOURCE,model=null}={}){
 audit(document);
 if(!Number.isSafeInteger(stageOrdinal)||stageOrdinal<1||stageOrdinal>3||
 typeof observed!=='boolean')fail('連続段階と明示的な手動到達確認が必要');
 const base={cardId:'30221',stageOrdinal,manualStageAssertionOnly:true,
  chainRouteVerified:false,publicationApproved:false,
  game2026Verified:false,noAutomaticRuntimeAdoption:true};
 if(!observed)return {...base,status:'STAGE_NOT_ASSERTED',routes:[]};
 const data=document.events[stageOrdinal-1];
 const event={id:'nonpublic_manually_reached_30221_chain_'+stageOrdinal,
  name:'非公開・手動到達の連続段階'+stageOrdinal,type:'auto',
  rewards:data.skillHints.map(h=>({skillId:'skill:'+h.skillNumericId,
   level:h.hintLevel}))};
 if(model)schema.validateCatalog({schemaVersion:1,cards:[{
  cardId:'30221',coverageStatus:'partial',events:[event]
 }]},model);
 const raw=core.directRoutes({id:'30221',hints:[],events:[event]},
  {stage:4,choices:{},outcomes:{}});
 return {...base,status:'MANUAL_STAGE_REPLAY',
  routes:raw.filter(x=>x.source==='event').map(x=>({...x,
   conditional:true,condition:'MANUALLY_ASSERTED_STAGE_REACHED',
   manualStageAssertionOnly:true}))};
}
module.exports={audit,replay};
