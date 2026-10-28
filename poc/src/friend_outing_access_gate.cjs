'use strict';
/*
 * Standalone, reusable friend outing access-gate evaluator.
 * It only models "one of these explicitly verified opener choices enables
 * outings". It intentionally does not claim subsequent outing stage 1..N
 * reachability, terminality, successful play, or automatic release.
 */
const fail=s=>{throw Error('友人お出かけ解放候補の適用: '+s);};
function validateOutingUnlockEvidence(evidence){
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)||
  typeof evidence.cardId!=='string'||!/^\d{5}$/.test(evidence.cardId)||
  !Number.isSafeInteger(evidence.siteEventOrdinal)||evidence.siteEventOrdinal<=0||
  !Array.isArray(evidence.choiceOrdinals)||evidence.choiceOrdinals.length<1||
  evidence.choiceOrdinals.length>5||
  new Set(evidence.choiceOrdinals).size!==evidence.choiceOrdinals.length||
  evidence.choiceOrdinals.some((n,i)=>!Number.isSafeInteger(n)||n!==i+1)||
  evidence.effectKind!=='enable-outings'||
  evidence.conditionalOnPlayerChoice!==true||
  evidence.outingEventSequenceVerified!==false||
  evidence.outingClosureVerified!==false||
  evidence.publicationApproved!==false)
  fail('出典の解放事実に未承認または不正な形式');
 return evidence;
}
function evaluateOutingUnlockSelection(evidence,selectedChoiceOrdinal){
 validateOutingUnlockEvidence(evidence);
 if(selectedChoiceOrdinal!==null&&(!Number.isSafeInteger(selectedChoiceOrdinal)||
    selectedChoiceOrdinal<=0))fail('選択肢の値が不正');
 const accepted=evidence.choiceOrdinals.includes(selectedChoiceOrdinal);
 const status=selectedChoiceOrdinal===null?'pending-opening-choice':
  accepted?'outings-unlocked':'invalid-or-unverified-opening-choice';
 return {
  cardId:evidence.cardId,
  sourceEventOrdinal:evidence.siteEventOrdinal,
  openingChoiceOrdinal:selectedChoiceOrdinal,
  outingAccessStatus:status,
  outingUnlocked:accepted,
  // Unlocking is necessary, but never proof that outing #1, #2, #3 etc
  // are all currently available. Their internal prerequisites are unknown.
  individualOutingStageReachability:'not-adjudicated',
  nextEventId:null,finalEventId:null,
  outingOrderVerified:false,
  terminalConditionVerified:false,
  originalGamePlayVerified:false,
  publicationApproved:false
 };
}
function verifyBothOpeningChoicesUnlock(evidence){
 validateOutingUnlockEvidence(evidence);
 if(evidence.choiceOrdinals.length!==2)return false;
 return [1,2].every(n=>evaluateOutingUnlockSelection(evidence,n).outingUnlocked);
}
module.exports={validateOutingUnlockEvidence,evaluateOutingUnlockSelection,verifyBothOpeningChoicesUnlock};
