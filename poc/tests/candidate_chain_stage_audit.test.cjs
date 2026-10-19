'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../data/candidates/checker_event_hints.v1.json');
const classification=require('../data/candidates/checker_route_classification.v1.json');
const {build,validateAudit}=require('../src/candidate_chain_stage_audit.cjs');
const deep=x=>structuredClone(x);
test('exact 954 pinned historical title links partition to numeric chain stages and unsequenced events',()=>{
 const audit=build(db,classification),s=audit.totals;
 assert.equal(audit.approvalState,'UNREVIEWED_NOT_FOR_PUBLICATION');
 assert.equal(audit.forSkillGrant,false);
 assert.equal(s.strictProvisionalEvents,954);
 assert.equal(s.stageGroups,349);
 assert.equal(s.stageCompleteUnique,312);
 assert.equal(s.stageIncomplete,33);
 assert.equal(s.stageAmbiguous,4);
 assert.equal(s.stageCompleteUniqueEventRows,841);
 assert.equal(s.unsequencedStrictEvents,44);
 assert.equal(s.stageEvents,910);
 assert.equal(s.verifiedGameChains,0);
 assert.equal(s.verifiedRewards,0);
 assert.equal(audit.chainGroups.length,349);
 assert.equal(audit.unsequencedStrictEvents.length,44);
 assert.equal(s.stageCompleteUnique+s.stageIncomplete+s.stageAmbiguous,s.stageGroups);
 assert.ok(audit.chainGroups.every(g=>g.needsCurrentGameReview&&g.needsChoiceOutcomeReview));
 assert.ok(audit.chainGroups.every(g=>g.events.every(e=>/^checker:\d{5}:/.test(e.sourceKey)&&
  /^\d{9}$/.test(e.provisionalStoryId))));
 assert.ok(audit.chainGroups.some(g=>g.cardId==='30001'&&g.chainMax===3&&
  g.structuralStatus==='stage-complete-unique'&&g.events.length===3));
 const json=JSON.stringify(audit);
 for(const forbidden of ['イベント本文','Effect','Title','choiceText','originalEventName'])
  assert.ok(!json.includes(forbidden),'source prose field leaked');
});
test('the stage diagnostic rejects grant promotion, source ID tampering, and incomplete artifacts',()=>{
 const audit=build(db,classification);
 for(const mutation of [
  x=>x.approvalState='APPROVED',
  x=>x.forSkillGrant=true,
  x=>x.totals.verifiedGameChains=1,
  x=>x.chainGroups[0].events[0].sourceDigest='sha256:'+'0'.repeat(64),
  x=>x.chainGroups[0].events[0].hintMentions=999,
  x=>x.chainGroups.pop(),
  x=>x.unsequencedStrictEvents.splice(0,1)
 ]){
  const d=deep(audit);mutation(d);
  assert.throws(()=>validateAudit(db,classification,d),/differs/);
 }
 assert.equal(validateAudit(db,classification,audit).stageCompleteUnique,312);
});
test('synthetic coordinate conflict never produces a confirmed chain',()=>{
 const mod=deep(classification);
 const card=mod.cards.find(c=>c.cardId==='30001');
 const pair=card.events.filter(e=>e.historicalLink.status==='strict-unique');
 assert.ok(pair.length>=3);
 const first=pair[0].historicalLink.historicalNumericMetadata;
 const second=pair[1].historicalLink.historicalNumericMetadata;
 // Invent a repeated stage coordinate while retaining candidate identity and pins:
 second.show_progress_1=first.show_progress_1;
 second.show_progress_2=first.show_progress_2;
 second.show_progress_3=first.show_progress_3;
 const audit=build(db,mod);
 const group=audit.chainGroups.find(g=>g.cardId==='30001'&&g.chainMax===3);
 assert.equal(group.structuralStatus,'stage-ambiguous');
 assert.equal(audit.totals.verifiedGameChains,0);
});
