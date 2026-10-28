'use strict';
/*
 * Cross-check independently read panel hints against route-local DOM hints.
 * Uses ID+hint-level for multiset equality. No event prose, no extra source.
 * A successful DOM association is still not game-mechanics or release proof.
 */
const fail=s=>{throw Error('新サポカの結果別スキルヒント候補照合: '+s);};
function hintSignature(x){
 if(x?.status!=='unique-verified-name'||!/^\d+$/.test(String(x.numericId??''))||
    !Number.isSafeInteger(x.level)||x.level<=0||x.level>10)return null;
 return x.numericId+':'+x.level;
}
function bag(items){
 const m=new Map();
 for(const item of items){
  const key=hintSignature(item);
  if(!key)continue;
  m.set(key,(m.get(key)||0)+1);
 }
 return m;
}
function summarizeCandidateRouteHints(events){
 if(!Array.isArray(events)||events.length>20||
    events.some(e=>!Array.isArray(e?.globalHints)||!Array.isArray(e?.routes)||
      e.globalHints.length>60||e.routes.length>40||
      e.routes.some(r=>!Number.isSafeInteger(r.choiceOrdinal)||r.choiceOrdinal<=0||
       !Number.isSafeInteger(r.outcomeOrdinal)||r.outcomeOrdinal<=0||
       r.unresolvedOr===true&&r.outcomeOrdinal!==1||
       !Array.isArray(r.hints)||r.hints.length>60)))
  fail('検証入力が不正');
 let total=0,routeCandidates=0,globalHits=0,attributed=0,completeEvents=0,
     ambiguousSiteGroups=0,withoutAnyVisibleRouteGroups=0,
     unresolvedGlobal=0,unresolvedLocal=0,missing=0,extra=0;
 let allPairsCompatible=true;
 const eventSummaries=[];
 for(const [i,e] of events.entries()){
  const global=e.globalHints||[],routes=e.routes||[];
  const keys=new Set();
  for(const r of routes){
   const key=r.choiceOrdinal+':'+r.outcomeOrdinal;
   if(keys.has(key))fail('同一イベント内の経路候補位置が重複');
   keys.add(key);
  }
  const local=routes.flatMap(r=>r.hints);
  const orig=bag(global),seen=bag(local);
  const originalPairs=[...orig.values()].reduce((a,b)=>a+b,0);
  const locatedPairs=[...seen.values()].reduce((a,b)=>a+b,0);
  let missingHere=0,extraHere=0;
  for(const [k,v] of orig)missingHere+=Math.max(0,v-(seen.get(k)||0));
  for(const [k,v] of seen)extraHere+=Math.max(0,v-(orig.get(k)||0));
  const unresGlobal=global.length-originalPairs;
  const unresLocal=local.length-locatedPairs;
  const structuralAmbiguity=routes.some(r=>r.unresolvedOr===true);
  const uniqueAssociation=routes.length>0&&missingHere===0&&extraHere===0&&
   unresGlobal===0&&unresLocal===0&&!structuralAmbiguity;
  allPairsCompatible=allPairsCompatible&&uniqueAssociation;
  total++;
  routeCandidates+=routes.length;
  globalHits+=global.length;
  attributed+=locatedPairs;
  if(uniqueAssociation)completeEvents++;
  if(routes.length===0)withoutAnyVisibleRouteGroups++;
  if(structuralAmbiguity)ambiguousSiteGroups++;
  unresolvedGlobal+=unresGlobal;
  unresolvedLocal+=unresLocal;
  missing+=missingHere;extra+=extraHere;
  eventSummaries.push({
   eventOrdinal:i+1,visibleRouteCandidateCount:routes.length,
   globalHintPairs:global.length,routeHintPairs:local.length,
   numericIdLevelPairsLocated:locatedPairs,
   matchingMultiset:missingHere===0&&extraHere===0&&
      global.length===local.length,
   structuralOutcomeSplitUnambiguous:!structuralAmbiguity,
   allCandidatePairsAssigned:uniqueAssociation
  });
 }
 return {
  eventPanelsCompared:total,
  candidateRoutesObserved:routeCandidates,
  wholePanelHintCandidates:globalHits,
  hintIdLevelCandidatesBoundToRoute:attributed,
  eventsWithAllKnownHintPairsAssigned:completeEvents,
  unclassifiedWholePanelHintCandidates:unresolvedGlobal,
  unclassifiedRouteHintCandidates:unresolvedLocal,
  missingNormalizedPairs:missing,extraNormalizedPairs:extra,
  eventsWithUnresolvedOrStructure:ambiguousSiteGroups,
  eventsWithoutVisibleRouteGroups:withoutAnyVisibleRouteGroups,
  allCandidateHintIdLevelPairsAssigned:allPairsCompatible&&total>0,
  events:eventSummaries,
  // Even a perfect observable UI match does not establish event-chain rules
  // or GameWith choice wording, let alone redistribution rights.
  officialGameOutcomeMeaningVerified:false,
  chainAndOutingProgressionVerified:false,
  maleChoiceTextSourcedAndPublished:false,
  independentGameFactAuditCompleted:false,
  publicationApproved:false,
  noSourceTextIncluded:true
 };
}
module.exports={hintSignature,summarizeCandidateRouteHints};
