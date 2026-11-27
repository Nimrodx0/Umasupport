#!/usr/bin/env node
'use strict';
/*
 * P2.33: no raw upstream registry stored in repository or CI artifact.
 * Validate immutable original source, construct the exact app-matched
 * activation structure, join fixed model research W as a NON-PROC proxy.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const loader=require('../src/live_loader.js');
const profiles=require('../src/skill_condition_profiles.js');
const publicEvents=require('../src/public_event_catalog.js');
const bridge=require('../src/skill_bridge.js');
const fixed=require('./globalsim_roster32.cjs');
const study=require('../src/skill_p2_33_same_id_projection.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function main(args){
 if(args.length!==7)throw Error(
  'Usage: P2.33 manifest source-skill source-support reviewed-legacy-skills approved-event-catalog surface-proxy-W output.json');
 const [manifestPath,skillPath,supportPath,legacyPath,
  eventsPath,modelWPath,out]=args;
 const skill=fs.readFileSync(skillPath,'utf8');
 const support=fs.readFileSync(supportPath,'utf8');
 const legacy=fs.readFileSync(legacyPath,'utf8');
 if(sha(skill)!==fixed.SOURCE_SHA||
  sha(legacy)!==bridge.PINNED_SHA256)
  throw Error('P2.33 pinned original source SHA changed');
 const app=loader.buildModel(support,{mode:'online'});
 const reviewed=JSON.parse(require('./fixed_research_event_catalog.cjs').verifyFixedEventText(fs.readFileSync(eventsPath)));
 publicEvents.attach(app,reviewed,{
  skillText:skill,pinnedSkillText:legacy,
  fullRegistry:true,allowReviewedLegacy:true});
 const cardsBefore=JSON.stringify(app.cards);
 const covered=profiles.attach(app,{
  skillText:skill,pinnedSkillText:legacy});
 if(app.skills.length!==881||app.cards.length!==566||
  covered.matched!==818||covered.unavailable!==63||
  covered.noActivationRecord!==0||
  JSON.stringify(app.cards)!==cardsBefore)
  throw Error('P2.33 app source skill coverage / immutable card drift');
 const input=JSON.parse(fs.readFileSync(modelWPath,'utf8'));
 const result=study.audit(app,
  JSON.parse(fs.readFileSync(manifestPath,'utf8')),input);
 result.source.originalUmaSimRevision=
  'f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
 result.source.originalSupportCardSHA256=sha(support);
 result.source.originalReviewedLegacySkillSHA256=sha(legacy);
 if(result.summary.originalSameIDMinimalSkillCandidates!==82||
  result.summary.sameOriginalIDObservedActualSkillActivations!==0||
  result.summary.p3OfficialSuitabilityRecords!==0)
  throw Error('P2.33 same original source skill candidate / scoring gate changed');
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('P2_33_SAME_ID_STATIC_CONTEXT_MODEL_PROXY='+JSON.stringify({
  status:result.status,summary:result.summary,
  firstSkills:result.records.slice(0,7).map(x=>({
   sourceNumericId:x.originalSourceSkillId,
   sourceMechanism:x.originalRankTimingMechanism,
   allowedAxisContexts:x.commonStaticContexts.length,
   reusedProxyContexts:x.projectionCounts.matchedProjectedContexts,
   strictBothHalves:x.projectionCounts.bothHalvesStrictDirection,
   actualWholeConditionMeasured:x.observedSameSkillSourceJVMEvents}))
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={main};
