'use strict';
/*
 * GameTora-original-site result ledger -> UmaSupport-shaped PRIVATE preview.
 * Does not use any other event source or known card IDs. Result positions,
 * stat effect amounts and numeric skill IDs/Lv are copied without guessing
 * success/failure, outcomes' probabilities or missing next-event conditions.
 *
 * A rendered group is a "display group", not a proven player choice. The
 * schema-shaped event is therefore NEVER a public event, even if its rewards
 * fit the app schema. The ready-to-publish candidate remains EMPTY until
 * every event and the publication gate are verified independently.
 */
const fail=s=>{throw Error('GameTora表示からの新サポカ暫定DB形式: '+s);};
const id=x=>typeof x==='string'&&/^[1-9]\d{4}$/.test(x);
const int=x=>Number.isSafeInteger(x)&&x>0;
const marker=new Set(['explicit-chain-stop','explicit-outing-unlock','explicit-outing-stop']);
function projectSiteEvent(observation){
 if(observation?.status==='no-visible-result-groups'||
    observation?.status==='unresolved-or-layout'){
  if(!id(observation.cardId)||!int(observation.siteEventOrdinal)||
     observation.publicationApproved!==false||
     observation.appEventSchemaAdoptable!==false)
   fail('不完全なイベント観測の識別子・非公開境界が不正');
  return {cardId:observation.cardId,
   siteEventOrdinal:observation.siteEventOrdinal,
   status:'pending',previewEvent:null,
   visibleRouteCount:observation.routeCount,
   blockers:[observation.status],publicationApproved:false,
   appEventSchemaAdoptable:false};
 }
 if(observation?.status!=='unified-unapproved'||
    observation.publicationApproved!==false||
    observation.appEventSchemaAdoptable!==false||
    !id(observation.cardId)||!int(observation.siteEventOrdinal)||
    observation.joined?.dataKind!=='official-gametora-site-unified-route-draft'||
    observation.joined.cardId!==observation.cardId||
    observation.joined.siteEventOrdinal!==observation.siteEventOrdinal||
    observation.joined.appEventSchemaAdoptable!==false||
    observation.joined.publicationApproved!==false||
    observation.joined.sourceSiteTextCopied!==false||
    !Array.isArray(observation.joined.routes)||
    !int(observation.joined.visibleGroupCount)||
    !int(observation.joined.visibleRouteCount)||
    observation.joined.routes.length!==observation.joined.visibleRouteCount)
  fail('入力は元サイトの未承認・結果別統合候補のみ');
 const source=observation.joined;
 const groups=[];
 let effectCount=0,hintCount=0,directCount=0,flowCount=0;
 const reasons=new Set([
  // These refer to what the site did NOT prove, not to GameWith labels.
  'site-groups-not-proven-player-choices',
  'all-event-skill-awards-not-proven-exhaustive',
  'next-event-internal-reachability-not-proven',
  'source-wording-publication-rights-not-approved'
 ]);
 for(const route of source.routes){
  if(!int(route?.choiceGroupOrdinal)||!int(route.resultOrdinal)||
     !Array.isArray(route.numericEffects)||!Array.isArray(route.skillHints)||
     !Array.isArray(route.directSkills)||
     !Array.isArray(route.visibleFlowMarkers)||
     !Array.isArray(route.unlocatedVisibleFlowMarkers)||
     !Array.isArray(route.unresolvedReasons)||
     route.sourceRoutePositionVerified!==true)
   fail('結果の元位置または報酬構造が不正');
  if(route.choiceGroupOrdinal===groups.length+1){
   if(route.resultOrdinal!==1)fail('初回結果番号が不連続');
   groups.push({id:'group-'+route.choiceGroupOrdinal,
    label:'選択肢'+route.choiceGroupOrdinal,results:[]});
  }
  const group=groups[route.choiceGroupOrdinal-1];
  if(!group||route.resultOrdinal!==group.results.length+1)
   fail('グループ・結果番号の入れ替え、欠番または重複');
  const effects=route.numericEffects.map((x,i)=>{
   if(!x||typeof x.kind!=='string'||!Number.isSafeInteger(x.delta)||
      x.delta===0)fail('数値効果の元構造が不正');
   return {kind:x.kind,delta:x.delta,sourceEffectOrdinal:i+1};
  });
  const rewards=[
   ...route.skillHints.map(x=>{
    if(!/^[1-9]\d*$/.test(x?.numericId)||!int(x.level))
     fail('ヒント数値ID／Lvが不正');
    return {skillId:'skill:'+x.numericId,kind:'hint',level:x.level};
   }),
   ...route.directSkills.map(x=>{
    if(!/^[1-9]\d*$/.test(x?.numericId)||
       !['normal','rare'].includes(x.rarity))
     fail('直接習得の数値ID／レアリティが不正');
    return {skillId:'skill:'+x.numericId,kind:'obtained'};
   })
  ];
  if(route.visibleFlowMarkers.some(x=>!marker.has(x))||
     route.unlocatedVisibleFlowMarkers.some(x=>!marker.has(x)))
   fail('対応しない進行表示');
  const terminal=route.visibleFlowMarkers.includes('explicit-chain-stop');
  const record={id:'result-'+route.resultOrdinal,
   label:'結果'+route.resultOrdinal,
   ...(effects.length?{effects}:{}),
   ...(rewards.length?{rewards}:{}),
   ...(terminal?{terminal:true}:{})
  };
  // Keep a schema-compatible shape only for the technical preview.
  // No success/failure labels or implicit negative termination flags.
  group.results.push(record);
  effectCount+=effects.length;hintCount+=route.skillHints.length;
  directCount+=route.directSkills.length;
  flowCount+=route.visibleFlowMarkers.length+
   route.unlocatedVisibleFlowMarkers.length;
  for(const reason of route.unresolvedReasons)reasons.add(reason);
  if(route.unlocatedVisibleFlowMarkers.length)
   reasons.add('progression-marker-not-localized-to-result');
  if(route.visibleFlowMarkers.some(x=>x==='explicit-outing-unlock'||
      x==='explicit-outing-stop'))
   reasons.add('outing-state-not-representable-by-basic-event-schema');
  if(!effects.length&&!rewards.length)
   reasons.add('displayed-result-has-no-parsed-reward-or-effect');
 }
 if(groups.length!==source.visibleGroupCount||
    groups.reduce((n,g)=>n+g.results.length,0)!==source.visibleRouteCount||
    effectCount!==source.numericEffectCount||
    hintCount!==source.uniqueSkillHintCount||
    directCount!==source.explicitDirectSkillCandidateCount||
    flowCount!==source.observedVisibleFlowMarkerCount)
  fail('抽出したイベント数・経路の効果件数が元サイトと不一致');
 const choices=groups.map(g=>({
  id:g.id,label:g.label,
  ...(g.results.length===1?
   Object.fromEntries(Object.entries(g.results[0]).filter(([k])=>
    ['effects','rewards','terminal'].includes(k))):
   {outcomes:g.results})
 }));
 const previewEvent={
  id:'gt-site:'+observation.cardId+':'+observation.siteEventOrdinal,
  name:'イベント'+observation.siteEventOrdinal,type:'choice',choices
 };
 return {
  cardId:observation.cardId,
  siteEventOrdinal:observation.siteEventOrdinal,
  status:'private-schema-shaped',
  previewEvent,
  visibleGroups:groups.length,visibleRouteCount:source.visibleRouteCount,
  numericEffects:effectCount,hints:hintCount,
  directSkills:directCount,flowMarkers:flowCount,
  blockers:[...reasons].sort(),
  siteInputOnly:true,gameChoiceSemanticsVerified:false,
  nextStageConditionsVerified:false,allRewardsVerified:false,
  publicationApproved:false,appEventSchemaAdoptable:false
 };
}
function projectNewCardSite({
 cardId,siteEventPanelCount,eventObservations
}={}){
 if(!id(cardId)||!int(siteEventPanelCount)||siteEventPanelCount>100||
    !Array.isArray(eventObservations)||
    eventObservations.length!==siteEventPanelCount)
  fail('新カード表示イベント数と抽出件数が一致しない');
 const projected=eventObservations.map((o,i)=>{
  if(o?.cardId!==cardId||o.siteEventOrdinal!==i+1)
   fail('カードID・イベント番号の混入／欠番');
  return projectSiteEvent(o);
 });
 const withRoutes=projected.filter(x=>x.status==='private-schema-shaped');
 const unresolved=projected.filter(x=>x.status==='pending');
 const count=key=>withRoutes.reduce((n,x)=>n+x[key],0);
 // Do not pass provisional event rewards to an approved catalog's append
 // stage. The original GameTora page still has undiscovered/unspecified
 // semantics. This "candidate" explicitly blocks all its event panels.
 const intakeCandidate={
  source:'GameTora-original-site',cardId,
  sourceSiteTextCopied:false,publicationApproved:false,
  appEventSchemaAdoptable:false,
  siteEventPanelCount,convertedEventCount:0,
  unresolvedEventCount:siteEventPanelCount,events:[]
 };
 return {
  dataKind:'gametora-site-card-private-db-projection',version:1,
  cardId,siteEventPanelCount,
  schemaShapedEventCount:withRoutes.length,
  noVisibleOrAmbiguousEventCount:unresolved.length,
  schemaShapedResults:count('visibleRouteCount'),
  schemaShapedNumericEffects:count('numericEffects'),
  schemaShapedHints:count('hints'),
  schemaShapedDirectSkills:count('directSkills'),
  schemaShapedFlowMarkers:count('flowMarkers'),
  perEvent:projected,
  intakeCandidate,
  allSiteEventsPublishable:false,
  existingDatabaseTouched:false,
  sourceSiteTextCopied:false,
  publicationApproved:false,appEventSchemaAdoptable:false
 };
}
function summarizeCardProjection(projected){
 if(projected?.dataKind!=='gametora-site-card-private-db-projection'||
    projected.publicationApproved!==false||
    projected.appEventSchemaAdoptable!==false||
    projected.intakeCandidate?.convertedEventCount!==0||
    projected.intakeCandidate?.unresolvedEventCount!==
      projected.siteEventPanelCount)fail('候補は未公開の観測だけ');
 return {
  cardId:projected.cardId,
  sourceEventPanels:projected.siteEventPanelCount,
  schemaShapedEvents:projected.schemaShapedEventCount,
  skippedOrAmbiguousEvents:projected.noVisibleOrAmbiguousEventCount,
  schemaShapedResults:projected.schemaShapedResults,
  numericEffects:projected.schemaShapedNumericEffects,
  skillHints:projected.schemaShapedHints,
  directSkills:projected.schemaShapedDirectSkills,
  flowMarkers:projected.schemaShapedFlowMarkers,
  pendingEventCount:projected.intakeCandidate.unresolvedEventCount,
  existingDatabaseTouched:false,
  publicationApproved:false
 };
}
module.exports={projectSiteEvent,projectNewCardSite,summarizeCardProjection};
