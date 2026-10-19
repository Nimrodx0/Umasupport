'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const core=require('../src/core.js');
const {validate,auditFixture}=require('../src/editorial_branch_crosscheck.cjs');
const candidate=require('../data/candidates/checker_event_hints.v1.json');
const facts=require('../data/candidates/checker_explicit_result_facts.v1.json');
const p0Queue=require('../data/candidates/checker_explicit_result_review_queue.v1.json');
const audit=require('../data/candidates/editorial_branch_crosscheck.v1.json');
const args={candidate,facts,p0Queue,audit};
const fixture=id=>auditFixture(args,id);
const stage=(fixture,n)=>fixture.events.find(x=>x.name==='連続'+n);
test('3 cards, 4 P0 events, 10 complete cross-publisher branches all match source positions',()=>{
 a.deepEqual(validate(args),{cards:3,transitionEvents:4,transitionBranches:10,awardChecks:8,unresolvedDifferences:2});
 a.equal(audit.actualGamePlayVerified,false);
 a.equal(audit.publicationApproval,false);
});
test('30026 first and second stage failure/opt-out terminate while both successes advance',()=>{
 const f=fixture('30026');
 const a1=stage(f,1),a2=stage(f,2),a3=stage(f,3);
 const ch={ [a1.id]:'c1',[a2.id]:'c1',[a3.id]:'c1' };
 a.equal(core.reachability(a2,ch,f.events).status,'conditional');
 a.equal(core.reachability(a2,ch,f.events,{[a1.id]:'success'}).status,'reachable');
 a.equal(core.reachability(a2,ch,f.events,{[a1.id]:'failure'}).status,'blocked');
 a.equal(core.reachability(a2,{...ch,[a1.id]:'c2'},f.events).status,'blocked');
 a.equal(core.reachability(a3,ch,f.events,{[a1.id]:'success',[a2.id]:'success'}).status,'reachable');
 a.equal(core.reachability(a3,ch,f.events,{[a1.id]:'success',[a2.id]:'failure'}).status,'blocked');
 a.equal(core.reachability(a3,{...ch,[a2.id]:'c2'},f.events,{[a1.id]:'success'}).status,'blocked');
 const success=core.directRoutes(f.card,{choices:ch,outcomes:{[a1.id]:'success',[a2.id]:'success',[a3.id]:'success'}});
 const failure=core.directRoutes(f.card,{choices:ch,outcomes:{[a1.id]:'success',[a2.id]:'success',[a3.id]:'failure'}});
 a.ok(success.some(x=>x.skillId==='200531'));
 a.ok(!success.some(x=>x.skillId==='200532'));
 a.ok(failure.some(x=>x.skillId==='200532'));
 a.ok(!failure.some(x=>x.skillId==='200531'));
 const terminated=core.directRoutes(f.card,{choices:ch,outcomes:{[a1.id]:'failure'}});
 a.ok(terminated.every(x=>x.eventId===a1.id));
 const disputed=core.directRoutes(f.card,{choices:{[a1.id]:'c1',[a2.id]:'c2'},outcomes:{[a1.id]:'success'}});
 a.ok(disputed.every(x=>x.skillId!=='200692'),'disputed reward must never be granted');
});
test('30001 and 30007 second stage lower choice prevents third-stage rewards',()=>{
 for(const [id,gold] of [['30001','200511'],['30007','200721']]){
  const f=fixture(id),second=stage(f,2),third=stage(f,3);
  a.equal(core.reachability(third,{[second.id]:'c1'},f.events).status,'reachable');
  a.equal(core.reachability(third,{[second.id]:'c2'},f.events).status,'blocked');
  const reward=core.directRoutes(f.card,{choices:{[second.id]:'c2'},outcomes:{[third.id]:'success'}});
  a.ok(!reward.some(x=>x.skillId===gold));
 }
});
test('source-digest drift or invented result routes are rejected',()=>{
 const x=structuredClone(audit);x.cards[0].transitionStages[0].sourceDigest='sha256:'+'0'.repeat(64);
 a.throws(()=>validate({...args,audit:x}),/出典指紋/);
 const y=structuredClone(audit);y.cards[2].transitionStages[1].branches[0].nextEventOrdinal=100;
 a.throws(()=>validate({...args,audit:y}),/遷移先/);
 const z=structuredClone(audit);z.cards[2].transitionStages[1].branches.pop();
 a.throws(()=>validate({...args,audit:z}),/網羅/);
});
test('unresolved reward conflicts remain non-publishable even if numeric data exists',()=>{
 const x=structuredClone(audit);
 const source=facts.cards.find(x=>x.cardId==='30026').events[1];
 x.cards[2].awardChecks.push({eventOrdinal:2,sourceKey:source.sourceKey,
 sourceDigest:source.sourceDigest,choiceOrdinal:2,resultKind:'unspecified',skillId:'200692',level:3});
 x.stats.awardChecks++;
 a.throws(()=>validate({...args,audit:x}),/承認できません/);
});
