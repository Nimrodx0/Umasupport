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
 {id:'200461',name:'三段階ヒント',rarity:'rare',group:20046},
 {id:'200462',name:'先行結果スキルA',rarity:'normal',group:20046},
 {id:'200901',name:'先行結果スキルB',rarity:'normal',group:20090},
 {id:'201051',name:'分岐共通ヒントA',rarity:'normal',group:20105},
 {id:'202671',name:'分岐共通ヒントB',rarity:'rare',group:20267},
 {id:'200283',name:'架空のマイナススキルA',rarity:'minus',group:20028},
 {id:'200353',name:'架空のマイナススキルB',rarity:'minus',group:20035},
 {id:'200521',name:'架空のマイナススキルC',rarity:'minus',group:20052},
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
 assert.equal(result.report.totals.skippedEvents,3);
 assert.equal(result.report.totals.candidateDirectAcquisitionEvents,1);
 assert.equal(d.totalExcluded,3);
 assert.equal(d.primaryReasonCounts.SOURCE_SPECIAL_CASE_REQUIRES_REVIEW,1);
 assert.equal(d.primaryReasonCounts.EXCLUSIVE_OR_OPTIONS_UNRESOLVED,1);
 assert.equal(d.primaryReasonCounts.MISSING_OR_DUPLICATE_RESULT_SKILL,1);
 assert.equal(d.sourceEvidenceEventCounts.PRIOR_RESULT_OR_BRANCH_FLAG_REQUIRES_REVIEW,1);
 assert.equal(d.sourceEvidenceEventCounts.CONDITIONAL_SEGMENT_REQUIRES_REVIEW,1);
 assert.equal(d.sourceEvidenceEventCounts.DIRECT_SKILL_GRANT_REQUIRES_REVIEW||0,0);
 assert.equal(d.sourceEvidenceEventCounts.SKILL_HINT_EFFECT_UNRESOLVED,1);
 assert.ok(result.dryRunCatalog.cards[0].events.some(e=>[e,...(e.choices||[])].some(part=>part.rewards?.some(r=>r.kind==='obtained'))));
 assert.equal(d.numericOnlyPositions.find(x=>x.sourceOrdinal===3).unparsedHintMentions,1);
 assert.equal(d.numericOnlyPositions.find(x=>x.sourceOrdinal===4).duplicateHintRouteCount,1);
 assert.equal(Object.values(d.specialCaseEvidenceCombinations).reduce((a,b)=>a+b,0),1);
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
  {skill_id:201272,value:'unknown'},
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


test('correlated slash levels are two alternatives, not an unconditional low hint',()=>{
 const raw={kind:'support',id:30026,events_ja:{one:{
  name:'unpublished range event',section:'random',choices:[{label:'',
   effects:[
    {type:'skill_hint',skill_id:201272,value:'+1/+3'},
    {type:'skill_hint',skill_id:200532,value:'+1'},
    {type:'speed',value:'+5/+10'}
   ]}]}}};
 const row=transformDocument(raw),{reviewQueue,effectTypeCounts,...card}=row;
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
 const m=model(),dict=skills(),link=crosswalk({candidate,model:m,skillText:dict});
 assert.equal(row.unresolvedHintMentions,1);
 assert.equal(link.stats.rangedHintEffects,1);
 assert.equal(link.rangeLocations.length,1);
 assert.deepEqual(card.events[0].choices[0].routes[0].effects[2].numericRange,[5,10]);
 const out=project({candidate,crosswalk:link,skillText:dict,model:m});
 assert.equal(out.report.totals.candidateSchemaEvents,1);
 assert.equal(out.report.totals.candidateRangedHintEffects,1);
 assert.equal(out.report.totals.candidateRangeOutcomeEvents,1);
 const event=out.dryRunCatalog.cards[0].events[0];
 assert.deepEqual(event.outcomes.map(x=>x.rewards.find(r=>r.skillId==='skill:201272').level),[1,3]);
 assert.ok(core.directRoutes({events:[event],hints:[]},{choices:{}}).every(x=>x.conditional));
 const forged=structuredClone(link);
 forged.rangeLocations[0].levelRange=[1,4];
 assert.equal(project({candidate,crosswalk:forged,skillText:dict,model:m}).report.excludedReasons.RANGED_HINT_EFFECT_PENDING,1);
});
test('range in OR options follows same low/high tier and does not grant both alternatives',()=>{
 const req=orCandidate([
  {skill_id:201272,value:'+1/+3'},
  {skill_id:400000,value:'+1'}
 ]);
 assert.equal(req.crosswalk.stats.exclusiveOrOptionsWithRange,1);
 const out=project(req);
 assert.equal(out.report.totals.candidateSchemaEvents,1);
 assert.equal(out.report.totals.candidateExclusiveOrRangedOptions,1);
 assert.equal(out.report.totals.candidateRangeOutcomeEvents,1);
 const o=out.dryRunCatalog.cards[0].events[0].outcomes;
 assert.equal(o.length,4);
 assert.deepEqual(o.map(x=>x.rewards.at(-1).level),[1,1,3,1]);
 assert.deepEqual(o.map(x=>x.rewards.at(-1).skillId),
  ['skill:201272','skill:400000','skill:201272','skill:400000']);
 assert.ok(o.every(x=>x.rewards.length===2));
});


