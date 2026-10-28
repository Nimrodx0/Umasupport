'use strict';
/*
 * Compare a pinned source event's choice / outcome tree with independently
 * visible GameTora DOM structure. This does NOT derive DOM results from source.
 * No original prose, labels, screenshots, HTML or full events leave memory.
 */
const {inspectRenderedChoices}=require('./official_gametora_choice_outcome_semantics.cjs');
const fail=s=>{throw Error('GameTora表示の選択肢と結果の構造: '+s);};
function sourceShape(event){
 if(!Array.isArray(event?.choices)||event.choices.length===0)
  fail('参照イベントに選択肢がない');
 const routes=event.choices.map(ch=>{
  if(!ch||typeof ch.label!=='string')fail('元の選択肢が不正');
  const outcomes=Array.isArray(ch.outcomes)?ch.outcomes:
   Array.isArray(ch.effects)?[ch.effects]:null;
  if(!outcomes||outcomes.length===0||outcomes.some(x=>!Array.isArray(x)))
   fail('元の結果配列が不正');
  return outcomes.length;
 });
 const terminals=event.choices.flatMap((choice,ci)=>{
  const outcomes=Array.isArray(choice.outcomes)?choice.outcomes:[choice.effects];
  return outcomes.flatMap((effects,oi)=>
   effects.some(x=>x?.type==='chain_end')?[{choiceOrdinal:ci+1,resultOrdinal:oi+1}]:[]);
 });
 return {choices:routes.length,routeCounts:routes,terminals};
}
function inspectSiteTopology(event,groups){
 const src=sourceShape(event);
 // The generic existing semantics checker normalizes displayed text only for
 // in-memory label matching and returns no original content.
 const s=inspectRenderedChoices(event,{groups});
 const counts=groups.map(g=>g.routeCandidateCount);
 const separators=groups.map(g=>g.orSeparatorCount);
 const countsAgree=groups.length===src.choices&&counts.length===src.routeCounts.length&&
  counts.every((n,i)=>n===src.routeCounts[i]);
 const separatorAgreement=separators.every((n,i)=>n===src.routeCounts[i]-1);
 const siteTerminalGroups=s.siteTerminalGroupOrdinals;
 const terminalGroupsFromSource=src.terminals
  .filter(t=>src.routeCounts[t.choiceOrdinal-1]===1)
  .map(t=>t.choiceOrdinal);
 const siteTerminalsConsistent=siteTerminalGroups.every(g=>terminalGroupsFromSource.includes(g))&&
  new Set(siteTerminalGroups).size===siteTerminalGroups.length;
 const allTerminalLocationsProven=src.terminals.length>0&&
  terminalGroupsFromSource.length===src.terminals.length&&
  siteTerminalGroups.length===src.terminals.length&&siteTerminalsConsistent;
 return {
  referenceChoiceCount:src.choices,
  observedOuterChoiceGroups:groups.length,
  referenceRouteCountsPerChoice:src.routeCounts,
  observedRouteCountsPerGroup:counts,
  observedOrSeparatorsPerGroup:separators,
  referenceResultRoutes:src.routeCounts.reduce((a,b)=>a+b,0),
  observedResultCandidates:counts.reduce((a,b)=>a+b,0),
  exactChoiceAndVisibleRouteCardinality:countsAgree&&separatorAgreement&&
   s.choiceCardinalityAgrees&&s.alternativeOutcomeStructureAgrees,
  sourceNonemptyLabels:s.nonemptySourceLabels,
  sourceLabelsUniquelyMatchedToVisibleGroups:s.nonemptyChoiceLabelsUnambiguouslyLocated,
  visibleLabelMatches:s.labelMatchCount,
  referenceTerminalRoutes:src.terminals.length,
  visibleExplicitTerminalGroups:siteTerminalGroups.length,
  explicitTerminalGroupsConsistentWithSingleRouteChoices:siteTerminalsConsistent,
  everyTerminalLocationIndependentlyVisible:allTerminalLocationsProven,
  // An OR split demonstrates displayed alternatives, NOT outcome probability.
  gameRandomOutcomeMeaningVerified:false,
  gameNextEventReachabilityVerified:false,
  numericRouteRewardsVerified:false,
  appEventJsonEquivalent:false,
  originalSourceProseExported:false,
  publicationApproved:false
 };
}
module.exports={sourceShape,inspectSiteTopology};
