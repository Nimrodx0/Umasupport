'use strict';
/*
 * Option-based chain PLANNING only. Keep two distinct claims apart:
 * (a) in the absence of an explicit cutoff, ordinary progression is the
 * default plan under the established GT/GameWith source policy;
 * (b) this does NOT verify 17 individual edge outcomes or guarantee that
 * an event will randomly trigger during a real training run.
 *
 * All derived skill routes remain prospects, never awarded facts.
 */
const {build:reviewed}=require('./phase2_chain_pages_preview_artifact.cjs');
const POLICY=require('../data/curation/phase2_five_chain_continuation_policy.v1.json');
const fail=s=>{throw Error('連続イベントの通常継続計画: '+s);};
const ALLOWED=['30318','30319','30320','30321','30221'];
function build(){
 const base=reviewed();
 if(base.schemaVersion!==1||
    base.dataKind!=='phase2-twelve-manual-chain-stage-browser-review'||
    base.previewOnly!==true||base.formallyApproved!==false||
    base.unresolvedPossibleTransitions!==17||
    base.inferredChainTransitions!==0||
    !Array.isArray(base.cards)||base.cards.length!==5||
    POLICY.schemaVersion!==1||
    POLICY.dataKind!=='phase2-five-ssr-chain-ordinary-continuation-planning-policy'||
    POLICY.publicationApproved!==false||
    POLICY.chainTopologyProven!==false||
    POLICY.actualEventOccurrenceGuaranteed!==false||
    POLICY.policyBasis!=='docs/gametora-baseline-event-policy-20261021.md'||
    !Array.isArray(POLICY.cards)||POLICY.cards.length!==5)
  fail('参照した5サポカ・未確定17経路・方針が変更されました');
 const seen=new Set();
 let paths=0,stages=0,alts=0,hints=0;
 const cards=base.cards.map((card,i)=>{
  const policy=POLICY.cards[i];
  if(card.cardId!==ALLOWED[i]||policy.cardId!==card.cardId||
     seen.has(card.cardId)||policy.explicitTerminationReportedInReviewedArticle!==false||
     !Array.isArray(policy.expectedFirstTwoStageOptionCounts)||
     policy.expectedFirstTwoStageOptionCounts.length!==2||
     !Array.isArray(card.events)||card.events.length!==3)
   fail('サポカ個別の通常継続根拠が照合できません');
  seen.add(card.cardId);
  if(card.events.some(e=>e.sourceUrl!==policy.sourceUrl||
     !Array.isArray(e.alternatives)||e.alternatives.length!==(e.choiceCount||1)||
     e.manualReachedRequired!==true||e.priorStageDependenceVerified!==false))
   fail('出典記事・元イベント状態と通常継続の既存UIが不一致');
  const events=card.events.map((e,stage)=>{
   stages++;alts+=e.alternatives.length;
   hints+=e.alternatives.reduce((n,x)=>n+x.hints.length,0);
   if(stage<2&&e.choiceCount!==policy.expectedFirstTwoStageOptionCounts[stage])
    fail('GameWithに記載された第1/第2段階の選択数と一致しません');
   const edges=stage===2?[]:e.alternatives.map(a=>{
    paths++;
    return {
     choiceId:a.id,nextStageId:card.events[stage+1].id,
     continuation:'ORDINARY_DEFAULT_NO_EXPLICIT_CUTOFF',
     individuallyVerified:false,terminationReported:false,
     nextEventOccurrenceGuaranteed:false
    };
   });
   return {
    id:e.id,title:e.title,ordinal:e.ordinal,choiceCount:e.choiceCount,
    sourceUrl:e.sourceUrl,
    alternatives:e.alternatives,
    nextStageEdges:edges
   };
  });
  return {cardId:card.cardId,name:card.name,events};
 });
 if(stages!==15||alts!==22||hints!==9||paths!==17||
    seen.size!==5)
  fail('5枚15段階22結果行9ヒント17通常継続候補の母数不整合');
 return {
  schemaVersion:1,dataKind:'phase2-five-chain-ordinary-default-planning-preview',
  previewOnly:true,publicationApproved:false,
  sourceNarrativeOrChoiceProseIncluded:false,
  planUsesOrdinaryContinuationDefault:true,
  verifiedIndividualContinuations:0,
  plannedDefaultContinuations:17,
  eventOccurrenceGuaranteed:false,
  explicitTerminalBranchesInSelectedEvidence:0,
  manualStageArrivalRequired:false,
  status:'PROSPECTIVE_SKILLS_ONLY',
  cards
 };
}
module.exports={build};
