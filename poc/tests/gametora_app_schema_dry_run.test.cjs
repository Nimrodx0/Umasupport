'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {transformDocument}=require('../src/gametora_whole_event_normalize.cjs');
const {crosswalk}=require('../src/gametora_event_skill_crosswalk.cjs');
const {project}=require('../src/gametora_app_schema_dry_run.cjs');
const core=require('../src/core.js');
const policy=require('../config/event-source-priority.v1.json');
function skills(){return JSON.stringify([
 {id:'200532',name:'速度維持',rarity:'normal',group:20053},
 {id:'201272',name:'金の加速',rarity:'rare',group:20127},
 ...Array.from({length:120},(_,i)=>({id:String(400000+i),name:'Other '+i,
  rarity:'normal',group:40000+i}))
]);}
function source(){
 return [
  {id:30026,kind:'support',events_ja:{
   a:{id:11,section:'random',name:'Original noncopy text',choices:[
    {label:'',effects:[{type:'skill_hint',skill_id:200532,value:'+1'}]}]},
   b:{id:12,section:'arrows',name:'Original stage text',choices:[
    {label:'選択を押す',outcomes:[
     [{type:'skill_hint',skill_id:201272,value:'+3'}],
     [{type:'chain_end'},{type:'energy',value:'-10'}]
    ],random_either:true},
    {label:'終わる',effects:[{type:'chain_end'}]}]},
   c:{id:13,section:'arrows',name:'Original next stage',choices:[
    {label:'',effects:[{type:'skill_hint',skill_id:200532,value:'+2'}]}]}}},
  {id:30080,kind:'support',events_ja:{
   a:{id:21,section:'arrows',name:'Missing skill',choices:[{label:'',effects:[
    {type:'skill_hint',skill_id:999999,value:'+1'}]}]},
   b:{id:22,section:'arrows',name:'Depends on omitted previous stage',choices:[
    {label:'',effects:[{type:'skill_hint',skill_id:200532,value:'+1'}]}]}}},
  {id:10010,kind:'support',events_ja:{
   a:{id:31,section:'random',name:'Simple selectable option',choices:[
    {label:'Option one',effects:[{type:'speed',value:'+10'}]},
    {label:'Option two',effects:[{type:'skill_hint',skill_id:200532,value:'+1'}]}]}}}
 ];
}
function model(){
 const cards=['30026','30080','10010'].map(id=>({id,hints:['hint:速度維持'],events:[]}));
 const s={id:'hint:速度維持',name:'速度維持',tier:'unknown',lowerId:null};
 return {cards,cardById:Object.fromEntries(cards.map(c=>[c.id,c])),
  skills:[s],skillById:{[s.id]:s},meta:{}};
}
function input(){
 const rows=source().map(x=>transformDocument(x));
 const cards=rows.map(r=>{
  const {reviewQueue,effectTypeCounts,...rest}=r;return rest;
 });
 const totals={rosterCards:3,sourceEvents:cards.reduce((s,c)=>s+c.sourceEventCount,0),
  sourceChoices:cards.reduce((s,c)=>s+c.sourceChoiceCount,0),
  expandedRoutes:cards.reduce((s,c)=>s+c.sourceExpandedRoutes,0),
  numericHintMentions:cards.reduce((s,c)=>s+c.numericParsedHintMentions,0),
  unresolvedHintMentions:cards.reduce((s,c)=>s+c.unresolvedHintMentions,0),
  directSkillGrantMentions:cards.reduce((s,c)=>s+c.directSkillGrantMentions,0)};
 const candidate={schemaVersion:1,dataKind:'gametora-whole-event-numeric-candidate',
  sourcePins:{gameToraDerived:policy.baselineRevision},
  releaseApproved:false,noEventCanPublishFromThisCandidate:true,
  cards,totals};
 const m=model(),cross=crosswalk({candidate,skillText:skills(),model:m});
 return {candidate,cross,skillText:skills(),model:m};
}
test('projection actually validates auto, selectable, branching and chained events using production schema',()=>{
 const {cross,...rest}=input();
 const result=project({...rest,crosswalk:cross});
 assert.equal(result.report.totals.sourceCards,3);
 assert.equal(result.report.totals.sourceEvents,6);
 assert.equal(result.report.totals.candidateSchemaEvents,4);
 assert.equal(result.report.totals.skippedEvents,2);
 assert.equal(result.report.totals.blockedDependentStages,1);
 assert.equal(result.report.totals.candidateSchemaCards,2);
 assert.equal(result.report.totals.candidateAutoEvents,2);
 assert.equal(result.report.totals.candidateChoiceEvents,2);
 assert.equal(result.report.totals.candidateRewardMentions,4);
 assert.equal(result.report.excludedReasons.SKILL_ID_OR_HINT_EFFECT_PENDING,1);
 assert.equal(result.report.excludedReasons.CHAIN_PREDECESSOR_NOT_PROJECTED,1);
 assert.equal(result.runtimeValidation.eventsWithRecords,4);
 const c=result.dryRunCatalog.cards.find(c=>c.cardId==='30026');
 assert.equal(c.events[0].type,'auto');
 assert.equal(c.events[1].type,'choice');
 assert.equal(c.events[1].choices[0].outcomes.length,2);
 assert.equal(c.events[1].choices[0].outcomes[1].terminal,true);
 assert.equal(c.events[1].choices[1].terminal,true);
 assert.deepEqual(c.events[2].requires,{all:[{eventId:c.events[1].id}]});
 assert.equal(core.isReachable(c.events[2],{[c.events[1].id]:'choice-01'},c.events,
  {[c.events[1].id]:'route-01'}),true);
 assert.equal(core.isReachable(c.events[2],{[c.events[1].id]:'choice-01'},c.events,
  {[c.events[1].id]:'route-02'}),false);
 assert.equal(core.isReachable(c.events[2],{[c.events[1].id]:'choice-02'},c.events),false);
 assert.equal(JSON.stringify(result.report).includes('Original'),false);
 assert.equal(result.report.publicationApproved,false);
});
test('a special prior-state marker is quarantined without dropping other sound events',()=>{
 const {cross,...rest}=input();
 const first=rest.candidate.cards[0].events[0];
 first.reviewReasons.push('PRIOR_RESULT_OR_BRANCH_FLAG_REQUIRES_REVIEW');
 const result=project({...rest,crosswalk:cross});
 assert.equal(result.report.totals.candidateSchemaEvents,3);
 assert.equal(result.report.excludedReasons.SOURCE_SPECIAL_CASE_REQUIRES_REVIEW,1);
 assert.equal(result.report.totals.candidateRewardMentions,3);
});
test('invalid source types and mismatch crosswalk lineage cannot enter runtime projection',()=>{
 const req=input();
 req.cross.sourcePins.gameToraDerived='0'.repeat(40);
 assert.throws(()=>project({...req,crosswalk:req.cross}),/出典/);
 const req2=input();req2.candidate.releaseApproved=true;
 assert.throws(()=>project({...req2,crosswalk:req2.cross}),/出典/);
});

