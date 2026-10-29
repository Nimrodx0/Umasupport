'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const review=require('../review/official-30322-explicit-outcomes-20261029.v1.json');
const {adjudicateExplicitSourceOutcomes}=
 require('../src/official_gametora_gamewith_result_adjudication.cjs');
const clone=x=>structuredClone(x);
function fixture(){
 const routes=review.groups.flatMap((g,i)=>g.results.map(result=>({
  choiceGroupOrdinal:g.group,resultOrdinal:result.result,
  numericEffects:result.numeric.map(([kind,delta])=>({kind,delta})),
  skillHints:result.hintLevels.map((level,j)=>({
   numericId:String(200000+i*10+j),level
  })),
  directSkills:[],unresolvedReasons:[]
 })));
 return {status:'unified-unapproved',cardId:'30322',siteEventOrdinal:4,
  joined:{dataKind:'official-gametora-site-unified-route-draft',
   cardId:'30322',siteEventOrdinal:4,
   visibleGroupCount:3,visibleRouteCount:6,routes,
   appEventSchemaAdoptable:false,publicationApproved:false},
  outcomeEvidence:{playerChoiceSemanticsVerified:false}};
}
const run=(event=fixture(),r=review)=>adjudicateExplicitSourceOutcomes(
 event,r,{siteEventTitleFingerprint:review.eventTitleNormalizedSha256}
);
test('3 player choices and 6 great-success/success outcomes adjudicated from explicit source',()=>{
 const x=run();
 assert.equal(x.editorialChoiceCount,3);
 assert.equal(x.editorialOutcomeCount,6);
 assert.deepEqual(x.outcomes.map(r=>r.editorialOutcomeLabel),
  ['great-success','success','great-success','success','great-success','success']);
 assert.equal(x.playerChoiceAndOutcomeTypesEditoriallyVerified,true);
 assert.equal(x.chainContinuationRequiresVerified,false);
 assert.equal(x.allSkillAwardsVerified,false);
 assert.equal(x.appEventSchemaAdoptable,false);
 assert.equal(x.publicationApproved,false);
 assert.equal(x.sourceProseExported,false);
 assert.ok(!Object.hasOwn(x,'choices'));
 assert.ok(!Object.hasOwn(x,'terminal'));
});
test('first source must be original GameTora and exception must be article-specific',()=>{
 const r=clone(review);r.gametoraSiteChecked=false;
 assert.throws(()=>run(fixture(),r),/source-scope-or-publication-gate/);
 const q=clone(review);q.gameWithArticleUrl='https://example.com/not-the-event';
 assert.throws(()=>run(fixture(),q),/source-scope-or-publication-gate/);
 const s=clone(review);s.cardId='30323';
 assert.throws(()=>run(fixture(),s),/source-scope-or-publication-gate/);
});
test('site event title identity is required and cannot be inferred by ordinal alone',()=>{
 assert.throws(()=>adjudicateExplicitSourceOutcomes(fixture(),review,
  {siteEventTitleFingerprint:'wrong'}),/event-title-identity/);
});
test('fail closed when any numeric value or effect recipient is omitted',()=>{
 const a=fixture();a.joined.routes[0].numericEffects[0].delta=10;
 assert.throws(()=>run(a),/gamewith-vs-original-site-numeric-drift/);
 const b=fixture();b.joined.routes[0].numericEffects.pop();
 assert.throws(()=>run(b),/gamewith-vs-original-site-numeric-drift/);
});
test('the same choice must retain the same two skill IDs in success and great success',()=>{
 const a=fixture();a.joined.routes[1].skillHints[1].numericId='999999';
 assert.throws(()=>run(a),/one-player-choice-different-skill-ids/);
 const b=fixture();b.joined.routes[1].skillHints[0].level=2;
 assert.throws(()=>run(b),/gamewith-vs-original-site-hint-level-drift/);
});
test('reject swapped success/grand-success labels, missing rows and changed order',()=>{
 const r=clone(review);r.groups[0].results[0].label='success';
 assert.throws(()=>run(fixture(),r),/adjudicated-result-or-unknown-reward-route/);
 const a=fixture();a.joined.routes.pop();
 assert.throws(()=>run(a),/source-result-layout-drift/);
});
test('unresolved original numeric facts cannot be promoted using GameWith patterns',()=>{
 const a=fixture();a.joined.routes[0].unresolvedReasons=['numeric-facts-unresolved'];
 assert.throws(()=>run(a),/adjudicated-result-or-unknown-reward-route/);
});
test('no rights, game validation or chain continuation is inferred',()=>{
 const a=fixture(),r=clone(review);
 r.publicationApproved=true;
 assert.throws(()=>run(a,r),/source-scope-or-publication-gate/);
 const x=run(a);
 assert.equal(x.inGameResultProbabilityVerified,false);
 assert.equal(x.game2026Verified,false);
 assert.equal(x.publicationApproved,false);
});
