'use strict';
/*
 * Prototype numeric fact interpreter for already-rendered GameTora card UI.
 * It never emits page labels, skill names or raw source text.
 * Candidate effects are not approved, and do not imply route identity.
 */
const KINDS=[
 ['skill_hint',/ヒント|hint/i],
 ['skill_points',/スキル(?:Pt|ポイント)|skill\s*points|skill\s*pt/i],
 ['max_energy',/最大体力|max\s*(?:energy|stamina)/i],
 ['energy',/体力|energy/i],
 ['speed',/スピード|speed/i],
 ['stamina',/スタミナ|stamina/i],
 ['power',/パワー|power/i],
 ['guts',/根性|guts/i],
 ['wisdom',/賢さ|wisdom|wit/i],
 ['bond',/絆|友情ゲージ|bond|friendship\s*gauge/i],
 ['mood',/やる気|mood/i]
];
const AMOUNT=/([+＋\-－−])\s*(\d{1,5})(?!\d)/g;
const matchedEffectKinds=text=>typeof text==='string'?KINDS.filter(([,pattern])=>pattern.test(text)).map(([kind])=>kind):[];
function scanOwnText(text){
 if(typeof text!=='string')return null;
 const nums=[...text.matchAll(AMOUNT)].map(m=>({sign:/[+＋]/.test(m[1])?1:-1,value:Number(m[2])}));
 if(!nums.length)return null;
 const kinds=matchedEffectKinds(text);
 return {
  kind:kinds.length===1?kinds[0]:'unclassified',
  amount:nums.length===1?nums[0].sign*nums[0].value:null,
  count:nums.length,
  requiresReview:kinds.length!==1||nums.length!==1
 };
}
function sourceFacts(event){
 if(!event||!Array.isArray(event.choices))throw Error('元イベントの選択肢を特定できない');
 const all=[];
 for(const choice of event.choices){
  const branches=Array.isArray(choice.outcomes)?choice.outcomes:[choice.effects||[]];
  for(const list of branches)for(const fact of list){
   if(!fact||typeof fact.type!=='string'||!fact.value)continue;
   const value=Number(fact.value);
   if(!Number.isFinite(value))continue;
   const kind=fact.type;
   if(!KINDS.some(([k])=>k===kind))continue;
   all.push({kind,amount:value});
  }
 }
 return all;
}
function compareProvisionalFacts(source,observed){
 const sourceItems=sourceFacts(source),
  parsed=observed.filter(f=>f.kind!=='unclassified'&&f.amount!==null);
 const bag=items=>{
  const m=new Map();
  for(const e of items){
   const key=e.kind+':'+e.amount;
   m.set(key,(m.get(key)||0)+1);
  }
  return m;
 };
 const a=bag(sourceItems),b=bag(parsed);
 let matched=0,missing=0,extra=0;
 const missingEffectKinds={};
 for(const [k,count] of a){
  matched+=Math.min(count,b.get(k)||0);
  const deficit=Math.max(0,count-(b.get(k)||0));
  missing+=deficit;
  if(deficit){const kind=k.split(':')[0];missingEffectKinds[kind]=(missingEffectKinds[kind]||0)+deficit;}
 }
 for(const [k,count] of b)extra+=Math.max(0,count-(a.get(k)||0));
 return {
  sourceNumericFacts:sourceItems.length,visibleRecognizedFacts:parsed.length,
  sourceNormalizedNumericPairs:sourceItems,
  visibleNormalizedNumericPairs:parsed.map(x=>({kind:x.kind,amount:x.amount})),
  visibleUnclassifiedFacts:observed.filter(x=>x.requiresReview).length,
  matchingKindAmountOccurrences:matched,missingComparedToSource:missing,
  missingEffectKinds,extraComparedToSource:extra,
  sourceHintLevelOccurrences:sourceItems.filter(x=>x.kind==='skill_hint').length,
  visibleHintLevelOccurrences:parsed.filter(x=>x.kind==='skill_hint').length,
  skillHintLevelMultisetMatches:(()=>{
   const expected=sourceItems.filter(x=>x.kind==='skill_hint').map(x=>x.amount).sort((a,b)=>a-b);
   const actual=parsed.filter(x=>x.kind==='skill_hint').map(x=>x.amount).sort((a,b)=>a-b);
   return JSON.stringify(expected)===JSON.stringify(actual);
  })(),
  effectOrderingOrBranchingVerified:false,skillNumericIdsVerified:false,
  sourceTextIncluded:false,publicationApproved:false
 };
}
module.exports={scanOwnText,matchedEffectKinds,sourceFacts,compareProvisionalFacts};
