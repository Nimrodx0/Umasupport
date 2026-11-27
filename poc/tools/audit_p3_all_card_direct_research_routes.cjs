#!/usr/bin/env node
'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const loader=require('../src/live_loader.js'),bridge=require('../src/skill_bridge.js');
const profiles=require('../src/skill_condition_profiles.js'),catalog=require('../src/public_event_catalog.js');
const g6=require('../src/p2_g6_research_handoff_881.cjs'),routes=require('../src/p3_all_card_direct_research_routes.cjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(60000)});a(r.ok,'HTTP '+r.status);return r.text();};
async function main(args){
 a.equal(args.length,6);
 const [raw,queue,logic,supplement,event,out]=args;
 const skillText=fs.readFileSync(raw,'utf8'),q=JSON.parse(fs.readFileSync(queue,'utf8'));
 a.equal(hash(skillText),g6.SOURCE_SHA);
 a.equal(q.source.skillRegistrySha256,g6.SOURCE_SHA);
 a.equal(q.source.revision,'f6e4501ee6c6c2d4ac8698e7796e309d31575bde');
 const [supportText,pinned]=await Promise.all([
  get('https://raw.githubusercontent.com/mee1080/umasim/'+q.source.revision+'/data/support_card.txt'),get(bridge.PINNED_URL)]);
 a.equal(hash(supportText),q.source.supportRegistrySha256);a.equal(hash(pinned),bridge.PINNED_SHA256);
 const eventText=require('./fixed_research_event_catalog.cjs').verifyFixedEventText(fs.readFileSync(event)),app=loader.buildModel(supportText,{mode:'online'});
 catalog.attach(app,JSON.parse(eventText),{skillText,pinnedSkillText:pinned,fullRegistry:true,allowReviewedLegacy:true});
 const p=profiles.attach(app,{skillText,pinnedSkillText:pinned});
 a.equal(app.cards.length,566);a.equal(app.skills.length,881);a.equal(app.meta.reviewedEventRecords,2487);
 a.equal(p.matched,818);a.equal(p.unavailable,63);
 const before=JSON.stringify({cards:app.cards,skills:app.skills});
 const report=routes.audit(app,JSON.parse(fs.readFileSync(logic,'utf8')),JSON.parse(fs.readFileSync(supplement,'utf8')));
 a.equal(before,JSON.stringify({cards:app.cards,skills:app.skills}));
 report.provenance={skillRegistrySHA256:hash(skillText),supportRegistrySHA256:hash(supportText),
  historicalRegistrySHA256:hash(pinned),approvedEventCatalogSHA256:hash(eventText),reviewedEventRecords:2487};
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log('P3_3B_ALL_CARD_ROUTES='+JSON.stringify(report.summary));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e.stack||e);process.exitCode=1;});
