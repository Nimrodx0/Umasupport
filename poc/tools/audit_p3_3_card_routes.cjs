#!/usr/bin/env node
'use strict';
/*
 * Research-only P3.3: compare P3.2's verified exact source/app identities
 * with a newly rebuilt, pinned, approved app event+hint model. No third-party
 * source content is written. This must follow the full P3.2 CI gate.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const loader=require('../src/live_loader.js');
const profiles=require('../src/skill_condition_profiles.js');
const eventCatalog=require('../src/public_event_catalog.js');
const bridge=require('../src/skill_bridge.js');
const fixed=require('./globalsim_roster32.cjs');
const routes=require('../src/p3_card_acquisition_routes.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function main(args){
 if(args.length!==6)throw Error(
  'Usage: audit_p3_3_card_routes.cjs p3-2-identity.json original-skill-data original-support-data reviewed-historical-skills published-events.json output.json');
 const [identityPath,skillPath,supportPath,historicalPath,catalogPath,outPath]=args;
 const identityText=fs.readFileSync(identityPath,'utf8'),
  skillText=fs.readFileSync(skillPath,'utf8'),
  supportText=fs.readFileSync(supportPath,'utf8'),
  historical=fs.readFileSync(historicalPath,'utf8'),
  catalogText=fs.readFileSync(catalogPath,'utf8');
 const identity=JSON.parse(identityText);
 if(sha(skillText)!==fixed.SOURCE_SHA||
  sha(historical)!==bridge.PINNED_SHA256||
  identity.provenance?.originalSkillRegistrySha256!==fixed.SOURCE_SHA||
  identity.provenance?.originalSupportRegistrySha256!==sha(supportText)||
  identity.provenance?.pinnedReviewedHistoricalSkillSha256!==sha(historical)||
  identity.provenance?.reviewedEventCatalogSha256!==sha(catalogText))
  throw Error('P3.3 fixed source or P3.2 input provenance drift');
 const app=loader.buildModel(supportText,{mode:'online'});
 eventCatalog.attach(app,JSON.parse(catalogText),{
  skillText,pinnedSkillText:historical,
  fullRegistry:true,allowReviewedLegacy:true
 });
 const coverage=profiles.attach(app,{skillText,pinnedSkillText:historical});
 if(app.cards.length!==566||app.skills.length!==881||
  app.meta.reviewedEventRecords!==2487||
  coverage.matched!==818||coverage.unavailable!==63)
  throw Error('P3.3 fixed app population or approved event source changed');
 const before=JSON.stringify(app.cards);
 const result=routes.audit({identity,appModel:app});
 if(JSON.stringify(app.cards)!==before||
  result.summary.sourceConditions!==10||
  result.summary.exactAppIdentityMatches!==9||
  result.summary.notInAppCatalog!==1||
  result.summary.productEligibleCardScores!==0||
  result.rows.some(x=>x.cardScore!==null||x.suitabilityLabel!==null||
   x.eligibleForP3CardScoring!==false))
  throw Error('P3.3 route study mutated app or promoted unverified scoring');
 result.provenance.p3_2IdentityAuditSha256=sha(identityText);
 result.provenance.approvedCatalogSha256=sha(catalogText);
 result.provenance.originalSupportRegistrySha256=sha(supportText);
 result.provenance.reviewedHistoricalSkillsSha256=sha(historical);
 fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');
 console.log('P3_3_FIXED_VERIFIED_CANDIDATE_ROUTES='+JSON.stringify({
  status:result.status,summary:result.summary,
  skillStatus:result.rows.map(r=>({id:r.originalSourceNumericId,
   status:r.status,directCandidates:r.directCandidates.length}))
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={main};
