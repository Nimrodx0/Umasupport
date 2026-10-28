'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {sha,normalize,textContainsFingerprint,evaluateOutingEvidence,validateLedger}=
 require('../src/official_gametora_azuma_outing_evidence.cjs');
const pinned=require('../review/outing-evidence-30323.v1.json');
test('a normalized title substring has one SHA match without logging text',()=>{
 const title='架空のイベント';
 const hash={length:Array.from(normalize(title)).length,sha256:sha(normalize(title))};
 assert.equal(textContainsFingerprint('SSR - '+title+' (イベント)',hash),true);
 assert.equal(textContainsFingerprint('別のイベント',hash),false);
 assert.doesNotMatch(JSON.stringify(hash),/架空/);
 const alt={length:4,sha256:sha(normalize('試験ーー'))};
 assert.equal(textContainsFingerprint('試験――',alt),true);
});
test('pinned six names have complete and unambiguous editorial provenance schema',()=>{
 assert.equal(validateLedger(pinned).titles.length,6);
 assert.equal(pinned.gameWithExplicitOutingUnlockChoiceOrdinals.length,2);
 assert.equal(pinned.automaticPublicationAllowed,false);
 const other=structuredClone(pinned);other.canonicalGender='female';
 assert.throws(()=>validateLedger(other),/不正/);
 const wrong=structuredClone(pinned);wrong.editorialOrderIsConfirmedPlayableStageDependency=true;
 assert.throws(()=>validateLedger(wrong),/不正/);
});
test('explicit GameWith two-branch unlock only adjudicates matching original-site event',()=>{
 const copy=structuredClone(pinned);
 const titles=['A','B','C','D','E','F'];
 copy.titles.forEach((x,i)=>{x.sha256=sha(titles[i]);x.length=1;});
 const render=titles.map((t,i)=>({title:'イベント '+t,choiceGroups:i===0||i===3?2:1,
   siteExplicitUnlockChoiceGroups:i===0?1:0,
   siteExplicitTerminalChoiceGroups:0}));
 const r=evaluateOutingEvidence(copy,render);
 assert.equal(r.siteMatchingEventHeadings,6);
 assert.equal(r.editorialChoiceCountCorroborated,6);
 assert.equal(r.firstEventBothChoicesExplicitlyEnableOutingsInGameWith,true);
 assert.equal(r.editorialUnlockFactAdoptableForPrivateCandidate,true);
 assert.equal(r.officialSiteExplicitUnlockOnFirstEvent,1);
 assert.equal(r.privateUnlockRouteCandidate,null);
 assert.equal(r.siteEffectTypeIndependentlyCorroborated,false);
 assert.equal(r.playSequenceAndOutingReachabilityVerified,false);
 assert.equal(r.outingEndStateVerified,false);
 assert.equal(r.publicationApproved,false);
 assert.doesNotMatch(JSON.stringify(r),/イベント A/);
});
test('duplicate or missing heading blocks private unlock attribution',()=>{
 const copy=structuredClone(pinned);
 copy.titles.forEach((x,i)=>{x.sha256=sha(String.fromCharCode(65+i));x.length=1;});
 const r=evaluateOutingEvidence(copy,[{
  title:'A',choiceGroups:2,siteExplicitUnlockChoiceGroups:0,siteExplicitTerminalChoiceGroups:0},{
  title:'A',choiceGroups:2,siteExplicitUnlockChoiceGroups:0,siteExplicitTerminalChoiceGroups:0}]);
 assert.equal(r.editorialUnlockFactAdoptableForPrivateCandidate,false);
 assert.equal(r.siteMatchingHeadingsUniqueAndDistinct,false);
 const uncorroborated=evaluateOutingEvidence(copy,[{
  title:'A',choiceGroups:1,siteExplicitUnlockChoiceGroups:0,siteExplicitTerminalChoiceGroups:0}]);
 assert.equal(uncorroborated.editorialUnlockFactAdoptableForPrivateCandidate,false);
});
test('unknown display data or too many claimed explicit markers is rejected',()=>{
 assert.throws(()=>evaluateOutingEvidence(pinned,[{
  title:'anything',choiceGroups:1,siteExplicitUnlockChoiceGroups:2,
  siteExplicitTerminalChoiceGroups:0
 }]),/不正/);
 assert.throws(()=>evaluateOutingEvidence(pinned,[{
  title:'anything',choiceGroups:1,siteExplicitUnlockChoiceGroups:0,
  siteExplicitTerminalChoiceGroups:2
 }]),/不正/);
});


test('site and GameWith both explicitly confirm two opening choices; graph remains private and sequence unknown',()=>{
 const copy=structuredClone(pinned);
 copy.titles.forEach((x,i)=>{x.sha256=sha(String.fromCharCode(65+i));x.length=1;});
 const r=evaluateOutingEvidence(copy,[{
  title:'A',choiceGroups:2,
  siteExplicitUnlockChoiceGroups:2,
  siteExplicitTerminalChoiceGroups:0
 }]);
 assert.equal(r.bothOriginalSiteChoiceGroupsExplicitlyUnlock,true);
 assert.deepEqual(r.privateUnlockRouteCandidate,{
  cardId:'30323',siteEventOrdinal:1,choiceOrdinals:[1,2],
  effectKind:'enable-outings',conditionalOnPlayerChoice:true,
  outingEventSequenceVerified:false,outingClosureVerified:false,
  publicationApproved:false
 });
 assert.equal(r.playSequenceAndOutingReachabilityVerified,false);
 assert.equal(r.siteEffectTypeIndependentlyCorroborated,true);
});
