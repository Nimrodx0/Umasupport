'use strict';
/*
 * Independent read-only observation of a visible numeric-range candidate on
 * two OLD support card pages. Old GT data supplies the expected target, NEVER
 * values observed on the website. Never export page text or implied odds.
 */
const {inspectOne,EXPECTED}=require('./official_gametora_old_structural_cohorts.cjs');
const {matchedEffectKinds}=require('./official_gametora_numeric_fact_parser.cjs');
const fail=s=>{throw Error('旧GT数値範囲の元サイト限定監査: '+s);};
const SIGNED=/([+＋\-－−])\s*(\d{1,5})(?!\d)/g;
function signedValues(text){
 if(typeof text!=='string'||text.length>350)return [];
 return [...text.matchAll(SIGNED)].map(m=>
  (/[+＋]/.test(m[1])?1:-1)*Number(m[2]));
}
function inspectVisibleRange(document,observation){
 const id=String(document?.id||'');
 if(!['30030','30041'].includes(id))fail('固定2カード以外は許可しない');
 inspectOne(document); // Strict pinned structural shape (source SHA is checked by the runner).
 const spec=EXPECTED[id].expectedRange;
 const event=Object.values(document.events_ja)[spec.event-1];
 const choice=event.choices[spec.choice-1];
 const matching=(choice.effects||[]).filter(x=>x?.type===spec.type&&
  typeof x.value==='string'&&x.value.includes('/'));
 if(matching.length!==1||!/^([+-]\d+)\/([+-]\d+)$/.test(matching[0].value))
  fail('固定元の数値範囲が一意でない');
 const expected=matching[0].value.split('/').map(Number);
 const pinnedValues=id==='30030'?[10,30]:[15,45];
 if(expected.length!==2||expected.some((n,i)=>n!==pinnedValues[i]))
  fail('旧固定ソースの範囲数値が確認済み値から変化');
 if(observation?.cardId!==id||observation.targetSourceOrdinal!==spec.event||
  observation.titleMatchCount!==1||!Array.isArray(observation.choiceGroups)||
  observation.choiceGroups.length>12||
  observation.choiceGroups.some(x=>!Array.isArray(x?.fragments)||
   x.fragments.length>150||x.fragments.some(s=>typeof s!=='string'||s.length>350)))
  fail('実サイトの対象見出し・位置またはDOMグループが不正');
 const group=observation.choiceGroups[spec.choice-1];
 const typed=(group?.fragments||[]).filter(s=>{
  const found=matchedEffectKinds(s);
  return found.length===1&&found[0]===spec.type;
 });
 const values=[...new Set(typed.flatMap(signedValues))].sort((a,b)=>a-b);
 const expectedValues=expected.slice().sort((a,b)=>a-b);
 const exact=values.length===2&&values.every((n,i)=>n===expectedValues[i]);
 const oneFragment=typed.some(s=>{
  const ns=[...new Set(signedValues(s))].sort((a,b)=>a-b);
  return ns.length===2&&ns.every((n,i)=>n===expectedValues[i]);
 });
 return {
  cardId:id,sourceEventOrdinal:spec.event,sourceChoiceOrdinal:spec.choice,
  sourceEffectKind:spec.type,expectedSignedValues:expected,
  sourceResultRouteCount:inspectOne(document).expandedResultRoutes,
  displayedMatchingHeadingCount:observation.titleMatchCount,
  displayedOuterChoiceGroups:observation.choiceGroups.length,
  expectedOuterChoiceGroups:EXPECTED[id].choiceCounts[spec.event-1],
  typedNumericFragmentsInTargetGroup:typed.length,
  observedDistinctSignedValuesInTargetGroup:values,
  exactBothNumericAlternativesVisibleInTargetGroup:exact,
  bothValuesCooccurInOneTypedFragment:oneFragment,
  fullChoiceAndOutcomeSemanticsVerified:false,
  appJsonEquivalenceVerified:false,publicationApproved:false,
  originalSourceProseExported:false
 };
}
module.exports={signedValues,inspectVisibleRange};
