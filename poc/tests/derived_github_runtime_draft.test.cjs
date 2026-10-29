'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {projectDerivedCardDraft}=
 require('../src/derived_github_runtime_draft.cjs');
const {blobSha}=require('../src/derived_github_card_event_preflight.cjs');
const {planDerivedNewCardIntake}=
 require('../src/derived_github_new_card_source_plan.cjs');
const {validateEvents}=require('../src/event_schema.js');
const {verifyRelease}=require('../src/event_release_gate.cjs');
const core=require('../src/core.js');
const skills=()=>JSON.stringify([
 {id:'200532',name:'Skill A',rarity:'normal',group:20053},
 {id:'201272',name:'Skill B',rarity:'rare',group:20127},
 ...Array.from({length:105},(_,i)=>({
  id:String(400000+i),name:'Other '+i,rarity:'normal',group:40000+i
 }))
]);
const source=()=>({kind:'support',id:30026,events_ja:{
 a:{id:11,section:'random',name:'Do not copy event title',choices:[
  {label:'do not copy selection',effects:[
   {type:'skill_hint',skill_id:200532,value:'+2'}]},
  {label:'Do not copy text',effects:[{type:'energy',value:'+10'}]}
 ]},
 b:{id:12,section:'arrows',name:'Stage one original title',choices:[
  {label:'play choice',outcomes:[
   [{type:'skill_hint',skill_id:201272,value:'+3'}],
   [{type:'chain_end'},{type:'energy',value:'-10'}]
  ],random_either:true},
  {label:'stop branch',effects:[{type:'chain_end'}]}
 ]},
 c:{id:13,section:'arrows',name:'Stage two original title',choices:[
  {label:'',effects:[{type:'obtain_skill',skill_id:200532}]}
 ]},
 d:{id:14,section:'random',name:'Unsupported alternative',choices:[
  {label:'',effects:[{type:'skill_hint_or',options:[
   {skill_id:200532,value:'+2'},{skill_id:201272,value:'+3'}
  ]}]}
 ]}
}});
function args(doc=source()){
 const sourceText=JSON.stringify(doc),sha=blobSha(sourceText);
 const plan=planDerivedNewCardIntake({
  discovery:{dataKind:'new-umamusume-support-card-ids',
   schemaVersion:1,publicationApproved:false,
   addedCardIds:['30026'],existingCardIds:['30001']},
  existingCatalog:{schemaVersion:1,cards:[{cardId:'30001',events:[]}]},
  sourceTree:{sha:'a'.repeat(40),truncated:false,tree:[{
   path:'server/data/events/gametora/support_30026.json',
   type:'blob',sha}]},sourceCommit:'b'.repeat(40)
 });
 return {plan,cardId:'30026',sourceText,skillText:skills()};
}
test('version-pinned source yields skill-only app-schema draft with proper result/terminal/dependency',()=>{
 const a=args(),res=projectDerivedCardDraft(a);
 assert.equal(res.census.sourceEvents,4);
 assert.equal(res.census.modeledEvents,4);
 assert.equal(res.census.excludedEvents,0);
 assert.equal(res.census.modeledSkills,5);
 assert.equal(res.census.modeledDirectGrants,1);
 assert.equal(res.census.nonSkillSourceEffectsOmitted,2);
 assert.deepEqual(res.pendingEvents,[]);
 assert.equal(res.census.modeledExclusiveHintGroups,1);
 assert.equal(res.census.modeledExclusiveHintOptions,2);
 const ev=res.draftCatalog.cards[0].events;
 assert.equal(ev[0].type,'choice');
 assert.deepEqual(ev[0].choices[0].rewards,[{
  skillId:'skill:200532',verifiedSkillName:'Skill A',level:2
 }]);
 assert.equal(ev[1].choices[0].outcomes[1].terminal,true);
 assert.equal(ev[1].choices[1].terminal,true);
 assert.deepEqual(ev[2].requires,{all:[{eventId:ev[1].id}]});
 assert.equal(ev[2].rewards[0].kind,'obtained');
 assert.equal(ev[3].type,'auto');
 assert.equal(ev[3].outcomes.length,2);
 assert.deepEqual(ev[3].outcomes.map(x=>x.rewards[0].skillId),
  ['skill:200532','skill:201272']);
 assert.deepEqual(ev[3].outcomes.map(x=>x.rewards[0].level),[2,3]);
 const firstOption={[ev[3].id]:ev[3].outcomes[0].id};
 const optionRoutes=core.directRoutes({id:'30026',hints:[],events:[ev[3]]},
  {stage:4,choices:{},outcomes:firstOption});
 assert.equal(optionRoutes.length,1);
 assert.equal(optionRoutes[0].skillId,'skill:200532');
 const skillById=Object.fromEntries(JSON.parse(skills()).map(x=>[
  'skill:'+x.id,{id:'skill:'+x.id,name:x.name}]));
 validateEvents(ev,{skillById});
 assert.equal(core.isReachable(ev[2],{[ev[1].id]:'choice-01'},ev,
  {[ev[1].id]:'route-01'}),true);
 assert.equal(core.isReachable(ev[2],{[ev[1].id]:'choice-01'},ev,
  {[ev[1].id]:'route-02'}),false);
 assert.equal(core.isReachable(ev[2],{[ev[1].id]:'choice-02'},ev),false);
 const text=JSON.stringify(res);
 for(const x of ['Do not copy','do not copy','Stage one','Stage two',
  'Unsupported alternative'])assert.ok(!text.includes(x));
 assert.equal(res.publicationApproved,false);
 assert.equal(res.completeCardReadyForPublication,false);
 assert.throws(()=>verifyRelease(res.draftCatalog,{schemaVersion:1,entries:[]}),
  /草稿は公開できません/);
});
test('a bad predecessor quarantines dependent chain stage rather than marking it unconditional',()=>{
 const doc=source();
 doc.events_ja.b.choices[0].effects=[{type:'branch_flag'}];
 delete doc.events_ja.b.choices[0].outcomes;
 const res=projectDerivedCardDraft(args(doc));
 assert.equal(res.census.modeledEvents,2);
 assert.deepEqual(res.pendingEvents.map(x=>x.reason),[
  'AMBIGUOUS_OR_UNSUPPORTED_SOURCE_FACT',
  'CHAIN_PREDECESSOR_NOT_PROJECTED'
 ]);
 assert.equal(res.draftCatalog.cards[0].events[0].id,'gt-30026-event-001');
});
test('direct skill is a kind=obtained reward with NO hint level',()=>{
 const res=projectDerivedCardDraft(args());
 const last=res.draftCatalog.cards[0].events[2].rewards[0];
 assert.equal(last.kind,'obtained');
 assert.equal(Object.hasOwn(last,'level'),false);
});
test('wrong Git blob or missing numeric registry skill fails closed',()=>{
 const a=args();
 assert.throws(()=>projectDerivedCardDraft({...a,sourceText:a.sourceText+' '}),
  /source-blob-content-not-identical/);
 const list=JSON.parse(skills()).filter(x=>x.id!=='201272');
 const result=projectDerivedCardDraft({...a,skillText:JSON.stringify(list)});
 assert.equal(result.census.modeledEvents,1);
 assert.equal(result.pendingEvents[0].reason,'MISSING_OR_UNSUITABLE_SKILL_ID');
 assert.equal(result.pendingEvents[1].reason,'CHAIN_PREDECESSOR_NOT_PROJECTED');
});
test('source with unmodeled conditional section is withheld but unrelated event remains usable',()=>{
 const doc=source();
 doc.events_ja.a.section='dates_random';
 const res=projectDerivedCardDraft(args(doc));
 assert.equal(res.pendingEvents[0].reason,'UNSUPPORTED_EVENT_SECTION');
 assert.equal(res.census.modeledEvents,3);
});

