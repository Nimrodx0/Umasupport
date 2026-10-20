'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const core=require('../src/core.js'),schema=require('../src/event_schema.js');
const {validate,auditFixture}=require('../src/editorial_cumulative_result_30103.cjs');
const candidate=require('../data/candidates/checker_event_hints.v1.json');
const facts=require('../data/candidates/checker_explicit_result_facts.v1.json');
const p0Queue=require('../data/candidates/checker_explicit_result_review_queue.v1.json');
const audit=require('../data/candidates/editorial_cumulative_result_30103.v1.json');
const args={candidate,facts,p0Queue,audit};
test('three stages and all four prior result combinations corroborated, but never published',()=>{
 a.deepEqual(validate(args),{cards:1,transitionEvents:3,branchCombinations:4,
  sourceOutcomeStates:7,numericAwardChecks:4,unresolvedSkillFacts:1});
 a.equal(audit.forSkillGrant,false);a.equal(audit.actualGamePlayVerified,false);
 const f=auditFixture(args);
 a.equal(f.events.length,3);schema.validateEvents(f.events,f.model,'30103');
 a.ok(f.meta.auditOnly);a.equal(f.meta.publicationApproval,false);
});
test('both wins, exactly one win, and both losses yield Lv3, Lv2, and Lv1 exclusively',()=>{
 const {events,card}=auditFixture(args),[e1,e2,e3]=events;
 for(const [first,second,expectedKind,expectedLevel] of [
  ['success','success','great',3],['success','failure','success',2],
  ['failure','success','success',2],['failure','failure','failure',1]]){
   const states={[e1.id]:first,[e2.id]:second},choices={};
   const possible=e3.outcomes.filter(r=>core.outcomeReachability(r,e3,choices,events,states).status!=='blocked');
   a.deepEqual(possible.map(r=>r.id),[expectedKind]);
   const routes=core.directRoutes(card,{choices,outcomes:states}).filter(r=>r.skillId==='200461');
   a.deepEqual(routes.map(r=>r.level),[expectedLevel]);
   a.equal(core.outcomeReachability(e3.outcomes.find(r=>r.id===expectedKind),e3,choices,events,states).status,'reachable');
   const impossible=e3.outcomes.find(r=>r.id!==expectedKind);
   a.equal(core.outcomeReachability(impossible,e3,choices,events,states).status,'blocked');
   const invalid=core.directRoutes(card,{choices,outcomes:{...states,[e3.id]:impossible.id}});
   a.ok(invalid.every(r=>r.eventId!==e3.id),'impossible result must never award skills');
  }
});
test('unknown earlier results mean conditional reward possibilities, not unconditional',()=>{
 const {events,card}=auditFixture(args),[first,second,third]=events;
 const routes=core.directRoutes(card,{choices:{},outcomes:{}}).filter(r=>r.eventId===third.id);
 a.deepEqual(routes.map(r=>r.level),[3,2,1]);
 a.ok(routes.every(r=>r.conditional));
 a.equal(core.outcomeReachability(third.outcomes[0],third,{},events,{}).status,'conditional');
 const next=core.directRoutes(card,{choices:{},outcomes:{[first.id]:'failure'}})
 .filter(r=>r.eventId===third.id);
 a.deepEqual(next.map(r=>r.level),[2,1]);
 // Stage 2's skill name is unresolved in the pinned numeric registry and cannot be granted.
 a.ok(!core.directRoutes(card,{choices:{},outcomes:{[second.id]:'success'}}).some(r=>r.skillId==='差し焦り'));
});
test('changing first stage resets third stage result even though second stage is independent',()=>{
 const {events,card}=auditFixture(args),[e1,e2,e3]=events;
 const states={[e1.id]:'success',[e2.id]:'success',[e3.id]:'great'};
 const changed=core.clearDependentState(card,{},states,e1.id);
 a.deepEqual(changed.outcomes,{});
 const stopped=core.directRoutes(card,{choices:{},outcomes:{[e1.id]:'failure',[e2.id]:'failure',[e3.id]:'great'}});
 a.ok(!stopped.some(r=>r.eventId===e3.id));
});
test('contradictory gate, unlisted choice paths, source changes, and invented IDs fail closed',()=>{
 let x=structuredClone(audit);
 x.stages[2].resultConditions[1].any.push([{eventOrdinal:1,resultKind:'success'},{eventOrdinal:2,resultKind:'success'}]);
 a.throws(()=>validate({...args,audit:x}),/重複/);
 x=structuredClone(audit);x.stages[0].sourceDigest='sha256:'+'0'.repeat(64);
 a.throws(()=>validate({...args,audit:x}),/指紋/);
 x=structuredClone(audit);x.numericAwardChecks[1].level=9;
 a.throws(()=>validate({...args,audit:x}),/ヒントID/);
 const fixture=auditFixture(args),events=structuredClone(fixture.events);
 events[2].outcomes[0].requires.any[0].all=[
  {eventId:events[0].id,outcomeId:'success'},
  {eventId:events[0].id,outcomeId:'failure'}];
 a.throws(()=>schema.validateEvents(events,fixture.model,'30103'),/両立しない/);
});