function outingCandidate(raw){
 const norm=transformDocument(raw);
 const {reviewQueue,effectTypeCounts,...card}=norm;
 const candidate={dataKind:'gametora-whole-event-numeric-candidate',
  releaseApproved:false,noEventCanPublishFromThisCandidate:true,
  sourcePins:{gameToraDerived:policy.baselineRevision},
  cards:[card],totals:{
   rosterCards:1,sourceEvents:norm.sourceEventCount,
   sourceChoices:norm.sourceChoiceCount,
   expandedRoutes:norm.sourceExpandedRoutes,
   numericHintMentions:norm.numericParsedHintMentions,
   unresolvedHintMentions:norm.unresolvedHintMentions,
   directSkillGrantMentions:norm.directSkillGrantMentions
  }};
 const m=model(),skillText=skills(),x=crosswalk({candidate,skillText,model:m});
 return {candidate,crosswalk:x,skillText,model:m};
}
test('a random choice declining a friend outing blocks its first and later dates, not random skill rewards',()=>{
 const req=outingCandidate({kind:'support',id:30026,events_ja:{
  start:{section:'random',name:'source prose withheld',choices:[
   {label:'accept',effects:[{type:'skill_hint',skill_id:200532,value:'+1'}]},
   {label:'decline',effects:[{type:'chain_end'},{type:'energy',value:'+3'}]}]},
  outing1:{section:'dates',name:'outing 1',choices:[{label:'',effects:[
   {type:'skill_hint',skill_id:201272,value:'+1'}]}]},
  outing2:{section:'dates',name:'outing 2',choices:[{label:'',effects:[
   {type:'skill_hint',skill_id:200532,value:'+2'}]}]}
 }});
 const out=project(req),events=out.dryRunCatalog.cards[0].events;
 assert.equal(out.report.totals.candidateSchemaEvents,3);
 assert.equal(out.report.totals.candidateOutingUnlockEvents,1);
 assert.equal(out.report.totals.candidateOutingFirstStagesGated,1);
 assert.equal(out.report.totals.skippedEvents,0);
 assert.deepEqual(events[1].requires,{all:[{eventId:events[0].id}]});
 assert.deepEqual(events[2].requires,{all:[{eventId:events[1].id}]});
 assert.equal(events[0].choices[1].terminal,true);
 assert.equal(core.reachability(events[1],{},events).status,'blocked');
 const accept={[events[0].id]:events[0].choices[0].id};
 const decline={[events[0].id]:events[0].choices[1].id};
 assert.equal(core.reachability(events[1],accept,events).status,'conditional');
 assert.equal(core.reachability(events[1],decline,events).status,'blocked');
 assert.equal(core.reachability(events[2],decline,events).status,'blocked');
 const selected=core.directRoutes({events,hints:[]},{choices:accept});
 assert.ok(selected.some(r=>r.skillId==='skill:201272'&&r.conditional));
 const stopped=core.directRoutes({events,hints:[]},{choices:decline});
 assert.ok(!stopped.some(r=>r.skillId==='skill:201272'));
 assert.ok(!JSON.stringify(out.report).includes('source prose'));
 assert.equal(out.report.publicationApproved,false);
});
test('random unlock terminal is conditional on its actual result, not the choice label alone',()=>{
 const req=outingCandidate({kind:'support',id:30026,events_ja:{
  start:{section:'random',name:'unpublished event title',choices:[
   {label:'gamble',random_either:true,outcomes:[
    [{type:'skill_hint',skill_id:200532,value:'+1'}],
    [{type:'chain_end'}]]},
   {label:'safe',effects:[{type:'speed',value:'+5'}]}]},
  outing:{section:'dates',name:'unpublished outing',choices:[{label:'',effects:[
   {type:'skill_hint',skill_id:201272,value:'+2'}]}]}
 }});
 const out=project(req),events=out.dryRunCatalog.cards[0].events;
 const [start,outing]=events;
 const gamble={[start.id]:'choice-01'};
 const safe={[start.id]:'choice-02'};
 assert.equal(out.report.totals.candidateOutingUnlockEvents,1);
 assert.equal(start.choices[0].outcomes[1].terminal,true);
 assert.equal(core.reachability(outing,gamble,events).status,'conditional');
 assert.equal(core.reachability(outing,gamble,events,{[start.id]:'route-02'}).status,'blocked');
 assert.equal(core.reachability(outing,gamble,events,{[start.id]:'route-01'}).status,'conditional');
 assert.equal(core.reachability(outing,safe,events).status,'conditional');
});
test('unknown outing unlock semantics or unresolved skill award blocks dates without guessing',()=>{
 const unknown=outingCandidate({kind:'support',id:30026,events_ja:{
  start:{section:'random',name:'unknown',choices:[{label:'',effects:[
   {type:'chain_end'}]}]},
  outing:{section:'dates',name:'outing',choices:[{label:'',effects:[
   {type:'skill_hint',skill_id:200532,value:'+1'}]}]}
 }});
 const a=project(unknown);
 assert.equal(a.report.totals.candidateSchemaEvents,0);
 assert.equal(a.report.excludedReasons.OUTING_UNLOCK_SEMANTICS_REQUIRES_REVIEW,1);
 const award=outingCandidate({kind:'support',id:30026,events_ja:{
  start:{section:'random',name:'mixed skill reward',choices:[
   {label:'take',effects:[{type:'obtain_skill',skill_id:999999}]},
   {label:'decline',effects:[{type:'chain_end'}]}]},
  outing1:{section:'dates',name:'outing1',choices:[{label:'',effects:[
   {type:'skill_hint',skill_id:201272,value:'+1'}]}]},
  outing2:{section:'dates',name:'outing2',choices:[{label:'',effects:[
   {type:'skill_hint',skill_id:200532,value:'+1'}]}]}
 }});
 const b=project(award);
 assert.equal(b.report.totals.candidateSchemaEvents,0);
 assert.equal(b.report.excludedReasons.DIRECT_SKILL_GRANT_ID_PENDING,1);
 assert.equal(b.report.excludedReasons.OUTING_UNLOCK_PREDECESSOR_NOT_PROJECTED,1);
 assert.equal(b.report.excludedReasons.OUTING_PREDECESSOR_NOT_PROJECTED,1);
 assert.equal(b.report.totals.blockedOutingUnlockStarts,1);
});


