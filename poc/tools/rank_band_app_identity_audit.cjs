#!/usr/bin/env node
'use strict';
/* P2 research-only: identify exactly which newly validated source rank-band
 * skills exist in the current published application model. Does not mutate
 * UI, cards, or the application's initial style labels. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const fit=require('../src/skill_activation_fit_v1.cjs');
const profiles=require('../src/skill_condition_profiles.js');
const bridge=require('../src/skill_bridge.js');
const loader=require('../src/live_loader.js');
const events=require('../src/public_event_catalog.js');
const sourceAudit=require('./rank_band_fit_population_audit.cjs');
const REV=sourceAudit.REV;
const PIN=sourceAudit.PINNED;
const STYLES=['逃げ','先行','差し','追込'];
const norm=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function candidates(raw){
 if(!Array.isArray(raw))throw Error('Source registry unavailable');
 const result=[];
 for(const record of raw){
  if(!record||typeof record.id!=='string'||typeof record.name!=='string'||
   !Array.isArray(record.invokes))throw Error('Invalid source skill');
  const profile={status:'source-structure',sourceNumericId:record.id,
   invokes:record.invokes.map((inv,i)=>({index:inv.index??i,
    preConditions:inv.preConditions??[],conditions:inv.conditions??[]}))};
  const evaluated=fit.evaluate(profile);
  if(STYLES.every(s=>['high','low'].includes(evaluated.styles[s].status)&&
   evaluated.styles[s].paths.some(x=>x.modelBandEvidence))){
   result.push({sourceNumericId:record.id,sourceName:norm(record.name),
    styles:Object.fromEntries(STYLES.map(s=>[s,evaluated.styles[s].status])),
    evidenceWindows:[...new Set(STYLES.flatMap(s=>evaluated.styles[s].paths
     .filter(p=>p.modelBandEvidence)
     .map(p=>p.modelBandEvidence.phase+'|'+p.modelBandEvidence.bandId)))].sort()});
  }
 }
 if(new Set(result.map(x=>x.sourceNumericId)).size!==result.length)
  throw Error('Duplicate source skill candidate');
 return result.sort((a,b)=>a.sourceNumericId.localeCompare(b.sourceNumericId,'en'));
}
function reconcile(candidateRows,model){
 if(!Array.isArray(candidateRows)||!model||!Array.isArray(model.skills)||
  !model.skillById)throw Error('Missing audited source/app roster');
 const sourceKeys=new Set(),out=[];
 const byNum=new Map(),byName=new Map();
 for(const skill of model.skills){
  if(!skill||typeof skill.id!=='string'||typeof skill.name!=='string')
   throw Error('Invalid app model skill record');
  const num=skill.activationProfile?.sourceNumericId||skill.sourceNumericId||
   (/^skill:(\d+)$/.exec(skill.id)||[])[1];
  if(num){
   if(!byNum.has(String(num)))byNum.set(String(num),[]);
   byNum.get(String(num)).push(skill);
  }
  const key=norm(skill.name);
  if(!byName.has(key))byName.set(key,[]);
  byName.get(key).push(skill);
 }
 for(const c of candidateRows){
  if(!/^\d+$/.test(c.sourceNumericId)||!c.sourceName||
   sourceKeys.has(c.sourceNumericId))throw Error('Invalid or duplicate candidate identity');
  sourceKeys.add(c.sourceNumericId);
  const idRows=byNum.get(c.sourceNumericId)||[];
  const matching=idRows.filter(x=>norm(x.name)===c.sourceName&&
   x.activationProfile?.status==='source-structure'&&
   x.activationProfile.sourceNumericId===c.sourceNumericId);
  const different=idRows.filter(x=>norm(x.name)!==c.sourceName);
  const names=byName.get(c.sourceName)||[];
  const status=matching.length===1&&different.length===0?'exact-id-name':
   matching.length>1?'duplicate-app-identity':
   idRows.length?'id-name-or-source-mismatch':
   names.length?'name-only-or-other-id':'not-in-app-catalog';
  out.push({...c,status,
   appSkills:matching.map(x=>({id:x.id,name:x.name,
    activationSource:x.activationProfile?.source||null})),
   conflictingAppIds:different.map(x=>x.id),
   sameNameAppIds:names.map(x=>x.id)});
 }
 const count=x=>out.filter(v=>v.status===x).length;
 return {schemaVersion:1,status:'research-only-new-rank-band-app-identity-audit',
  sourceRevision:REV,sourceSkillSha256:PIN,
  fitVersion:fit.VERSION,
  app:{totalSkills:model.skills.length,totalCards:model.cards?.length??null,
   profileCoverage:model.meta?.skillConditionProfiles||null},
  candidates:out.length,summary:{
   exactIdName:count('exact-id-name'),
   duplicateAppIdentity:count('duplicate-app-identity'),
   idNameOrSourceMismatch:count('id-name-or-source-mismatch'),
   nameOnlyOrOtherId:count('name-only-or-other-id'),
   notInAppCatalog:count('not-in-app-catalog')
  },items:out,
  boundaries:[
   'Source candidate count is computed from all four style statuses plus signed model rank-band paths, not from example source IDs.',
   'App identity requires numeric source ID AND normalized original name AND source condition match; name alone is never enough.',
   'Hint name-only source resolution is accepted only after profile attachment verifies unique original numeric identity.',
   'Same name at another numeric ID is not an identity and is recorded separately.',
   'Result does not mean public card grants that skill: hint/event routes need separate independent coverage audit.',
   'Existing 53 style fit and published app cards, events, saved decks, and user-facing labels remain untouched.',
   'GlobalSim rank occupancy is not a game trigger probability or proof of skill usefulness.'
  ]};
}
function inspectSourceAndApp({skillText,supportText,pinnedText,catalog}){
 if(typeof skillText!=='string'||hash(Buffer.from(skillText))!==PIN)
  throw Error('Pinned 2162-skill registry SHA mismatch');
 if(typeof pinnedText!=='string'||typeof supportText!=='string'||
  !catalog||!Array.isArray(catalog.cards))
  throw Error('Missing exact app model source inputs');
 const raw=JSON.parse(skillText.replace(/^\uFEFF/,''));
 const candidateRows=candidates(raw);
 const sourceOverview=sourceAudit.audit(raw);
 if(sourceOverview.stats.fullyResolvedNewRankBandSkills!==candidateRows.length)
  throw Error('Candidate and full-source rank-band audit disagree');
 const model=loader.buildModel(supportText,{mode:'online'});
 events.attach(model,catalog,{skillText,pinnedSkillText:pinnedText,
  fullRegistry:true,allowReviewedLegacy:true});
 const cardsBefore=JSON.stringify(model.cards);
 profiles.attach(model,{skillText,pinnedSkillText:pinnedText});
 if(JSON.stringify(model.cards)!==cardsBefore)
  throw Error('Attaching skill source profile mutated published cards');
 const report=reconcile(candidateRows,model);
 return {...report,sourceCoverage:sourceOverview.stats,
  publishedEventCatalog:{version:catalog.schemaVersion??null,
   eventsWithRecords:model.meta.reviewedEventRecords??null}};
}
function main(args){
 const [skillPath,supportPath,pinnedPath,catalogPath,output]=args;
 if(!output)throw Error('Usage: rank_band_app_identity_audit.cjs fixed_skills fixed_support pinned_legacy_skills reviewed_events output.json');
 const result=inspectSourceAndApp({
  skillText:fs.readFileSync(skillPath,'utf8'),
  supportText:fs.readFileSync(supportPath,'utf8'),
  pinnedText:fs.readFileSync(pinnedPath,'utf8'),
  catalog:JSON.parse(fs.readFileSync(catalogPath,'utf8'))
 });
 if(result.candidates!==24||
  result.app.totalSkills!==881||
  result.app.profileCoverage?.matched!==818||
  Object.values(result.summary).reduce((a,b)=>a+b,0)!==result.candidates)
  throw Error('Fixed app cohort identity coverage drift '+JSON.stringify({
   app:result.app,source:result.sourceCoverage,summary:result.summary}));
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({candidateCount:result.candidates,
  app:result.app,summary:result.summary,
  identityMatches:result.items.filter(x=>x.status==='exact-id-name')
   .map(x=>({id:x.sourceNumericId,name:x.sourceName,appIds:x.appSkills.map(y=>y.id)})),
  noMatch:result.items.filter(x=>x.status!=='exact-id-name')
   .map(x=>({id:x.sourceNumericId,name:x.sourceName,status:x.status}))},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={REV,PIN,STYLES,norm,candidates,reconcile,
 inspectSourceAndApp,main};
