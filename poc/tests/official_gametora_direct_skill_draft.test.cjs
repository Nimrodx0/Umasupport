'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {registryFromSkillText}=require('../src/official_gametora_skill_id_crosswalk.cjs');
const {classifyAwardLeaf,siteDirectSkillDraft,summarizeDirectSkillDraft}=
 require('../src/official_gametora_direct_skill_draft.cjs');
const reg=()=>registryFromSkillText(JSON.stringify([
 ...Array.from({length:100},(_,i)=>({id:String(900000+i),name:'合成スキル'+i,
  rarity:'normal',group:i})),
 {id:'201',name:'山登り',rarity:'normal',group:501},
 {id:'202',name:'星降り',rarity:'rare',group:502},
 {id:'203',name:'重複',rarity:'normal',group:503},
 {id:'204',name:'重複',rarity:'rare',group:504},
 {id:'205',name:'特殊状態',rarity:'minus',group:505}
]));
const route=(ci,ri,texts,unresolvedOr=false)=>({
 choiceGroupOrdinal:ci,resultOrdinal:ri,directOwnTexts:texts,unresolvedOr
});
test('one explicit Japanese direct skill award yields exactly an unapproved numeric ID',()=>{
 const x=classifyAwardLeaf('スキル「山登り」を獲得',reg());
 assert.deepEqual(x,{status:'unique-provisional-direct-grant',numericId:'201',rarity:'normal'});
 assert.deepEqual(classifyAwardLeaf('「星降り」を習得',reg()),{
  status:'unique-provisional-direct-grant',numericId:'202',rarity:'rare'});
});
test('a hint award, skill point gain, or implied reward does NOT become a direct skill',()=>{
 for(const s of ['「山登り」のヒントLv +2','「山登り」のヒントを獲得',
  'スキルPt +35','スキルポイントを獲得','「山登り」', 'スキル「山登り」が手に入る']){
  assert.notEqual(classifyAwardLeaf(s,reg()).status,'unique-provisional-direct-grant');
 }
});
test('two distinct directly awarded names, unknown name, duplicate name and rarity are held',()=>{
 assert.equal(classifyAwardLeaf('「山登り」を獲得 「星降り」を獲得',reg()).status,
  'ambiguous-multiple-direct-grants');
 assert.equal(classifyAwardLeaf('「実在しない」を獲得',reg()).status,
  'direct-grant-skill-absent-in-registry');
 assert.equal(classifyAwardLeaf('「重複」を取得',reg()).status,
  'direct-grant-skill-id-ambiguous');
 assert.equal(classifyAwardLeaf('「特殊状態」を習得',reg()).status,
  'direct-grant-skill-rarity-or-id-unsupported');
});
test('a vague acquisition fragment cannot inherit a different route skill name',()=>{
 const x=siteDirectSkillDraft({cardId:'30322',siteEventOrdinal:3,registry:reg(),
  routes:[route(1,1,['獲得']),route(1,2,['「山登り」を獲得'])]});
 assert.equal(x.directLikeTexts,2);
 assert.equal(x.uniquelyMatchedDirectSkillCandidates,1);
 assert.equal(x.unresolvedDirectLikeTexts,1);
 assert.deepEqual(x.routeCandidates[0].provisionalDirectGrants,[]);
 assert.deepEqual(x.routeCandidates[1].provisionalDirectGrants.map(x=>x.numericId),['201']);
});
test('explicit OR that cannot be separated never assigns a direct skill to its first route',()=>{
 const x=siteDirectSkillDraft({cardId:'30322',siteEventOrdinal:3,registry:reg(),
  routes:[route(1,1,['「山登り」を獲得'],true)]});
 assert.equal(x.uniquelyMatchedDirectSkillCandidates,0);
 assert.equal(x.unresolvedDirectLikeTexts,1);
 assert.deepEqual(x.routeCandidates[0].unresolvedReasons,['or-route-unresolved']);
});
test('result-specific direct skill remains separate from its hint and other routes',()=>{
 const x=siteDirectSkillDraft({cardId:'30322',siteEventOrdinal:3,registry:reg(),
  routes:[
   route(1,1,['「山登り」を獲得','「星降り」のヒントLv +1']),
   route(1,2,['「星降り」を習得']),route(2,1,[])
  ]});
 const y=summarizeDirectSkillDraft(x);
 assert.equal(y.resultRoutes,3);
 assert.equal(y.unapprovedDirectSkillCandidates,2);
 assert.equal(y.unresolvedDirectLikeLeafTexts,0);
 assert.equal(y.candidates[0].choiceGroupOrdinal,1);
 assert.equal(y.candidates[0].resultOrdinal,1);
 assert.equal(y.candidates[1].resultOrdinal,2);
 assert.equal(y.appEventSchemaAdoptable,false);
 assert.equal(x.allDirectSkillEffectsFound,false);
 assert.equal(x.publicationApproved,false);
 assert.doesNotMatch(JSON.stringify(x),/山登り|星降り/);
});
test('zero observed direct rewards is NOT evidence of no direct rewards',()=>{
 const x=siteDirectSkillDraft({cardId:'30323',siteEventOrdinal:1,registry:reg(),
  routes:[route(1,1,['体力 +15'])]});
 assert.equal(x.uniquelyMatchedDirectSkillCandidates,0);
 assert.equal(x.allDirectSkillEffectsFound,false);
 assert.equal(summarizeDirectSkillDraft(x).siteTextScanCompletenessVerified,false);
});
test('bad registry, route identifiers, oversized text and duplicated coordinates are rejected',()=>{
 assert.throws(()=>classifyAwardLeaf('text',null),/bad-leaf-or-registry/);
 assert.throws(()=>siteDirectSkillDraft({cardId:'x',siteEventOrdinal:1,
  routes:[],registry:reg()}),/invalid/);
 assert.throws(()=>siteDirectSkillDraft({cardId:'30322',siteEventOrdinal:1,
  routes:[route(1,1,[]),route(1,1,[])],registry:reg()}),/duplicate/);
 assert.throws(()=>siteDirectSkillDraft({cardId:'30322',siteEventOrdinal:1,
  routes:[route(1,1,['x'.repeat(301)])],registry:reg()}),/malformed/);
});
