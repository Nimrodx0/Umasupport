'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const loader=require('../src/live_loader.js'),bridge=require('../src/skill_bridge.js'),profiles=require('../src/skill_condition_profiles.js'),catalog=require('../src/public_event_catalog.js');
const view=require('../src/card_suitability_view.js'),fit=require('../src/skill_suitability.js'),core=require('../src/core.js');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(60000)});a(r.ok,'HTTP '+r.status);return r.text();};
async function main(args){
 a.equal(args.length,3);const [labelPath,routePath,out]=args;
 const report=JSON.parse(fs.readFileSync(labelPath,'utf8')),routes=JSON.parse(fs.readFileSync(routePath,'utf8'));
 a.equal(report.status,'P3.4j-D052-initial-scoped-skill-labels');a.deepEqual(report.counts,{general:257,targeted:43,undetermined:581});
 const base='https://raw.githubusercontent.com/mee1080/umasim/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/data/';
 const [supportText,skillText,pinnedSkillText]=await Promise.all([get(base+'support_card.txt'),get(base+'skill_data.txt'),get(bridge.PINNED_URL)]);
 const p=routes.provenance,eventText=fs.readFileSync('poc/data/reviewed_events.v1.json','utf8');
 a.equal(hash(supportText),p.supportRegistrySHA256);a.equal(hash(skillText),p.skillRegistrySHA256);a.equal(hash(pinnedSkillText),p.historicalRegistrySHA256);a.equal(hash(eventText),p.approvedEventCatalogSHA256);
 const data=loader.buildModel(supportText,{mode:'online'});
 catalog.attach(data,JSON.parse(eventText),{skillText,pinnedSkillText,fullRegistry:true,allowReviewedLegacy:true});
 profiles.attach(data,{skillText,pinnedSkillText});
 a.equal(data.cards.length,566);a.equal(data.skills.length,881);
 const labels=view.index(report.rows),byCard=new Map(report.cards.map(c=>[c.cardId,c]));
 a.equal(labels.size,881);a.equal(byCard.size,566);
 let cards=0,stageChecks=0,selectionChecks=0,allPairs=0,unknownDefault=0,knownDefault=0;
 for(const skill of data.skills){
  const l=labels.get(skill.id);a(l);
  a.equal(l.sourceNumericId,skill.activationProfile.status==='source-structure'?skill.activationProfile.sourceNumericId:null);
  a.equal(fit.resolve(l).state,l.label.state==='targeted'?'undetermined':l.label.state);
  a.deepEqual(fit.present(l,null,true).styles,fit.present(l,null,false).styles);
 }
 for(const c of data.cards){
  const expected=byCard.get(c.id);a(expected);cards++;allPairs+=expected.skills.length;
  for(let stage=0;stage<=4;stage++){
   const config={stage,choices:{},outcomes:{}},v=view.cardView(c,config,data,labels);
   const ids=expected.skills.filter(s=>s.directCandidates.some(r=>r.source==='approved-event'||r.stages?.includes(stage))).map(s=>s.appSkillId).sort();
   a.deepEqual(v.potential.rows.map(r=>r.appSkillId).sort(),ids);
   a.deepEqual(v.currentRoutes,core.directRoutes(c,config));
   stageChecks++;unknownDefault+=v.current.counts.undetermined;knownDefault+=v.current.counts.general;
   a.equal(v.current.counts.targeted,0);
   for(const ev of c.events)for(const ch of ev.choices||[]){
    const cfg={stage,choices:{[ev.id]:ch.id},outcomes:{}},x=view.cardView(c,cfg,data,labels);
    a.deepEqual(x.currentRoutes,core.directRoutes(c,cfg));a(x.current.rows.every(r=>ids.includes(r.appSkillId)));selectionChecks++;
   }
  }
 }
 a.equal(cards,566);a.equal(stageChecks,2830);a.equal(allPairs,5434);
 const summary={cards,stageChecks,selectionChecks,allPairs,knownDefault,unknownDefault,formalCardScores:0,publicDeployment:false};
 fs.writeFileSync(out,JSON.stringify(summary,null,2)+'\n');console.log('P3_5_CARD_VIEW='+JSON.stringify(summary));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e.stack||e);process.exitCode=1;});
