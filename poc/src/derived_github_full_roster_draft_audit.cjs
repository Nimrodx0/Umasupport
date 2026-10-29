'use strict';
/*
 * Read-only, numeric-only full-roster audit of the STRUCTURED third-party
 * GitHub event JSON -> private UmaSupport app-schema projection.
 * Source pages, prose, unpublished draft catalogs and card event details
 * are NEVER returned by this module.
 */
const {planDerivedNewCardIntake}=require('./derived_github_new_card_source_plan.cjs');
const {projectDerivedCardDraft}=require('./derived_github_runtime_draft.cjs');
const fail=code=>{throw Error('派生GitHub全カード監査: '+code);};
const numericId=x=>typeof x==='string'&&/^[1-9]\d{4}$/.test(x);
const counter=(map,key,n=1)=>map.set(key,(map.get(key)||0)+n);
const sorted=map=>Object.fromEntries([...map].sort(([a],[b])=>a.localeCompare(b)));
function auditDerivedRoster({sourceTree,sourceCommit,records,skillText}={}){
 if(!Array.isArray(records)||!records.length||typeof skillText!=='string')
  fail('nonempty-source-documents-and-skill-dictionary-required');
 const seen=new Set(),all=[];
 for(const entry of records){
  if(!numericId(entry?.cardId)||seen.has(entry.cardId)||
     typeof entry.sourceText!=='string'||!entry.sourceText)
   fail('duplicate-or-invalid-card-entry');
  seen.add(entry.cardId);all.push(entry.cardId);
 }
 all.sort();
 // The empty previous population is an AUDIT FIXTURE, not an observation of
 // actual new releases. This is only for running the real version-bound
 // new-card source gate on every pinned historical card.
 const plan=planDerivedNewCardIntake({
  discovery:{schemaVersion:1,dataKind:'new-umamusume-support-card-ids',
   publicationApproved:false,existingCardIds:[],addedCardIds:all},
  existingCatalog:{schemaVersion:1,cards:[]},
  sourceTree,sourceCommit
 });
 if(plan.candidateIds.length!==all.length)
  fail('some-historical-card-json-not-present-in-complete-git-tree');
 const byId=new Map(records.map(r=>[r.cardId,r.sourceText]));
 const totals={sourceCards:all.length,sourceEvents:0,modeledEvents:0,
  pendingEvents:0,cardsFullyModeledInSourceSnapshot:0,
  cardsWithPendingEvents:0,modeledSkillMentions:0,
  modeledDirectGrantMentions:0,modeledExclusiveHintGroups:0,
  modeledExclusiveHintOptions:0,nonSkillSourceEffectsOmitted:0,
  modeledResultRoutes:0,sourceResultRoutes:0};
 const reasons=new Map(),byCard=[];
 for(const cardId of all){
  const data=projectDerivedCardDraft({plan,cardId,
   sourceText:byId.get(cardId),skillText});
  const c=data.census;
  totals.sourceEvents+=c.sourceEvents;
  totals.modeledEvents+=c.modeledEvents;
  totals.pendingEvents+=c.excludedEvents;
  totals.modeledSkillMentions+=c.modeledSkills;
  totals.modeledDirectGrantMentions+=c.modeledDirectGrants;
  totals.modeledExclusiveHintGroups+=c.modeledExclusiveHintGroups;
  totals.modeledExclusiveHintOptions+=c.modeledExclusiveHintOptions;
  totals.nonSkillSourceEffectsOmitted+=c.nonSkillSourceEffectsOmitted;
  totals.modeledResultRoutes+=c.modeledRoutes;
  totals.sourceResultRoutes+=c.sourceRoutes;
  if(c.excludedEvents){totals.cardsWithPendingEvents++;}
  else totals.cardsFullyModeledInSourceSnapshot++;
  const cardReasons=new Map();
  for(const event of data.pendingEvents){
   if(!/^[A-Z][A-Z0-9_]{2,95}$/.test(event.reason))
    fail('unexpected-rejection-code');
   counter(reasons,event.reason);
   counter(cardReasons,event.reason);
  }
  byCard.push({cardId,sourceEvents:c.sourceEvents,
   modeledEvents:c.modeledEvents,pendingEvents:c.excludedEvents,
   reasonCounts:sorted(cardReasons)});
 }
 if(totals.modeledEvents+totals.pendingEvents!==totals.sourceEvents||
    totals.cardsFullyModeledInSourceSnapshot+
     totals.cardsWithPendingEvents!==totals.sourceCards||
    Object.values(sorted(reasons)).reduce((a,b)=>a+b,0)!==totals.pendingEvents)
  fail('conservation-or-review-count-diverged');
 return {dataKind:'derived-github-private-full-roster-draft-audit',
  schemaVersion:1,sourceRepository:'systemless10/UmamusumePS',
  sourceCommit,sourceTreeSha:sourceTree.sha,
  population:'all-structured-github-card-json-present-in-pinned-snapshot',
  historicAllCardsAsNewIsSyntheticAuditFixture:true,
  totals,reasonCounts:sorted(reasons),cards:byCard,
  sourceEventProseCopied:false,rawEventEffectsCopied:false,
  privateRuntimeEventsExposed:false,
  gameWideCompletenessVerified:false,gameSemanticsVerified:false,
  publicationApproved:false};
}
module.exports={auditDerivedRoster};
