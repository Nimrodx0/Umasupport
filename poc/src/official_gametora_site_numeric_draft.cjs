'use strict';
/*
 * Stage 1 of direct GameTora -> UmaSupport conversion: observed site-only
 * numeric effects and visible grouping, in memory. This is NOT a valid public
 * event catalog: user choices, rewards/IDs, and chain dependencies remain
 * unverified. No historical GT values or third-party prose are inputs.
 */
const {parseNumericFactWithLocalContext}=require('./official_gametora_existing_normalized_parity.cjs');
const KINDS=new Set(['speed','stamina','power','guts','wisdom','energy','max_energy',
 'skill_points','mood','bond']);
const STOP=/(?:連続イベント|連続イベ|イベントチェーン|連続.*イベント).{0,10}(?:打ち切り|終了|中断|発生しない)|(?:打ち切り|終了|中断).{0,10}(?:連続イベント|連続イベ|イベントチェーン)/;
const error=code=>{throw Error('GameTora直接数値候補: '+code);};
function siteOnlyNumericDraft({cardId,siteEventOrdinal,groups}={}){
 if(!/^\d{4,7}$/.test(String(cardId||''))||
   !Number.isSafeInteger(siteEventOrdinal)||siteEventOrdinal<1||siteEventOrdinal>100||
   !Array.isArray(groups)||groups.length<1||groups.length>20)
  error('scope-or-event-group-invalid');
 let scalar=0,nonNumericHint=0;
 const candidates=groups.map((g,ci)=>{
  if(!g||!Number.isSafeInteger(g.orSeparatorCount)||g.orSeparatorCount<0||
   !Number.isSafeInteger(g.routeCandidateCount)||g.routeCandidateCount<1||
   g.routeCandidateCount!==g.orSeparatorCount+1||
   !Array.isArray(g.numericSegments)||g.numericSegments.length!==g.routeCandidateCount||
   !Array.isArray(g.ownTextFragments)||g.ownTextFragments.length>100||
   g.ownTextFragments.some(s=>typeof s!=='string'||s.length>250))
   error('visible-branch-not-separated');
  const terminalDisplayed=g.ownTextFragments.some(s=>STOP.test(s));
  const outcomeCandidates=g.numericSegments.map((segment,ri)=>{
   if(!segment||!Array.isArray(segment.effectTexts)||!Array.isArray(segment.effectContexts)||
    segment.effectTexts.length>80||segment.effectContexts.length!==segment.effectTexts.length)
    error('observed-numeric-segments-invalid');
   const effects=[],nonScalar=[],issues=[];
   for(const [i,raw] of segment.effectTexts.entries()){
    const contexts=segment.effectContexts[i];
    if(typeof raw!=='string'||raw.length>400||!Array.isArray(contexts)||
     contexts.length>6||contexts.some(x=>typeof x!=='string'||x.length>300))
     error('numeric-fragment-limit-exceeded');
    const parsed=parseNumericFactWithLocalContext(raw,contexts).fact;
    if(!parsed)continue;
    if(parsed.requiresReview||!Number.isSafeInteger(parsed.amount)||parsed.amount===0){
     issues.push('unresolved-numeric');continue;
    }
    if(!KINDS.has(parsed.kind)){
     nonScalar.push(parsed.kind);nonNumericHint++;
     continue;
    }
    // Do not merge numbers or guess bond recipient, campaign bonus, etc.
    effects.push({kind:parsed.kind,delta:parsed.amount});
    scalar++;
   }
   return {
    resultOrdinal:ri+1,
    effects,nonScalarKinds:[...new Set(nonScalar)].sort(),
    issues:[...new Set(issues)].sort(),
    terminalEvidence:terminalDisplayed&&g.routeCandidateCount===1?
      'displayed-on-single-route':'not-independently-located',
    // No "rewards: []": that would falsely mean no skill awards exist.
    skillRewardsStatus:'unresolved',
    numericEffectRecipientsStatus:'unresolved'
   };
  });
  return {
   visibleGroupOrdinal:ci+1,orSeparatorCount:g.orSeparatorCount,
   routeCandidates:outcomeCandidates,
   displayedTerminalOnGroup:terminalDisplayed,
   terminalRouteLocationKnown:terminalDisplayed&&g.routeCandidateCount===1
  };
 });
 const unparsed=candidates.reduce((n,g)=>n+g.routeCandidates.reduce((a,r)=>
  a+r.issues.length,0),0);
 const allGroupsWithEvidence=candidates.every(g=>g.routeCandidates.length>0);
 const totalRoutes=candidates.reduce((n,g)=>n+g.routeCandidates.length,0);
 const stop=candidates.filter(g=>g.displayedTerminalOnGroup).length;
 const report={
  dataKind:'official-gametora-site-numeric-draft',
  version:1,cardId:String(cardId),siteEventOrdinal,
  visibleGroupCount:candidates.length,visibleRouteCount:totalRoutes,
  observedScalarEffectCount:scalar,unparsedNumericCount:unparsed,
  excludedNonScalarNumericCount:nonNumericHint,
  explicitTerminalGroupCount:stop,
  candidates,
  // Explicitly NOT a complete event: visible groups are not proven choices.
  interpretedChoiceSemantics:false,
  outcomeRandomnessOrProbabilityVerified:false,
  chainDependenciesVerified:false,
  siteSkillIdsAndRewardsVerified:false,
  effectRecipientIdsVerified:false,
  sourceSiteTextCopied:false,
  appEventSchemaAdoptable:false,
  publicationApproved:false,
  reviewReasons:['choice-vs-result-semantics-unverified',
   'skill-rewards-unverified','event-name-and-choice-labels-unresolved',
   'chain-reachability-unverified','rights-unreviewed',
   ...(unparsed?['unparsed-numeric-effects']:[]),
   ...(stop&&!candidates.filter(g=>g.displayedTerminalOnGroup)
    .every(g=>g.terminalRouteLocationKnown)?['terminal-route-unresolved']:[])]
 };
 if(!allGroupsWithEvidence)error('no-visible-groups');
 return report;
}
function summarizeNumericDraft(draft){
 if(draft?.dataKind!=='official-gametora-site-numeric-draft'||
  draft.appEventSchemaAdoptable!==false||
  !Array.isArray(draft.candidates))
  error('not-a-provisional-site-draft');
 return {
  cardId:draft.cardId,siteEventOrdinal:draft.siteEventOrdinal,
  outerGroups:draft.visibleGroupCount,resultCandidates:draft.visibleRouteCount,
  parsedNumericFacts:draft.observedScalarEffectCount,
  unresolvedNumericFacts:draft.unparsedNumericCount,
  nonScalarNumericFacts:draft.excludedNonScalarNumericCount,
  terminalGroups:draft.explicitTerminalGroupCount,
  numericKindAndAmountByResult:draft.candidates.map(g=>
   g.routeCandidates.map(x=>x.effects.map(e=>e.kind+':'+e.delta).sort())),
  appEventSchemaAdoptable:false,publicationApproved:false
 };
}
module.exports={siteOnlyNumericDraft,summarizeNumericDraft};
