#!/usr/bin/env node
'use strict';
/*
 * Offline fixed-source P3.2 join. Fetch original third-party source files
 * at the immutable commits in CI. Never check those files into this repo.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const loader=require('../src/live_loader.js');
const profiles=require('../src/skill_condition_profiles.js');
const events=require('../src/public_event_catalog.js');
const bridge=require('../src/skill_bridge.js');
const auditor=require('../src/p3_source_app_identity_audit.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function main(args){
 if(args.length!==8)throw Error(
  'Usage: audit_p3_2_source_app_identity.cjs manifest p2-envelope p3-receipt original-skill-data original-support-card-data historical-pinned-skills reviewed-events out.json');
 const [mf,p2f,p3f,skf,suf,oldf,catalogf,out]=args;
 const skillText=fs.readFileSync(skf,'utf8');
 const supportText=fs.readFileSync(suf,'utf8');
 const historicalText=fs.readFileSync(oldf,'utf8');
 if(sha(historicalText)!==bridge.PINNED_SHA256)
  throw Error('P3.2 original reviewed event historical source SHA changed');
 const app=loader.buildModel(supportText,{mode:'online'});
 const reviewed=JSON.parse(fs.readFileSync(catalogf,'utf8'));
 events.attach(app,reviewed,{
  skillText,pinnedSkillText:historicalText,
  fullRegistry:true,allowReviewedLegacy:true
 });
 const cardsBefore=JSON.stringify(app.cards);
 const coverage=profiles.attach(app,{
  skillText,pinnedSkillText:historicalText});
 if(JSON.stringify(app.cards)!==cardsBefore)
  throw Error('P3.2 app original condition attachment mutated cards');
 if(app.skills.length!==881||app.cards.length!==566||
  coverage.matched!==818||coverage.unavailable!==63||
  coverage.noActivationRecord!==0)
  throw Error('P3.2 pinned app model or condition population drift: '+
   JSON.stringify({skills:app.skills.length,cards:app.cards.length,
    coverage}));
 const result=auditor.audit({
  manifest:JSON.parse(fs.readFileSync(mf,'utf8')),
  p2Envelope:JSON.parse(fs.readFileSync(p2f,'utf8')),
  p3Receipt:JSON.parse(fs.readFileSync(p3f,'utf8')),
  originalSkillText:skillText,appModel:app
 });
 if(result.summary.originalSourceConditions!==10||
  result.summary.appSkillRosterSize!==881||
  result.summary.productEligibleSkillRatings!==0)
  throw Error('P3.2 research-only population or product gate changed');
 result.provenance.pinnedReviewedHistoricalSkillSha256=
  bridge.PINNED_SHA256;
 result.provenance.originalSupportRegistrySha256=sha(supportText);
 result.provenance.reviewedEventCatalogSha256=
  sha(fs.readFileSync(catalogf,'utf8'));
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('P3_2_ORIGINAL_SKILL_APP_IDENTITY='+JSON.stringify({
  status:result.status,sourceRevision:result.provenance.originalUmaSimRevision,
  appCoverage:result.provenance.appSourceProfileCoverage,
  summary:result.summary,
  rows:result.rows.map(x=>({
   sourceNumericId:x.originalSourceNumericId,
   name:x.originalSourceName,status:x.result,
   appSkillId:x.appSkillId
  }))
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={main};
