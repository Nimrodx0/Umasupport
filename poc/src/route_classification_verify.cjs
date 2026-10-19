/* Strictly verify stored route classification vs pinned candidate DB.
 * Historical title matches do not approve events or rewards. */
'use strict';
const assert=require('node:assert/strict');
const candidate=require('./checker_candidate_database.cjs');
const SHA=/^[a-f0-9]{64}$/, story=/^[0-9]+$/;
const TAGS=new Set(['strict-unique','typography-suggestion','ambiguous','no-match','no-2025-direct-story-rows']);
function verify(db,classification){
 const d=candidate.validate(db);
 if(!classification||classification.schemaVersion!==1||classification.dataKind!=='support-event-route-classification'||
   classification.routeApprovalState!=='UNREVIEWED_NOT_FOR_PUBLICATION'||classification.forSkillGrant!==false||
   !Array.isArray(classification.cards)||!Array.isArray(classification.historicalPossibleGaps)||
   !classification.sourcePins?.historicalMaster||!SHA.test(classification.sourcePins.historicalMaster.sha256))
  throw Error('Classification is missing provenance or unreviewed release gate');
 if(classification.sourcePins.checkerRevision!==db.sourcePins.checker.revision)
  throw Error('Classification Checker pin differs from database');
 if(classification.cards.length!==db.cards.length)throw Error('Candidate classification card count differs');
 const seen=new Set(),links=new Map(),cardMap=new Map(db.cards.map(x=>[x.cardId,x]));
 const counts={events:0,strict:0,loose:0};
 for(const card of classification.cards){
  if(!card||seen.has(card.cardId)||!cardMap.has(card.cardId)||!Array.isArray(card.events))
   throw Error('Unexpected / duplicate classified card');
  seen.add(card.cardId);
  const original=cardMap.get(card.cardId);
  if(card.rarity!==original.rarity||card.events.length!==original.events.length||
    card.sourceRecordStatus!==(original.events.length?'needs-review':'source-gap'))
   throw Error('Card source-gap status or candidate count changed');
  for(let i=0;i<card.events.length;i++){
   const e=card.events[i],source=original.events[i];
   if(!e||e.sourceKey!==source.sourceKey||e.sourceDigest!==source.sourceDigest||
     e.ordinal!==source.ordinal||e.status!=='needs-review'||
     !e.historicalLink||!TAGS.has(e.historicalLink.status)||
     !Array.isArray(e.reasons)||!e.reasons.includes('event-route-not-reviewed')||
     !e.reasons.includes('outcome-branch-not-reviewed')||
     !e.reasons.includes('publication-not-reviewed'))
    throw Error('Unsafe route approval, invalid identity or missing review reason');
   if(e.historicalLink.status==='strict-unique'){
    if(!story.test(e.historicalLink.provisionalStoryId)||!e.historicalLink.historicalNumericMetadata)
     throw Error('Strict provisional link lacks historical story evidence');
    counts.strict++;
   }else if(Object.hasOwn(e.historicalLink,'provisionalStoryId')||
       Object.hasOwn(e.historicalLink,'historicalNumericMetadata'))throw Error('Unproven historical story metadata');
   if(e.historicalLink.status==='typography-suggestion'){
    if(!story.test(e.historicalLink.possibleStoryId))throw Error('Loose link ID invalid');
    counts.loose++;
   }else if(Object.hasOwn(e.historicalLink,'possibleStoryId'))throw Error('Unexpected loose link ID');
   if(Object.keys(e).some(k=>!['sourceKey','sourceDigest','ordinal','status','historicalLink','reasons'].includes(k)))
    throw Error('Original titles/rewards may not enter classification');
   counts.events++;
  }
 }
 if(classification.totals.candidateCards!==d.cards||classification.totals.candidateEvents!==d.events||
    classification.totals.verifiedRoutes!==0||classification.totals.needsReview!==d.events||
    classification.totals.sourceGapEventRecords!==0||
    classification.totals.cardsWithEmptyCandidateSource!==db.cards.filter(c=>c.events.length===0).length||
    classification.totals.historicalProvisionalLinks['strict-unique']!==counts.strict||
    classification.totals.historicalProvisionalLinks['typography-suggestion']!==counts.loose||
    classification.totals.historicalDirectRowsWithoutStrictTitleLink!==classification.historicalPossibleGaps.length)
  throw Error('Historical classification coverage or release status inconsistent');
 const known=new Set(),historicalRows=new Set();
 for(const row of classification.historicalPossibleGaps){
  if(!row||!cardMap.has(row.cardId)||!story.test(row.historicalStoryId)||
     row.confirmedMissingIn2026!==false||row.reason!=='historical-direct-title-not-strictly-matched')
   throw Error('Historical gap is not a bounded hypothesis');
  const unique=row.cardId+':'+row.historicalStoryId;
  if(historicalRows.has(unique))throw Error('Duplicate historical gap story ID');
  historicalRows.add(unique);
 }
 return {classifiedEvents:counts.events,strictProvisionalLinks:counts.strict,
  typographySuggestions:counts.loose,emptySourceCards:classification.totals.cardsWithEmptyCandidateSource,
  historicalGapHypotheses:historicalRows.size,verifiedRoutes:0};
}
module.exports={verify};
