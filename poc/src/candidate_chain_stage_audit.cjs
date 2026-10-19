/*
 * Provisional 2025 master chainNum/chainMax/isGroupChain assessment over
 * all strictly title-matched Checker candidate events.
 *
 * A complete STAGE SET is not a verified 2026 route. It says nothing about
 * guaranteed event reachability, choice stops, success/failure, or awards.
 * Output only event numeric IDs, digests, ordinal/stage numbers and counts.
 */
'use strict';
const {verify}=require('./route_classification_verify.cjs');
const {validate}=require('./checker_candidate_database.cjs');
const STATUSES=['stage-complete-unique','stage-incomplete','stage-ambiguous'];
function fail(message){throw Error('Chain stage audit: '+message);}
function measures(source) {
 if(!source||!Array.isArray(source.choices))fail('invalid candidate source event');
 let hintMentions=0,numericHintMentions=0,unresolvedHintMentions=0,flaggedChoices=0;
 let unparsedChoices=0;
 for(const ch of source.choices){
  if(ch.needsManualResultReview)flaggedChoices++;
  if(ch.unparsedHintSyntax)unparsedChoices++;
  for(const h of ch.observedHints){
   hintMentions++;
   if(h.skillId)numericHintMentions++; else unresolvedHintMentions++;
  }
 }
 return {choiceSlots:source.choices.length,hintMentions,
  numericHintMentions,unresolvedHintMentions,flaggedChoices,unparsedChoices};
}
function build(db,classification){
 const evidence=verify(db,classification);
 validate(db);
 const reference=new Map(db.cards.map(c=>[c.cardId,new Map(c.events.map(e=>[e.sourceKey,e]))]));
 const groups=[],unsequenced=[];
 const count={stageGroups:0,stageCompleteUnique:0,stageIncomplete:0,stageAmbiguous:0,
  stageEvents:0,unsequencedStrictEvents:0,stageCompleteUniqueEventRows:0,
  stageGroupsWithFlaggedChoices:0,stageCompleteGroupsWithFlaggedChoices:0,
  stageGroupsWithUnresolvedHints:0,stageCompleteGroupsWithUnresolvedHints:0,
  stageCompleteGroupsWithObservedHints:0,stageCompleteGroupsWithoutFlaggedChoices:0,
  matchedHintMentionsInStageEvents:0,unresolvedHintMentionsInStageEvents:0};
 const groupFlag=x=>x===1||x===true?1:x===0||x===false?0:null;
 for(const card of classification.cards){
  const sourceEvents=reference.get(card.cardId);
  if(!sourceEvents)fail('unexpected card ID');
  const keyed=new Map();
  for(const e of card.events){
   if(e.historicalLink.status!=='strict-unique')continue;
   const source=sourceEvents.get(e.sourceKey);
   if(!source||source.sourceDigest!==e.sourceDigest||source.ordinal!==e.ordinal)
    fail('source event identity mismatch');
   const p=e.historicalLink.historicalNumericMetadata;
   if(!p||typeof e.historicalLink.provisionalStoryId!=='string')
    fail('missing historical match metadata');
   const flag=groupFlag(p.show_progress_3);
   const n=p.show_progress_1,max=p.show_progress_2;
   const base={sourceKey:e.sourceKey,sourceDigest:e.sourceDigest,
    provisionalStoryId:e.historicalLink.provisionalStoryId,
    ...measures(source)};
   if(Number.isSafeInteger(n)&&Number.isSafeInteger(max)&&n>=1&&max>=1&&
      n<=max&&max<=12&&flag!==null){
    const k=max+':'+flag;
    if(!keyed.has(k))keyed.set(k,[]);
    keyed.get(k).push({stage:n,...base});
   }else{
    // Even a 0/0/0 game master record may still represent an event. Never
    // synthesize a chain or claim absent content based on these coordinates.
    unsequenced.push({cardId:card.cardId,provisionalStageMetadata:{
     chainNum:n,chainMax:max,isGroupChain:flag},
     ...base,needsCurrentGameReview:true});
   }
  }
  for(const [k,members] of keyed){
   const [max,flag]=k.split(':').map(Number);
   members.sort((a,b)=>a.stage-b.stage||a.sourceKey.localeCompare(b.sourceKey));
   const byStage=new Map();
   for(const item of members)byStage.set(item.stage,(byStage.get(item.stage)||0)+1);
   const missingStages=[];
   for(let i=1;i<=max;i++)if(!byStage.has(i))missingStages.push(i);
   const status=[...byStage.values()].some(n=>n!==1)?'stage-ambiguous':
      missingStages.length?'stage-incomplete':'stage-complete-unique';
   const flagged=members.some(e=>e.flaggedChoices>0);
   const unresolved=members.some(e=>e.unresolvedHintMentions>0);
   const hints=members.some(e=>e.hintMentions>0);
   groups.push({cardId:card.cardId,chainMax:max,isGroupChain:flag===1,
    structuralStatus:status,missingStages,events:members,
    needsCurrentGameReview:true,needsChoiceOutcomeReview:true});
   count.stageGroups++;
   if(status==='stage-complete-unique'){
    count.stageCompleteUnique++;
    count.stageCompleteUniqueEventRows+=members.length;
    if(flagged)count.stageCompleteGroupsWithFlaggedChoices++;
    else count.stageCompleteGroupsWithoutFlaggedChoices++;
    if(unresolved)count.stageCompleteGroupsWithUnresolvedHints++;
    if(hints)count.stageCompleteGroupsWithObservedHints++;
   }else if(status==='stage-incomplete')count.stageIncomplete++;
   else count.stageAmbiguous++;
   if(flagged)count.stageGroupsWithFlaggedChoices++;
   if(unresolved)count.stageGroupsWithUnresolvedHints++;
   for(const row of members){
    count.stageEvents++;
    count.matchedHintMentionsInStageEvents+=row.numericHintMentions;
    count.unresolvedHintMentionsInStageEvents+=row.unresolvedHintMentions;
   }
  }
 }
 unsequenced.sort((a,b)=>a.cardId.localeCompare(b.cardId)||a.sourceKey.localeCompare(b.sourceKey));
 groups.sort((a,b)=>a.cardId.localeCompare(b.cardId)||a.chainMax-b.chainMax||
   Number(a.isGroupChain)-Number(b.isGroupChain));
 count.unsequencedStrictEvents=unsequenced.length;
 if(count.stageEvents+count.unsequencedStrictEvents!==evidence.strictProvisionalLinks)
  fail('strict-match 954-member crosswalk not exhaustive');
 if(count.stageCompleteUnique+count.stageIncomplete+count.stageAmbiguous!==count.stageGroups)
  fail('incomplete chain group partition');
 return {
  schemaVersion:1,dataKind:'provisional-historical-chain-stage-audit',
  approvalState:'UNREVIEWED_NOT_FOR_PUBLICATION',forSkillGrant:false,
  sourcePins:{candidateInputSha256:classification.candidateInputSha256,
   historicalMasterRevision:classification.sourcePins.historicalMaster.revision,
   historicalMasterSha256:classification.sourcePins.historicalMaster.sha256},
  totals:{...count,strictProvisionalEvents:evidence.strictProvisionalLinks,
   verifiedGameChains:0,verifiedRewards:0},
  chainGroups:groups,unsequencedStrictEvents:unsequenced,
  warning:'A structurally complete 2025 chainNum/chainMax stage set is not a confirmed 2026 chain. A shared max/flag within a card is not proof of one chain if multiple chains have identical coordinates; any duplicate stage is ambiguous. All choice/outcome/termination/reward/publication conditions remain unverified.'
 };
}
function validateAudit(db,cls,audit){
 const expected=build(db,cls);
 if(JSON.stringify(expected)!==JSON.stringify(audit))
  fail('stored audit differs from deterministic, unapproved, full-coverage source reconstruction');
 return expected.totals;
}
module.exports={build,validateAudit};
