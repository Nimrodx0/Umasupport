'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {blobSha,validateDerivedCardSource}=
 require('../src/derived_github_card_event_preflight.cjs');
const {planDerivedNewCardIntake}=
 require('../src/derived_github_new_card_source_plan.cjs');
const sha=x=>x.repeat(40);
const source=()=>JSON.stringify({kind:'support',id:30322,events_ja:{
 'proprietary-title':{name:'not-to-be-republished',section:'arrows',choices:[
  {label:'proprietary-label',random_either:true,outcomes:[
   [{type:'skill_hint',skill_id:201272,value:'+2'}],
   [{type:'obtain_skill',skill_id:201273},{type:'chain_end'}]
  ]}
 ]},
 'second-title':{name:'second-proprietary-name',section:'arrows',choices:[
  {label:'another-proprietary-label',effects:[{type:'energy',value:'+10'}]}
 ]}
}});
function input(src=source()){
 const sourceTree={sha:sha('a'),truncated:false,tree:[
  {path:'server/data/events/gametora/support_30322.json',
   type:'blob',sha:blobSha(src)}
 ]};
 const plan=planDerivedNewCardIntake({
  discovery:{dataKind:'new-umamusume-support-card-ids',
   schemaVersion:1,publicationApproved:false,
   addedCardIds:['30322'],existingCardIds:['30001']},
  existingCatalog:{schemaVersion:1,cards:[{cardId:'30001'}]},
  sourceTree,sourceCommit:sha('b')
 });
 return {plan,cardId:'30322',sourceText:src};
}
test('pin exact Git blob, keep source choice/result and terminal statistics private',()=>{
 const got=validateDerivedCardSource(input());
 assert.equal(got.cardId,'30322');
 assert.equal(got.observedEvents,2);
 assert.equal(got.observedChoices,2);
 assert.equal(got.observedResultRoutes,3);
 assert.equal(got.numericParsedHintMentions,1);
 assert.equal(got.directSkillGrantMentions,1);
 assert.equal(got.explicitChainTerminalRoutes,1);
 assert.equal(got.rawEventTextEmitted,false);
 assert.equal(got.publishableSchemaProduced,false);
 assert.equal(got.existingDatabaseUnchanged,true);
 assert.equal(got.publicationApproved,false);
 assert.doesNotMatch(JSON.stringify(got),
  /proprietary|not-to-be-republished|another-proprietary/);
});
test('changed blob bytes, wrong target ID, broken JSON or unsupported source reject',()=>{
 const args=input();
 assert.throws(()=>validateDerivedCardSource({...args,sourceText:args.sourceText+' '}),
  /source-blob-content-not-identical/);
 assert.throws(()=>validateDerivedCardSource({...args,cardId:'30323'}),
  /card-not-source-pinned/);
 const broken='{"kind":"support",';
 const bad=input(broken);
 assert.throws(()=>validateDerivedCardSource(bad),/invalid-source-json/);
 const wrong=input(JSON.stringify({kind:'support',id:30323,events_ja:{}}));
 assert.throws(()=>validateDerivedCardSource(wrong),/source-card-id-or-kind-drift/);
 const empty=input(JSON.stringify({kind:'support',id:30322,events_ja:{}}));
 assert.throws(()=>validateDerivedCardSource(empty),/source-event-normalizer-rejected|source-event-count-drift/);
});
test('a missing or already imported GitHub JSON is not fetchable or publishable',()=>{
 const i=input();
 const absent={...i.plan,results:[{cardId:'30322',status:'await-derived-github-json'}]};
 assert.throws(()=>validateDerivedCardSource({...i,plan:absent}),
  /card-not-source-pinned/);
 const imported={...i.plan,results:[{cardId:'30322',status:'already-in-catalog'}]};
 assert.throws(()=>validateDerivedCardSource({...i,plan:imported}),
  /card-not-source-pinned/);
});
