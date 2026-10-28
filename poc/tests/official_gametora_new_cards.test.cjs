'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {TARGETS}=require('../src/official_gametora_probe.cjs');
const {validateTargets,summarizeEvents,summarizeExpandedCensus,verifyPinnedNewCardCandidate}=
 require('../tools/probe_official_gametora_new_cards.cjs');
test('fixed allowlist permits only 30322 and 30323, never 30001 or custom URL',()=>{
 const targets=TARGETS.filter(t=>t.cardId!=='30001');
 assert.deepEqual(validateTargets(targets).map(x=>x.cardId),['30322','30323']);
 assert.throws(()=>validateTargets(TARGETS),/固定2枚/);
 assert.throws(()=>validateTargets([targets[1],targets[0]]),/固定2枚/);
 assert.throws(()=>validateTargets([{cardId:'30322',slug:'fake'},targets[1]]),/固定2枚/);
});
test('rendered observation is strictly structural and never approves event contents',()=>{
 const info=summarizeEvents({accordionButtons:8,trainingSections:1,
  chainSections:1,randomSections:1,outingSections:0,
  chainHeadings:1,randomHeadings:1,outingHeadings:0,
  sampledEventPanels:2,sampledPanelsWithNumericEffects:1});
 assert.equal(info.supportEventAccordions,8);
 assert.equal(info.sampledPanelsWithNumericEffects,1);
 assert.equal(info.chainHeadingCount,1);
 assert.equal(info.eventRewardRoutesVerified,false);
 assert.equal(info.choiceWordingVerified,false);
 assert.equal(info.independentSkillIdVerified,false);
 assert.equal(info.publicationApproved,false);
 assert.deepEqual(Object.values(info).filter(x=>typeof x==='string'),[]);
});
test('unobserved fields do not become a false empty event catalog',()=>{
 assert.throws(()=>summarizeEvents({accordionButtons:0}),/不正/);
 const empty=summarizeEvents({accordionButtons:0,trainingSections:0,
  chainSections:0,randomSections:0,outingSections:0,
  chainHeadings:0,randomHeadings:0,outingHeadings:0,
  sampledEventPanels:0,sampledPanelsWithNumericEffects:0});
 assert.equal(empty.supportEventAccordions,0);
 assert.equal(empty.eventRewardRoutesVerified,false);
});

test('new-card event topology sums candidate groups and explicit OR without claiming verified choices',()=>{
 const row=(choiceGroups,orMarkers,hintCandidates,uniqueSkillIdHints)=>({
  eventPanelHasContent:1,choiceGroups,orMarkers,signedNumericLeaves:4,
  hintCandidates,uniqueSkillIdHints,
  unresolvedSkillIdHints:hintCandidates-uniqueSkillIdHints
 });
 const result=summarizeExpandedCensus([
  row(2,0,1,1),row(1,1,2,1),row(1,0,0,0)
 ]);
 assert.equal(result.accordionPanelsOpened,3);
 assert.equal(result.candidateChoiceGroups,4);
 assert.equal(result.visibleOrSeparators,1);
 assert.equal(result.candidateOutcomeRoutes,5);
 assert.equal(result.skillHintCandidateRows,3);
 assert.equal(result.uniquelyMappedUmaSimSkillIdHintRows,2);
 assert.equal(result.unresolvedSkillIdHintRows,1);
 assert.equal(result.choiceAndOutcomeSemanticsVerified,false);
 assert.equal(result.continuityAndOutingUnlockVerified,false);
 assert.equal(result.eventRewardCompletenessVerified,false);
 assert.equal(result.publicationApproved,false);
});
test('unknown, inconsistent, negative, or excessive branch counters are rejected',()=>{
 const valid={eventPanelHasContent:1,choiceGroups:2,orMarkers:1,
  signedNumericLeaves:2,hintCandidates:2,uniqueSkillIdHints:2,
  unresolvedSkillIdHints:0};
 assert.throws(()=>summarizeExpandedCensus([{...valid,choiceGroups:-1}]),/不正/);
 assert.throws(()=>summarizeExpandedCensus([{...valid,unresolvedSkillIdHints:1}]),/不正/);
 assert.throws(()=>summarizeExpandedCensus(Array.from({length:21},()=>valid)),/不正/);
 assert.deepEqual(summarizeExpandedCensus([]).publicationApproved,false);
});

test('pin actual observed new SSR candidate topology so source drift cannot silently enter DB',()=>{
 const a={accordionPanelsOpened:6,candidateChoiceGroups:10,
  visibleOrSeparators:3,candidateOutcomeRoutes:13,
  skillHintCandidateRows:14,uniquelyMappedUmaSimSkillIdHintRows:14};
 const r=verifyPinnedNewCardCandidate('30322',a);
 assert.equal(r.candidateTopologyMatches20261027Sample,true);
 assert.equal(r.officialEventPublicationApproved,false);
 assert.throws(()=>verifyPinnedNewCardCandidate('30322',{...a,skillHintCandidateRows:13}),/要再確認/);
 assert.throws(()=>verifyPinnedNewCardCandidate('30323',a),/要再確認/);
 assert.throws(()=>verifyPinnedNewCardCandidate('30321',a),/未知/);
});