test('special/outing/outing-random events remain conditional and outing order is preserved',()=>{
 const doc={kind:'support',id:30026,events_ja:{
  s:{id:1,section:'special',name:'not redistributed',choices:[
   {label:'',effects:[{type:'skill_hint',skill_id:200532,value:'+1'}]}]},
  d1:{id:2,section:'dates',name:'outing one',choices:[
   {label:'',effects:[{type:'energy',value:'+10'}]}]},
  d2:{id:3,section:'dates',name:'outing two',choices:[
   {label:'',effects:[{type:'skill_hint',skill_id:200532,value:'+2'}]}]},
  dr:{id:4,section:'dates_random',name:'random outing',choices:[
   {label:'',effects:[{type:'skill_hint',skill_id:201272,value:'+3'}]}]}
 }};
 const row=transformDocument(doc);
 const {reviewQueue,effectTypeCounts,...card}=row;
 const candidate={dataKind:'gametora-whole-event-numeric-candidate',
  releaseApproved:false,noEventCanPublishFromThisCandidate:true,
  sourcePins:{gameToraDerived:policy.baselineRevision},
  cards:[card],totals:{
   rosterCards:1,sourceEvents:row.sourceEventCount,
   sourceChoices:row.sourceChoiceCount,expandedRoutes:row.sourceExpandedRoutes,
   numericHintMentions:row.numericParsedHintMentions,
   unresolvedHintMentions:row.unresolvedHintMentions,
   directSkillGrantMentions:row.directSkillGrantMentions
  }};
 const m=model();
 const link=crosswalk({candidate,skillText:skills(),model:m});
 const out=project({candidate,crosswalk:link,skillText:skills(),model:m});
 assert.equal(out.report.totals.candidateSchemaEvents,4);
 assert.equal(out.report.totals.candidateConditionalAvailabilityEvents,4);
 assert.equal(out.report.totals.candidateSpecialTriggerEvents,1);
 assert.equal(out.report.totals.candidateOutingSequenceEvents,2);
 assert.equal(out.report.totals.candidateOutingRandomEvents,1);
 assert.equal(out.report.totals.skippedEvents,0);
 const events=out.dryRunCatalog.cards[0].events;
 assert.deepEqual(events.map(x=>x.availabilityKind),[
  'special-trigger','outing-sequence','outing-sequence','outing-random']);
 assert.deepEqual(events[2].requires,{all:[{eventId:events[1].id}]});
 assert.equal(core.reachability(events[0],{},events).status,'conditional');
 assert.equal(core.reachability(events[1],{},events).status,'conditional');
 assert.equal(core.reachability(events[2],{},events).status,'conditional');
 assert.equal(core.reachability(events[3],{},events).status,'conditional');
 assert.equal(core.isReachable(events[0],{},events),false);
 assert.equal(core.isReachable(events[2],{},events),false);
 const routes=core.directRoutes({hints:[],events},{choices:{}});
 assert.equal(routes.length,3);
 assert.ok(routes.every(x=>x.conditional===true));
 assert.ok(routes.every(x=>/イベント|お出かけ/.test(x.condition)));
 const schema=require('../src/event_schema.js');
 assert.throws(()=>schema.validateEvents([
  {...events[0],availabilityKind:'made-up-unconditional'}
 ],{skillById:{'skill:200532':{}}},'30026'),/特殊イベント発生条件/);
});

