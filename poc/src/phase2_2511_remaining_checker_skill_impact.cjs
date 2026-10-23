'use strict';
/*
 * Skill-impact priority, not publication or claim of newly missing events.
 * Input: the 16 exact residual Checker positions, the 2511 GT-first catalog,
 * and the pre-existing LOCAL text-free Checker skill candidate database.
 */
const crypto=require('node:crypto');
const {validate}=require('./checker_candidate_database.cjs');
const fail=s=>{throw Error('Phase2残16位置スキル影響比較: '+s);};
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function hintsInEvent(e){
 const ids=new Set();
 function add(part){
  if(!object(part))return;
  for(const r of part.rewards||[]){
   if(typeof r.skillId==='string'&&/^skill:\d+$/.test(r.skillId))
    ids.add(r.skillId.slice(6));
  }
  for(const outcome of part.outcomes||[])add(outcome);
 }
 if(e.type==='choice')for(const c of e.choices||[])add(c);
 else add(e);
 return ids;
}
function build({reconciliation,integrated,checker},{strict=false}={}){
 if(reconciliation?.dataKind!=='phase2-2511-reconciled-65-source-positions'||
    reconciliation.publicationApproved!==false||
    reconciliation.sourceNarrativeOrChoiceProseIncluded!==false||
    reconciliation.summary?.checkerOnGTCardIdentityUnpaired!==16||
    reconciliation.summary?.checkerOnGTCardIdentityEditoriallyResolved!==1||
    !Array.isArray(reconciliation.openQueue)||
    integrated?.dataKind!=='phase2-2511-nonpublishing-gt-and-curated-chain-runtime'||
    integrated.publicationApproved!==false||
    integrated.reviewedEventsPublished!==0||
    integrated.noAutomaticRuntimeAdoption!==true||
    integrated.summary?.catalogSha256!==hash(integrated.catalog)||
    checker?.dataKind!=='support-event-hint-candidates'||
    checker.approvalState!=='UNREVIEWED_NOT_FOR_PUBLICATION'||
    checker.forSkillGrant!==false||
    checker.sourcePins?.checker?.revision!==
     reconciliation.sourcePins?.checkerIndex)
  fail('元16位置、GT全件SHA、固定Checker未承認候補の版が不一致');
 const db=validate(checker);
 if(strict&&(db.events!==2109||
    integrated.summary.rosterCards!==563||
    integrated.summary.totalCandidateEvents!==2511))
  fail('固定Checkerイベント2,109件／GT2,511件の全件確認が未実施');
 const cards=new Map(checker.cards.map(c=>[c.cardId,c]));
 const catalog=new Map(integrated.catalog.cards.map(c=>[c.cardId,c]));
 const seen=new Set(),rows=[];
 for(const entry of reconciliation.openQueue){
  if(entry.status!=='UNPAIRED_IDENTITY_NOT_PROVEN_MISSING'){
   if(entry.cardId!=='30240'||entry.count!==3)fail('未分類の残件');
   continue;
  }
  if(seen.has(entry.sourceKey))fail('Checker元イベント位置が重複');
  seen.add(entry.sourceKey);
  const source=cards.get(entry.cardId);
  const event=source?.events?.find(e=>e.sourceKey===entry.sourceKey);
  if(!event||event.ordinal!==entry.checkerOrdinal||
     !Array.isArray(event.choices)||!event.choices.length||
     !/^sha256:[0-9a-f]{64}$/.test(event.sourceDigest))
   fail('Checker元イベントの位置・SHA・選択数が不一致: '+entry.cardId);
  const gt=catalog.get(entry.cardId);
  if(!gt||!Array.isArray(gt.events))fail('GTカード本体がありません');
  const inGT=new Set();
  for(const ev of gt.events)for(const id of hintsInEvent(ev))inGT.add(id);
  const matched=[],absent=[],unresolved=[];
  let conditionalChoices=0,unparsedChoices=0,numericMentions=0;
  const known=new Set();
  for(const choice of event.choices){
   if(choice.needsManualResultReview)conditionalChoices++;
   if(choice.unparsedHintSyntax)unparsedChoices++;
   for(const h of choice.observedHints){
    if(typeof h.skillId==='string'){
     numericMentions++;
     if(known.has(h.skillId))continue;
     known.add(h.skillId);
     if(inGT.has(h.skillId))matched.push(h.skillId);
     else absent.push(h.skillId);
    }else if(typeof h.skillName==='string'&&
      ['missing','ambiguous'].includes(h.resolution))
     unresolved.push({resolution:h.resolution,level:h.level});
    else fail('CheckerヒントID・未解決分類が不正');
   }
  }
  matched.sort();absent.sort();
  const priority=absent.length>0?'P0':
   unresolved.length>0||unparsedChoices>0||conditionalChoices>0?'P1':'P2';
  rows.push({
   cardId:entry.cardId,checkerOrdinal:entry.checkerOrdinal,
   sourceKey:entry.sourceKey,
   sourceDigest:event.sourceDigest,
   priority,skillEvidence:
    absent.length?'CHECKER_NUMERIC_SKILL_NOT_IN_GT_CARD_EVENT_CATALOG':
    unresolved.length||unparsedChoices?'CHECKER_SKILL_ID_OR_EFFECT_NOT_RESOLVED':
    matched.length?'SAME_NUMERIC_SKILL_ALREADY_IN_GT_CARD_EVENTS':
    'NO_NUMERIC_SKILL_HINT_RECORDED_FOR_CHECKER_ROW',
   candidateNumericHintMentions:numericMentions,
   candidateSkillIdsAbsentFromGTEventCatalog:absent,
   candidateSkillIdsAlreadyInGTEventCatalog:matched,
   unresolvedNameOnlyHintMentions:unresolved.length,
   manualResultReviewChoices:conditionalChoices,
   unparsedHintChoices:unparsedChoices,
   publicationApproved:false,
   missingActualEventVerified:false,
   identityPairVerified:false
  });
 }
 if(rows.length!==16||seen.size!==16)fail('未対16位置の元Checker候補結合件数不一致');
 rows.sort((a,b)=>a.priority.localeCompare(b.priority)||
  a.cardId.localeCompare(b.cardId)||a.checkerOrdinal-b.checkerOrdinal);
 const counts={P0:0,P1:0,P2:0,absentNumericSkillIdPositions:0,
  matchedNumericSkillIdPositions:0,unresolvedSkillIdPositions:0,
  conditionalReviewPositions:0,noNumericHintPositions:0};
 for(const r of rows){
  counts[r.priority]++;
  if(r.candidateSkillIdsAbsentFromGTEventCatalog.length)counts.absentNumericSkillIdPositions++;
  if(r.candidateSkillIdsAlreadyInGTEventCatalog.length)counts.matchedNumericSkillIdPositions++;
  if(r.unresolvedNameOnlyHintMentions||r.unparsedHintChoices)counts.unresolvedSkillIdPositions++;
  if(r.manualResultReviewChoices)counts.conditionalReviewPositions++;
  if(!r.candidateNumericHintMentions)counts.noNumericHintPositions++;
 }
 return {
  schemaVersion:1,dataKind:'phase2-16-remaining-checker-skill-priority',
  publicationApproved:false,
  checkerCandidatesNotForSkillGrant:true,
  sourceNarrativeOrChoiceProseIncluded:false,
  sourcePins:structuredClone(reconciliation.sourcePins),
  summary:{openCheckerPositions:rows.length,
   separate30240MissingChainStages:3,
   ...counts,confirmedNewMissingGameEvents:0,
   approvedEvents:0},
  rows
 };
}
module.exports={build};
