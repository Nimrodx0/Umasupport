'use strict';
/*
 * P3.3 initial research-only acquisition-route audit.
 * Only validated in-app skill IDs from P3.2 may join to verified hint
 * stages or explicitly approved event branches. Route presence is a
 * *candidate* in the fixed published app, not acquisition, activation,
 * suitability, or an indirect gold/white grant.
 */
const p32=require('./p3_source_app_identity_audit.cjs');
const core=require('./core.js');
const fixed=require('../tools/globalsim_roster32.cjs');
const STATUS='P3.3-fixed-approved-data-direct-route-candidates-not-card-suitability';
const fail=(ok,why)=>{if(!ok)throw Error('P3.3 route audit: '+why)};
const STAGES=[0,1,2,3,4];
const sort=(a,b)=>String(a).localeCompare(String(b),'en');
function checkIdentity(identity,app){
 fail(identity?.status===p32.STATUS&&identity.schemaVersion===1&&
  identity.provenance?.originalSkillRegistrySha256===fixed.SOURCE_SHA&&
  identity.summary?.originalSourceConditions===10&&
  identity.summary?.[p32.SOURCE_MATCH]===9&&
  identity.summary?.['not-in-app-catalog']===1&&
  identity.summary?.confirmedSupportCardAcquisitionRoutes===0&&
  identity.summary?.productEligibleSkillRatings===0&&
  Array.isArray(identity.rows)&&identity.rows.length===10,
  'P3.2 source/identity scope or product gate changed');
 fail(app&&Array.isArray(app.cards)&&Array.isArray(app.skills)&&
  app.cardById&&app.skillById&&
  app.meta?.eventStatus==='reviewed-partial'&&
  app.meta.reviewedEventRecords>0,
  'approved published event model unavailable');
 const byId=new Set(),byApp=new Set(),identities=[];
 for(const r of identity.rows){
  const id=r.originalSourceNumericId;
  fail(typeof id==='string'&&/^\d+$/.test(id)&&!byId.has(id)&&
   r.eligibleForP3CardScoring===false&&r.cardScore===null&&
   r.suitabilityLabel===null&&
   r.verifiedSupportCardAcquisition==='not-evaluated',
   'invalid P3.2 source identity or unexpected scoring');
  byId.add(id);
  if(r.result===p32.SOURCE_MATCH){
   const skill=app.skillById[r.appSkillId];
   fail(typeof r.appSkillId==='string'&&!byApp.has(r.appSkillId)&&
    skill&&p32.numericId(skill)===id&&skill.name===r.appSkillName&&
    skill.activationProfile?.status==='source-structure'&&
    skill.activationProfile.sourceNumericId===id,
    'source/app identity must be exact and unique');
   byApp.add(r.appSkillId);
   identities.push({sourceId:id,appSkillId:r.appSkillId,status:'matched'});
  }else{
   fail(r.result==='not-in-app-catalog'&&r.appSkillId===null,
    'nonmatched or ambiguous identity cannot be promoted to routes');
   identities.push({sourceId:id,appSkillId:null,status:'not-in-app-catalog'});
  }
 }
 fail(byId.size===10&&byApp.size===9,'source cohort incomplete');
 const seenCards=new Set();
 for(const card of app.cards){
  fail(card&&typeof card.id==='string'&&!seenCards.has(card.id)&&
   app.cardById[card.id]===card&&
   card.sourceStatus?.startsWith('verified_hints')&&
   card.hintsByStage&&typeof card.hintsByStage==='object'&&
   Array.isArray(card.events),'verified card source or card index missing');
  seenCards.add(card.id);
  for(const n of STAGES)fail(Array.isArray(card.hintsByStage[String(n)]),
   'missing pinned hint-stage list '+card.id+' '+n);
 }
 return identities.sort((a,b)=>sort(a.sourceId,b.sourceId));
}
function directCandidates(card,skillId){
 const records=[];
 const stages=STAGES.filter(n=>card.hintsByStage[String(n)].includes(skillId));
 if(stages.length)records.push({
  cardId:card.id,appSkillId:skillId,source:'normal-hint',
  stages,kind:'hint',conditional:true,
  reason:'hint-present-at-specified-limit-breaks-not-guaranteed-acquired'
 });
 for(const event of card.events){
  fail(event&&typeof event.id==='string'&&
   ['auto','choice'].includes(event.type),'unverified published event type');
  const parts=event.type==='choice'?
   (Array.isArray(event.choices)?event.choices:[]).map(c=>({part:c,choiceId:c.id})):
   [{part:event,choiceId:null}];
  for(const {part,choiceId} of parts){
   fail(part&&typeof part==='object','invalid reviewed choice branch');
   const outcomes=Array.isArray(part.outcomes)&&part.outcomes.length?
    part.outcomes.map(o=>({part:o,outcomeId:o.id})):
    [{part,outcomeId:null}];
   for(const {part:leaf,outcomeId} of outcomes)
    for(const [index,reward] of (leaf.rewards||[]).entries()){
     if(reward?.skillId!==skillId||reward.kind==='negative')continue;
     // event_schema: omitted kind is a normal hint, matching core.directRoutes.
     const kind=reward.kind===undefined?'hint':reward.kind;
     fail(['hint','obtained'].includes(kind),
      'unrecognized positive published skill reward kind');
     records.push({
      cardId:card.id,appSkillId:skillId,source:'approved-event',
      eventId:event.id,choiceId:choiceId||null,
      outcomeId:outcomeId||null,rewardIndex:index,kind,
      conditional:true,reason:'event-occurrence-branch-outcome-and-prerequisites-not-guaranteed'
     });
    }
  }
 }
 return records;
}
function audit({identity,appModel}){
 const identities=checkIdentity(identity,appModel),rows=[];
 for(const entry of identities){
  const routes=entry.appSkillId?
   appModel.cards.flatMap(c=>directCandidates(c,entry.appSkillId)):[];
  rows.push({
   originalSourceNumericId:entry.sourceId,
   appSkillId:entry.appSkillId,
   status:entry.status==='not-in-app-catalog'?'not-in-app-catalog':
    routes.length?'direct-candidates-in-fixed-approved-app':'no-direct-candidate-in-fixed-approved-app',
   directCandidates:routes,
   indirectGrantRoutes:'not-assessed',
   wholeSkillActivationRate:null,
   eligibleForP3CardScoring:false,
   cardScore:null,
   suitabilityLabel:null
  });
 }
 const count=rows.reduce((n,r)=>n+r.directCandidates.length,0);
 return {
  schemaVersion:1,status:STATUS,
  provenance:{
   originalSkillRegistrySha256:identity.provenance.originalSkillRegistrySha256,
   reviewedAppPopulation:'fixed-verified-hints-plus-reviewed-published-events',
   p32OriginalSourceConditions:10,
   publishedReviewedEventRecords:appModel.meta.reviewedEventRecords
  },
  summary:{
   sourceConditions:rows.length,
   exactAppIdentityMatches:9,
   notInAppCatalog:1,
   skillsWithDirectCandidate:rows.filter(r=>r.directCandidates.length>0).length,
   directCandidateRecords:count,
   hintCandidateRecords:rows.reduce((n,r)=>n+r.directCandidates.filter(x=>x.source==='normal-hint').length,0),
   approvedEventCandidateRecords:rows.reduce((n,r)=>n+r.directCandidates.filter(x=>x.source==='approved-event').length,0),
   productEligibleCardScores:0
  },
  rows,
  boundaries:[
   'Direct candidate in a fixed approved app model is not confirmed in-game acquisition or event occurrence.',
   'A stage-specific hint is not silently presumed to occur at other limit breaks.',
   'Event alternatives, outcomes, prerequisites and termination are not combined into guaranteed awards.',
   'No name-only or lower/gold indirect path is inferred; unsupported joins remain unassessed.',
   'Absence in fixed published records is not proof of absence in the game or an aptitude value of zero.',
   'P2 W partial conditions, D specificity, whole skill activation and approved card suitability are different evidence.'
  ]
 };
}
// Reuse the same reachability machinery as the live application, but do not
// treat an unselected alternative as a guaranteed reward. A caller may test
// a specific card/choice/outcome scenario without changing published state.
function selectedDirectCandidates({identity,appModel,cardId,stage=4,choices={},outcomes={}}){
 const identities=checkIdentity(identity,appModel);
 fail(STAGES.includes(stage)&&typeof cardId==='string'&&
  choices&&typeof choices==='object'&&!Array.isArray(choices)&&
  outcomes&&typeof outcomes==='object'&&!Array.isArray(outcomes),
  'invalid selected card/limit break/branches');
 const card=appModel.cardById[cardId];
 fail(card,'unknown selected card');
 const allowed=new Set(identities.filter(x=>x.status==='matched').map(x=>x.appSkillId));
 return core.directRoutes(card,{stage,choices,outcomes})
  .filter(x=>allowed.has(x.skillId))
  .map(x=>({cardId,appSkillId:x.skillId,source:x.source,
   eventId:x.eventId,conditional:x.source==='event'||!!x.conditional,
   selectionStatus:'reachable-candidate-in-specified-app-settings-not-acquired'}));
}
module.exports={STATUS,STAGES,checkIdentity,directCandidates,audit,selectedDirectCandidates};