test('two independently evidenced curation-only skill IDs can unlock nonpublic schema positions',()=>{
 const curated=require('../data/curation/supplemental_skills.v1.json');
 const raw={kind:'support',id:30026,events_ja:{
  a:{id:1,section:'random',name:'copyrighted event, no export',choices:[
   {label:'Option one',effects:[
    {type:'skill_hint',skill_id:200801,value:'+1'}]},
   {label:'Option two',effects:[
    {type:'skill_hint',skill_id:201012,value:'+2'}]}]}
 }};
 const normalized=transformDocument(raw);
 const {reviewQueue,effectTypeCounts,...card}=normalized;
 const candidate={dataKind:'gametora-whole-event-numeric-candidate',
  releaseApproved:false,noEventCanPublishFromThisCandidate:true,
  sourcePins:{gameToraDerived:policy.baselineRevision},
  cards:[card],totals:{rosterCards:1,sourceEvents:1,sourceChoices:2,
   expandedRoutes:2,numericHintMentions:2,unresolvedHintMentions:0,
   directSkillGrantMentions:0}};
 const m=model(),dict=skills();
 const x=crosswalk({candidate,skillText:dict,model:m,supplemental:curated});
 assert.equal(x.stats.curationOnlySkillIds,2);
 const noSupplement=project({candidate,crosswalk:x,skillText:dict,model:m});
 assert.equal(noSupplement.report.totals.candidateSchemaEvents,0);
 assert.equal(noSupplement.report.totals.skippedEvents,1);
 const yes=project({candidate,crosswalk:x,skillText:dict,model:m,supplemental:curated});
 assert.equal(yes.report.totals.candidateSchemaEvents,1);
 assert.equal(yes.report.totals.candidateCurationOnlyEvents,1);
 assert.equal(yes.report.totals.candidateCurationOnlyHintMentions,2);
 assert.equal(yes.report.totals.candidateRewardMentions,2);
 assert.equal(yes.report.publicationApproved,false);
 const rewards=yes.dryRunCatalog.cards[0].events[0].choices.flatMap(c=>c.rewards);
 assert.deepEqual(rewards.map(x=>x.skillId),['skill:200801','skill:201012']);
 const corrupt=JSON.parse(JSON.stringify(curated));
 corrupt.skills[0].evidence.numericId='https://umamusu.wiki/Game:Skills/999999';
 assert.throws(()=>project({candidate,crosswalk:x,skillText:dict,model:m,supplemental:corrupt}),
  /根拠不十分/);
 const fakeLink={...x,locations:x.locations.map(l=>({...l,status:'curation-only-not-in-runtime-registry'}))};
 assert.equal(project({candidate,crosswalk:fakeLink,skillText:dict,model:m}).report.totals.candidateSchemaEvents,0);
});