test('direct skill acquisition stays separate from hints and has NO hint level',()=>{
 const req=outingCandidate({kind:'support',id:30026,events_ja:{
  event:{id:89,section:'random',name:'original not published',choices:[
   {label:'A',effects:[
    {type:'obtain_skill',skill_id:201272},
    {type:'skill_hint',skill_id:200532,value:'+2'}]},
   {label:'B',effects:[{type:'speed',value:'+5'}]}]}
 }});
 assert.equal(req.crosswalk.stats.directSkillGrantMentions,1);
 const out=project(req);
 assert.equal(out.report.totals.candidateSchemaEvents,1);
 assert.equal(out.report.totals.candidateDirectAcquisitionMentions,1);
 assert.equal(out.report.totals.candidateDirectAcquisitionEvents,1);
 const choice=out.dryRunCatalog.cards[0].events[0].choices[0];
 assert.deepEqual(choice.rewards.map(r=>({id:r.skillId,kind:r.kind||'hint',level:r.level??null})),[
  {id:'hint:速度維持',kind:'hint',level:2},
  {id:'skill:201272',kind:'obtained',level:null}
 ]);
 assert.equal(out.runtimeValidation.eventsWithRecords,1);
 const event=out.dryRunCatalog.cards[0].events[0];
 const selected=core.directRoutes({hints:[],events:[event]},{choices:{[event.id]:choice.id}});
 assert.equal(selected.find(r=>r.skillId==='skill:201272').kind,'obtained');
 assert.equal(selected.find(r=>r.skillId==='skill:201272').level,null);
 assert.equal(selected.find(r=>r.skillId==='hint:速度維持').kind,'hint');
 assert.equal(selected.find(r=>r.skillId==='hint:速度維持').level,2);
 assert.ok(!JSON.stringify(out.report).includes('original not published'));
});
test('direct acquisition crosswalk must be exact and the same result cannot award duplicate skills',()=>{
 const base={kind:'support',id:30026,events_ja:{
  event:{id:1,section:'random',name:'no external text',choices:[
   {label:'A',effects:[{type:'obtain_skill',skill_id:201272}]}]}
 }};
 const ok=outingCandidate(base);
 const loc=ok.crosswalk.locations.find(x=>x.kind==='direct-skill-award');
 assert.ok(loc);
 loc.numericId='200532';
 assert.equal(project(ok).report.excludedReasons.DIRECT_SKILL_GRANT_ID_PENDING,1);
 const duplicate=outingCandidate({kind:'support',id:30026,events_ja:{
  event:{id:1,section:'random',name:'no text',choices:[
   {label:'A',effects:[{type:'skill_hint',skill_id:200532,value:'+1'},
    {type:'obtain_skill',skill_id:200532}]}]}
 }});
 assert.equal(project(duplicate).report.excludedReasons.DIRECT_SKILL_GRANT_DUPLICATE_OR_RARITY,1);
});
test('the friend outing previously blocked by a valid direct grant now retains the reward and unlock gate',()=>{
 const req=outingCandidate({kind:'support',id:30026,events_ja:{
  start:{section:'random',name:'not published',choices:[
   {label:'go',effects:[{type:'obtain_skill',skill_id:200532}]},
   {label:'stop',effects:[{type:'chain_end'}]}]},
  date1:{section:'dates',name:'unpublished 1',choices:[{label:'',effects:[
   {type:'skill_hint',skill_id:201272,value:'+1'}]}]},
  date2:{section:'dates',name:'unpublished 2',choices:[{label:'',effects:[
   {type:'skill_hint',skill_id:200532,value:'+2'}]}]}
 }});
 const out=project(req),events=out.dryRunCatalog.cards[0].events;
 assert.equal(out.report.totals.candidateSchemaEvents,3);
 assert.equal(out.report.totals.candidateDirectAcquisitionMentions,1);
 assert.deepEqual(events[1].requires,{all:[{eventId:events[0].id}]});
 const choices={[events[0].id]:events[0].choices[0].id};
 const routes=core.directRoutes({hints:[],events},{choices});
 assert.ok(routes.some(x=>x.skillId==='hint:速度維持'&&x.kind==='obtained'&&!x.conditional));
 assert.ok(routes.some(x=>x.skillId==='skill:201272'&&x.kind==='hint'&&x.conditional));
});


