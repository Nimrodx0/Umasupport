'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {compareNumericRoutes}=require('../src/official_gametora_old_numeric_route_parity.cjs');
function oldEvent(){
 const fx=(type,value)=>({type,value});
 return {choices:[
  {label:'synthetic 1',outcomes:[
   [fx('max_energy','+4'),fx('energy','+10'),fx('mood','+1'),fx('bond','+10')],
   [fx('skill_points','+50'),fx('obtain_skill',null),fx('bond','+5')]
  ]},
  {label:'synthetic 2',effects:[fx('mood','+1'),fx('stamina','+10'),fx('bond','+5')]},
  {label:'synthetic 3',effects:[fx('energy','-10'),fx('skill_points','+100'),
   fx('skill_hint','+1'),fx('obtain_skill',null),fx('bond','-10'),fx('chain_end',null)]}
 ]};
}
function group(...texts){return {effectTexts:texts,effectContexts:texts.map(()=>[])};}
function site(){
 return [
  [group('最大体力 +4','体力 +10','やる気 +1','友情ゲージ +10'),
   group('スキルPt +50','友情ゲージ +5')],
  [group('やる気 +1','スタミナ +10','友情ゲージ +5')],
  [group('体力 -10','スキルPt +100','ヒントLv +1','友情ゲージ -10')]
 ];
}
test('all four routes and all scalar facts are uniquely matched by typed numbers, not choice prose',()=>{
 const result=compareNumericRoutes(oldEvent(),site());
 assert.equal(result.referenceChoices,3);
 assert.equal(result.referenceResultRoutes,4);
 assert.equal(result.referenceScalarEffects,12);
 assert.equal(result.siteScalarEffects,12);
 assert.equal(result.uniquelyMatchedNumericRoutes,4);
 assert.equal(result.everyNumericResultRouteOneToOne,true);
 assert.equal(result.allObservedSignedScalarFactsParsed,true);
 assert.equal(result.historicalValueOrEffectKindDriftObserved,false);
 assert.equal(result.skillHintIdAndLevelVerified,false);
 assert.equal(result.directSkillGrantVerified,false);
 assert.equal(result.bondRecipientIdentityVerified,false);
 assert.equal(result.publicationApproved,false);
 assert.doesNotMatch(JSON.stringify(result),/synthetic/);
});
test('a permutation of two OR outcome rows is matched by facts not ordinal assumptions',()=>{
 const observed=site();
 observed[0].reverse();
 const result=compareNumericRoutes(oldEvent(),observed);
 assert.equal(result.everyNumericResultRouteOneToOne,true);
 assert.deepEqual(result.links.slice(0,2).map(x=>x.renderedRouteOrdinal),[2,1]);
});
test('cross-route swaps, unknown numbers and missing values cannot fake parity',()=>{
 const observed=site();
 observed[0][0].effectTexts[0]='最大体力 +999';
 const changed=compareNumericRoutes(oldEvent(),observed);
 assert.equal(changed.everyNumericResultRouteOneToOne,false);
 assert.equal(changed.allObservedSignedScalarFactsParsed,true);
 assert.equal(changed.historicalValueOrEffectKindDriftObserved,true);
 const wrong=site();wrong[0][1].effectTexts.push('謎 +55');
 wrong[0][1].effectContexts.push([]);
 assert.equal(compareNumericRoutes(oldEvent(),wrong).everyNumericResultRouteOneToOne,false);
 const missing=site();missing[2][0].effectTexts.pop();missing[2][0].effectContexts.pop();
 assert.equal(compareNumericRoutes(oldEvent(),missing).everyNumericResultRouteOneToOne,false);
});
test('non-numeric direct skill grants and hints are not counted as verified scalar facts',()=>{
 const observed=site();
 const result=compareNumericRoutes(oldEvent(),observed);
 assert.ok(result.rows[2].sourceExcludedKinds.includes('skill_hint'));
 assert.ok(result.rows[0].sourceExcludedKinds.includes('obtain_skill'));
 assert.ok(result.rows[2].siteExcludedKinds.includes('skill_hint'));
});
test('mismatched choice cardinality, unsupported source values and excessive text are rejected',()=>{
 assert.throws(()=>compareNumericRoutes(oldEvent(),[site()[0]]),/不正/);
 const bad=oldEvent();
 bad.choices[0].outcomes[0][0].value='+4/+9';
 assert.throws(()=>compareNumericRoutes(bad,site()),/単一スカラー/);
 const badSite=site();
 badSite[0][0].effectTexts[0]='x'.repeat(401);
 assert.throws(()=>compareNumericRoutes(oldEvent(),badSite),/上限/);
});
