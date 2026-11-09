#!/usr/bin/env node
'use strict';
/* Fixed source roster replay for a simple P3 card-style trend preview.
 * External text remains in /tmp; this produces derived verdicts ONLY.
 * No production deployment, saved-data change, rating percentages or skill
 * effect utility. Publishes at most a small set of source-ID matched examples.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const loader=require('../src/live_loader.js');
const profiles=require('../src/skill_condition_profiles.js');
const events=require('../src/public_event_catalog.js');
const preview=require('../src/skill_default_coarse_preview.cjs');
const PIN='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const tally=(entries,prop)=>
 Object.fromEntries([...new Set(entries.map(x=>x[prop]))].sort().map(k=>
  [k,entries.filter(x=>x[prop]===k).length]));
// Intentional stratified diagnostic examples, NOT random/representative statistics.
function selectReviewExamples(reviews,limit=12){
 const ordered=reviews.slice().sort((a,b)=>
  String(a.cardId).localeCompare(String(b.cardId)));
 const has=(c,p)=>preview.STYLES.some(s=>p(c.styles[s]));
 const strata=[
  ['single-style-candidate',c=>c.coarseDirection.styles.length===1],
  ['multi-style-candidate',c=>c.coarseDirection.styles.length>1&&
   c.coarseDirection.styles.length<4],
  ['mixed-without-leader',c=>c.coarseDirection.styles.length===0&&
   has(c,s=>s.label==='mixed')],
  ['all-material-insufficient',c=>preview.STYLES.every(s=>
   c.styles[s].label==='unresolved')],
  ['broad-model-only',c=>has(c,s=>s.onlyBroadReference)],
  ['no-reviewed-event-data',c=>!c.coverage.reviewedEventData],
  ['conditional-route',c=>c.skills.some(s=>
   s.availability==='route-conditional-only')],
  ['explicit-style-target',c=>c.skills.some(skill=>
   preview.STYLES.some(s=>skill.styles[s].signal==='explicit-targeted'))],
  ['four-style-model-evidence',c=>has(c,s=>s.strongFourStyleEvidence>0)]
 ];
 const chosen=[],seen=new Set();
 function choose(card,reason){
  if(!card||seen.has(card.cardId)||chosen.length>=limit)return;
  seen.add(card.cardId);chosen.push({card,reason});
 }
 for(const [reason,pred] of strata)choose(ordered.find(c=>!seen.has(c.cardId)&&pred(c)),reason);
 const strength=c=>preview.STYLES.reduce((sum,s)=>sum+
  c.styles[s].strongFourStyleEvidence,0);
 const extras=ordered.filter(c=>!seen.has(c.cardId)).sort((a,b)=>
  strength(b)-strength(a)||String(a.cardId).localeCompare(String(b.cardId)));
 for(const card of extras)choose(card,'remaining-fixed-source-example');
 return chosen;
}
function audit({skillText,supportText,pinnedSkillText,catalog}){
 if(typeof skillText!=='string'||sha(skillText)!==PIN)
  throw Error('Not the fixed 2162-skill source');
 if(typeof pinnedSkillText!=='string'||typeof supportText!=='string'||
  !catalog||!Array.isArray(catalog.cards))
  throw Error('Source inputs incomplete');
 const model=loader.buildModel(supportText,{mode:'pinned-research'});
 events.attach(model,catalog,{skillText,pinnedSkillText,
  fullRegistry:true,allowReviewedLegacy:true});
 const cardSnapshot=JSON.stringify(model.cards);
 const source=profiles.attach(model,{skillText,pinnedSkillText});
 if(JSON.stringify(model.cards)!==cardSnapshot)
  throw Error('Attaching P1 source conditions changed card grants');
 if(model.cards.length!==566||model.skills.length!==881||source.matched!==818)
  throw Error('App fixed source cohort changed; do not interpret old trial');
 const reviews=model.cards.map(card=>preview.previewCard(card,model));
 if(reviews.length!==model.cards.length||
  new Set(reviews.map(x=>x.cardId)).size!==reviews.length)
  throw Error('Duplicate or missing card preview');
 const allSkills=reviews.flatMap(c=>c.skills);
 const styles=Object.fromEntries(preview.STYLES.map(s=>[s,{
  labels:tally(reviews.map(x=>x.styles[s]),'label'),
  modelFourStyleHints:reviews.reduce((n,x)=>n+
   x.styles[s].strongFourStyleEvidence,0),
  oldBroadModelHints:reviews.reduce((n,x)=>n+
   x.styles[s].broadFavorable+x.styles[s].broadUnfavorable,0),
  skillUncertainty:reviews.reduce((n,x)=>n+x.styles[s].unknown,0)
 }]));
 const candidates=reviews.filter(x=>
  preview.STYLES.some(s=>x.styles[s].evidenceCount>0));
 const examples=selectReviewExamples(reviews,12);
 const projection=x=>({
  cardId:x.cardId,cardName:x.cardName,
  stage:x.stage,coverage:x.coverage,coarseDirection:x.coarseDirection,
  styles:Object.fromEntries(preview.STYLES.map(s=>[s,x.styles[s]])),
  sourceHints: x.skills.map(s=>({
   id:s.skillId,name:s.skillName,
   availability:s.availability,
   sourceRouteTypes:s.sources,
   sourceNumericId:s.sourceNumericId,
   researchSignals:Object.fromEntries(preview.STYLES.map(style=>
    [style,s.styles[style].signal]))
  }))
 });
 return {schemaVersion:1,
  status:'p3-default-style-research-preview-only-not-product-deck-score',
  version:preview.VERSION,
  modelRevision:'umasim/f6e4501ee6c6c2d4ac8698e7796e309d31575bde',
  sourceSkillSha256:PIN,
  publisherSupportSha256:sha(supportText),
  sourceP1Coverage:source,
  cards:model.cards.length,appSkills:model.skills.length,
  approvedEventsWithRecords:model.meta.reviewedEventRecords,
  trialConfig:{supportStage:4,choices:{},outcomes:{},
   referenceScenario:'balanced-only',
   allSourceRowsPreserved:false},
  totalCandidateRoutes:reviews.reduce((n,x)=>n+x.coverage.routes,0),
  uniqueCardSkillCandidates:allSkills.length,
  unknownSkillConditions:allSkills.filter(x=>x.sourceNumericId===null).length,
  cardsWithAtLeastOneQualitativeSignal:candidates.length,
  cardsWithNoReviewedEventEntry:reviews.filter(x=>!
   x.coverage.reviewedEventData).length,
  byStyle:styles,
  examples:examples.map(({card,reason})=>({...projection(card),reviewStratum:reason})),
  invariants:[
   'Only reviewed approved event records and verified normal hints for configured stage are candidate grants.',
   'Unselected choice events do not become candidate grants; outcomes are not guaranteed.',
   'All source-condition assessments use exact matched skill identity and preserve all unresolved OR/AND branches.',
   'Four-style rank evidence outranks old broader two-group clue; no numeric skill activation or effect score.',
   'Candidate skill count is unique per numeric-or-name-specific app skill id and never doubles gold/lower.',
   'Unknown and unprovided event data are not negative suitability evidence.',
   'The example list is coverage-ranked for debugging only, NOT a recommendation of the best cards.',
   'No change to public UI, event dataset, user saves, card definitions, default thresholds or result ordering.'
  ]};
}
function main([skillFile,supportFile,pinnedFile,catalogFile,output]){
 if(!output)throw Error(
  'Usage: audit_default_coarse_card_preview.cjs pinned-skills pinned-support pinned-legacy public-reviewed-events derived-report.json');
 const model=audit({skillText:fs.readFileSync(skillFile,'utf8'),
  supportText:fs.readFileSync(supportFile,'utf8'),
  pinnedSkillText:fs.readFileSync(pinnedFile,'utf8'),
  catalog:JSON.parse(fs.readFileSync(catalogFile,'utf8'))});
 fs.writeFileSync(output,JSON.stringify(model,null,2)+'\n');
 console.log(JSON.stringify({cards:model.cards,appSkills:model.appSkills,
  cardsWithAtLeastOneQualitativeSignal:model.cardsWithAtLeastOneQualitativeSignal,
  uniqueCardSkillCandidates:model.uniqueCardSkillCandidates,
  byStyle:model.byStyle,
  examples:model.examples.slice(0,5).map(x=>({
   cardId:x.cardId,cardName:x.cardName,
   coarseDirection:x.coarseDirection,
   labels:Object.fromEntries(preview.STYLES.map(s=>[s,x.styles[s].labelJa])),
   evidence:Object.fromEntries(preview.STYLES.map(s=>[s,x.styles[s].evidenceCount])),
   unknown:x.coverage.unmatchedSkills
  }))},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={PIN,sha,selectReviewExamples,audit,main};