test('historical-2025-only ID corroboration unlocks a blocked stage and later linked stage in memory',()=>{
 const crypto=require('node:crypto');
 const {MASTER_REV,MASTER_SHA}=(()=>{
  return {MASTER_REV:'5a8ec1356859a35e245edef0d40da740e652df68',
   MASTER_SHA:'46363929ab097edf164d78a1e8f8d212dbf8c440a7c44431079198ca167002cb'};
 })();
 const req=input();
 const sha='sha256:'+crypto.createHash('sha256').update('架空の旧版スキル').digest('hex');
 const report={
  schemaVersion:1,
  dataKind:'2025-historical-master-missing-2026-umasim-skill-ids',
  historicalMasterRevision:MASTER_REV,
  sourceGameToraRevision:policy.baselineRevision,
  sourceUmaSimSkillRevision:require('../src/gametora_event_skill_crosswalk.cjs').CANONICAL_SOURCE_REV,
  game2026Verified:false,automaticAdoptionAllowed:false,
  crosswalkMissingOccurrences:1,
  rows:[{numericId:'999999',occurrences:1,
   historicalStatus:'2025-ID-and-rarity-with-unique-JP-name',
   historicalRarity:1,historicalNameFingerprint:sha}]
 };
 const privateRecords={
  schemaVersion:1,dataKind:'historical-2025-skill-preview-private-runner-only',
  historicalMasterSha256:MASTER_SHA,historicalMasterRevision:MASTER_REV,
  game2026Verified:false,publicationAllowed:false,
  skills:[{id:'999999',name:'架空の旧版スキル',rarity:'normal',
   historicalNameFingerprint:sha}]
 };
 const baseline=project({...req,crosswalk:req.cross});
 assert.equal(baseline.report.totals.candidateSchemaEvents,4);
 const history=project({...req,crosswalk:req.cross,historicalPreview:{report,privateRecords}});
 assert.equal(history.report.totals.candidateSchemaEvents,6);
 assert.equal(history.report.totals.skippedEvents,0);
 assert.equal(history.report.totals.candidateHistorical2025HintMentions,1);
 assert.equal(history.report.totals.candidateHistorical2025Events,1);
 assert.equal(history.report.historical2025OnlyIdsAreNot2026Verified,true);
 assert.equal(history.report.publicationApproved,false);
 const card=history.dryRunCatalog.cards.find(c=>c.cardId==='30080');
 assert.equal(card.events.length,2);
 assert.deepEqual(card.events[1].requires,{all:[{eventId:card.events[0].id}]});
 const altered=JSON.parse(JSON.stringify(privateRecords));
 altered.skills[0].name='架空の別の名前';
 assert.throws(()=>project({...req,crosswalk:req.cross,historicalPreview:{
  report,privateRecords:altered}}),/ハッシュ/);
 const wrongMaster=JSON.parse(JSON.stringify(privateRecords));
 wrongMaster.historicalMasterSha256='0'.repeat(64);
 assert.throws(()=>project({...req,crosswalk:req.cross,historicalPreview:{
  report,privateRecords:wrongMaster}}),/出典/);
 const falsePresent=JSON.parse(JSON.stringify(report));
 falsePresent.rows[0].occurrences=2;
 assert.throws(()=>project({...req,crosswalk:req.cross,historicalPreview:{
  report:falsePresent,privateRecords}}),/件数/);
});


test('every excluded event has a numeric-only diagnostic and linked predecessor',()=>{
 const {cross,...rest}=input();
 const out=project({...rest,crosswalk:cross});
 const diagnosis=out.report.blockerDiagnosis;
 assert.equal(diagnosis.totalExcluded,2);
 assert.deepEqual(diagnosis.primaryReasonCounts,out.report.excludedReasons);
 assert.equal(diagnosis.publicationApproved,false);
 assert.equal(diagnosis.gameVerified,false);
 assert.equal(diagnosis.sourceProseIncluded,false);
 assert.equal(diagnosis.sourceEvidenceEventCounts.SKILL_HINT_EFFECT_UNRESOLVED,undefined);
 const blocked=diagnosis.numericOnlyPositions.find(x=>
  x.primaryReason==='CHAIN_PREDECESSOR_NOT_PROJECTED');
 assert.equal(blocked.cardId,'30080');
 assert.equal(blocked.sourceOrdinal,2);
 assert.equal(blocked.predecessorSourceOrdinal,1);
 assert.equal(blocked.predecessorBlocked,true);
 assert.equal(blocked.predecessorPrimaryReason,'SKILL_ID_OR_HINT_EFFECT_PENDING');
 assert.ok(!JSON.stringify(diagnosis).includes('Original'));
 assert.ok(!JSON.stringify(diagnosis).includes('速度維持'));
 // A changed source ID must never be accepted as a genuine blocker position.
 const fake=structuredClone(out.report);
 fake.excludedSourcePositions[0].eventId='fabricated';
 const {diagnose}=require('../src/gametora_schema_blocker_diagnostics.cjs');
 assert.throws(()=>diagnose(rest.candidate,fake),/一致しない/);
});

