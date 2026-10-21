'use strict';
/*
 * Triage ABSENCE OF SOURCE RECORDS separately from absence of game events.
 * This is an audit-only projection from our already-hashed, unpublished
 * GT × Checker roster index. It does not fetch/republish source material.
 */
const fail=x=>{throw Error('GameTora未収録カード監査: '+x);};
const validCount=x=>Number.isSafeInteger(x)&&x>=0;
function triage(index,{expectedRoster=563,expectedGameTora=559,expectedMissing=4}={}){
 if(index?.schemaVersion!==1||
    index.dataKind!=='umasupport-whole-event-provisional-index'||
    index.publicationApproval!==false||index.gameVerified!==false||
    index.allActualEventsVerified!==false||
    index.rawSourceContentIncluded!==false||
    !Array.isArray(index.cards)||
    typeof index.sourcePins?.checker!=='string'||
    typeof index.sourcePins?.gameToraDerived!=='string'||
    !/^[0-9a-f]{40}$/.test(index.sourcePins.checker)||
    !/^[0-9a-f]{40}$/.test(index.sourcePins.gameToraDerived))
  fail('未承認の固定クロスソース索引が必要');
 const ids=new Set(),missing=[],present=[],sum={roster:0,gt:0,missing:0,checker:0,neither:0,candidateEvents:0};
 for(const c of index.cards){
  if(!/^[1-9]\d*$/.test(c.cardId||'')||ids.has(c.cardId)||
     !['R','SR','SSR'].includes(c.rarity)||
     typeof c.sourceMissing!=='boolean'||
     typeof c.checkerMissing!=='boolean'||
     !validCount(c.gameToraObservedCount)||
     !validCount(c.checkerObservedCount)||
     c.sourceMissing!==(c.gameToraObservedCount===0)||
     c.checkerMissing!==(c.checkerObservedCount===0)||
     !Array.isArray(c.pairs)||!Array.isArray(c.checkerOnly)||
     !Array.isArray(c.gameToraOnly))
   fail('個別カード索引のID・件数・欠損分類が不正');
  ids.add(c.cardId);sum.roster++;
  if(!c.sourceMissing){
   sum.gt++;present.push(c.cardId);continue;
  }
  if(c.pairs.length!==0||c.gameToraOnly.length!==0||
     c.checkerOnly.length!==c.checkerObservedCount||
     c.checkerOnly.some(x=>!Number.isSafeInteger(x.checkerOrdinal)||x.checkerOrdinal<1))
   fail('GameTora未収録とされるカードに出典イベントが混入');
  sum.missing++;sum.candidateEvents+=c.checkerObservedCount;
  if(c.checkerMissing)sum.neither++;else sum.checker++;
  missing.push({cardId:c.cardId,rarity:c.rarity,
   sourceAbsence:'MISSING_FROM_PINNED_GAMETORA_SNAPSHOT',
   alternateStatus:c.checkerMissing?'NO_CHECKER_CANDIDATE':'CHECKER_PROVISIONAL_ONLY',
   checkerCandidateCount:c.checkerObservedCount,
   checkerCandidateOrdinals:c.checkerOnly.map(x=>x.checkerOrdinal).sort((a,b)=>a-b),
   gameEventAbsenceProven:false,checkedAgainstCurrentGame:false,
   alternativeSourceIndependentOfGameWith:false,publicationApproved:false});
 }
 missing.sort((a,b)=>Number(a.cardId)-Number(b.cardId));
 if(sum.roster!==expectedRoster||sum.gt!==expectedGameTora||sum.missing!==expectedMissing||
    index.stats?.rosterCards!==sum.roster||
    index.stats?.gameToraCards!==sum.gt||
    index.stats?.cardsOnlyChecker!==undefined&&
      index.stats.cardsOnlyChecker+index.stats.cardsNeither!==sum.missing)
  fail('母集団の件数か固定出典の観測差分が一致しない');
 return {schemaVersion:1,dataKind:'gametora-missing-support-card-triage',
  sourcePins:{...index.sourcePins},publicationApproved:false,
  currentGameVerified:false,checkerIsIndependentEvidence:false,
  sourceTitlesOrProseIncluded:false,
  counts:{rosterCards:sum.roster,sourcePresentCards:sum.gt,
   missingSourceCards:sum.missing,checkerProvisionalOnlyCards:sum.checker,
   neitherSourceCards:sum.neither,checkerCandidateEventsOnMissingCards:sum.candidateEvents},
  missingCards:missing};
}
module.exports={triage};
