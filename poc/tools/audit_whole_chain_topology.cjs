'use strict';
/*
 * Phase 2③. Exhaustively inventory every source "arrows" event and outcome.
 * A next stage inferred from presentation order is NEVER an actual verified edge.
 * Do not export copyrighted text or rehost third-party source JSON.
 */
const fs=require('node:fs');
const path=require('node:path');
const {flattenRoutes,readDocuments}=require('./audit_gametora_branches.cjs');

const PRIOR=new Set(['both_previous_chain_good','one_previous_chain_good',
 'both_previous_chain_bad','success','fail','result_good','result_bad','result_average']);
const fail=s=>{throw Error('Whole chain topology audit: '+s);};
const localId=ev=>Number.isSafeInteger(ev.id)?ev.id:null;
const sourceEvents=doc=>{
 const ja=doc.events_ja&&typeof doc.events_ja==='object'&&Object.keys(doc.events_ja).length;
 const events=ja?doc.events_ja:doc.events;
 if(!events||typeof events!=='object'||Array.isArray(events))
  fail('invalid source event map '+doc.id);
 return Object.values(events);
};
function analyzeStage(event,sourceOrdinal,chainOrdinal){
 if(event.section!=='arrows'||!Array.isArray(event.choices))
  fail('invalid chain event structure');
 const choices=[];
 let terminals=0,priorMarkers=0,conditionedRoutes=0,allOutcomes=0,mixedChoices=0;
 const kindSet=new Set();
 for(let j=0;j<event.choices.length;j++){
  const choice=event.choices[j],routes=flattenRoutes(choice);
  const terminalAt=[];
  let conditioned=false;
  for(let k=0;k<routes.length;k++){
   const r=routes[k];
   if(!Array.isArray(r.effects)||!Array.isArray(r.when))fail('malformed route');
   const effects=r.effects.map(x=>x?.type);
   const guards=r.when.map(x=>x?.kind);
   if([...effects,...guards].some(x=>typeof x!=='string'))fail('malformed effect/guard');
   if(effects.includes('chain_end')){terminals++;terminalAt.push(k+1);}
   const prior=[...effects,...guards].filter(x=>PRIOR.has(x));
   if(prior.length){priorMarkers+=prior.length;prior.forEach(x=>kindSet.add(x));}
   if(r.when.length){conditionedRoutes++;conditioned=true;}
   allOutcomes++;
  }
  if(terminalAt.length>0&&terminalAt.length<routes.length)mixedChoices++;
  choices.push({
   choiceOrdinal:j+1,routeCount:routes.length,terminalOutcomes:terminalAt,
   terminalExtent:!terminalAt.length?'not-explicitly-terminal':
    terminalAt.length===routes.length?'all-outcomes-explicitly-terminal':'mixed-outcome-termination',
   hasGuardedSegments:conditioned
  });
 }
 return {sourceOrdinal,chainOrdinal,sourceLocalEventId:localId(event),
  choiceCount:event.choices.length,routeCount:allOutcomes,
  terminalRouteCount:terminals,priorMarkerCount:priorMarkers,
  priorMarkerKinds:[...kindSet].sort(),guardedRouteCount:conditionedRoutes,
  choicesWithMixedTermination:mixedChoices,choices};
}
function compareCheckerStop(stage,linkedPairs,reviewCases,checkerEvent){
 if(!checkerEvent)return {status:'source-only-event'};
 const reported=(reviewCases||[]).filter(x=>x.sourceKey===checkerEvent.sourceKey);
 if(!stage||!linkedPairs||!linkedPairs.choiceCountAgreement)
  return {status:'choice-count-conflict'};
 const c=checkerEvent.choices;
 if(c.length!==stage.choices.length)fail('checker choice count drift');
 let agree=0,disagree=0,unverified=0;
 const issues=[];
 for(let i=0;i<c.length;i++){
  const result=c[i];
  if(!Array.isArray(result.results))fail('Checker result shape');
  const source=stage.choices[i],checkStop=result.results.some(x=>x.terminalObserved===true);
  const sourceStop=source.terminalOutcomes.length>0;
  const aligned=reported.find(x=>x.choiceOrdinal===i+1);
  const positionSupported=aligned&&['label-exact-provisional','label-typographic-provisional']
    .includes(aligned.choiceLabelStatus);
  if(!positionSupported){unverified++;continue;}
  if(checkStop===sourceStop)agree++;
  else {disagree++;issues.push({
   choiceOrdinal:i+1,checkerObservedStop:checkStop,sourceObservedStop:sourceStop
  });}
 }
 return {status:'provisionally-paired',
  choiceStopPresenceAgree:agree,choiceStopPresenceDisagree:disagree,
  choicesNotIdentityAligned:unverified,
  issues};
}
function historicalStageIndex(history){
 if(history?.dataKind!=='provisional-historical-chain-stage-audit'||
    history.approvalState!=='UNREVIEWED_NOT_FOR_PUBLICATION'||
    history.forSkillGrant!==false||!Array.isArray(history.chainGroups)||
    history.totals?.stageGroups!==history.chainGroups.length)
  fail('historical stage snapshot/provenance invalid');
 const bySource=new Map(),groups=[];
 for(const group of history.chainGroups){
  if(!Array.isArray(group.events)||!['stage-complete-unique','stage-incomplete',
    'stage-ambiguous'].includes(group.structuralStatus))
   fail('historical chain group shape');
  const id=groups.length;
  groups.push(group);
  for(const e of group.events){
   if(bySource.has(e.sourceKey)||!Number.isInteger(e.stage)||
      e.stage<1||e.stage>group.chainMax)fail('historical chain stage collision');
   bySource.set(e.sourceKey,{groupId:id,stage:e.stage,
    structuralStatus:group.structuralStatus,
    chainMax:group.chainMax});
  }
 }
 return {bySource,groups};
}
function historicPairEvidence(firstKey,nextKey,historyIndex){
 const a=historyIndex.bySource.get(firstKey),b=historyIndex.bySource.get(nextKey);
 if(!a||!b)return 'missing-2025-stage-evidence';
 if(a.groupId===b.groupId&&a.structuralStatus==='stage-complete-unique'&&
    b.structuralStatus==='stage-complete-unique'&&b.stage===a.stage+1)
  return '2025-structural-stage-order-agrees';
 if(a.groupId===b.groupId&&b.stage!==a.stage+1)
  return '2025-stage-order-disagrees';
 if(a.groupId!==b.groupId)
  return '2025-groups-differ-or-ambiguous';
 return '2025-stage-evidence-incomplete';
}
function build({index,sourceDocuments,checkerFacts,rewardAudit,historicalAudit}){
 if(index?.dataKind!=='umasupport-whole-event-provisional-index'||
    index.publicationApproval!==false||index.routeTopologyVerified!==false||
    !Array.isArray(index.cards)||index.cards.length!==563||
    rewardAudit?.dataKind!=='umasupport-two-source-numeric-reward-audit'||
    rewardAudit.releaseApproved!==false||!Array.isArray(rewardAudit.cases)||
    checkerFacts?.dataKind!=='umasupport-explicit-result-facts'||
    checkerFacts.forSkillGrant!==false||!Array.isArray(checkerFacts.cards)||
    !Array.isArray(sourceDocuments)||index.sourcePins.gameToraDerived!==rewardAudit.sourcePins.gameToraDerived||
    index.sourcePins.checker!==rewardAudit.sourcePins.checker)
  fail('unreviewed source/version invariants');
 const docs=new Map();
 for(const doc of sourceDocuments){
  if(doc?.kind!=='support'||!Number.isSafeInteger(doc.id)||
     docs.has(String(doc.id)))fail('duplicate/invalid support document');
  docs.set(String(doc.id),sourceEvents(doc));
 }
 const historyIndex=historicalStageIndex(historicalAudit);
 const facts=new Map(checkerFacts.cards.map(x=>[x.cardId,new Map(x.events.map(e=>[e.sourceKey,e]))]));
 const caseBySource=new Map();
 for(const x of rewardAudit.cases){
  const key=x.cardId+':'+x.sourceOrdinal,rows=caseBySource.get(key)||[];
  rows.push(x);caseBySource.set(key,rows);
 }
 const totals={rosterCards:0,sourceCards:docs.size,missingSourceCards:0,
  cardsWithChain:0,cardsWithoutChain:0,sourceChainEvents:0,chainChoices:0,
  chainOutcomeRoutes:0,terminalOutcomeRoutes:0,
  stageEventsWithTerminal:0,stageEventsWithPrior:0,priorMarkers:0,guardedRoutes:0,
  mixedTerminationChoices:0,
  proposedAdjacentStageLinks:0,verifiedAdjacentStageLinks:0,
  historicallyOrderCorroborated:0,historicallyOrderConflicted:0,
  historicallyGroupsDiffer:0,historicallyEvidenceMissingOrIncomplete:0,
  stageEventsWithSourceSuccessor:0,stageEventsAtTail:0,
  nonTailStagesWithTerminal:0,nonTailStagesWithoutTerminal:0,
  nonTailStagesAllTerminal:0,nonTailStagesSomeTerminal:0,
  nonTailStagesOnlyNoTerminalMarker:0,
  eventCrosswalkMatched:0,eventCrosswalkUnmatched:0,
  matchedChoiceStopPresenceAgree:0,matchedChoiceStopPresenceDisagree:0,
  matchedChoicesIdentityUnknown:0,sourceOnlyChainEvents:0,
  sourceEventsWithUnknownChoiceIdentity:0,
  chainEventsRequiringTopologyReview:0,
  cardsWithNonTailStop:0,cardsWithPrior:0,
  singleStageCards:0,multipleStageCards:0};
 const cards=[],seen=new Set(),reviewQueue=[];
 for(const record of index.cards){
  const cardId=record.cardId,events=docs.get(cardId)||[];
  if(seen.has(cardId))fail('duplicate roster');seen.add(cardId);totals.rosterCards++;
  if(record.gameToraObservedCount!==events.length||record.sourceMissing!==(docs.has(cardId)===false))
   fail('source cardinality drift '+cardId);
  if(!docs.has(cardId))totals.missingSourceCards++;
  const links=new Map(record.pairs.map(x=>[x.sourceOrdinal,x]));
  const stageEvents=events.map((ev,i)=>({ev,sourceOrdinal:i+1}))
    .filter(x=>x.ev.section==='arrows');
  if(stageEvents.length)totals.cardsWithChain++;else totals.cardsWithoutChain++;
  if(stageEvents.length===1)totals.singleStageCards++;
  if(stageEvents.length>1)totals.multipleStageCards++;
  let anyNonTailStop=false,anyPrior=false;
  const stages=[];
  for(let i=0;i<stageEvents.length;i++){
   const {ev,sourceOrdinal}=stageEvents[i];
   const stage=analyzeStage(ev,sourceOrdinal,i+1);
   const hasNext=i<stageEvents.length-1;
   const nextStage=hasNext?stageEvents[i+1]:null;
   const nextPair=nextStage?links.get(nextStage.sourceOrdinal):null;
   const paired=links.get(sourceOrdinal),c=paired?facts.get(cardId)?.get(paired.sourceKey):null;
   const crosswalk=paired?compareCheckerStop(stage,paired,
    caseBySource.get(cardId+':'+sourceOrdinal),c):{status:'source-only-event'};
   if(paired&&!c)fail('Checker sourceKey missing for paired chain stage '+cardId);
   const goodCrosswalk=paired&&paired.choiceCountAgreement===true;
   if(paired)totals.eventCrosswalkMatched++;else totals.eventCrosswalkUnmatched++;
   if(!paired)totals.sourceOnlyChainEvents++;
   let historyStatus=null;
   if(hasNext){
    historyStatus=historicPairEvidence(paired?.sourceKey,nextPair?.sourceKey,historyIndex);
    if(historyStatus==='2025-structural-stage-order-agrees')totals.historicallyOrderCorroborated++;
    else if(historyStatus==='2025-stage-order-disagrees')totals.historicallyOrderConflicted++;
    else if(historyStatus==='2025-groups-differ-or-ambiguous')totals.historicallyGroupsDiffer++;
    else totals.historicallyEvidenceMissingOrIncomplete++;
    totals.stageEventsWithSourceSuccessor++;
   }
   else totals.stageEventsAtTail++;
   totals.sourceChainEvents++;totals.chainChoices+=stage.choiceCount;
   totals.chainOutcomeRoutes+=stage.routeCount;
   totals.terminalOutcomeRoutes+=stage.terminalRouteCount;
   totals.priorMarkers+=stage.priorMarkerCount;totals.guardedRoutes+=stage.guardedRouteCount;
   totals.mixedTerminationChoices+=stage.choicesWithMixedTermination;
   if(stage.terminalRouteCount)totals.stageEventsWithTerminal++;
   if(stage.priorMarkerCount){totals.stageEventsWithPrior++;anyPrior=true;}
   if(hasNext){
    totals.proposedAdjacentStageLinks++;
    if(stage.terminalRouteCount){
     totals.nonTailStagesWithTerminal++;anyNonTailStop=true;
     if(stage.terminalRouteCount===stage.routeCount)totals.nonTailStagesAllTerminal++;
     else totals.nonTailStagesSomeTerminal++;
    }else{totals.nonTailStagesWithoutTerminal++;
      totals.nonTailStagesOnlyNoTerminalMarker++;}
   }
   totals.matchedChoiceStopPresenceAgree+=crosswalk.choiceStopPresenceAgree||0;
   totals.matchedChoiceStopPresenceDisagree+=crosswalk.choiceStopPresenceDisagree||0;
   totals.matchedChoicesIdentityUnknown+=crosswalk.choicesNotIdentityAligned||0;
   if(crosswalk.choicesNotIdentityAligned||paired&&!goodCrosswalk)
    totals.sourceEventsWithUnknownChoiceIdentity++;
   totals.chainEventsRequiringTopologyReview++;
   const reasons=['CONSECUTIVE_STAGE_LINK_UNVERIFIED'];
   if(stage.terminalRouteCount)reasons.push('EXPLICIT_SOURCE_TERMINATION');
   if(stage.choicesWithMixedTermination)reasons.push('OUTCOME_DEPENDENT_TERMINATION');
   if(stage.priorMarkerCount)reasons.push('PRIOR_OUTCOME_DEPENDENCE');
   if(stage.guardedRouteCount)reasons.push('GUARDED_OUTCOME');
   if(!paired)reasons.push('UNPAIRED_CHECKER_EVENT');
   else if(!goodCrosswalk)reasons.push('CHOICE_COUNT_CONFLICT');
   if(crosswalk.choiceStopPresenceDisagree)reasons.push('CHECKER_SOURCE_STOP_DISAGREEMENT');
   if(crosswalk.choicesNotIdentityAligned)reasons.push('CHOICE_IDENTITY_UNKNOWN');
   // Proposed adjacency is presentation order, never a verified route.
   const candidateNext=nextStage?{sourceOrdinal:nextStage.sourceOrdinal,
    chainOrdinal:i+2,status:'UNVERIFIED_SOURCE_ORDER_ADJACENCY',
    historical2025OrderEvidence:historyStatus}:null;
   stages.push({
    ...stage,checkerSourceKey:paired?.sourceKey||null,
    checkerMatchMethod:paired?.matchMethod||null,
    checkerChoiceCountAgreement:paired?.choiceCountAgreement??null,
    nextCandidate:candidateNext,edgeVerified:false,
    sourceRoutesEnumerated:stage.routeCount>0,gameRoutesVerified:false,
    crossSourceStopReview:crosswalk,reasons});
   reviewQueue.push({cardId,chainOrdinal:i+1,sourceOrdinal,
    checkerSourceKey:paired?.sourceKey||null,
    priority:stage.priorMarkerCount||crosswalk.choiceStopPresenceDisagree||
      stage.choicesWithMixedTermination?'P0':
      stage.terminalRouteCount||stage.guardedRouteCount||!paired||!goodCrosswalk?'P1':'P2',
    reasons});
  }
  if(anyNonTailStop)totals.cardsWithNonTailStop++;
  if(anyPrior)totals.cardsWithPrior++;
  cards.push({cardId,rarity:record.rarity,sourceMissing:!docs.has(cardId),
   sourceEventCount:events.length,chainEventCount:stages.length,
   chainTopologyVerified:false,stages});
 }
 if(totals.rosterCards!==563||docs.size!==559||totals.sourceChainEvents!==1069||
    totals.chainChoices!==1517||totals.chainOutcomeRoutes!==1713||
    totals.terminalOutcomeRoutes!==91||
    totals.proposedAdjacentStageLinks!==totals.sourceChainEvents-totals.cardsWithChain||
    totals.nonTailStagesWithTerminal+totals.nonTailStagesWithoutTerminal!==totals.proposedAdjacentStageLinks||
    totals.eventCrosswalkMatched+totals.eventCrosswalkUnmatched!==totals.sourceChainEvents||
    totals.historicallyOrderCorroborated+totals.historicallyOrderConflicted+
    totals.historicallyGroupsDiffer+totals.historicallyEvidenceMissingOrIncomplete!==
     totals.proposedAdjacentStageLinks||
    totals.verifiedAdjacentStageLinks!==0||
    totals.chainEventsRequiringTopologyReview!==totals.sourceChainEvents)
  fail('chain population arithmetic or pinned snapshot drift');
 const priorityCounts={P0:0,P1:0,P2:0};
 for(const x of reviewQueue)priorityCounts[x.priority]++;
 return {schemaVersion:1,dataKind:'umasupport-whole-chain-topology-review',
  sourcePins:{...index.sourcePins,checkerSha256:checkerFacts.sourcePins.checkerSha256,
   historical2025Master:historicalAudit.sourcePins.historicalMasterSha256},
  forSkillGrant:false,releaseApproved:false,chainEdgesVerified:false,gameVerified:false,
  sourceOriginalTextIncluded:false,stats:{...totals,priorityCounts},
  semantics:{
   adjacency:'Events ordered in the third-party snapshot, not verified next-event pointers',
   terminal:'A chain_end marker is source evidence only; lack of marker never establishes continuation',
   prior:'A previous-result marker may select a reward segment rather than gate event access',
   stopCrosscheck:'Only provisionally aligned Japanese choice labels are compared; result branches remain unordered'
  },reviewQueue,cards};
}
function main(args){
 if(args.length!==4)fail('usage: node poc/tools/audit_whole_chain_topology.cjs <whole-index.json> <rewards-audit.json> <gametora-dir> <output.json>');
 const [indexPath,rewardPath,folder,out]=args;
 const x=build({index:JSON.parse(fs.readFileSync(indexPath,'utf8')),
  rewardAudit:JSON.parse(fs.readFileSync(rewardPath,'utf8')),
  checkerFacts:require('../data/candidates/checker_explicit_result_facts.v1.json'),
  historicalAudit:require('../data/candidates/checker_chain_stage_audit.v1.json'),
  sourceDocuments:readDocuments(folder)});
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(x,null,2)+'\n');
 console.log('WHOLE_CHAIN_TOPOLOGY_STATS='+JSON.stringify(x.stats));
 console.log('WHOLE_CHAIN_REVIEW_FOCUS='+JSON.stringify(x.reviewQueue
  .filter(e=>e.priority==='P0').slice(0,70)));
}
if(require.main===module)main(process.argv.slice(2));
module.exports={analyzeStage,compareCheckerStop,historicalStageIndex,historicPairEvidence,build};
