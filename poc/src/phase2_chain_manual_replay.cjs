'use strict';
/*
 * Manual, one-stage-at-a-time replay of the four GT-snapshot-missing SSRs.
 * This is NOT a complete chained-event graph and NOT a publishing adapter.
 * The caller must explicitly assert that this precise stage was observed/reached.
 * It never treats missing continuation/terminal evidence as affirmative proof.
 */
const core=require('./core.js');
const schema=require('./event_schema.js');
const {build:reviewRemaining}=require('./phase2_remaining_ssr_intake.cjs');
const {build:review30321}=require('./phase2_editorial_intake.cjs');
const {validate:validateLedger}=require('./phase2_adjudicated_fact_intake.cjs');
const REMAINING=require('../data/curation/adjudicated/30318-30320.v1.json');
const DURAMENTE=require('../data/curation/adjudicated/30321.v1.json');
const LEDGER=require('../data/curation/adjudicated_event_facts.v1.json');
const fail=s=>{throw Error('4SSR連続段階・手動到達再現: '+s);};
const PENDING='NOT_ESTABLISHED_BY_SOURCE';
const HINT_CONDITION='MANUALLY_ASSERTED_STAGE_REACHED_NOT_VERIFIED_CHAIN_ROUTE';
function audit({remaining=REMAINING,duramente=DURAMENTE,ledger=LEDGER}={}){
 const a=reviewRemaining(remaining);
 const b=review30321(duramente);
 const central=validateLedger(ledger); // independent intake <-> central ledger gate
 if(a.summary.editoriallyAdoptedEvents!==15||
    b.summary.editoriallyAdoptedEvents!==5||
    central.adoptedNumericalEvents!==20||central.publishedEvents!==0)
  fail('固定20イベントの数値台帳と非公開ゲートが不整合');
 const cards=[...remaining.cards,{cardId:duramente.cardId,
  gameToraWebsite:duramente.gameToraWebsite,gameWith:duramente.gameWith,
  events:duramente.events}];
 if(cards.length!==4)fail('対象カード数');
 const evidence=[],transitions=[],byId=new Map();
 let hints=0,alternatives=0;
 for(const card of cards){
  if(byId.has(card.cardId)||card.events.length!==5)
   fail('固定4SSRのカード・イベント位置が不正');
  byId.set(card.cardId,card);
  for(let i=0;i<3;i++){
   const e=card.events[i],alternates=e.alternatives;
   if(e.ordinal!==i+1||e.section!=='CHAIN'||
      e.chainPrerequisitesVerified!==false||
      !Array.isArray(alternates)||alternates.length!==(e.choiceCount||1))
    fail(card.cardId+'/'+(i+1)+': 前段未確認を解除できない');
   hints+=alternates.reduce((n,x)=>n+x.skillHints.length,0);
   alternatives+=alternates.length;
   evidence.push({
    cardId:card.cardId,stageOrdinal:i+1,
    reportedPlayerSelectableChoices:e.choiceCount,
    reportedAlternativeRows:alternates.length,
    numericSkillHintFacts:alternates.reduce((n,x)=>n+x.skillHints.length,0),
    checkedGameToraPage:card.gameToraWebsite.url,
    checkedGameWithArticle:card.gameWith.url,
    isFinalReportedStage:i===2,
    priorStageDependenceVerified:false,
    terminalSemanticsVerified:false
   });
   // This explicitly enumerates both continuation AND termination as UNKNOWN.
   if(i<2)for(const alt of alternates){
    transitions.push({cardId:card.cardId,stageOrdinal:i+1,
     reportedAlternativeOrdinal:alt.ordinal,nextStageOrdinal:i+2,
     continuationStatus:PENDING,terminationStatus:PENDING,
     sourceHasNoExplicitPerAlternativeRouteClaim:true});
   }
  }
 }
 if(evidence.length!==12||transitions.length!==15||
    alternatives!==19||hints!==8)
  fail('12連続段階・19結果行・15前段経路・8ヒントの母数不一致');
 return {cards:byId,evidence,transitions,summary:{
  sourceCards:4,chainStages:12,reportedChainAlternatives:19,
  unresolvedPossibleTransitions:15,establishedTransitions:0,
  numericChainSkillHintFacts:8,nonPublicRandomEventDrafts:8,
  publicEvents:0,chainDependenciesVerified:false,
  currentGameplayVerified:false,publicationApproved:false,
  noAutomaticRuntimeAdoption:true
 }};
}
function replay({cardId,stageOrdinal,observed,selectedOptionOrdinal=null}={},
 {model=null,sources}={}){
 const audited=audit(sources);
 if(typeof cardId!=='string'||!audited.cards.has(cardId)||
    !Number.isSafeInteger(stageOrdinal)||stageOrdinal<1||stageOrdinal>3||
    typeof observed!=='boolean')
  fail('固定カード・段階・明示的到達確認が必要');
 const source=audited.cards.get(cardId).events[stageOrdinal-1];
 if(!observed&&selectedOptionOrdinal!==null)
  fail('段階が未確認なのに選択を適用できない');
 if(source.choiceCount===0&&selectedOptionOrdinal!==null)
  fail('選択肢なしの段階に選択を捏造できない');
 if(source.choiceCount>0&&selectedOptionOrdinal!==null&&
   (!Number.isSafeInteger(selectedOptionOrdinal)||selectedOptionOrdinal<1||
    selectedOptionOrdinal>source.choiceCount))
  fail('選択肢位置が出典の範囲外');
 const base={cardId,stageOrdinal,manuallyAssertedStageReached:observed,
  selectedOptionOrdinal,chainDependenciesVerified:false,
  game2026Verified:false,publicationApproved:false,noAutomaticRuntimeAdoption:true};
 if(!observed)return {...base,status:'STAGE_NOT_ASSERTED',routes:[]};
 const eventId='nonpublic_manually_reached_'+cardId+'_chain_'+stageOrdinal;
 const toReward=a=>a.skillHints.map(h=>({
  skillId:'skill:'+h.skillNumericId,level:h.hintLevel
 }));
 const event=source.choiceCount===0?
  {id:eventId,name:'手動到達・連続段階'+stageOrdinal,type:'auto',
   rewards:toReward(source.alternatives[0])}:
  {id:eventId,name:'手動到達・連続段階'+stageOrdinal,type:'choice',
   choices:source.alternatives.map(a=>({
    id:'option'+a.ordinal,label:'選択位置'+a.ordinal,
    rewards:toReward(a)
   }))};
 // Validate only an ephemeral event, never export a chain whose topology
 // could be mistakenly interpreted as reviewed/complete.
 if(model)schema.validateCatalog({schemaVersion:1,cards:[
  {cardId,coverageStatus:'partial',events:[event]}
 ]},model);
 const choices=selectedOptionOrdinal===null?{}:
  {[eventId]:'option'+selectedOptionOrdinal};
 const raw=core.directRoutes({id:cardId,hints:[],events:[event]},
  {stage:4,choices,outcomes:{}});
 const routes=raw.filter(x=>x.source==='event').map(x=>({
  ...x,conditional:true,condition:HINT_CONDITION,
  manualStageAssertionOnly:true
 }));
 return {...base,status:source.choiceCount>0&&selectedOptionOrdinal===null?
  'AWAITING_MANUAL_CHOICE':'MANUAL_STAGE_REPLAY',
  routes};
}
module.exports={audit,replay,PENDING,HINT_CONDITION};
