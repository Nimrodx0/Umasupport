'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {sha,normalize}=require('../src/official_gametora_azuma_outing_evidence.cjs');
const {validateSequenceLedger,correlateSequenceEvidence,evaluateSequenceCandidate}
 =require('../src/azuma_outing_sequence.cjs');
const ledger=require('../review/outing-progression-30323.v1.json');
const opening={
 cardId:'30323',siteEventOrdinal:8,choiceOrdinals:[1,2],
 effectKind:'enable-outings',conditionalOnPlayerChoice:true,
 outingEventSequenceVerified:false,outingClosureVerified:false,publicationApproved:false
};
function pageFixture(){
 const evidence={
  cardId:'30323',siteMatchingHeadingsUniqueAndDistinct:true,siteMatchingEventHeadings:6,
  editorialChoiceCountCorroborated:6,siteOutingHeadingsFormContiguousList:true,
  bothOriginalSiteChoiceGroupsExplicitlyUnlock:true,
  headingMatches:[
   {editorialOutingOrdinal:1,matchedSiteEventOrdinal:8,observedChoiceGroups:2},
   ...[2,3,4,5,6].map((pos,i)=>({
    editorialOutingOrdinal:i+2,matchedSiteEventOrdinal:pos,
    observedChoiceGroups:i===2?2:1}))
  ]
 };
 const ends=['架空終了A','架空終了B'];
 const copy=structuredClone(ledger);
 copy.endingTitles.forEach((entry,i)=>{
  entry.normalizedCodePointLength=Array.from(normalize(ends[i])).length;
  entry.titleSha256=sha(normalize(ends[i]));
 });
 const views=Array.from({length:12},(_,i)=>({
  title:i===9?ends[0]:i===10?ends[1]:'見出し'+i,
  choiceGroups:i===7?2:i===3?2:1
 }));
 return {evidence,copy,views};
}
test('source ledger pins exact five stages 2-6, opening position 8 and male-only display',()=>{
 assert.equal(validateSequenceLedger(ledger).stages.length,5);
 assert.deepEqual(ledger.stages.map(s=>s.siteEventOrdinal),[2,3,4,5,6]);
 assert.deepEqual(ledger.stages.map(s=>s.siteChoiceGroups),[1,1,2,1,1]);
 assert.equal(ledger.earlyTerminationByStageChoices,'not-explicitly-specified');
 const altered=structuredClone(ledger);altered.stages[1].siteEventOrdinal=7;
 assert.throws(()=>validateSequenceLedger(altered),/無根拠/);
 const early=structuredClone(ledger);early.earlyTerminationByStageChoices='all-choices-continue';
 assert.throws(()=>validateSequenceLedger(early),/無根拠/);
});
test('six title-correlated event positions plus 2 distinct ending titles are site observations only',()=>{
 const {evidence,copy,views}=pageFixture();
 const r=correlateSequenceEvidence(copy,evidence,views);
 assert.equal(r.headingCountMatched,6);
 assert.equal(r.stageCount,5);
 assert.deepEqual(r.stageSiteEventOrdinals,[2,3,4,5,6]);
 assert.equal(r.endingTitlePositionsVerified,true);
 assert.deepEqual(r.endingHeadings.map(x=>x.sourceEventOrdinal),[10,11]);
 assert.equal(r.earlyStopChoiceRulesVerified,false);
 assert.equal(r.endingTitleToCompletionBranchIndependentlyVerified,false);
 assert.equal(r.publicationApproved,false);
 assert.doesNotMatch(JSON.stringify(r),/架空終了/);
});
test('ambiguous or absent ending title does not certify condition-to-title map',()=>{
 const {evidence,copy,views}=pageFixture();
 views[11].title=views[9].title;
 const r=correlateSequenceEvidence(copy,evidence,views);
 assert.equal(r.endingTitlePositionsVerified,false);
 assert.equal(r.endingHeadings[0].uniqueTitleMatch,false);
 assert.equal(r.endingTitleToCompletionBranchIndependentlyVerified,false);
 assert.throws(()=>correlateSequenceEvidence(copy,{...evidence,siteMatchingEventHeadings:5},views),/不足/);
});
test('progression preserves ordered prefix and editorial completion without claiming route termination',()=>{
 const before=evaluateSequenceCandidate(ledger,opening,[]);
 assert.equal(before.nextStageOrdinalCandidate,1);
 assert.equal(before.trainingEndBranchEditorialCandidate,'incomplete');
 const after2=evaluateSequenceCandidate(ledger,opening,[1,2]);
 assert.equal(after2.nextStageOrdinalCandidate,3);
 const after3=evaluateSequenceCandidate(ledger,opening,[1,2,3],2);
 assert.equal(after3.nextStageOrdinalCandidate,4);
 assert.equal(after3.nextStageAccessStatus,'conditional-choice-continuation-not-independently-verified');
 const completed=evaluateSequenceCandidate(ledger,opening,[1,2,3,4,5],1);
 assert.equal(completed.outingSeriesState,'five-stage-series-completed');
 assert.equal(completed.trainingEndBranchEditorialCandidate,'completed');
 assert.equal(completed.nextStageOrdinalCandidate,null);
 assert.equal(completed.terminalFlagGenerated,false);
 assert.equal(completed.endingBranchPerTitleIndependentlyVerified,false);
 assert.equal(completed.publicationApproved,false);
});
test('unearned stages, unverified opener, unknown third-stage branch and fake game proof fail closed',()=>{
 assert.throws(()=>evaluateSequenceCandidate(ledger,opening,[1,3]),/飛び/);
 assert.throws(()=>evaluateSequenceCandidate(ledger,opening,[1,2,3]),/未確定/);
 assert.throws(()=>evaluateSequenceCandidate(ledger,opening,[1,2],1),/未確定/);
 assert.throws(()=>evaluateSequenceCandidate(ledger,opening,[1,2,3],3),/未確定/);
 assert.throws(()=>evaluateSequenceCandidate(ledger,{...opening,siteEventOrdinal:7},[]),/一致しない/);
 assert.throws(()=>validateSequenceLedger({...ledger,gamePlayIndependentlyVerified:true}),/無根拠/);
});
