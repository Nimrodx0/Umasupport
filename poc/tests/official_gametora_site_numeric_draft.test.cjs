'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {siteOnlyNumericDraft,summarizeNumericDraft}=
 require('../src/official_gametora_site_numeric_draft.cjs');
const seg=(...items)=>({effectTexts:items,
 effectContexts:items.map(()=>[])});
const group=(segments,terminal=false)=>({
 orSeparatorCount:segments.length-1,routeCandidateCount:segments.length,
 numericSegments:segments,
 ownTextFragments:terminal?['連続イベント打ち切り']:['site-only structural marker']
});
const args=()=>({
 cardId:'30080',siteEventOrdinal:5,
 groups:[
  group([seg('体力 +4','体力 +16','やる気 +1','友情ゲージ +10'),
   seg('スキルPt +75','友情ゲージ +5')]),
  group([seg('スタミナ +15','やる気 +1','友情ゲージ +5')]),
  group([seg('体力 -10','スキルPt +150','ヒントLv +1','友情ゲージ -10')],true)
 ]
});
test('site-only four-route, 12-scalar numeric draft does not use old fixed data',()=>{
 const x=siteOnlyNumericDraft(args()),out=summarizeNumericDraft(x);
 assert.equal(x.visibleGroupCount,3);
 assert.equal(x.visibleRouteCount,4);
 assert.equal(x.observedScalarEffectCount,12);
 assert.equal(x.unparsedNumericCount,0);
 assert.equal(x.excludedNonScalarNumericCount,1);
 assert.equal(x.explicitTerminalGroupCount,1);
 assert.equal(x.candidates[2].routeCandidates[0].terminalEvidence,'displayed-on-single-route');
 assert.equal(x.candidates[0].routeCandidates[0].terminalEvidence,'not-independently-located');
 assert.deepEqual(x.candidates[0].routeCandidates[0].effects,[
  {kind:'energy',delta:4},{kind:'energy',delta:16},
  {kind:'mood',delta:1},{kind:'bond',delta:10}
 ]);
 assert.equal(x.candidates[0].routeCandidates[0].skillRewardsStatus,'unresolved');
 assert.equal(x.interpretedChoiceSemantics,false);
 assert.equal(x.appEventSchemaAdoptable,false);
 assert.equal(x.publicationApproved,false);
 assert.equal(out.parsedNumericFacts,12);
 assert.equal(out.numericKindAndAmountByResult[0].length,2);
 assert.doesNotMatch(JSON.stringify(out),/site-only structural marker/);
});
test('old reference numbers are not an input and cannot overwrite site observations',()=>{
 const x=args();
 x.groups[0].numericSegments[0].effectTexts[1]='体力 +37';
 const draft=siteOnlyNumericDraft(x);
 assert.ok(draft.candidates[0].routeCandidates[0].effects.some(
  effect=>effect.kind==='energy'&&effect.delta===37));
 assert.equal(draft.appEventSchemaAdoptable,false);
});
test('unknown signed numeric text is never quietly treated as a fully parsed draft',()=>{
 const x=args();x.groups[0].numericSegments[1].effectTexts.push('未知値 +29');
 x.groups[0].numericSegments[1].effectContexts.push([]);
 const y=siteOnlyNumericDraft(x);
 assert.equal(y.unparsedNumericCount,1);
 assert.ok(y.reviewReasons.includes('unparsed-numeric-effects'));
 assert.equal(y.appEventSchemaAdoptable,false);
});
test('terminal mentioned on an OR group cannot mark either route terminal',()=>{
 const x=args();x.groups[0].ownTextFragments=['連続イベント終了'];
 const d=siteOnlyNumericDraft(x);
 assert.ok(d.reviewReasons.includes('terminal-route-unresolved'));
 assert.equal(d.candidates[0].terminalRouteLocationKnown,false);
 assert.equal(d.candidates[0].routeCandidates[0].terminalEvidence,'not-independently-located');
});
test('no printed source labels and no invented empty rewards',()=>{
 const x=args();
 x.groups[0].ownTextFragments=['架空の選択肢','連続イベント打ち切り'];
 const y=siteOnlyNumericDraft(x);
 assert.doesNotMatch(JSON.stringify(y),/架空の選択肢|旧固定|原文/);
 assert.equal(Object.hasOwn(y.candidates[0].routeCandidates[0],'rewards'),false);
 assert.equal(y.candidates[0].routeCandidates[0].skillRewardsStatus,'unresolved');
});
test('invalid branch topology, wrong card or numeric limits fail closed',()=>{
 for(const mutate of [
  x=>{x.cardId='-1';},
  x=>{x.siteEventOrdinal=0;},
  x=>{x.groups[0].routeCandidateCount=3;},
  x=>{x.groups[0].numericSegments.pop();},
  x=>{x.groups[1].numericSegments[0].effectTexts[0]='x'.repeat(401);},
  x=>{x.groups[1].numericSegments[0].effectContexts[0]=['x'.repeat(301)];}
 ]){
  const x=args();mutate(x);
  assert.throws(()=>siteOnlyNumericDraft(x),/GameTora直接数値候補/);
 }
});
test('max energy and normal energy are distinct site types without old-source correction',()=>{
 const a=args();a.groups[0].numericSegments[0].effectTexts[0]='最大体力 +4';
 const x=siteOnlyNumericDraft(a);
 assert.equal(x.candidates[0].routeCandidates[0].effects[0].kind,'max_energy');
});

test('slash-range leaf remains an unresolved effect and cannot become a guaranteed scalar',()=>{
 const x=args();
 const route=x.groups[0].numericSegments[0];
 route.effectTexts[0]='体力 +10/20';
 route.effectContexts[0]=['体力 +10']; // even a plausible parent must not pick +10
 const result=siteOnlyNumericDraft(x);
 const first=result.candidates[0].routeCandidates[0];
 assert.equal(first.issues.includes('unresolved-numeric'),true);
 assert.equal(first.effects.some(effect=>effect.kind==='energy'&&effect.delta===10),false);
 assert.equal(result.reviewReasons.includes('unparsed-numeric-effects'),true);
 assert.equal(result.appEventSchemaAdoptable,false);
 assert.equal(result.publicationApproved,false);
});
