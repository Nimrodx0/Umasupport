'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate}=require('../src/phase2_adjudicated_fact_intake.cjs');
const original=require('../data/curation/adjudicated_event_facts.v1.json');
const copy=()=>structuredClone(original);
test('fixed 4-SSR register adopts five GameWith facts, preserves fifteen pending positions',()=>{
 assert.deepEqual(validate(copy()),{
  sourceCards:4,sourcePositions:20,adoptedNumericalEvents:5,
  pendingRoutePositions:15,adoptedSkillHintFacts:2,
  adoptedNonSkillEffectFacts:17,pendingSkillHintMentions:10,
  adoptedSelectableAlternatives:6,publishedEvents:0
 });
});
test('inferred player choices and invented result branches cannot be adopted',()=>{
 const c=copy();
 c.cards[3].events[1].playerSelectableChoiceCount=2;
 assert.throws(()=>validate(c),/既存裁定と一致しない/);
 c.cards[3].events[1].playerSelectableChoiceCount=0;
 c.cards[3].events[1].outcomes=[{id:'success'}];
 assert.throws(()=>validate(c),/追加・欠落フィールド/);
});
test('wrong reward number, skill ID and source URL fail closed',()=>{
 for(const mutate of [
  c=>{c.cards[3].events[1].numericEffects[1].value=11;},
  c=>{c.cards[3].events[2].skillHints[0].skillNumericId=201464;},
  c=>{c.cards[3].events[2].gameWithArticle='https://example.com/article';},
  c=>{c.cards[3].events[2].gameToraLivePage=c.cards[0].events[0].gameToraLivePage;},
  c=>{c.cards[3].events[2].checkedAt='2026-10-23';}
 ]){
  const c=copy();mutate(c);
  assert.throws(()=>validate(c),/既存裁定と一致しない/);
 }
});
test('a pending event cannot silently become an unconditional skill grant',()=>{
 for(const mutate of [
  c=>{c.cards[0].events[0].decision='GAMEWITH_NUMERIC_FACTS_ADOPTED';},
  c=>{c.cards[2].events[3].skillHints=[{skillNumericId:1,hintLevel:5}];},
  c=>{c.cards[3].events[0].alternatives[0].effects[0].value++;},
  c=>{c.cards[3].events[4].alternatives[1].skillHints[0].hintLevel=2;},
  c=>{c.cards[3].events[2].decision='PENDING_ROUTE_REVIEW';},
  c=>{c.cards[3].events[2].priorStageDependenceVerified=true;}
 ]){
  const c=copy();mutate(c);
  assert.throws(()=>validate(c));
 }
});
test('no preview/publication flag or source prose can be smuggled into editorial facts',()=>{
 for(const mutate of [
  c=>{c.noAutomaticRuntimeAdoption=false;},
  c=>{c.publicationApproved=true;},
  c=>{c.cards[3].events[2].publicationApproved=true;},
  c=>{c.cards[1].events[4].publicationApproved=true;},
  c=>{c.sourceProseIncluded=true;},
  c=>{c.cards[3].events[1].name='source event title';}
 ]){
  const c=copy();mutate(c);
  assert.throws(()=>validate(c));
 }
});
test('all positions and the exact pinned roster must be preserved',()=>{
 for(const mutate of [
  c=>{c.cards.pop();},
  c=>{c.cards[0].cardId='30321';},
  c=>{c.cards[0].events.pop();},
  c=>{c.cards[0].events[2].sourceOrdinal=2;},
  c=>{c.sourcePins.checker='new-reference';}
 ]){
  const c=copy();mutate(c);
  assert.throws(()=>validate(c));
 }
});
