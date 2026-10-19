/*
 * Validate human spot-checks against Umasupport's pinned factual candidate DB.
 * This validator can corroborate internal numeric consistency; it cannot
 * recertify third-party editorial webpages or actual game outcome semantics.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {validateAudit}=require('./candidate_chain_stage_audit.cjs');
const {validateStored}=require('./candidate_numeric_outcome_crosscheck.cjs');
const sourcePriority=require('../config/event-source-priority.v1.json');
function fail(s){throw Error('Editorial choice review: '+s)}
function objectsEqual(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function hintPairs(list){
 if(!Array.isArray(list))fail('invalid hint list');
 const pairs=list.map(h=>{
  if(!h||!/^\d+$/.test(h.skillId)||!Number.isSafeInteger(h.level)||h.level<0||h.level>10||
     Object.keys(h).sort().join(',')!=='level,skillId')fail('unrecognized hint fields');
  return h.skillId+':'+h.level;
 });
 return pairs.sort();
}
const allowed=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).sort().join(',')===keys.slice().sort().join(',');
const pinURL=(url,domain)=>typeof url==='string'&&
 url.startsWith(domain)&&/^https:\/\/[a-z0-9.-]+\/.+$/.test(url);
function verify(db,classification,stages,crosscheck,review){
 const auditTotals=validateAudit(db,classification,stages);
 const comp=validateStored({db,classification,stages,crosscheck});
 if(!allowed(review,['schemaVersion','dataKind','approvalState','forSkillGrant','reviewDate',
  'scope','sourceCaveat','records','reviewGates','warning'])||
  review.schemaVersion!==1||review.dataKind!=='editorial-numeric-choice-review'||
  review.approvalState!=='UNREVIEWED_NOT_FOR_PUBLICATION'||review.forSkillGrant!==false||
  !Array.isArray(review.records)||!review.reviewDate.match(/^\d{4}-\d{2}-\d{2}$/)||
  typeof review.scope!=='string'||typeof review.warning!=='string')
  fail('not an unapproved editorial evidence set');
 if(!objectsEqual(review.sourceCaveat,{
  gameWithOverlapsCheckerLineage:true,game8IndependentExtractionUnverified:true,
  publisherRightsUnverified:true,actualGameOutcomesUnverified:true
 })||!objectsEqual(review.reviewGates,{
  eventRouteApproved:0,choiceResultTierApproved:0,gameRewardClaimsApproved:0,
  externalTextIncluded:false,manualEditorialSpotCheck:true
 }))fail('publisher lineage and release gate required');
 if(sourcePriority.eventEffectPrimary!=='GameWith'||
    sourcePriority.automaticPublicationAllowed!==false)fail('source priority policy mismatch');
 const byCard=new Map(db.cards.map(c=>[c.cardId,new Map(c.events.map(e=>[e.sourceKey,e]))]));
 const chainMap=new Map(stages.chainGroups.filter(g=>g.reviewBand==='readyForIndependentRouteReview')
   .flatMap(g=>g.events.map(e=>[e.sourceKey,{g,e}])));
 const secondMap=new Map(crosscheck.firstPassGroups.flatMap(g=>g.events.map(e=>[e.sourceKey,e])));
 let choices=0,hints=0,conflicts=0;const seen=new Set();
 for(const record of review.records){
  if(!allowed(record,['cardId','provisionalStoryId','sourceKey','sourceDigest','chainStage',
     'pageReferences','observations','nonSkillSourceDifferences','publishedOutcomeTiersCompared',
     'chainTerminationVerified','gameRewardVerified']))
   fail('unexpected editorial record fields');
  if(seen.has(record.sourceKey))fail('duplicate reviewed event');
  seen.add(record.sourceKey);
  const lookup=chainMap.get(record.sourceKey);
  if(!lookup||lookup.g.cardId!==record.cardId||lookup.e.provisionalStoryId!==record.provisionalStoryId||
     lookup.e.sourceDigest!==record.sourceDigest||lookup.e.stage!==record.chainStage)
   fail('editorial event absent from strictly matched 171-chain queue');
  const src=byCard.get(record.cardId)?.get(record.sourceKey),ext=secondMap.get(record.sourceKey);
  if(!src||!ext||ext.supplementalPresence!=='matching-numeric-story-key'||
     ext.supplementalSelection!=='single'||ext.ordinalComparison!=='numeric-pairs-positionally-equal'||
     ext.pairDifferenceClass!=='same-pairs-same-count')
   fail('claimed positionally comparable event absent in pinned independent extraction');
  if(!record.pageReferences||!pinURL(record.pageReferences.gameWith,'https://gamewith.jp/uma-musume/article/show/')||
    !pinURL(record.pageReferences.game8,'https://game8.jp/umamusume/')||
    Object.keys(record.pageReferences).sort().join(',')!=='game8,gameWith')
   fail('missing human-reviewed article evidence URLs');
  if(!Array.isArray(record.observations)||record.observations.length!==src.choices.length||
    !Array.isArray(record.nonSkillSourceDifferences)||
    record.publishedOutcomeTiersCompared!==false||
    record.chainTerminationVerified!==false||record.gameRewardVerified!==false)
   fail('missing or prematurely certified branch evidence');
  for(let i=0;i<src.choices.length;i++){
   const observed=record.observations[i],original=src.choices[i];
   if(!allowed(observed,['choiceOrdinal','numericHints','bothEditorialPagesListSameNumericHints'])||
      observed.choiceOrdinal!==i+1||observed.bothEditorialPagesListSameNumericHints!==true||
      !objectsEqual(hintPairs(observed.numericHints),hintPairs(original.observedHints)))
    fail('editorial branch observations differ from candidate ordinal or numeric skills');
   choices++;hints+=observed.numericHints.length;
  }
  const used=new Set();
  for(const diff of record.nonSkillSourceDifferences){
   if(!allowed(diff,['choiceOrdinal','quantity','gameWith','game8','chosenProvisional'])||
      !Number.isSafeInteger(diff.choiceOrdinal)||diff.choiceOrdinal<1||
      diff.choiceOrdinal>src.choices.length||diff.quantity!=='bondGauge'||
      !Number.isSafeInteger(diff.gameWith)||!Number.isSafeInteger(diff.game8)||
      diff.gameWith===diff.game8||diff.chosenProvisional!==diff.gameWith)
    fail('unreviewed effect conflict or invalid GameWith-first provisional value');
   const key=diff.choiceOrdinal+':'+diff.quantity;
   if(used.has(key))fail('duplicate conflict row');
   used.add(key);
   conflicts++;
  }
 }
 if(!review.records.length||choices<1||hints<1||comp.ordinalPositionsEqual<review.records.length||
    auditTotals.reviewBands.readyForIndependentRouteReview!==171)
  fail('insufficient fixed source candidate integrity or unexpected 171-chain population');
 return {reviewedEventKeys:seen.size,reviewedChoicePositions:choices,
  numericHintMentions:hints,unresolvedNonSkillDiscrepancies:conflicts,
  currentGameOutcomeTiersConfirmed:0,verifiedAcquisitionRoutes:0};
}
function fromDisk(){
 const root=path.resolve(__dirname,'../data/candidates');
 const read=x=>JSON.parse(fs.readFileSync(path.join(root,x),'utf8'));
 return verify(read('checker_event_hints.v1.json'),
  read('checker_route_classification.v1.json'),
  read('checker_chain_stage_audit.v1.json'),
  read('checker_first_pass_numeric_crosscheck.v1.json'),
  read('editorial_choice_review.v1.json'));
}
module.exports={verify,fromDisk};
