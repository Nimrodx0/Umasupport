'use strict';
/**
 * Conservative semantics for a single rendered GameTora support-card event.
 * Compares choice labels and visible OR separators against a historical
 * reference, which is evidence only, NEVER an origin for missing site facts.
 * Does not return any source prose or publish data.
 */
const fail=s=>{throw Error('GameTora元サイト選択肢・結果分岐: '+s);};
const norm=s=>String(s).normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
const TERMINAL=/(?:連続イベント|連続イベ|イベントチェーン|連続.*イベント).{0,10}(?:打ち切り|終了|中断|発生しない)|(?:打ち切り|終了|中断).{0,10}(?:連続イベント|連続イベ|イベントチェーン)/;
const OUTCOME=/^(?:成功|失敗|大成功|成功時|失敗時|大成功時|success|failure|great success)$/i;
function inspectRenderedChoices(event,observation){
 if(!event||!Array.isArray(event.choices)||event.choices.length===0||
    !observation||!Array.isArray(observation.groups)||
    observation.groups.length>20||
    observation.groups.some(g=>!g||typeof g.visibleText!=='string'||
     g.visibleText.length>3000||!Array.isArray(g.ownTextFragments)||
     g.ownTextFragments.length>100||g.ownTextFragments.some(t=>typeof t!=='string'||t.length>250)||
     !Number.isSafeInteger(g.orSeparatorCount)||g.orSeparatorCount<0||
     !Number.isSafeInteger(g.routeCandidateCount)||g.routeCandidateCount<1))
  fail('単一イベントの元・画面構造が不正');
 const expected=event.choices;
 const sourceChoiceCount=expected.length;
 const sourceOutcomeRoutes=expected.reduce((n,c)=>n+(Array.isArray(c.outcomes)?c.outcomes.length:1),0);
 const referenceExplicitTerminalChoices=expected.map((c,i)=>({
  index:i+1,sourceHasChainEnd:Array.isArray(c.effects)&&c.effects.some(x=>x?.type==='chain_end')||
   Array.isArray(c.outcomes)&&c.outcomes.some(route=>Array.isArray(route)&&route.some(x=>x?.type==='chain_end'))
 }));
 const siteLabels=expected.map((c,i)=>{
  if(typeof c.label!=='string')fail('元選択肢名称が不正');
  if(!norm(c.label))return {sourceChoiceOrdinal:i+1,status:'implicit-empty-label'};
  const matches=observation.groups.map((g,idx)=>norm(g.visibleText).includes(norm(c.label))?idx+1:null).filter(Boolean);
  return {sourceChoiceOrdinal:i+1,status:matches.length===1?'one-matching-site-group':
   matches.length===0?'label-not-found':'ambiguous-multiple-groups',
   // Only group ordinal, NOT the name/choice text.
   matchedVisibleGroup:matches.length===1?matches[0]:null};
 });
 const nonempty=siteLabels.filter(x=>x.status!=='implicit-empty-label');
 const allNonemptyLabelsUniquelyMatched=nonempty.every(x=>x.status==='one-matching-site-group')&&
  new Set(nonempty.map(x=>x.matchedVisibleGroup)).size===nonempty.length;
 const possibleOr=observation.groups.map((g,i)=>({group:i+1,or:g.orSeparatorCount,routeCandidates:g.routeCandidateCount}))
  .filter(x=>x.or>0);
 const visibleOrSeparators=possibleOr.reduce((n,x)=>n+x.or,0);
 const sourceHasAlternativeOutcomes=expected.some(c=>Array.isArray(c.outcomes)&&c.outcomes.length>1);
 const siteExplicitOutcomeLabels=observation.groups.reduce((n,g)=>
  n+g.ownTextFragments.filter(x=>OUTCOME.test(x.trim())).length,0);
 const visibleTerminalGroups=observation.groups.flatMap((g,i)=>
  g.ownTextFragments.some(x=>TERMINAL.test(x))?[i+1]:[]);
 const countAgreement=sourceChoiceCount===observation.groups.length;
 const alternativeAgreement=sourceHasAlternativeOutcomes&&visibleOrSeparators>0&&
  observation.groups.reduce((n,x)=>n+x.routeCandidateCount,0)===sourceOutcomeRoutes;
 // Site can show the branching layout without explaining what causes it.
 const sourceTerminalCount=referenceExplicitTerminalChoices.filter(x=>x.sourceHasChainEnd).length;
 const observedTerminalRouteBindingVerified=false;
 return {
  sourceChoiceCount,visibleTopLevelGroups:observation.groups.length,
  sourceOutcomeRoutes,visibleCandidateRoutes:observation.groups.reduce((n,x)=>n+x.routeCandidateCount,0),
  sourceHasAlternativeOutcomes,
  sourceRandomEitherChoices:expected.filter(c=>c.random_either===true).length,
  visibleOrSeparators,siteExplicitOutcomeLabels,
  sourceTerminalCount,siteExplicitTerminalGroups:visibleTerminalGroups.length,
  labelStatuses:siteLabels.map(x=>x.status),
  labelMatchCount:siteLabels.filter(x=>x.status==='one-matching-site-group').length,
  nonemptySourceLabels:nonempty.length,
  choiceCardinalityAgrees:countAgreement,
  nonemptyChoiceLabelsUnambiguouslyLocated:allNonemptyLabelsUniquelyMatched,
  alternativeOutcomeStructureAgrees:sourceHasAlternativeOutcomes?alternativeAgreement:
   visibleOrSeparators===0&&sourceOutcomeRoutes===sourceChoiceCount,
  sourceTerminalHasOfficialVisibleEvidence:sourceTerminalCount===0?null:visibleTerminalGroups.length>0,
  // These must be proven separately. A page may omit chain-end and odds.
  randomOutcomeMeaningVerified:false,
  observedTerminalRouteBindingVerified,
  nextStageDependenceVerified:false,
  everySourceChoiceMeaningVerified:false,
  originalSiteRightsReviewed:false,
  publicationApproved:false
 };
}
module.exports={inspectRenderedChoices};