test('source obtain_skill with pinned minus rarity stays visible as a negative event effect but never skill coverage',()=>{
 const req=outingCandidate({kind:'support',id:30026,events_ja:{
  risk:{id:7,section:'random',name:'unpublished minus reward',choices:[
   {label:'bad',effects:[{type:'obtain_skill',skill_id:200521},
    {type:'skill_hint',skill_id:200532,value:'+2'}]}]}
 }});
 const proof=req.crosswalk.locations.find(r=>r.kind==='direct-skill-award');
 assert.equal(proof.status,'unsupported-rarity');
 assert.equal(proof.rarity,'minus');
 const result=project(req);
 assert.equal(result.report.totals.candidateSchemaEvents,1);
 assert.equal(result.report.totals.candidateNegativeSkillMentions,1);
 assert.equal(result.report.totals.candidateNegativeSkillEvents,1);
 assert.equal(result.report.totals.candidateDirectAcquisitionMentions,0);
 const ev=result.dryRunCatalog.cards[0].events[0];
 const bad=ev.choices[0].rewards.find(x=>x.kind==='negative');
 assert.deepEqual({skillId:bad.skillId,kind:bad.kind,level:bad.level??null},
  {skillId:'skill:200521',kind:'negative',level:null});
 const paths=core.directRoutes({hints:[],events:[ev]},
  {choices:{[ev.id]:ev.choices[0].id}});
 assert.equal(paths.length,1);
 assert.equal(paths[0].skillId,'hint:速度維持');
 assert.ok(!paths.some(x=>x.skillId==='skill:200521'));
 const tampered=outingCandidate({kind:'support',id:30026,events_ja:{
  risk:{section:'random',name:'unpublished',choices:[{label:'',effects:[
   {type:'obtain_skill',skill_id:200521}]}]}
 }});
 tampered.crosswalk.locations.find(x=>x.kind==='direct-skill-award').rarity='rare';
 assert.equal(project(tampered).report.excludedReasons.DIRECT_SKILL_GRANT_ID_PENDING,1);
});


