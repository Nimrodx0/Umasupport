/*
 * Cross-source factual-only event-hint comparison for the first-pass 171
 * provisional historic chain groups. No article text, labels, or external
 * event effects are stored. Two derived sources agreeing is NOT independent
 * game verification or proof that any choice/outcome grants a skill.
 */
'use strict';
const crypto=require('node:crypto');
const {validateAudit}=require('./candidate_chain_stage_audit.cjs');
const REV='0cacbb1aaf9dca10283d5b9ea20b205b9d204535';
const FILE_HASH={
 events:'ac3febaad945b4046a137ff6d1d650b6b6def9ae02a891be936e30735956bfd4',
 supports:'7b6e119a007a64bc494ba5b65dada7700c856993f02dba35319bc0d8aa437f5b'
};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validPair=x=>obj(x)&&Number.isSafeInteger(x.skillId)&&x.skillId>0&&
 Number.isSafeInteger(x.hintLevel)&&x.hintLevel>=0&&x.hintLevel<=7;
function fail(message){throw Error('Numeric outcome crosscheck: '+message)}
function pairs(list,external){
 if(!Array.isArray(list))fail('skill pairs absent');
 return list.map(h=>{
  if(external&&!validPair(h))fail('external numeric skill pair invalid');
  if(!external&&(!obj(h)||!/^\d+$/.test(h.skillId||'')||
    !Number.isSafeInteger(h.level)||h.level<1||h.level>10))
    fail('candidate skill pair invalid');
  return String(external?h.skillId:h.skillId)+':'+String(external?h.hintLevel:h.level);
 }).sort();
}
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function compareEvent(source,external){
 if(!obj(source)||!Array.isArray(source.choices))fail('candidate event missing');
 if(!obj(external)||!['auto','single'].includes(external.selection))fail('invalid supplement event');
 const expected=source.choices.flatMap(c=>c.observedHints).filter(x=>x.skillId);
 const observed=[
   ...(external.skills||[]),
   ...(external.choices||[]).flatMap(c=>c.skills||[])
 ];
 const a=pairs(expected,false),b=pairs(observed,true);
 const setA=[...new Set(a)],setB=[...new Set(b)];
 const multisetMatch=same(a,b),setMatch=same(setA,setB);
 let ordinalStatus='not-comparable';
 let comparedChoicePositions=0;
 if(external.selection==='single'){
  if(!Array.isArray(external.choices)||external.choices.length<1||
    external.choices.some(x=>!obj(x)||!Array.isArray(x.skills)))
   fail('supplemental single choice array invalid');
  if(source.choices.length===external.choices.length){
   comparedChoicePositions=source.choices.length;
   ordinalStatus=source.choices.every((c,i)=>same(
    pairs(c.observedHints.filter(x=>x.skillId),false),
    pairs(external.choices[i].skills,true)
   ))?'numeric-pairs-positionally-equal':'numeric-pairs-positionally-different';
  }
 }else if((external.choices||[]).length)fail('auto records must not assert individual choice branches');
 return {
  supplementalSelection:external.selection,
  candidateChoicePositions:source.choices.length,
  supplementalChoicePositions:external.choices?.length||0,
  candidateNumericHintMentions:a.length,
  supplementalNumericHintMentions:b.length,
  pairMultisetAgreement:multisetMatch,
  pairSetAgreement:setMatch,
  pairDifferenceClass:multisetMatch?'same-pairs-same-count':
    setMatch?'same-pairs-different-multiplicity':'different-numeric-pairs',
  ordinalComparison:ordinalStatus,comparedChoicePositions,
  outcomeTiersVerified:false,
  conditionalChainProgressVerified:false,
  // Even agreement on numeric choices isn't a proven current in-game route.
  gameRewardVerified:false
 };
}
function digest(buffer){return crypto.createHash('sha256').update(buffer).digest('hex')}
function build({db,classification,stages,supplementManifest,supplementSupports,supplementEvents,rawSupports,rawEvents}){
 const chainTotals=validateAudit(db,classification,stages);
 if(!obj(supplementManifest)||supplementManifest.datasetVersion!=='0.1.14'||
   supplementManifest.schemaVersion!==1||supplementManifest.source?.factory!=='umamusume-data-src')
  fail('pinned supplement manifest missing');
 for(const file of ['supports','events']){
  if(supplementManifest.files?.[file]?.sha256!==FILE_HASH[file])
   fail('supplemental upstream file pin drift');
 }
 if(!Buffer.isBuffer(rawSupports)||digest(rawSupports)!==FILE_HASH.supports||
    !Buffer.isBuffer(rawEvents)||digest(rawEvents)!==FILE_HASH.events)
  fail('actual source file checksum mismatch');
 if(!Array.isArray(supplementSupports)||supplementSupports.length!==45||
    !obj(supplementEvents)||!Array.isArray(supplementEvents.events)||
    supplementEvents.events.length!==126||supplementEvents.version!==2)
  fail('supplement source population changed');
 const supported=new Set();
 for(const c of supplementSupports){
  const id=String(c?.id??'');
  if(!/^\d{5}$/.test(id)||supported.has(id))fail('malformed or duplicated external card ID');
  supported.add(id);
 }
 const lookup=new Map();
 for(const event of supplementEvents.events){
  if(!obj(event)||typeof event.id!=='string'||lookup.has(event.id))fail('malformed/duplicate supplement event');
  lookup.set(event.id,event);
 }
 const sourceByCard=new Map(db.cards.map(c=>[c.cardId,new Map(c.events.map(e=>[e.sourceKey,e]))]));
 const groups=[];
 const counters={
  firstPassGroups:0,firstPassEvents:0,
  groupsWithSupplementalEvents:0,groupsWithoutSupplementalEvents:0,
  eventNumericIdOverlap:0,eventNotInSupplement:0,
  samePairsSameCount:0,samePairsDifferentMultiplicity:0,differentNumericPairs:0,
  ordinalPositionsEqual:0,ordinalPositionsDifferent:0,
  supplementalSelectionAuto:0,supplementalSelectionSingle:0,
  independentlyVerifiedGameRewards:0
 };
 for(const group of stages.chainGroups){
  if(group.reviewBand!=='readyForIndependentRouteReview')continue;
  counters.firstPassGroups++;
  const source=sourceByCard.get(group.cardId);
  if(!source)fail('card missing in candidate fact database');
  const events=[],sameCount={seen:0,notSeen:0};
  for(const e of group.events){
   counters.firstPassEvents++;
   const key='evt_'+group.cardId+'_'+e.provisionalStoryId;
   const external=lookup.get(key);
   if(!external){
    counters.eventNotInSupplement++;
    sameCount.notSeen++;
    events.push({sourceKey:e.sourceKey,provisionalStoryId:e.provisionalStoryId,
     supplementalPresence:'not-in-45-card-snapshot',
     note:'Not evidence that the game event does not exist',
     gameRewardVerified:false});
    continue;
   }
   if(!supported.has(group.cardId))fail('supplement event found outside listed cards');
   const factual=compareEvent(source.get(e.sourceKey),external);
   counters.eventNumericIdOverlap++;
   sameCount.seen++;
   if(factual.pairDifferenceClass==='same-pairs-same-count')counters.samePairsSameCount++;
   if(factual.pairDifferenceClass==='same-pairs-different-multiplicity')
    counters.samePairsDifferentMultiplicity++;
   if(factual.pairDifferenceClass==='different-numeric-pairs')counters.differentNumericPairs++;
   if(factual.ordinalComparison==='numeric-pairs-positionally-equal')counters.ordinalPositionsEqual++;
   if(factual.ordinalComparison==='numeric-pairs-positionally-different')
    counters.ordinalPositionsDifferent++;
   if(factual.supplementalSelection==='auto')counters.supplementalSelectionAuto++;
   else counters.supplementalSelectionSingle++;
   events.push({
    sourceKey:e.sourceKey,provisionalStoryId:e.provisionalStoryId,
    supplementalPresence:'matching-numeric-story-key',
    ...factual});
  }
  counters[sameCount.seen?'groupsWithSupplementalEvents':'groupsWithoutSupplementalEvents']++;
  groups.push({cardId:group.cardId,chainMax:group.chainMax,isGroupChain:group.isGroupChain,
   sourceChainStatus:group.structuralStatus,
   evidenceStatus:'unreviewed-cross-source-numeric-comparison',
   supplementalEventCount:sameCount.seen,events,
   gameChainProgressVerified:false,gameRewardsVerified:false});
 }
 if(counters.firstPassGroups!==chainTotals.reviewBands.readyForIndependentRouteReview||
    counters.eventNumericIdOverlap+counters.eventNotInSupplement!==counters.firstPassEvents||
    counters.samePairsSameCount+counters.samePairsDifferentMultiplicity+
     counters.differentNumericPairs!==counters.eventNumericIdOverlap)
  fail('full 171-group crosswalk count mismatch');
 return {schemaVersion:1,dataKind:'provisional-event-hint-cross-source-comparison',
  approvalState:'UNREVIEWED_NOT_FOR_PUBLICATION',forSkillGrant:false,
  sources:{
   candidateRevision:db.sourcePins.checker.revision,
   candidateSha256:db.sourcePins.checker.sha256,
   supplementRevision:REV,supplementSupportsSha256:FILE_HASH.supports,
   supplementEventsSha256:FILE_HASH.events,
   supplementExtractionFactory:'umamusume-data-src (private)',
   supplementOriginLabel:'U-tools+mdb; lineage/independence unconfirmed',
   sourceRowsAreThirdPartyDerived:true
  },
  counts:counters,firstPassGroups:groups,
  warning:'Matching numeric skill ID/Lv lists across derived source snapshots does NOT validate in-game choices, chronology, outcome tiers, termination, rewards, or republication rights. The auto selection mode is planning-only.'};
}
function validateStored({db,classification,stages,crosscheck}){
 const stagesTotal=validateAudit(db,classification,stages);
 if(!obj(crosscheck)||crosscheck.schemaVersion!==1||
  crosscheck.dataKind!=='provisional-event-hint-cross-source-comparison'||
  crosscheck.approvalState!=='UNREVIEWED_NOT_FOR_PUBLICATION'||crosscheck.forSkillGrant!==false||
  !Array.isArray(crosscheck.firstPassGroups)||
  crosscheck.sources?.supplementEventsSha256!==FILE_HASH.events||
  crosscheck.sources?.supplementSupportsSha256!==FILE_HASH.supports||
  crosscheck.sources?.supplementRevision!==REV||
  crosscheck.sources?.candidateSha256!==db.sourcePins.checker.sha256||
  crosscheck.sources?.candidateRevision!==db.sourcePins.checker.revision)
  fail('stored derived comparison header or pin is unsafe');
 const intended=stages.chainGroups.filter(g=>g.reviewBand==='readyForIndependentRouteReview');
 if(intended.length!==crosscheck.firstPassGroups.length||
   intended.length!==stagesTotal.reviewBands.readyForIndependentRouteReview)
  fail('stored comparison did not cover all first-pass groups');
 const got={firstPassGroups:0,firstPassEvents:0,groupsWithSupplementalEvents:0,
  groupsWithoutSupplementalEvents:0,eventNumericIdOverlap:0,eventNotInSupplement:0,
  samePairsSameCount:0,samePairsDifferentMultiplicity:0,differentNumericPairs:0,
  ordinalPositionsEqual:0,ordinalPositionsDifferent:0,
  supplementalSelectionAuto:0,supplementalSelectionSingle:0,
  independentlyVerifiedGameRewards:0};
 for(let i=0;i<intended.length;i++){
  const expected=intended[i],group=crosscheck.firstPassGroups[i];
  if(!obj(group)||group.cardId!==expected.cardId||
    group.chainMax!==expected.chainMax||group.isGroupChain!==expected.isGroupChain||
    group.sourceChainStatus!=='stage-complete-unique'||
    group.evidenceStatus!=='unreviewed-cross-source-numeric-comparison'||
    group.gameChainProgressVerified!==false||group.gameRewardsVerified!==false||
    !Array.isArray(group.events)||group.events.length!==expected.events.length)
   fail('group identity or approval changed');
  got.firstPassGroups++;
  let seen=0;
  for(let j=0;j<expected.events.length;j++){
   const old=expected.events[j],event=group.events[j];
   if(!obj(event)||event.sourceKey!==old.sourceKey||
      event.provisionalStoryId!==old.provisionalStoryId||
      event.gameRewardVerified!==false)
    fail('candidate event identity or evidence changed');
   got.firstPassEvents++;
   if(event.supplementalPresence==='not-in-45-card-snapshot'){
    if(Object.keys(event).sort().join(',')!==
      'gameRewardVerified,note,provisionalStoryId,sourceKey,supplementalPresence')
      fail('source-absent event includes unsupported reward claim');
    got.eventNotInSupplement++;
    continue;
   }
   if(event.supplementalPresence!=='matching-numeric-story-key'||event.outcomeTiersVerified!==false||
      event.conditionalChainProgressVerified!==false||
      !['same-pairs-same-count','same-pairs-different-multiplicity','different-numeric-pairs'].includes(event.pairDifferenceClass)||
      !['auto','single'].includes(event.supplementalSelection)||
      !['not-comparable','numeric-pairs-positionally-equal','numeric-pairs-positionally-different'].includes(event.ordinalComparison))
    fail('unsafe source comparison or route promotion');
   if(Object.keys(event).sort().join(',')!==[
    'candidateChoicePositions','candidateNumericHintMentions',
    'comparedChoicePositions','conditionalChainProgressVerified','gameRewardVerified',
    'ordinalComparison','outcomeTiersVerified','pairDifferenceClass',
    'pairMultisetAgreement','pairSetAgreement','provisionalStoryId',
    'sourceKey','supplementalChoicePositions','supplementalNumericHintMentions',
    'supplementalPresence','supplementalSelection'
   ].sort().join(','))fail('unexpected comparison content fields');
   if((event.pairDifferenceClass==='same-pairs-same-count')!==event.pairMultisetAgreement||
      (event.pairDifferenceClass!=='different-numeric-pairs')!==event.pairSetAgreement)
    fail('numeric list comparison was mislabeled');
   if(event.supplementalSelection==='auto'&&event.ordinalComparison!=='not-comparable')
    fail('planning auto record cannot validate choice index');
   if(event.ordinalComparison!=='not-comparable'&&
      (event.supplementalSelection!=='single'||
       event.comparedChoicePositions!==event.candidateChoicePositions||
       event.candidateChoicePositions!==event.supplementalChoicePositions))
    fail('positional comparison without two explicit choice sets');
   got.eventNumericIdOverlap++;seen++;
   got[event.pairDifferenceClass==='same-pairs-same-count'?'samePairsSameCount':
     event.pairDifferenceClass==='same-pairs-different-multiplicity'?'samePairsDifferentMultiplicity':
     'differentNumericPairs']++;
   got[event.supplementalSelection==='auto'?'supplementalSelectionAuto':'supplementalSelectionSingle']++;
   if(event.ordinalComparison==='numeric-pairs-positionally-equal')got.ordinalPositionsEqual++;
   if(event.ordinalComparison==='numeric-pairs-positionally-different')got.ordinalPositionsDifferent++;
  }
  if(group.supplementalEventCount!==seen)fail('supplemental group count inconsistent');
  got[seen?'groupsWithSupplementalEvents':'groupsWithoutSupplementalEvents']++;
 }
 if(Object.entries(got).some(([k,v])=>crosscheck.counts?.[k]!==v)||
   Object.keys(crosscheck.counts).length!==Object.keys(got).length)
  fail('stored aggregate comparison counts inconsistent');
 return got;
}
module.exports={build,compareEvent,validateStored,FILE_HASH,REV};
