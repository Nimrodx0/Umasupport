/*
 * Umasupport's source-position -> unspecified-result -> numeric hint facts.
 * Derives from the existing 417-card Checker numeric DB; does not reproduce
 * title, choices or effects. NO "unconditional"/"success"/"failure" inference.
 */
'use strict';
const crypto=require('node:crypto');
const {validate}=require('./checker_candidate_database.cjs');
function fail(m){throw Error('選択肢・結果ファクトDB: '+m)}
const ordered=x=>JSON.stringify(x);
function build(db){
 const old=validate(db);
 const counts={cards:0,events:0,choicePositions:0,
  hintMentionsNumeric:0,hintMentionsUnresolved:0,
  eventsReadyForChoiceCandidate:0,eventsNeedingFurtherParsing:0,
  eventsWithoutObservedHints:0,choicesWithUnspecifiedOutcomes:0,
  eventsWithFlaggedResultOrSyntax:0,eventsWithUnresolvedSkillIds:0};
 const cards=db.cards.map(card=>{
  counts.cards++;
  const events=card.events.map(event=>{
   counts.events++;
   let n=0,p=0,flagged=false,unresolved=false;
   const choices=event.choices.map(choice=>{
    counts.choicePositions++;
    counts.choicesWithUnspecifiedOutcomes++;
    const numeric=[],unknown=[];
    for(const hint of choice.observedHints){
     n++;
     if(hint.skillId){
      counts.hintMentionsNumeric++;
      numeric.push({skillId:hint.skillId,level:hint.level});
     }else{
      counts.hintMentionsUnresolved++;
      unresolved=true;
      unknown.push({skillName:hint.skillName,level:hint.level,resolution:hint.resolution});
     }
    }
    if(choice.needsManualResultReview||choice.unparsedHintSyntax)flagged=true;
    return {
     ordinal:choice.ordinal,
     sourcePositionOnly:true,
     resultCandidates:[{
      resultKind:'unspecified',outcomeCoverage:'unknown',
      skillHints:numeric,unresolvedSkillHints:unknown
     }],
     needsResultOrSyntaxReview:choice.needsManualResultReview,
     unparsedHintSyntax:!!choice.unparsedHintSyntax
    };
   });
   if(flagged)counts.eventsWithFlaggedResultOrSyntax++;
   if(unresolved)counts.eventsWithUnresolvedSkillIds++;
   let candidateStatus;
   if(n===0){candidateStatus='no-observed-skill-hints';counts.eventsWithoutObservedHints++;}
   else if(flagged||unresolved){candidateStatus='needs-choice-or-result-review';counts.eventsNeedingFurtherParsing++;}
   else{candidateStatus='numeric-choice-candidate';counts.eventsReadyForChoiceCandidate++;}
   return {
    sourceKey:event.sourceKey,sourceDigest:event.sourceDigest,
    sourceEventOrdinal:event.ordinal,candidateStatus,
    gameEventIdVerified:false,
    choices
   };
  });
  return {cardId:card.cardId,rarity:card.rarity,events};
 });
 if(counts.cards!==old.cards||counts.events!==old.events||
    counts.choicePositions!==old.choices||
    counts.hintMentionsNumeric!==old.numericHints||
    counts.hintMentionsUnresolved!==old.pendingHints||
    counts.eventsReadyForChoiceCandidate+
     counts.eventsNeedingFurtherParsing+counts.eventsWithoutObservedHints!==old.events)
  fail('全件・選択肢・数値ヒントの保存件数が一致しません');
 return {
  schemaVersion:1,dataKind:'umasupport-choice-result-facts',
  reviewStatus:'SOURCE_FACTS_WITH_UNSPECIFIED_OUTCOMES',
  productionApproval:false,
  sourcePins:{
   checkerRevision:db.sourcePins.checker.revision,
   checkerSha256:db.sourcePins.checker.sha256,
   skillRevision:db.sourcePins.umasimSkills.revision,
   skillSha256:db.sourcePins.umasimSkills.sha256,
   inputSha256:crypto.createHash('sha256').update(ordered(db)).digest('hex')
  },
  stats:counts,cards,
  semantics:{
   choiceOrdinal:'Source option-array order only; not republished choice dialogue',
   resultKind:'unspecified means result labels and successful outcome tiers were NOT inferred',
   skillHint:'Observed numeric ID and level, NOT guaranteed acquisition in game',
   candidateStatus:'Only numeric-choice-candidate can enter explicitly opt-in source-fact preview',
   sourceBased:true,gameTriggerOrTerminationRequired:false,
   unreviewedBranchesAreNeverGuaranteed:true
  }
 };
}
function validateStored(db,output){
 const expected=build(db);
 if(ordered(expected)!==ordered(output))fail('保存DBと数値ファクトの全件対応が不一致、または未承認データが書き換わりました');
 return output.stats;
}
module.exports={build,validateStored};
