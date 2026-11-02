'use strict';
// Independent released-cohort runtime gate using only the workflow's pinned
// source files. No candidate prose, source snapshots or skill names are logged.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const loader=require('../src/live_loader.js');
const publicEvents=require('../src/public_event_catalog.js');
const bridge=require('../src/skill_bridge.js');
const release=require('../data/reviewed_events.v1.json');
const [supportPath,skillPath]=process.argv.slice(2);
if(!supportPath||!skillPath)throw Error('Usage: support_card.txt skill_data.txt');
const skillText=fs.readFileSync(skillPath,'utf8');
assert.equal(crypto.createHash('sha256').update(skillText).digest('hex'),bridge.PINNED_SHA256,
 'The immutable publication-time UmaSim source changed');
const supportText=fs.readFileSync(supportPath,'utf8');
const model=loader.buildModel(supportText);
const result=publicEvents.attach(model,release,{
 skillText,pinnedSkillText:skillText,fullRegistry:true,allowReviewedLegacy:true
});
assert.equal(result.eventsWithRecords,2487);
assert.equal(result.cardsWithRecords,559);
assert.equal(model.meta.reviewedEventRecords,2487);
assert.equal(model.meta.reviewedEventCards,559);
assert.equal(Object.keys(bridge.REVIEWED_LEGACY_SKILL_NAMES).length,30);
// The legacy skill names are approved in the release, but their current tiers
// are not inferred from the historical snapshot.
let n=0;
for(const id of Object.keys(bridge.REVIEWED_LEGACY_SKILL_NAMES)){
 const skill=model.skillById['skill:'+id];
 assert.equal(skill?.tier,'unknown','An unverified current tier was invented for '+id);
 assert.equal(skill?.sourceStatus,'reviewed-legacy-master-id-only');
 n++;
}
assert.equal(n,30);
const modified=JSON.parse(JSON.stringify(release));
let first;
for(const card of modified.cards)for(const ev of card.events){
 const queue=[ev];
 while(queue.length){
  const cur=queue.pop();
  if(Array.isArray(cur)){queue.push(...cur);continue;}
  if(!cur||typeof cur!=='object')continue;
  if(cur.skillId==='skill:200801'){first=cur;break;}
  for(const val of Object.values(cur))if(val&&typeof val==='object')queue.push(val);
 }
 if(first)break;
}
assert.ok(first,'Approved historical numeric ID is absent');
first.verifiedSkillName='invalid-unreviewed-name';
assert.throws(()=>publicEvents.preflight(loader.buildModel(supportText),modified,{
 skillText,pinnedSkillText:skillText,fullRegistry:true,allowReviewedLegacy:true
}),/未照合|名称照合/);
console.log(JSON.stringify({status:'PASS_PINNED_GT2487_RUNTIME',cards:559,events:2487,
 historicalApprovedNumericIds:30,alteredNameRejected:true}));
