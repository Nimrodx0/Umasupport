'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {evaluateOutingUnlockSelection,verifyBothOpeningChoicesUnlock}=
 require('../src/friend_outing_access_gate.cjs');
const gate=Object.freeze({cardId:'30323',siteEventOrdinal:8,
 choiceOrdinals:[1,2],effectKind:'enable-outings',
 conditionalOnPlayerChoice:true,outingEventSequenceVerified:false,
 outingClosureVerified:false,publicationApproved:false});
test('both independently corroborated opening choices unlock friend outings',()=>{
 assert.equal(verifyBothOpeningChoicesUnlock(gate),true);
 for(const n of [1,2]){
  const v=evaluateOutingUnlockSelection(gate,n);
  assert.equal(v.outingUnlocked,true);
  assert.equal(v.outingAccessStatus,'outings-unlocked');
  assert.equal(v.individualOutingStageReachability,'not-adjudicated');
  assert.equal(v.nextEventId,null);
  assert.equal(v.terminalConditionVerified,false);
  assert.equal(v.publicationApproved,false);
 }
});
test('before opener is selected do not automatically count any outing reward',()=>{
 const r=evaluateOutingUnlockSelection(gate,null);
 assert.equal(r.outingUnlocked,false);
 assert.equal(r.outingAccessStatus,'pending-opening-choice');
 assert.equal(r.individualOutingStageReachability,'not-adjudicated');
});
test('unknown choice, malformed ids, and fake terminal proof remain blocked',()=>{
 assert.equal(evaluateOutingUnlockSelection(gate,3).outingUnlocked,false);
 assert.throws(()=>evaluateOutingUnlockSelection({...gate,outingClosureVerified:true},1),/不正/);
 assert.throws(()=>evaluateOutingUnlockSelection({...gate,publicationApproved:true},1),/不正/);
 assert.throws(()=>evaluateOutingUnlockSelection({...gate,choiceOrdinals:[1,1]},1),/不正/);
 assert.throws(()=>evaluateOutingUnlockSelection(gate,0),/不正/);
});
test('source candidate never contains a male/female choice label or inferred stage sequence',()=>{
 const r=evaluateOutingUnlockSelection(gate,1);
 assert.equal(Object.hasOwn(r,'choiceLabel'),false);
 assert.equal(Object.hasOwn(r,'requires'),false);
 assert.equal(Object.hasOwn(r,'stageSequence'),false);
});
