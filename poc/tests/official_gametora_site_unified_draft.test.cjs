'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {registryFromSkillText}=require('../src/official_gametora_skill_id_crosswalk.cjs');
const {siteOnlyNumericDraft}=require('../src/official_gametora_site_numeric_draft.cjs');
const {hintOnlyDraft}=require('../src/official_gametora_site_hint_draft.cjs');
const {siteDirectSkillDraft}=require('../src/official_gametora_direct_skill_draft.cjs');
const {routeFlowCandidates}=require('../src/official_gametora_site_flow_draft.cjs');
const {buildUnifiedSiteDraft,summarizeUnifiedSiteDraft}=
 require('../src/official_gametora_site_unified_draft.cjs');
const registry=()=>registryFromSkillText(JSON.stringify([
 ...Array.from({length:100},(_,i)=>({id:String(700000+i),
  name:'合成'+i,rarity:'normal',group:i})),
 {id:'200516',name:'登山家',rarity:'normal',group:501},
 {id:'200517',name:'夜行',rarity:'rare',group:502}
]));
function fixture(){
 const rg=registry();
 const groups=[
  {orSeparatorCount:1,routeCandidateCount:2,
   ownTextFragments:[],visibleText:'',
   numericSegments:[
    {effectTexts:['体力 +16','「登山家」のヒントLv +2'],
     effectContexts:[[],['「登山家」のヒントLv +2']]},
    {effectTexts:['スピード +5'],effectContexts:[[]]}
   ]},
  {orSeparatorCount:0,routeCandidateCount:1,
   ownTextFragments:[],visibleText:'',
   numericSegments:[
    {effectTexts:['スキルPt +75'],effectContexts:[[]]}
   ]}
 ];
 const numericDraft=siteOnlyNumericDraft({cardId:'30322',siteEventOrdinal:3,groups});
 const hintDraft=hintOnlyDraft(numericDraft,groups,rg);
 const routes=[
  {choiceGroupOrdinal:1,resultOrdinal:1,unresolvedOr:false,
   directOwnTexts:['「夜行」を獲得'],flowOwnTexts:[]},
  {choiceGroupOrdinal:1,resultOrdinal:2,unresolvedOr:false,
   directOwnTexts:[],flowOwnTexts:['連続イベント終了']},
  {choiceGroupOrdinal:2,resultOrdinal:1,unresolvedOr:false,
   directOwnTexts:[],flowOwnTexts:['お出かけができるようになる']}
 ];
 const directDraft=siteDirectSkillDraft({cardId:'30322',siteEventOrdinal:3,
  registry:rg,routes});
 const flowDraft=routeFlowCandidates({cardId:'30322',siteEventOrdinal:3,routes});
 return {numericDraft,hintDraft,directDraft,flowDraft};
}
const clone=x=>structuredClone(x);
test('join uses same exact result coordinates with no implicit aggregation or distribution',()=>{
 const sample=fixture(),result=buildUnifiedSiteDraft(sample),sum=summarizeUnifiedSiteDraft(result);
 assert.equal(result.visibleGroupCount,2);
 assert.equal(result.visibleRouteCount,3);
 assert.equal(result.numericEffectCount,3);
 assert.equal(result.uniqueSkillHintCount,1);
 assert.equal(result.explicitDirectSkillCandidateCount,1);
 assert.equal(result.observedVisibleFlowMarkerCount,2);
 assert.equal(result.routes[0].skillHints[0].numericId,'200516');
 assert.equal(result.routes[0].directSkills[0].numericId,'200517');
 assert.equal(result.routes[1].skillHints.length,0);
 assert.equal(result.routes[1].directSkills.length,0);
 assert.deepEqual(result.routes[1].visibleFlowMarkers,['explicit-chain-stop']);
 assert.deepEqual(result.routes[2].visibleFlowMarkers,['explicit-outing-unlock']);
 assert.equal(sum.routeSummary[0].group,1);
 assert.equal(sum.routeSummary[2].group,2);
 assert.equal(result.appEventSchemaAdoptable,false);
 assert.equal(result.publicationApproved,false);
 assert.equal(result.skillAwardCompletenessVerified,false);
 assert.equal(Object.hasOwn(result,'rewards'),false);
 assert.equal(Object.hasOwn(result,'requires'),false);
 assert.equal(Object.hasOwn(result.routes[0],'rewards'),false);
 assert.equal(Object.hasOwn(result.routes[0],'terminal'),false);
 assert.doesNotMatch(JSON.stringify(result),/登山家|夜行|連続イベント終了/);
});
test('identity drift rejects silently joining another card or event',()=>{
 const a=fixture(),b=clone(a.hintDraft);
 b.cardId='30323';
 assert.throws(()=>buildUnifiedSiteDraft({...a,hintDraft:b}),/scope-or-approval-mismatch/);
 b.cardId='30322';b.siteEventOrdinal=4;
 assert.throws(()=>buildUnifiedSiteDraft({...a,hintDraft:b}),/scope-or-approval-mismatch/);
});
test('missing, added and swapped routes are rejected instead of left-joining',()=>{
 const a=fixture(),d=clone(a.directDraft);
 d.routeCandidates=d.routeCandidates.slice(0,2);
 assert.throws(()=>buildUnifiedSiteDraft({...a,directDraft:d}),/cardinality-mismatch/);
 const e=clone(a.flowDraft);
 [e.routes[0],e.routes[1]]=[e.routes[1],e.routes[0]];
 assert.throws(()=>buildUnifiedSiteDraft({...a,flowDraft:e}),/route-order-or-field-mismatch/);
 const h=clone(a.hintDraft);
 h.routeCandidates[0].pop();
 assert.throws(()=>buildUnifiedSiteDraft({...a,hintDraft:h}),/route-topology-mismatch/);
});
test('contradictory counts, invalid effects and wrong grant location fail closed',()=>{
 const a=fixture();
 const x=clone(a.numericDraft);x.observedScalarEffectCount++;
 assert.throws(()=>buildUnifiedSiteDraft({...a,numericDraft:x}),/count-or-meaning-drift/);
 const y=clone(a.numericDraft);y.candidates[0].routeCandidates[0].effects[0].delta=0;
 assert.throws(()=>buildUnifiedSiteDraft({...a,numericDraft:y}),/invalid-scalar/);
 const z=clone(a.directDraft);
 z.routeCandidates[0].provisionalDirectGrants[0].resultOrdinal=2;
 assert.throws(()=>buildUnifiedSiteDraft({...a,directDraft:z}),/mislocated/);
});
test('unresolved OR flow marker must not be assigned to a specific outcome',()=>{
 const a=fixture(),r=clone(a.flowDraft);
 r.routes[1].safelyAttributedToResult=false;
 r.locatedVisibleMarkerKinds=1;
 r.unlocatedVisibleMarkerKinds=1;
 const result=buildUnifiedSiteDraft({...a,flowDraft:r});
 assert.deepEqual(result.routes[1].visibleFlowMarkers,[]);
 assert.deepEqual(result.routes[1].unlocatedVisibleFlowMarkers,['explicit-chain-stop']);
 assert.ok(result.routes[1].unresolvedReasons.includes('flow-marker-route-unresolved'));
 assert.equal(result.routes[1].explicitChainEdgeVerified,false);
});
test('even verified visible marker does not create an app terminal or next requires',()=>{
 const result=buildUnifiedSiteDraft(fixture());
 assert.equal(result.continuationRequiresVerified,false);
 assert.equal(result.resultExclusivityVerified,false);
 assert.equal(result.routes[1].explicitChainEdgeVerified,false);
 assert.equal(result.routes[1].gameOutcomeMeaningVerified,false);
 assert.equal(result.routes[2].allAwardsExhaustive,false);
});
test('source publication claims, old-source text and invalid reward ID never leak',()=>{
 const a=fixture(),x=clone(a.flowDraft);
 x.publicationApproved=true;
 assert.throws(()=>buildUnifiedSiteDraft({...a,flowDraft:x}),/scope-or-approval-mismatch/);
 const y=clone(a.hintDraft);y.sourceWebsiteProseExported=true;
 assert.throws(()=>buildUnifiedSiteDraft({...a,hintDraft:y}),/provenance-or-completeness/);
 const z=clone(a.hintDraft);z.routeCandidates[0][0].hints[0].numericId='bad';
 assert.throws(()=>buildUnifiedSiteDraft({...a,hintDraft:z}),/mislocated-or-invalid/);
});
test('all source drafts must be supplied and a published output cannot summarize',()=>{
 const a=fixture();
 assert.throws(()=>buildUnifiedSiteDraft({numericDraft:a.numericDraft}),/scope-or-approval/);
 const result=buildUnifiedSiteDraft(a);
 assert.throws(()=>summarizeUnifiedSiteDraft({...result,publicationApproved:true}),/only-unapproved/);
});
