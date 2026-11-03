#!/usr/bin/env node
/* Read-only whole-population report. Run manually, not in every ordinary CI. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../src/live_loader.js');
const bridge=require('../src/skill_bridge.js');
const catalogLoader=require('../src/public_event_catalog.js');
const skillEffects=require('../src/skill_effects.js');

const REVISION=process.env.UMASIM_REVISION||'f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const BASE='https://raw.githubusercontent.com/mee1080/umasim/'+REVISION+'/data/';
const ROOT=path.resolve(__dirname,'../..');
function n(s){return String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function percent(a,b){return b?Math.round(a/b*10000)/100:null;}
function sample(list,n=25){return list.slice(0,n);}
async function get(url){
 const resp=await fetch(url,{signal:AbortSignal.timeout(60000)});
 if(!resp.ok)throw Error('HTTP '+resp.status+': '+url);
 return await resp.text();
}
function stats(list){
 const items=[...new Map(list.filter(Boolean).map(x=>[x.id,x])).values()];
 const withSummary=items.filter(x=>typeof x.effectDescription==='string'&&x.effectDescription.trim()).length;
 const withDetails=items.filter(x=>typeof x.effectTechnicalDetails==='string'&&x.effectTechnicalDetails.trim()).length;
 const pinned=items.filter(x=>x.effectSource==='pinned').length;
 return {total:items.length,effectDescription:withSummary,coveragePct:percent(withSummary,items.length),
  technicalDetails:withDetails,technicalPct:percent(withDetails,items.length),pinned,
  missing:items.length-withSummary};
}
function rewards(part,out){
 for(const r of part?.rewards||[])if(typeof r.skillId==='string')out.add(r.skillId);
 for(const o of part?.outcomes||[])rewards(o,out);
}
(async()=>{
 const sourceTime=new Date().toISOString();
 const [supportText,skillText,pinnedSkillText]=await Promise.all([
  get(BASE+'support_card.txt'),get(BASE+'skill_data.txt'),get(bridge.PINNED_URL)
 ]);
 const records=JSON.parse(skillText.replace(/^\uFEFF/,''));
 const source=bridge.parseSource(skillText);
 const rawByRarity={};
 for(const x of records){
  const r=x.rarity||'unknown';
  const v=rawByRarity[r]??={total:0,infoSummary:0,infoTechnical:0,infoMultipleTechnical:0,invokes:0};
  v.total++;
  if(n(x.info?.[0]))v.infoSummary++;
  if(n(x.info?.[1]))v.infoTechnical++;
  if((x.info||[]).slice(2).some(z=>n(z)))v.infoMultipleTechnical++;
  if(Array.isArray(x.invokes)&&x.invokes.length)v.invokes++;
 }
 const srcTotals={total:records.length,
  withInfoSummary:records.filter(x=>n(x.info?.[0])).length,
  withInfoTechnical:records.filter(x=>n(x.info?.[1])).length,
  withAdditionalInfo:records.filter(x=>Array.isArray(x.info)&&x.info.slice(2).some(z=>n(z))).length,
  withInvokes:records.filter(x=>Array.isArray(x.invokes)&&x.invokes.length).length};
 srcTotals.summaryPct=percent(srcTotals.withInfoSummary,srcTotals.total);
 srcTotals.technicalPct=percent(srcTotals.withInfoTechnical,srcTotals.total);
 srcTotals.missingInfoSummary=sample(records.filter(x=>!n(x.info?.[0])).map(x=>({id:x.id,name:x.name,rarity:x.rarity})));
 const model=loader.buildModel(supportText,{mode:'online'});
 const cardCount=model.cards.length;
 const hintSkills=model.skills.slice();
 const uniqueHints=new Set(hintSkills.map(x=>n(x.name)));
 const hintNamesNotInSource=[...uniqueHints].filter(name=>!source.byName.has(name));
 const hintNamesAmbiguous=[...uniqueHints].filter(name=>(source.byName.get(name)||[]).length>1);
 const before=stats(hintSkills);
 const reviewed=JSON.parse(fs.readFileSync(path.join(ROOT,'poc/data/reviewed_events.v1.json'),'utf8'));
 const attached=catalogLoader.attach(model,reviewed,{skillText,pinnedSkillText,
  fullRegistry:true,allowReviewedLegacy:true});
 const skillIdsFromEvents=new Set();
 for(const card of model.cards)for(const ev of card.events||[]){
  rewards(ev,skillIdsFromEvents);
  for(const choice of ev.choices||[])rewards(choice,skillIdsFromEvents);
 }
 const enrichment=skillEffects.attach(model,{skillText,pinnedSkillText});
 const appSkills=[...new Map(model.skills.map(x=>[x.id,x])).values()];
 const group=(predicate)=>stats(appSkills.filter(predicate));
 const byTier=Object.fromEntries([...new Set(appSkills.map(x=>x.tier))].sort()
  .map(t=>[t,group(x=>x.tier===t)]));
 const unfilled=appSkills.filter(x=>!x.effectDescription);
 const classify=skill=>{
  if(skill.id.startsWith('hint:')){
   const hits=source.byName.get(n(skill.name))||[];
   if(hits.length===0)return 'hint-name-not-in-source';
   if(hits.length>1)return 'hint-name-ambiguous';
   return hits[0].description?'unexpected-missing':'source-info-empty';
  }
  const numeric=String(skill.sourceNumericId||(/^skill:(\d+)$/.exec(skill.id)||[])[1]||'');
  const records=[source.byId.get(numeric),bridge.parseSource(pinnedSkillText).byId.get(numeric)].filter(Boolean);
  if(records.length===0)return 'numeric-id-not-in-live-or-pinned';
  if(!records.some(x=>x.name===n(skill.name)))return 'numeric-id-name-mismatch';
  if(!records.some(x=>x.name===n(skill.name)&&x.description))return 'source-info-empty';
  return 'unexpected-missing';
 };
 const reasons={};
 for(const skill of unfilled){const why=classify(skill);reasons[why]??={count:0,samples:[]};reasons[why].count++;
  if(reasons[why].samples.length<15)reasons[why].samples.push({id:skill.id,name:skill.name,tier:skill.tier});
 }
 const report={
  auditedAt:sourceTime,
  source:{revision:REVISION,supportCardUrl:BASE+'support_card.txt',skillDataUrl:BASE+'skill_data.txt',
   skillFileBytes:Buffer.byteLength(skillText),cardFileBytes:Buffer.byteLength(supportText),
   pinnedRevision:bridge.PINNED_URL},
  sourceSkillDictionary:srcTotals,
  dictionaryByRarity:rawByRarity,
  supportCards:{count:cardCount,uniqueOrdinaryHintNames:uniqueHints.size,
   hintNamesMissingFromDictionary:hintNamesNotInSource.length,
   missingHintExamples:sample(hintNamesNotInSource),ambiguousHintNames:hintNamesAmbiguous.length,
   ambiguousExamples:sample(hintNamesAmbiguous),
   initialHintsModel:before},
  publicEventCatalog:{cardsWithRecords:attached.cardsWithRecords,events:attached.eventsWithRecords,
   distinctRewardSkills:skillIdsFromEvents.size,distinctRewardSkillsWithDescription:
    [...skillIdsFromEvents].filter(id=>model.skillById[id]?.effectDescription).length},
  appDisplayedSkillModel:{...stats(appSkills),byTier,ordinaryHints:group(x=>x.id.startsWith('hint:')),
   eventRewardSkills:stats([...skillIdsFromEvents].map(id=>model.skillById[id])),
   onlyEventRewardSkills:stats([...skillIdsFromEvents].filter(id=>!id.startsWith('hint:'))
    .map(id=>model.skillById[id])),
   normalAndRare:group(x=>['white','gold'].includes(x.tier)),
   currentSourceDescriptions:enrichment.current,pinnedDescriptions:enrichment.pinned},
  missingEffectExplanation:reasons,
  notes:['All source skill rarities include unique and special skills that are not registered wholesale for goal selection.',
   'An info string is publisher-reported coverage, not proof of current game behavior.',
   'The UI currently displays info[0] and info[1] only; info[2+] remains unavailable in skill detail.',
   'Missing descriptions do not mean that a skill is absent from the game.']
 };
 const filename=process.env.SKILL_AUDIT_OUTPUT||'skill-effect-coverage-audit.json';
 fs.writeFileSync(filename,JSON.stringify(report,null,2)+'\n');
 console.log('SKILL_EFFECT_COVERAGE_REPORT_START');
 console.log(JSON.stringify(report,null,2));
 console.log('SKILL_EFFECT_COVERAGE_REPORT_END');
})().catch(error=>{console.error('SKILL_EFFECT_AUDIT_FAILED',error?.stack||String(error));process.exitCode=1;});