function scriptedSource(effectSets,section='special'){
 return {kind:'support',id:30026,events_ja:{sample:{
  id:1433,section,name:'unpublished source title',
  choices:[{label:'',segments:effectSets.map((effects,i)=>({
   when:[{kind:'scripted',value:['class',i+1]}],effects
  }))}]
 }}};
}
test('a scripted event with different stats but NO skills in any class is skill-invariant only',()=>{
 const req=outingCandidate(scriptedSource([
  [{type:'bond',value:'+3'},{type:'mood',value:'+1'}],
  [{type:'speed',value:'+12'},{type:'mood',value:'+1'}],
  [{type:'guts',value:'+12'},{type:'bond',value:'+5'}]
 ]));
 const result=project(req);
 assert.equal(result.report.totals.candidateSchemaEvents,1);
 assert.equal(result.report.totals.skippedEvents,0);
 assert.equal(result.report.totals.candidateSkillInvariantScriptedEvents,1);
 assert.equal(result.report.totals.candidateUnmodeledNonSkillBranches,3);
 const event=result.dryRunCatalog.cards[0].events[0];
 assert.deepEqual({type:event.type,rewards:event.rewards,availabilityKind:event.availabilityKind},
  {type:'auto',rewards:[],availabilityKind:'special-trigger'});
 assert.deepEqual(core.directRoutes({events:[event],hints:[]},{choices:{}}),[]);
 assert.equal(result.report.publicationApproved,false);
 assert.equal(result.report.gameVerified,false);
 assert.ok(!JSON.stringify(result.report).includes('unpublished source title'));
});
test('scripted condition with any skill reward, direct grant, termination or unknown effect is NOT skill invariant',()=>{
 const innocent=[
  [{type:'bond',value:'+3'}],
  [{type:'mood',value:'+1'}],
  [{type:'speed',value:'+12'}]
 ];
 const changed=[
  [...innocent[0]],
  [{type:'skill_hint',skill_id:200532,value:'+1'}],
  [...innocent[2]]
 ];
 for(const [cases,section] of [
  [changed,'special'],
  [[innocent[0],[{type:'obtain_skill',skill_id:200283}],innocent[2]],'special'],
  [[innocent[0],[{type:'chain_end'}],innocent[2]],'special'],
  [[innocent[0],[{type:'branch_flag'}],innocent[2]],'special'],
  [innocent,'arrows']]){
  const result=project(outingCandidate(scriptedSource(cases,section)));
  assert.equal(result.report.totals.candidateSkillInvariantScriptedEvents,0);
  assert.equal(result.report.totals.candidateSchemaEvents,0);
  assert.equal(result.report.totals.skippedEvents,1);
 }
});


