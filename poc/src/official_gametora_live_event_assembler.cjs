'use strict';
/*
 * Assemble ONLY an original GameTora page's observed result fragments.
 * Historical GT-derived event JSON and prose are not inputs. Missing and
 * ambiguous result layouts are explicit skips, never fabricated "no reward".
 */
const {siteOnlyNumericDraft}=require('./official_gametora_site_numeric_draft.cjs');
const {hintOnlyDraft}=require('./official_gametora_site_hint_draft.cjs');
const {siteDirectSkillDraft}=require('./official_gametora_direct_skill_draft.cjs');
const {routeFlowCandidates}=require('./official_gametora_site_flow_draft.cjs');
const {buildUnifiedSiteDraft,summarizeUnifiedSiteDraft}=
 require('./official_gametora_site_unified_draft.cjs');
const {scanOwnText}=require('./official_gametora_numeric_fact_parser.cjs');
const {resolveHintContextChain}=require('./official_gametora_skill_id_crosswalk.cjs');
const fail=s=>{throw Error('GameTora新サポカ実表示統合: '+s);};
const good=x=>Number.isSafeInteger(x)&&x>0;
const signature=x=>x.numericId+':'+x.level;
function assembleLiveEvent({cardId,siteEventOrdinal,routePieces,registry}={}){
 if(!/^[1-9]\d{3,6}$/.test(String(cardId??''))||
   !good(siteEventOrdinal)||siteEventOrdinal>100||
   !Array.isArray(routePieces)||routePieces.length>60||
   !(registry?.byName instanceof Map)||!registry.byName.size)
  fail('scope-or-registry-invalid');
 if(!routePieces.length)return {
  status:'no-visible-result-groups',cardId:String(cardId),siteEventOrdinal,
  routeCount:0,publicationApproved:false,appEventSchemaAdoptable:false
 };
 const groups=[];
 let expectedGroup=1,expectedResult=1;
 const directRoutes=[],flowRoutes=[],independentHints=[];
 for(const r of routePieces){
  if(!r||!good(r.choiceOrdinal)||!good(r.outcomeOrdinal)||
     r.choiceOrdinal>20||r.outcomeOrdinal>20||
     !Array.isArray(r.numericEffectTexts)||
     !Array.isArray(r.numericEffectContexts)||
     r.numericEffectTexts.length>80||
     r.numericEffectContexts.length!==r.numericEffectTexts.length||
     !Array.isArray(r.groupOwnTextFragments)||
     !Array.isArray(r.hints)||r.hints.length>60||
     !Array.isArray(r.directOwnTexts)||!Array.isArray(r.flowOwnTexts)||
     typeof r.unresolvedOr!=='boolean')
   fail('invalid-route-shape');
  if(r.choiceOrdinal===expectedGroup+1&&r.outcomeOrdinal===1){
   expectedGroup++;expectedResult=1;
  }
  if(r.choiceOrdinal!==expectedGroup||r.outcomeOrdinal!==expectedResult)
   fail('route-position-gap-duplicate-or-reordering');
  expectedResult++;
  let g=groups[r.choiceOrdinal-1];
  if(!g){
   if(r.groupOwnTextFragments.length>100||
      r.groupOwnTextFragments.some(t=>typeof t!=='string'||t.length>250))
    fail('group-text-out-of-bounds');
   g={orSeparatorCount:0,routeCandidateCount:0,
    numericSegments:[],ownTextFragments:r.groupOwnTextFragments};
   groups.push(g);
  }else if(JSON.stringify(g.ownTextFragments)!==
    JSON.stringify(r.groupOwnTextFragments))
   fail('same-group-provenance-mismatch');
  g.routeCandidateCount++;
  g.orSeparatorCount=g.routeCandidateCount-1;
  g.numericSegments.push({
   effectTexts:r.numericEffectTexts,
   effectContexts:r.numericEffectContexts
  });
  const base={choiceGroupOrdinal:r.choiceOrdinal,resultOrdinal:r.outcomeOrdinal,
   unresolvedOr:r.unresolvedOr};
  directRoutes.push({...base,directOwnTexts:r.directOwnTexts});
  flowRoutes.push({...base,flowOwnTexts:r.flowOwnTexts});
  for(const hint of r.hints){
   const parsed=scanOwnText(hint?.text);
   const match=resolveHintContextChain(hint?.contexts,registry);
   independentHints.push({
    choiceGroupOrdinal:r.choiceOrdinal,resultOrdinal:r.outcomeOrdinal,
    level:parsed?.kind==='skill_hint'&&!parsed.requiresReview?parsed.amount:null,
    match
   });
  }
 }
 if(groups.length>20)fail('too-many-result-groups');
 if(routePieces.some(r=>r.unresolvedOr))return {
  status:'unresolved-or-layout',cardId:String(cardId),siteEventOrdinal,
  routeCount:routePieces.length,publicationApproved:false,
  appEventSchemaAdoptable:false
 };
 const numericDraft=siteOnlyNumericDraft({cardId,siteEventOrdinal,groups});
 const hintDraft=hintOnlyDraft(numericDraft,groups,registry);
 const directDraft=siteDirectSkillDraft({cardId,siteEventOrdinal,registry,routes:directRoutes});
 const flowDraft=routeFlowCandidates({cardId,siteEventOrdinal,routes:flowRoutes});
 const joined=buildUnifiedSiteDraft({numericDraft,hintDraft,directDraft,flowDraft});
 const summary=summarizeUnifiedSiteDraft(joined);
 const hinted=joined.routes.flatMap(r=>r.skillHints.map(h=>({
  choiceGroupOrdinal:r.choiceGroupOrdinal,resultOrdinal:r.resultOrdinal,
  numericId:h.numericId,level:h.level
 })));
 const keys=(items)=>items.map(x=>x.choiceGroupOrdinal+':'+x.resultOrdinal+':'+
  signature(x)).sort().join('|');
 const original=independentHints.filter(x=>x.match.status==='unique-verified-name'&&
  good(x.level)&&x.level<=10).map(x=>({
   choiceGroupOrdinal:x.choiceGroupOrdinal,resultOrdinal:x.resultOrdinal,
   numericId:x.match.numericId,level:x.level
  }));
 // Strict comparator against the older route-local, independently observed
 // hint rows. Route association cannot be silently dropped or reassigned.
 if(original.length!==independentHints.length||
    keys(original)!==keys(hinted)||
    hinted.length!==hintDraft.uniquelyResolvedHintIdLevelPairs){
  const expectedSet=new Set(original.map(x=>x.choiceGroupOrdinal+':'+x.resultOrdinal+
   ':'+signature(x))),actualSet=new Set(hinted.map(x=>x.choiceGroupOrdinal+
   ':'+x.resultOrdinal+':'+signature(x)));
  const missed=[...expectedSet].filter(x=>!actualSet.has(x)).length;
  const extra=[...actualSet].filter(x=>!expectedSet.has(x)).length;
  fail('site-local-hint-id-level-route-drift:event-'+siteEventOrdinal+
   ':independent-'+independentHints.length+':resolved-'+original.length+
   ':unified-'+hinted.length+':missed-'+missed+':extra-'+extra);
 }
 return {
  status:'unified-unapproved',cardId:String(cardId),siteEventOrdinal,
  numericDraft,hintDraft,directDraft,flowDraft,joined,
  summary,
  // Every emitted candidate stays non-public and cannot be loaded by app.
  publicationApproved:false,appEventSchemaAdoptable:false
 };
}
function summarizeLiveEvent(result){
 if(!result||result.publicationApproved!==false||
    result.appEventSchemaAdoptable!==false)
  fail('only-unapproved-site-event');
 if(result.status!=='unified-unapproved')return {
  cardId:result.cardId,siteEventOrdinal:result.siteEventOrdinal,
  status:result.status,routeCount:result.routeCount,
  publicationApproved:false,appEventSchemaAdoptable:false
 };
 const x=result.summary;
 return {cardId:x.cardId,siteEventOrdinal:x.siteEventOrdinal,
  status:result.status,groups:x.groups,routes:x.routes,
  numericEffects:x.numericEffects,skillHints:x.skillHints,
  directSkillCandidates:x.directSkillCandidates,
  visibleFlowMarkers:x.observedFlowMarkers,
  locatedFlowMarkers:x.locatedFlowMarkers,
  reviewReasonCounts:x.routeSummary.flatMap(r=>r.reviewReasons)
   .reduce((out,reason)=>({...out,[reason]:(out[reason]||0)+1}),{}),
  routeSummary:x.routeSummary.map(r=>({
   group:r.group,result:r.result,numericalFacts:r.numericalFacts,
   hints:r.hints,directCandidates:r.directCandidates,
   flowMarkers:r.flowMarkers,unlocatedFlowMarkers:r.unlocatedFlowMarkers
  })),
  allSkillAwardsVerified:false,continuationRequiresVerified:false,
  publicationApproved:false,appEventSchemaAdoptable:false};
}
module.exports={assembleLiveEvent,summarizeLiveEvent};