test('special-case blockers are split by guarded route, direct grant, unresolved hint and duplicate',()=>{
 const doc={kind:'support',id:30026,events_ja:{
  guarded:{id:1,section:'arrows',name:'private source title A',choices:[{
   label:'private choice text',
   random_either:true,
   segments:[
    {when:[{kind:'both_previous_chain_good'}],
     effects:[{type:'skill_hint',skill_id:200532,value:'+1'}]},
    {when:[{kind:'both_previous_chain_bad'}],
     effects:[{type:'speed',value:'+5'}]}
   ]}]},
  award:{id:2,section:'random',name:'private source title B',choices:[{
   label:'',effects:[{type:'obtain_skill',skill_id:200532}]}]},
  unresolved:{id:3,section:'random',name:'private source title C',choices:[{
   label:'',effects:[{type:'skill_hint_or',skill_id:200532,value:'+1'}]}]},
  duplicated:{id:4,section:'random',name:'private source title D',choices:[{
   label:'',effects:[
    {type:'skill_hint',skill_id:200532,value:'+1'},
    {type:'skill_hint',skill_id:200532,value:'+1'}
   ]}]}
 }};
 const row=transformDocument(doc);
 const {reviewQueue,effectTypeCounts,...card}=row;
 const candidate={dataKind:'gametora-whole-event-numeric-candidate',
  releaseApproved:false,noEventCanPublishFromThisCandidate:true,
  sourcePins:{gameToraDerived:policy.baselineRevision},
  cards:[card],totals:{
   rosterCards:1,sourceEvents:row.sourceEventCount,
   sourceChoices:row.sourceChoiceCount,expandedRoutes:row.sourceExpandedRoutes,
   numericHintMentions:row.numericParsedHintMentions,
   unresolvedHintMentions:row.unresolvedHintMentions,
   directSkillGrantMentions:row.directSkillGrantMentions
  }};
 const dict=skills(),m=model(),x=crosswalk({candidate,skillText:dict,model:m});
 const result=project({candidate,crosswalk:x,skillText:dict,model:m});
 const d=result.report.blockerDiagnosis;
 assert.equal(result.report.totals.skippedEvents,4);
 assert.equal(d.totalExcluded,4);
 assert.equal(d.primaryReasonCounts.SOURCE_SPECIAL_CASE_REQUIRES_REVIEW,2);
 assert.equal(d.primaryReasonCounts.EXCLUSIVE_OR_OPTIONS_UNRESOLVED,1);
 assert.equal(d.primaryReasonCounts.MISSING_OR_DUPLICATE_RESULT_SKILL,1);
 assert.equal(d.sourceEvidenceEventCounts.PRIOR_RESULT_OR_BRANCH_FLAG_REQUIRES_REVIEW,1);
 assert.equal(d.sourceEvidenceEventCounts.CONDITIONAL_SEGMENT_REQUIRES_REVIEW,1);
 assert.equal(d.sourceEvidenceEventCounts.DIRECT_SKILL_GRANT_REQUIRES_REVIEW,1);
 assert.equal(d.sourceEvidenceEventCounts.SKILL_HINT_EFFECT_UNRESOLVED,1);
 assert.equal(d.numericOnlyPositions.find(x=>x.sourceOrdinal===2).directAwardMentions,1);
 assert.equal(d.numericOnlyPositions.find(x=>x.sourceOrdinal===3).unparsedHintMentions,1);
 assert.equal(d.numericOnlyPositions.find(x=>x.sourceOrdinal===4).duplicateHintRouteCount,1);
 assert.equal(Object.values(d.specialCaseEvidenceCombinations).reduce((a,b)=>a+b,0),2);
 assert.equal(d.publicationApproved,false);
 const str=JSON.stringify(d);
 assert.ok(!str.includes('private source'));
 assert.ok(!str.includes('private choice'));
 assert.ok(!str.includes('速度維持'));
});


