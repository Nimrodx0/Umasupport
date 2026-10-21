'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {transformDocument,build}=require('../src/gametora_whole_event_normalize.cjs');
const doc=()=>({kind:'support',id:30026,events_ja:{
 '原文は出力禁止':{name:'第三者イベント原題',id:100,section:'random',choices:[
  {label:'文章複製禁止',effects:[{type:'skill_hint',skill_id:200532,value:'+1'},{type:'energy',value:'+10'}]},
  {label:'文章複製禁止2',effects:[{type:'skill_hint_or',skill_id:200532,value:'+3'}]}]},
 '次も原文禁止':{name:'転載不可タイトル',id:543,section:'arrows',choices:[
  {label:'成功・失敗文章',outcomes:[
   [{type:'skill_hint',skill_id:201272,value:'+3'},{type:'speed',value:'+10'}],
   [{type:'energy',value:'-10'},{type:'chain_end'}]],random_either:true,probs:[null,null]},
  {label:'終了文章',effects:[{type:'chain_end'}]}]},
 '最後の原文禁止':{name:'転載不可末尾',id:544,section:'arrows',choices:[
  {label:'',effects:[{type:'both_previous_chain_good'},
   {type:'skill_hint',skill_id:200461,value:'+3'},
   {type:'one_previous_chain_good'},
   {type:'skill_hint',skill_id:200461,value:'+2'}]}]}
}});
test('normalizes every original event, choice, branch and skill without source prose',()=>{
 const original=doc(),out=transformDocument(original);
 assert.equal(out.sourceEventCount,3);
 assert.equal(out.sourceChainCount,2);
 assert.equal(out.sourceChoiceCount,5);
 assert.equal(out.sourceExpandedRoutes,6);
 assert.equal(out.explicitChainEndRoutes,2);
 assert.equal(out.numericParsedHintMentions,4);
 assert.equal(out.unresolvedHintMentions,1);
 assert.equal(out.events[0].choices[0].routes[0].numericHintFacts[0].skillNumericId,'200532');
 assert.equal(out.events[0].choices[0].routes[0].numericHintFacts[0].appSkillIdVerified,false);
 assert.equal(out.events[0].choices[1].routes[0].numericHintFacts[0].numericFactParsed,false);
 assert.equal(out.events[1].sourceLocalEventId,543);
 assert.equal(out.events[1].nextChainSourceOrdinalCandidate,3);
 assert.equal(out.events[1].choices[0].routes[0].provisionalTransition,'DEFAULT_CONTINUE');
 assert.equal(out.events[1].choices[0].routes[1].explicitChainEnd,true);
 assert.equal(out.events[1].choices[0].routes[1].nextSourceOrdinalCandidate,null);
 assert.equal(out.events[2].choices[0].routes[0].provisionalTransition,'OBSERVED_CHAIN_TAIL');
 assert.ok(out.events[2].reviewReasons.includes('PRIOR_RESULT_OR_BRANCH_FLAG_REQUIRES_REVIEW'));
 assert.deepEqual(original.events_ja['次も原文禁止'].choices[0].probs,[null,null]);
 const serialized=JSON.stringify(out);
 for(const phrase of ['原文は出力禁止','第三者イベント原題','文章複製禁止',
                      '次も原文禁止','転載不可タイトル','転載不可末尾','成功・失敗文章'])
  assert.ok(!serialized.includes(phrase),'raw prose leaked: '+phrase);
});
test('retains guarded outcome segments as flagged numerical facts rather than inventing unconditional hint',()=>{
 const d={kind:'support',id:30026,events_ja:{A:{name:'A',section:'arrows',choices:[
  {label:'X',segments:[
   {when:[{kind:'success'}],effects:[{type:'skill_hint',skill_id:200461,value:'+3'}]},
   {when:[{kind:'fail'}],effects:[{type:'chain_end'}]}
  ]}
 ]}}};
 const row=transformDocument(d);
 assert.equal(row.sourceExpandedRoutes,2);
 assert.equal(row.conditionalRoutes,2);
 assert.deepEqual(row.events[0].choices[0].routes[0].guardKinds,['success']);
 assert.equal(row.events[0].choices[0].routes[1].explicitChainEnd,true);
 assert.ok(row.reviewQueue.some(x=>x.reason==='CONDITIONAL_SEGMENT_REQUIRES_REVIEW'));
});
test('source event count and four missing cards are preserved, never converted to no-event cards',()=>{
 const base=doc();
 const index={dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,sourcePins:{gameToraDerived:require('../config/event-source-priority.v1.json').baselineRevision,
   checker:'8cf9fcb3cc7239041161be75c84daf9f8f22d29f'},
  cards:[{cardId:'30026',sourceMissing:false,gameToraObservedCount:3},
         {cardId:'10099',sourceMissing:true,gameToraObservedCount:0}],
  stats:{gameToraEventRecords:3}};
 const result=build({documents:[base],index});
 assert.equal(result.totals.baselineCards,1);
 assert.equal(result.totals.rosterCards,2);
 assert.equal(result.totals.sourceEvents,3);
 assert.equal(result.totals.missingBaselineCards,1);
 assert.equal(result.cards[1].sourceMissing,true);
 assert.ok(result.reviewQueue.some(x=>x.reason==='CARD_MISSING_FROM_GAMETORA_BASELINE'));
 assert.equal(result.releaseApproved,false);
 assert.equal(result.numericSkillsNotMappedToRuntimeNames,true);
 assert.equal(result.noEventCanPublishFromThisCandidate,true);
 index.stats.gameToraEventRecords=2;
 assert.throws(()=>build({documents:[base],index}),/件数が保存/);
});
test('invalid or truncated choices reject instead of creating apparent source coverage',()=>{
 const d=doc();d.events_ja['次も原文禁止'].choices=[];
 assert.throws(()=>transformDocument(d),/破損/);
 const d2=doc();d2.events_ja['原文は出力禁止'].choices[0].effects=[{type:'skill_hint',skill_id:200532,value:{text:'x'}}];
 const n=transformDocument(d2);
 assert.equal(n.unresolvedHintMentions,2);
 assert.ok(n.reviewQueue.some(x=>x.reason==='SKILL_HINT_EFFECT_UNRESOLVED'));
});
test('event title is only a one-way fingerprint, never copied as original text',()=>{
 const x=transformDocument(doc());
 assert.match(x.events[0].sourceTitleFingerprint,/^sha256:[a-f0-9]{64}$/);
 assert.equal(x.events[0].displayName,'イベント001（仮）');
 assert.equal(x.events[1].choices[0].displayLabel,'選択肢1（仮）');
});