function specialCaseCandidate(raw){
 const norm=transformDocument(raw);
 const {reviewQueue,effectTypeCounts,...card}=norm;
 const candidate={dataKind:'gametora-whole-event-numeric-candidate',
  releaseApproved:false,noEventCanPublishFromThisCandidate:true,
  sourcePins:{gameToraDerived:policy.baselineRevision},
  cards:[card],totals:{
   rosterCards:1,sourceEvents:norm.sourceEventCount,
   sourceChoices:norm.sourceChoiceCount,expandedRoutes:norm.sourceExpandedRoutes,
   numericHintMentions:norm.numericParsedHintMentions,
   unresolvedHintMentions:norm.unresolvedHintMentions,
   directSkillGrantMentions:norm.directSkillGrantMentions
  }};
 const m=model(),id=String(raw.id);
 if(!m.cardById[id]){
  const next={id,hints:[],events:[]};m.cards.push(next);m.cardById[id]=next;
 }
 const skillText=skills(),x=crosswalk({candidate,skillText,model:m});
 return {candidate,crosswalk:x,skillText,model:m};
}
function baseSpecialSeries(last,id){
 return {kind:'support',id,events_ja:{
  prep1:{id:1,section:'random',name:'source omitted',choices:[{label:'option A',effects:[]}]},
  prep2:{id:2,section:'random',name:'source omitted',choices:[{label:'option A',effects:[]}]},
  chain1:{id:3,section:'arrows',name:'stage1',choices:[{label:'',
   random_either:true,outcomes:[
    [{type:'skill_hint',skill_id:200462,value:'+1'},{type:'skill_points',value:'+25'}],
    [{type:'skill_points',value:'+15'}]
   ]}]},
  chain2:{id:4,section:'arrows',name:'stage2',choices:[{label:'',
   random_either:true,outcomes:[
    [{type:'skill_hint',skill_id:200901,value:'+1'},{type:'skill_points',value:'+25'}],
    [{type:'skill_points',value:'+15'}]
   ]}]},
  chain3:last
 }};
}
test('source pinned Matitan: two earlier outcome results yield EXACTLY one of three hint levels',()=>{
 const source=baseSpecialSeries({id:5,section:'arrows',name:'unpublished 3',choices:[{label:'',
  effects:[
   {type:'both_previous_chain_good'},
   {type:'speed',value:'+7'},{type:'skill_hint',skill_id:200461,value:'+3'},
   {type:'one_previous_chain_good'},
   {type:'power',value:'+7'},{type:'skill_hint',skill_id:200461,value:'+2'},
   {type:'both_previous_chain_bad'},
   {type:'energy',value:'+10'},{type:'skill_hint',skill_id:200461,value:'+1'}
  ]}]},30103);
 const out=project(specialCaseCandidate(source)),events=out.dryRunCatalog.cards[0].events;
 assert.equal(out.report.totals.skippedEvents,0);
 assert.equal(out.report.totals.candidateSourceReviewedConditionalEvents,1);
 assert.equal(out.report.totals.candidateRewardMentions,5); // 2 upstream + 3 alternatives
 const final=events.find(e=>e.id.endsWith('005'));
 assert.equal(final.outcomes.length,3);
 assert.deepEqual(final.outcomes.map(o=>o.rewards[0].level),[3,2,1]);
 const first=events.find(e=>e.id.endsWith('003')),second=events.find(e=>e.id.endsWith('004'));
 const cases=[
  [['route-01','route-01'],0],
  [['route-01','route-02'],1],
  [['route-02','route-01'],1],
  [['route-02','route-02'],2]
 ];
 for(const [[a,b],expected] of cases){
  const chosen={[first.id]:a,[second.id]:b};
  const states=final.outcomes.map(o=>core.outcomeReachability(o,final,{},events,chosen).status);
  assert.deepEqual(states.map(x=>x!=='blocked'),[0,1,2].map(x=>x===expected));
 }
 assert.ok(!JSON.stringify(out.report).includes('unpublished'));
 assert.equal(out.report.publicationApproved,false);
});
test('Matitan source marker drift / ambiguous predecessor is quarantined, not flattened to three concurrent hints',()=>{
 const raw=baseSpecialSeries({id:5,section:'arrows',name:'not published',choices:[{label:'',
  effects:[{type:'both_previous_chain_good'},{type:'skill_hint',skill_id:200461,value:'+3'},
   {type:'one_previous_chain_good'},{type:'skill_hint',skill_id:200461,value:'+2'},
   {type:'both_previous_chain_bad'},{type:'skill_hint',skill_id:200461,value:'+1'}]}]},30103);
 raw.events_ja.chain1.choices[0].outcomes[0]=[{type:'speed',value:'+5'}];
 const result=project(specialCaseCandidate(raw));
 assert.equal(result.report.totals.candidateSourceReviewedConditionalEvents,0);
 assert.equal(result.report.excludedReasons.SOURCE_SPECIAL_CASE_REQUIRES_REVIEW,1);
});
function rheinSeries(mutate){
 const block=[
  {type:'speed',value:'+25'},
  {type:'skill_hint',skill_id:201051,value:'+1'},
  {type:'skill_hint',skill_id:202671,value:'+1'},
  {type:'bond',value:'+5'}
 ];
 const copy=structuredClone(block);
 if(mutate)copy[1].value='+2';
 return {kind:'support',id:30253,events_ja:{
  prep1:{id:1,section:'random',name:'prep',choices:[{label:'',effects:[]}]},
  prep2:{id:2,section:'random',name:'prep',choices:[{label:'',effects:[]}]},
  first:{id:3,section:'arrows',name:'first',choices:[{label:'',effects:[]}]},
  second:{id:4,section:'arrows',name:'second',choices:[
   {label:'option A',effects:[]},{label:'option B',effects:[]}]},
  final:{id:5,section:'arrows',name:'unpublished final',choices:[{label:'',
   effects:[...block,...copy]}]}
 }};
}
test('two identical source copies of Rhein hints are NOT double-awarded; preserve source provenance',()=>{
 const out=project(specialCaseCandidate(rheinSeries(false)));
 assert.equal(out.report.totals.skippedEvents,0);
 assert.equal(out.report.totals.candidateSourceReviewedDuplicateEvents,1);
 assert.equal(out.report.totals.candidateCollapsedDuplicatedSourceHints,2);
 const events=out.dryRunCatalog.cards[0].events;
 const ev=events.find(e=>e.id.endsWith('005'));
 assert.deepEqual(ev.rewards.map(x=>x.level),[1,1]);
 assert.equal(ev.rewards.length,2);
 assert.ok(!ev.outcomes);
 assert.equal(out.report.publicationApproved,false);
 assert.equal(out.report.gameVerified,false);
});
test('source copy is not identical: do not silently deduplicate or infer the previous choice reward',()=>{
 const out=project(specialCaseCandidate(rheinSeries(true)));
 assert.equal(out.report.totals.candidateSourceReviewedDuplicateEvents,0);
 assert.equal(out.report.excludedReasons.MISSING_OR_DUPLICATE_RESULT_SKILL,1);
});