function orCandidate(options,fixedId=200532){
 const effects=[
  ...(fixedId?[{type:'skill_hint',skill_id:fixedId,value:'+1'}]:[]),
  {type:'skill_hint_or',options}
 ];
 const normalized=transformDocument({kind:'support',id:30026,events_ja:{
  a:{id:1,section:'random',name:'not for publication',choices:[
   {label:'',effects}]}
 }});
 const {reviewQueue,effectTypeCounts,...card}=normalized;
 const candidate={dataKind:'gametora-whole-event-numeric-candidate',
  releaseApproved:false,noEventCanPublishFromThisCandidate:true,
  sourcePins:{gameToraDerived:policy.baselineRevision},
  cards:[card],totals:{
   rosterCards:1,sourceEvents:normalized.sourceEventCount,
   sourceChoices:normalized.sourceChoiceCount,
   expandedRoutes:normalized.sourceExpandedRoutes,
   numericHintMentions:normalized.numericParsedHintMentions,
   unresolvedHintMentions:normalized.unresolvedHintMentions,
   directSkillGrantMentions:normalized.directSkillGrantMentions
  }};
 const dict=skills(),m=model();
 const x=crosswalk({candidate,skillText:dict,model:m});
 return {candidate,crosswalk:x,skillText:dict,model:m};
}
test('GameTora OR skill hints create exclusive conditional outcomes with shared fixed reward',()=>{
 const req=orCandidate([
  {skill_id:201272,value:'+3'},
  {skill_id:400000,value:'+1'}
 ]);
 const raw=req.candidate.cards[0].events[0].choices[0].routes[0].numericHintFacts;
 assert.equal(raw.length,2);
 assert.deepEqual(raw[1].alternatives.map(x=>x.skillNumericId),['201272','400000']);
 assert.equal(req.crosswalk.stats.exclusiveOrHintEffects,1);
 assert.equal(req.crosswalk.stats.exclusiveOrOptionsParsed,2);
 assert.equal(req.crosswalk.alternativeLocations.length,2);
 const result=project(req),counts=result.report.totals;
 assert.equal(counts.candidateSchemaEvents,1);
 assert.equal(counts.candidateExclusiveOrEvents,1);
 assert.equal(counts.candidateExclusiveOrHintEffects,1);
 assert.equal(counts.candidateExclusiveOrOptionMentions,2);
 assert.equal(counts.candidateRewardMentions,3);
 const event=result.dryRunCatalog.cards[0].events[0];
 assert.equal(event.type,'auto');
 assert.equal(event.outcomes.length,2);
 assert.equal(event.rewards,undefined);
 assert.deepEqual(event.outcomes.map(o=>o.rewards.map(r=>r.skillId)),[
  ['hint:速度維持','skill:201272'],
  ['hint:速度維持','skill:400000']]);
 const routes=core.directRoutes({hints:[],events:[event]},{choices:{}});
 assert.equal(routes.length,4);
 assert.ok(routes.every(x=>x.conditional));
 assert.ok(!JSON.stringify(result.report).includes('not for publication'));
 assert.equal(result.report.publicationApproved,false);
});
test('OR alternatives require every numeric ID and exact level; no partial source rewards',()=>{
 const malformed=orCandidate([
  {skill_id:201272,value:'+1/+3'},
  {skill_id:400000,value:'+1'}
 ]);
 assert.equal(malformed.crosswalk.stats.exclusiveOrOptionsParsed,1);
 const blocked=project(malformed);
 assert.equal(blocked.report.totals.candidateSchemaEvents,0);
 assert.equal(blocked.report.excludedReasons.EXCLUSIVE_OR_OPTIONS_UNRESOLVED,1);
 const mismatch=orCandidate([
  {skill_id:201272,value:'+3'},{skill_id:400000,value:'+1'}
 ]);
 mismatch.crosswalk.alternativeLocations[0].level=99;
 assert.equal(project(mismatch).report.excludedReasons.EXCLUSIVE_OR_OPTIONS_UNRESOLVED,1);
 const duplicate=orCandidate([
  {skill_id:200532,value:'+3'},{skill_id:201272,value:'+1'}
 ]);
 assert.equal(project(duplicate).report.excludedReasons.EXCLUSIVE_OR_DUPLICATES_FIXED_REWARD,1);
 const withoutOptions=orCandidate(undefined);
 assert.equal(project(withoutOptions).report.totals.candidateSchemaEvents,0);
});
