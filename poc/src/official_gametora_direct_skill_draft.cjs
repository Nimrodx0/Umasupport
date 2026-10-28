'use strict';
/*
 * A strict site-only recognizer for DIRECT skill acquisition statements.
 * A hint bonus is NEVER a direct grant. Only an explicit, quoted, locally
 * named award may become an unapproved numeric ID candidate.
 *
 * Inputs are DOM-own text fragments observed inside verified result roots and
 * an independently pinned UmaSim registry. Old GT mirrors are NOT inputs.
 * No source prose, names, or HTML are returned.
 */
const fail=reason=>{throw Error('GameTora直接スキル獲得候補: '+reason);};
const quoted=/(?:スキル\s*)?[「『]([^「『」』\n]{1,80})[」』]\s*(?:(?:の)?\s*スキル\s*)?(?:を\s*)?(?:獲得|習得|取得)(?!できない|しない|不可)/gu;
const norm=x=>x.normalize('NFKC').replace(/\s+/g,' ').trim();
function classifyAwardLeaf(own,registry){
 if(typeof own!=='string'||own.length>300||!(registry?.byName instanceof Map))
  fail('bad-leaf-or-registry');
 if(!/(?:獲得|習得|取得)/.test(own))return {status:'not-explicit-direct-grant'};
 if(/(?:ヒント|hint|スキル\s*(?:Pt|ポイント)|skill\s*points)/i.test(own))
  return {status:'not-explicit-direct-grant'};
 const m=[...own.matchAll(quoted)];
 if(m.length!==1)
  return {status:m.length?'ambiguous-multiple-direct-grants':'direct-grant-name-not-explicit'};
 const label=norm(m[0][1]);
 const matching=[];
 for(const [name,records] of registry.byName){
  if(norm(name)===label)matching.push(...records);
 }
 if(!matching.length)return {status:'direct-grant-skill-absent-in-registry'};
 if(matching.length!==1)return {status:'direct-grant-skill-id-ambiguous'};
 const item=matching[0];
 if(!/^[1-9]\d*$/.test(String(item.id))||
    !['normal','rare'].includes(item.rarity))
  return {status:'direct-grant-skill-rarity-or-id-unsupported'};
 return {status:'unique-provisional-direct-grant',numericId:item.id,rarity:item.rarity};
}
function siteDirectSkillDraft({cardId,siteEventOrdinal,routes,registry}={}){
 if(!/^\d{4,7}$/.test(String(cardId??''))||
    !Number.isSafeInteger(siteEventOrdinal)||siteEventOrdinal<1||
    siteEventOrdinal>100||!Array.isArray(routes)||routes.length>150||
    !(registry?.byName instanceof Map))fail('draft-identity-or-registry-invalid');
 const seen=new Set();
 let directLikeTexts=0,resolved=0,unresolved=0;
 const entries=routes.map(route=>{
  if(!Number.isSafeInteger(route?.choiceGroupOrdinal)||route.choiceGroupOrdinal<1||
     !Number.isSafeInteger(route.resultOrdinal)||route.resultOrdinal<1||
     !Array.isArray(route.directOwnTexts)||route.directOwnTexts.length>80||
     route.directOwnTexts.some(x=>typeof x!=='string'||x.length>300)||
     typeof route.unresolvedOr!=='boolean')
   fail('malformed-route');
  const key=route.choiceGroupOrdinal+':'+route.resultOrdinal;
  if(seen.has(key))fail('duplicate-result-location');
  seen.add(key);
  const candidates=[],issues=[];
  for(const own of route.directOwnTexts){
   const result=classifyAwardLeaf(own,registry);
   if(result.status==='not-explicit-direct-grant')continue;
   directLikeTexts++;
   if(result.status==='unique-provisional-direct-grant'&&!route.unresolvedOr){
    candidates.push({numericId:result.numericId,rarity:result.rarity,
     choiceGroupOrdinal:route.choiceGroupOrdinal,resultOrdinal:route.resultOrdinal,
     source:'gametora-visible-explicit-direct-award'});
    resolved++;
   }else{
    issues.push(route.unresolvedOr?'or-route-unresolved':result.status);
    unresolved++;
   }
  }
  return {choiceGroupOrdinal:route.choiceGroupOrdinal,resultOrdinal:route.resultOrdinal,
   provisionalDirectGrants:candidates,unresolvedReasons:[...new Set(issues)].sort(),
   otherSkillRewardsComplete:false};
 });
 return {dataKind:'official-gametora-site-direct-skill-draft',version:1,
  cardId:String(cardId),siteEventOrdinal,
  routesInspected:entries.length,directLikeTexts,
  uniquelyMatchedDirectSkillCandidates:resolved,unresolvedDirectLikeTexts:unresolved,
  routeCandidates:entries,
  allDirectSkillEffectsFound:false,allHintEffectsFound:false,
  siteOnlyTextScanCoverage:'strict-explicit-quoted-leaf-only',
  gameEffectSemanticsVerified:false,
  appEventSchemaAdoptable:false,publicationApproved:false,sourceProseExported:false};
}
function summarizeDirectSkillDraft(draft){
 if(draft?.dataKind!=='official-gametora-site-direct-skill-draft'||
  draft.appEventSchemaAdoptable!==false||draft.publicationApproved!==false)
  fail('not-a-provisional-draft');
 return {cardId:draft.cardId,siteEventOrdinal:draft.siteEventOrdinal,
  resultRoutes:draft.routesInspected,explicitDirectLikeLeafTexts:draft.directLikeTexts,
  unapprovedDirectSkillCandidates:draft.uniquelyMatchedDirectSkillCandidates,
  unresolvedDirectLikeLeafTexts:draft.unresolvedDirectLikeTexts,
  candidates:draft.routeCandidates.flatMap(r=>r.provisionalDirectGrants),
  reasonCounts:draft.routeCandidates.flatMap(r=>r.unresolvedReasons)
   .reduce((x,s)=>({...x,[s]:(x[s]||0)+1}),{}),
  siteTextScanCompletenessVerified:false,
  appEventSchemaAdoptable:false,publicationApproved:false};
}
module.exports={classifyAwardLeaf,siteDirectSkillDraft,summarizeDirectSkillDraft};
