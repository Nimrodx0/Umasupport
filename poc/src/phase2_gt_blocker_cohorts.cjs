'use strict';
/*
 * Cohort-first triage of ALL blocked GT non-skill events. Works from the
 * existing pinned, full-population inventory. Do not copy names, choice
 * prose, raw effects, reward values, or copyrighted descriptions.
 *
 * This is a classification/reporting layer; it never awards rewards or
 * silently removes blockers from the executable GT projection.
 */
const POLICY=require('../config/event-source-priority.v1.json');
const fail=x=>{throw Error('GT全件保留グループ監査: '+x);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const code=x=>typeof x==='string'&&/^[A-Z][A-Z0-9_]*$/.test(x);
const effectType=x=>typeof x==='string'&&/^[a-z][a-z0-9_]*$/.test(x);
const cmp=(a,b)=>a.localeCompare(b,'en');
const sortedCounts=counts=>Object.fromEntries([...counts.entries()].sort(([a],[b])=>cmp(a,b)));
const count=(m,k)=>m.set(k,(m.get(k)||0)+1);
function classify(issues){
 if(issues.some(x=>x==='SOURCE_ROUTE_GUARD_UNMODELED'||
     x==='CONDITIONAL_SEGMENTS_NOT_MODELED'))return 'INTERNAL_SEGMENT_GUARD';
 if(issues.includes('CONTROL_MARKERS_REQUIRE_BRANCH_ADJUDICATION')||
    issues.includes('CHAIN_END_SOURCE_CONTEXT_UNSUPPORTED'))
  return 'CHAIN_CONTROL_OR_TERMINAL_CONTEXT';
 if(issues.includes('UNFLAGGED_MULTIPLE_RESULT_ROUTES')||
    issues.includes('RANDOM_RESULT_WITHOUT_ALTERNATIVE'))
  return 'RESULT_SHAPE_DISCREPANCY';
 if(issues.includes('NONSCALAR_OR_INVALID_NUMERIC_VALUE'))
  return 'NUMERIC_RANGE_OR_SHAPE';
 if(issues.includes('UNSUPPORTED_EFFECT_TYPE'))
  return 'UNSUPPORTED_EFFECT_SEMANTICS';
 return 'OTHER_UNMODELED';
}
function analyze({inventory,documents,index},{strict=false}={}){
 if(POLICY.automaticPublicationAllowed!==false||
    inventory?.dataKind!=='phase2-gt-whole-nonskill-effect-inventory'||
    inventory?.sourcePins?.gameToraDerived!==POLICY.baselineRevision||
    inventory?.publicationApproved!==false||
    inventory?.automaticRuntimeAdoption!==false||
    index?.dataKind!=='umasupport-whole-event-provisional-index'||
    index?.sourcePins?.gameToraDerived!==POLICY.baselineRevision||
    index?.publicationApproval!==false||
    !Array.isArray(inventory.rows)||!Array.isArray(index.cards)||
    !Array.isArray(documents))
  fail('固定出典／非公開／全件監査契約の不一致');
 const source=new Map(),roster=new Map();
 for(const c of index.cards){
  if(!obj(c)||!/^\d{5}$/.test(c.cardId)||roster.has(c.cardId)||
     !Number.isSafeInteger(c.gameToraObservedCount)||
     c.gameToraObservedCount<0)
   fail('元サポカ母集団のID・件数が不正');
  roster.set(c.cardId,c);
 }
 for(const d of documents){
  const id=String(d?.id);
  if(!obj(d)||d.kind!=='support'||!roster.has(id)||source.has(id)||
     !obj(d.events_ja)&&!obj(d.events))
   fail('固定GT元カードがない、重複、または形状不正');
  source.set(id,d);
 }
 for(const [id,c] of roster){
  const d=source.get(id);
  if((d===undefined)!==(c.sourceMissing===true))fail('元カード欠損分類が違う');
  if(d){
   const events=obj(d.events_ja)&&Object.keys(d.events_ja).length?
    d.events_ja:d.events;
   if(!obj(events)||Object.keys(events).length!==c.gameToraObservedCount)
    fail('固定元イベント件数の不一致 '+id);
  }
 }
 const positions=new Map();
 for(const row of inventory.rows){
  const {cardId,sourceOrdinal,choiceOrdinal,routeOrdinal,issueCodes}=row||{};
  if(!roster.has(cardId)||!source.has(cardId)||
     ![sourceOrdinal,choiceOrdinal,routeOrdinal].every(n=>
      Number.isSafeInteger(n)&&n>0)||
     !Array.isArray(issueCodes)||issueCodes.some(x=>!code(x))||
     new Set(issueCodes).size!==issueCodes.length)
   fail('元結果の位置・保留理由が不正');
  const id=cardId+':'+sourceOrdinal;
  if(!positions.has(id))positions.set(id,{
   cardId,sourceOrdinal,
   issues:new Set(),routeIssues:[],routeKeys:new Set(),sourceTypes:new Set(),
   affectedChoices:new Set(),totalRoutes:0,blockedRoutes:0
  });
  const group=positions.get(id),routeKey=choiceOrdinal+':'+routeOrdinal;
  if(group.routeKeys.has(routeKey))fail('元結果のID・ルート順位が重複');
  group.routeKeys.add(routeKey);
  const ev=Object.values(source.get(cardId).events_ja||
   source.get(cardId).events)[sourceOrdinal-1];
  const choice=ev?.choices?.[choiceOrdinal-1];
  if(!choice)fail('元位置の選択肢が見つからない');
  const {flattenRoutes}=require('../tools/audit_gametora_branches.cjs');
  const result=flattenRoutes(choice)[routeOrdinal-1];
  if(!result||!Array.isArray(result.effects)||
     result.effects.some(e=>!obj(e)||!effectType(e.type)))
   fail('元結果の効果コード形状不正');
  const codes=[...issueCodes].sort(cmp);
  group.totalRoutes++;
  if(codes.length){
   group.blockedRoutes++;group.affectedChoices.add(choiceOrdinal);
   codes.forEach(x=>group.issues.add(x));
   result.effects.forEach(e=>group.sourceTypes.add(e.type));
   group.routeIssues.push({choiceOrdinal,routeOrdinal,reasonCodes:codes});
  }
 }
 let eventCount=0,blockedCount=0,blockedRoutes=0,affectedCards=new Set();
 const byCause=new Map(),signatureCounts=new Map(),sourceTypes=new Map();
 const rows=[];
 for(const g of positions.values()){
  eventCount++;
  if(!g.issues.size)continue;
  blockedCount++;blockedRoutes+=g.blockedRoutes;affectedCards.add(g.cardId);
  const issues=[...g.issues].sort(cmp),cause=classify(issues);
  count(byCause,cause);count(signatureCounts,issues.join('+'));
  g.sourceTypes.forEach(x=>count(sourceTypes,x));
  rows.push({
   cardId:g.cardId,sourceOrdinal:g.sourceOrdinal,
   priorityGroup:cause,reasonCodes:issues,
   sourceEffectTypes:[...g.sourceTypes].sort(cmp),
   affectedChoiceOrdinals:[...g.affectedChoices].sort((a,b)=>a-b),
   totalRoutes:g.totalRoutes,blockedRoutes:g.blockedRoutes,
   routeReasons:g.routeIssues.sort((a,b)=>a.choiceOrdinal-b.choiceOrdinal||
      a.routeOrdinal-b.routeOrdinal)
  });
 }
 rows.sort((a,b)=>cmp(a.cardId,b.cardId)||a.sourceOrdinal-b.sourceOrdinal);
 if(eventCount!==inventory.summary?.sourceEvents||
    blockedCount!==inventory.summary?.blockedEvents||
    blockedRoutes!==inventory.summary?.blockedRoutes||
    inventory.summary.eligibleEvents+blockedCount!==eventCount||
    rows.length!==blockedCount)
  fail('元イベント・保留ルート数の集計が一致しない');
 if(strict&&(eventCount!==2488||blockedCount!==84||
     index.cards.length!==563||source.size!==559))
  fail('固定563カード／559元カード／2488イベント／84保留の母数が変化');
 return {dataKind:'phase2-gt-blocker-cohorts-private',
  sourceRevision:POLICY.baselineRevision,
  sourceEvents:eventCount,blockedEvents:blockedCount,
  eligibleEvents:inventory.summary.eligibleEvents,
  affectedCards:affectedCards.size,blockedRoutes,
  cohorts:sortedCounts(byCause),reasonSignatures:sortedCounts(signatureCounts),
  involvedSourceEffectTypes:sortedCounts(sourceTypes),rows,
  publicationApproved:false,
  automaticRuntimeAdoption:false,sourceNarrativeIncluded:false};
}
module.exports={analyze,classify};
