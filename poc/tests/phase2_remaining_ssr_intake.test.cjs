'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/core.js');
const {build}=require('../src/phase2_remaining_ssr_intake.cjs');
const source=require('../data/curation/adjudicated/30318-30320.v1.json');
const copy=()=>structuredClone(source);
test('all 15 GameWith facts and 10 hint positions are adopted independently of publication',()=>{
 const result=build(copy());
 assert.deepEqual(result.summary,{
  sourceCards:3,editoriallyAdoptedEvents:15,adoptedNumericEffectFacts:73,
  numericSkillHintMentions:10,adoptedEffectAlternatives:27,
  provisionalStandaloneEvents:6,blockedChainEvents:9,
  chainDependenciesVerified:false,game2026Verified:false,
  publicationApproved:false,noAutomaticRuntimeAdoption:true,sourceProseIncluded:false
 });
 assert.equal(result.policyDecisions.length,15);
 assert.ok(result.policyDecisions.every(x=>x.status==='GAMEWITH_ADJUDICATED_GT_GAP'&&
   x.publicationApproved===false&&x.noAutomaticRuntimeAdoption===true));
 assert.deepEqual(result.ledgerCards.map(x=>x.cardId),['30318','30319','30320']);
 assert.deepEqual(result.ledgerCards.flatMap(x=>x.events).map(x=>x.playerSelectableChoiceCount),
  [2,2,0,2,2,2,2,0,2,2,2,2,0,2,2]);
 assert.equal(result.ledgerCards.flatMap(x=>x.events).filter(x=>
   x.decision==='GAMEWITH_NUMERIC_FACTS_ADOPTED').length,3);
});
test('only six standalone normal events get unpublished draft choices; chain skills stay excluded',()=>{
 const output=build(copy()).provisionalCatalog;
 assert.equal(output.cards.length,3);
 assert.deepEqual(output.cards.map(x=>x.events.map(y=>y.id)),[
  ['editorial_candidate_30318_random_4','editorial_candidate_30318_random_5'],
  ['editorial_candidate_30319_random_4','editorial_candidate_30319_random_5'],
  ['editorial_candidate_30320_random_4','editorial_candidate_30320_random_5']
 ]);
 const expected={'30318':['skill:200152',2],'30319':['skill:201641',2],
  '30320':['skill:202082',1]};
 for(const c of output.cards){
  const [skillId,optionIndex]=expected[c.cardId];
  const random5=c.events[1],card={id:c.cardId,hints:[],events:c.events};
  const noChoice=core.directRoutes(card,{stage:4,choices:{},outcomes:{}});
  assert.equal(noChoice.filter(x=>x.source==='event').length,0,c.cardId);
  const choice={['editorial_candidate_'+c.cardId+'_random_5']:'option'+optionIndex};
  const yes=core.directRoutes(card,{stage:4,choices:choice,outcomes:{}})
   .filter(x=>x.source==='event');
  assert.equal(yes.length,1,c.cardId);
  assert.equal(yes[0].skillId,skillId,c.cardId);
  assert.equal(yes[0].level,1,c.cardId);
  const other=core.directRoutes(card,{stage:4,choices:{
   [random5.id]:'option'+(3-optionIndex)
  },outcomes:{}});
  assert.equal(other.filter(x=>x.source==='event').length,0,c.cardId);
 }
});
test('a two-choice GameWith standalone detail corrects the misleading 30319/5 card-list label',()=>{
 const d=build(copy());
 const c=d.ledgerCards.find(c=>c.cardId==='30319');
 assert.equal(c.events[4].playerSelectableChoiceCount,2);
 assert.deepEqual(c.events[4].alternatives[1].skillHints,[{
  skillNumericId:201641,hintLevel:1
 }]);
});
test('changed numerical fact, hint level, source location, invented chain reachability or prose is rejected',()=>{
 const mutations=[
  d=>{d.cards[0].events[0].alternatives[0].effects[0].value=2;},
  d=>{d.cards[0].events[2].alternatives[0].skillHints[0].skillNumericId=1;},
  d=>{d.cards[1].events[2].alternatives[0].skillHints[1].hintLevel=1;},
  d=>{d.cards[2].events[4].alternatives[0].skillHints[0].hintLevel=2;},
  d=>{d.cards[1].events[4].choiceCount=0;},
  d=>{d.cards[1].choicePresentationClarification.eventSpecificArticleConfirmsTwoPlayerChoices=false;},
  d=>{d.cards[0].events[0].chainPrerequisitesVerified=true;},
  d=>{d.cards[2].gameToraWebsite.url=d.cards[1].gameToraWebsite.url;},
  d=>{d.cards[2].gameToraWebsite.status='EVENT_LIST';},
  d=>{d.cards[0].events[3].alternatives[1].choiceText='third-party-prose';},
  d=>{d.cards[1].events[3].alternatives[1].effects[0].kind='energy';},
  d=>{d.cards[1].events[3].alternatives[1].effects[0].value=9;},
  d=>{d.cards[1].events[4].alternatives.reverse();},
  d=>{d.cards[0].gameWith.url='https://example.com';},
  d=>{d.publicationApproved=true;},
  d=>{d.noAutomaticRuntimeAdoption=false;},
  d=>{d.cards[2].events.pop();}
 ];
 for(const change of mutations){
  const d=copy();change(d);
  assert.throws(()=>build(d),/残り3SSR数値編集採用|イベント出典裁定規則/);
 }
});
test('ordinary and 30321 adoption remain separate from published event approval',()=>{
 const published=require('../data/reviewed_events.v1.json');
 const approvals=require('../config/event-release-approvals.v1.json');
 assert.deepEqual(published.cards,[]);
 assert.deepEqual(approvals.entries,[]);
});