test('alternative hint with source-defined options becomes mutually exclusive outcomes',()=>{
 const d=source();
 d.events_ja.d.choices[0].effects=[
  {type:'skill_hint',skill_id:400000,value:'+1'},
  {type:'skill_hint_or',options:[
   {skill_id:200532,value:'+2'},{skill_id:201272,value:'+3'}]}
 ];
 const res=projectDerivedCardDraft(args(d)),last=res.draftCatalog.cards[0].events.at(-1);
 assert.equal(last.outcomes.length,2);
 assert.equal(res.census.modeledExclusiveHintGroups,1);
 for(const out of last.outcomes){
  assert.equal(out.rewards.length,2);
  assert.equal(out.rewards[0].skillId,'skill:400000');
 }
 const selected={[last.id]:last.outcomes[1].id};
 const selectedRoutes=core.directRoutes({id:'30026',hints:[],events:[last]},
  {stage:4,choices:{},outcomes:selected});
 assert.equal(selectedRoutes.length,2);
 assert.deepEqual(selectedRoutes.map(x=>x.skillId),['skill:400000','skill:201272']);
});
test('unknown or ranged OR option quarantines entire event, never supplies both skills',()=>{
 for(const options of [
  [{skill_id:200532,value:'+2'},{skill_id:888888,value:'+1'}],
  [{skill_id:200532,value:'+1/+2'},{skill_id:201272,value:'+3'}],
  [{skill_id:200532,value:'+1'},{skill_id:200532,value:'+2'}]
 ]){
  const d=source();d.events_ja.d.choices[0].effects=[{
   type:'skill_hint_or',options}];
  const res=projectDerivedCardDraft(args(d));
  assert.equal(res.census.modeledEvents,3);
  assert.equal(res.census.modeledExclusiveHintGroups,0);
  assert.equal(res.pendingEvents.length,1);
  assert.equal(res.pendingEvents[0].reason,'EXCLUSIVE_HINT_OPTION_UNRESOLVED');
 }
});
