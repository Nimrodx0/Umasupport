'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate}=require('../src/phase2_adjudicated_fact_intake.cjs');
const baseline=require('../data/curation/adjudicated_event_facts.v1.json');
const copy=()=>structuredClone(baseline);
const EXPECTED={sourceCards:4,sourcePositions:20,adoptedNumericalEvents:20,
 pendingRoutePositions:0,adoptedSkillHintFacts:12,
 adoptedNonSkillEffectFacts:90,pendingSkillHintMentions:0,
 adoptedSelectableAlternatives:30,publishedEvents:0};
test('all 20 editorial facts from four missing SSR cards are adopted, with zero published events',()=>{
 assert.deepEqual(validate(copy()),EXPECTED);
});
test('new three-card numeric adoption cannot drift from independent card detail',()=>{
 for(const change of [
  x=>{x.cards[0].events[0].alternatives[0].effects[0].value=5;},
  x=>{x.cards[0].events[2].skillHints[0].skillNumericId++;},
  x=>{x.cards[1].events[4].playerSelectableChoiceCount=0;},
  x=>{x.cards[1].events[3].alternatives[1].effects[0].kind='energy';},
  x=>{x.cards[2].events[4].alternatives[0].skillHints[0].hintLevel=5;},
  x=>{x.cards[2].events[2].decision='PENDING_ROUTE_REVIEW';},
  x=>{x.cards[2].events[1].gameWithArticle='https://example.com';},
  x=>{x.cards[0].events[2].priorStageDependenceVerified=true;}
 ]){
  const c=copy();change(c);
  assert.throws(()=>validate(c),/GameWith編集採用事実と独立台帳が不一致/);
 }
});
test('existing five 30321 adjudications cannot lose selection identity or numerical integrity',()=>{
 for(const change of [
  x=>{x.cards[3].events[1].playerSelectableChoiceCount=2;},
  x=>{x.cards[3].events[1].numericEffects[1].value++;},
  x=>{x.cards[3].events[2].skillHints[0].skillNumericId++;},
  x=>{x.cards[3].events[4].alternatives[1].skillHints[0].hintLevel=2;},
  x=>{x.cards[3].events[0].alternatives[0].effects[0].value++;},
  x=>{x.cards[3].events[2].priorStageDependenceVerified=true;},
  x=>{x.cards[3].events[2].decision='PENDING_ROUTE_REVIEW';}
 ]){
  const c=copy();change(c);assert.throws(()=>validate(c));
 }
});
test('no editorial source prose, game truth claim, approval or automatic grant can be smuggled',()=>{
 for(const change of [
  x=>{x.noAutomaticRuntimeAdoption=false;},
  x=>{x.game2026Verified=true;},
  x=>{x.publicationApproved=true;},
  x=>{x.sourceProseIncluded=true;},
  x=>{x.cards[0].events[0].publicationApproved=true;},
  x=>{x.cards[3].events[1].name='copied prose';},
  x=>{x.cards[1].events[4].game2026Verified=true;}
 ]){
  const c=copy();change(c);assert.throws(()=>validate(c));
 }
});
test('source cards, ordinal positions, counts and pins are fail-closed',()=>{
 for(const change of [
  x=>{x.cards.pop();},
  x=>{x.cards[0].cardId='30321';},
  x=>{x.cards[0].events.pop();},
  x=>{x.cards[0].events[2].sourceOrdinal=2;},
  x=>{x.sourcePins.checker='unapproved';}
 ]){
  const c=copy();change(c);assert.throws(()=>validate(c));
 }
});
