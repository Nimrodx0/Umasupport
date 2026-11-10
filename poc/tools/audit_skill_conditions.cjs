#!/usr/bin/env node
/* Deliberately manual / PR-scoped real-source audit. No upstream data is
 * published as a repository asset. Machine-readable report remains a CI artifact. */
'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const bridge=require('../src/skill_bridge.js');
const loader=require('../src/live_loader.js');
const publicEvents=require('../src/public_event_catalog.js');
const {inventory}=require('../src/skill_condition_inventory.cjs');
const profiles=require('../src/skill_condition_profiles.js');
const combinations=require('../src/skill_condition_combinations.cjs');
const rankTime=require('../src/skill_rank_timing_audit.cjs');
const styleTendency=require('../src/skill_style_tendency.js');
const skillTags=require('../src/skill_condition_tags.js');
const styleReview=require('../src/skill_style_review.cjs');
const researchTriage=require('../src/skill_condition_research_triage.cjs');
const mixedResearch=require('../src/skill_condition_mixed_cohort.cjs');
const REVISION=process.env.UMASIM_REVISION||'f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const BASE='https://raw.githubusercontent.com/mee1080/umasim/'+REVISION+'/data/';
const get=async url=>{
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('upstream HTTP '+response.status+': '+url);
 return await response.text();
};
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const norm=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
function matchedRecord(skill,live,old){
 const name=norm(skill.name);
 const numeric=skill.sourceNumericId||(/^skill:(\d+)$/.exec(skill.id)||[])[1];
 if(numeric){
  const cur=live.byId.get(String(numeric)),pin=old.byId.get(String(numeric));
  return cur?.name===name?{record:cur,source:'live'}:pin?.name===name?{record:pin,source:'pinned'}:null;
 }
 if(skill.id.startsWith('hint:')){
  const matches=live.byName.get(name)||[];
  return matches.length===1?{record:matches[0],source:'live'}:null;
 }
 return null;
}
(async()=>{
 const [skillText,supportText,pinnedText]=await Promise.all([
  get(BASE+'skill_data.txt'),get(BASE+'support_card.txt'),get(bridge.PINNED_URL)]);
 const raw=JSON.parse(skillText.replace(/^\uFEFF/,''));
 const pinnedRaw=JSON.parse(pinnedText.replace(/^\uFEFF/,''));
 const source=bridge.parseSource(skillText),old=bridge.parseSource(pinnedText);
 const whole=inventory(raw);
 const model=loader.buildModel(supportText,{mode:'online'});
 const published=JSON.parse(fs.readFileSync('poc/data/reviewed_events.v1.json','utf8'));
 publicEvents.attach(model,published,{skillText,pinnedSkillText:pinnedText,
  fullRegistry:true,allowReviewedLegacy:true});
 const seen=new Map(),unknown=[],sourceCounts={live:0,pinned:0};
 for(const skill of model.skills){
  const found=matchedRecord(skill,source,old);
  if(!found){unknown.push({id:skill.id,name:skill.name});continue;}
  const record=(found.source==='live'?raw:pinnedRaw).find(r=>r.id===found.record.id);
  if(!record)throw Error('Parsed registry ID absent from original: '+found.record.id);
  sourceCounts[found.source]++;
  seen.set(record.id,record);
 }
 const relevant=inventory([...seen.values()]);
 const p2Triage=researchTriage.examine(whole,relevant,
  {matchedRecords:[...seen.values()]});
 const mixed=mixedResearch.analyze([...seen.values()]);
 if(mixed.mixedSkills!==p2Triage.summary.matchedSkillStructure.candidateAndDeferredMixed)
  throw Error('P2 mixed cohort no longer matches independent triage population');

 const applied=profiles.attach(model,{skillText,pinnedSkillText:pinnedText});
 if(applied.matched!==relevant.shape.valid||
    applied.unavailable!==unknown.length||applied.noActivationRecord!==0)
   throw Error('P1 profile coverage mismatch with independent P0 cohort: '+
    JSON.stringify(applied));
 const profileTags=model.skills.filter(s=>s.activationProfile?.angleTags?.length).length;
 if(profileTags!==relevant.shape.withTags)
   throw Error('P1 bracket-label mismatch against P0 inventory: '+
     profileTags+' != '+relevant.shape.withTags);
 const profileByAxis={};
 for(const skill of model.skills)for(const invoke of skill.activationProfile?.invokes||[])
  for(const side of ['preConditions','conditions'])
   for(const orGroup of invoke[side])for(const c of orGroup)
    if(c.axis)profileByAxis[c.axis]=(profileByAxis[c.axis]||0)+1;
 const combosAll=combinations.examine(raw);
 const combosApp=combinations.examine([...seen.values()]);
 if(combosAll.skills!==whole.total||combosApp.skills!==relevant.total)
  throw Error('P2 combination audit source-population mismatch');
 const rankTimingAll=rankTime.cohort(raw);
 const rankTimingApp=rankTime.cohort([...seen.values()]);
 if(rankTimingAll.totalRecords!==whole.total||
    rankTimingApp.totalRecords!==relevant.total)
  throw Error('P2 rank-timing cohort denominator drift');
 const cardsBefore=JSON.stringify(model.cards);
 const styleApp=styleTendency.attach(model);
 if(cardsBefore!==JSON.stringify(model.cards))
  throw Error('P2 inference mutated card/event/hint catalog');
 if(styleApp.total!==model.skills.length||styleApp.unavailable!==unknown.length)
  throw Error('P2 style tendency app coverage mismatch: '+JSON.stringify(styleApp));
 const allInferredReview=styleReview.summarize(model);
 if(allInferredReview.total!==styleApp.inferred)
  throw Error('P2 review list lost inferred skills');
 const sourceStyles=raw.map(rec=>{
  const inference=styleTendency.infer({
   status:'source-structure',sourceNumericId:rec.id,
   invokes:rec.invokes,angleTags:skillTags.recognized(rec.info)});
  return {id:rec.id,name:rec.name,inference};
 });
 const styleFull={total:sourceStyles.length,
  statuses:{},labels:{},reviewReasons:{},examples:{front:[],back:[],
   needsReview:[],explicitOnly:[],notInferable:[]}};
 const inc=(obj,k)=>{obj[k]=(obj[k]||0)+1;};
 for(const item of sourceStyles){
  const x=item.inference;
  inc(styleFull.statuses,x.status);
  if(x.status==='inferred'){
   inc(styleFull.labels,x.label);
   const examples=x.basisRuleIds[0]===styleTendency.RULES.FRONT.id?
    styleFull.examples.front:styleFull.examples.back;
   if(examples.length<12)examples.push({id:item.id,name:item.name,
     ruleIds:x.basisRuleIds,sourceConditions:x.branches[0].sourceConditions});
  }else{
   if(x.reason)inc(styleFull.reviewReasons,x.reason);
   const list=x.status==='explicit-only'?styleFull.examples.explicitOnly:
    x.status==='not-inferable'?styleFull.examples.notInferable:
    styleFull.examples.needsReview;
   if(list.length<12)list.push({id:item.id,name:item.name,reason:x.reason});
  }
 }
 const mustAgree=[
  ['201052','逃げ・先行寄り'],['200702','差し・追込寄り'],
  ['202312','逃げ・先行寄り'],
  ['202311','逃げ・先行寄り'],
  ['202672','逃げ・先行寄り'],['202671','逃げ・先行寄り']];
 for(const [id,expected] of mustAgree){
  const found=sourceStyles.find(x=>x.id===id);
  if(!found||found.inference.status!=='inferred'||found.inference.label!==expected)
   throw Error('P2 named skill regression: '+id+' != '+expected+
    ' (actual '+JSON.stringify(found?.inference)+')');
 }
 for(const id of ['200542','200592']){
  const found=sourceStyles.find(x=>x.id===id);
  if(!found||found.inference.status!=='explicit-only')
   throw Error('P2 explicit-style card wrongly inferred: '+id);
 }
 // The full and app cohorts must never silently acquire a 75%-based
 // four-style eligibility classification. The late-phase opportunity
 // is contextual evidence, not a proven style likelihood threshold.
 for(const [id,expectedEnd] of [['202312',0.83333333],['202311',0.83333333],
  ['202672',0.75],['202671',0.75]]){
  const found=sourceStyles.find(x=>x.id===id);
  const actual=found?.inference?.branches?.[0]?.timingContext?.latestPossibleRate;
  if(actual!==expectedEnd)throw Error('P2 phase window boundary mismatch '+id+': '+actual);
 }
 if(styleApp.broadLateFront!==undefined)
  throw Error('Obsolete broad-late-front eligibility cohort still present');
 if(styleFull.total!==Object.values(styleFull.statuses).reduce((a,b)=>a+b,0))
  throw Error('P2 style tendency full count mismatch');
 const report={
  auditVersion:7,source:{revision:REVISION,sha256:digest(skillText),
   pinnedRevision:bridge.PINNED_URL.split('/')[5],pinnedSha256:digest(pinnedText),
   supportRevision:REVISION,supportSha256:digest(supportText)},
  fullRegistry:whole,
  p2Combinations:{all:combosAll,app:combosApp},
  p2RankTiming:{all:rankTimingAll,app:rankTimingApp},
  p2StyleTendency:{all:styleFull,app:styleApp},
  p2StyleReview:allInferredReview,
  app:{cards:model.cards.length,skills:model.skills.length,
   matchedEntries:seen.size,unmatched:unknown.length,unmatchedExamples:unknown.slice(0,25),
   sourceCounts,inventory:relevant,profiles:{...applied,profileTags,profileByAxis}}
 };
 if(whole.shape.invalid||relevant.shape.invalid)
  throw Error('Unexpected malformed source skill predicates: '+whole.shape.invalid+'/'+relevant.shape.invalid);
 fs.writeFileSync('skill-condition-inventory-audit.json',JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync('p2-mixed-rank-deferred-audit.json',
  JSON.stringify({source:{revision:REVISION,sha256:digest(skillText)},...mixed},
   null,2)+'\n');
 console.log('P2_MIXED_RANK_COHORT_SUMMARY_START');
 console.log(JSON.stringify({mixedSkills:mixed.mixedSkills,
  byRelation:mixed.byRelation,byDeferredType:mixed.byDeferredType,
  cases:mixed.cases.map(c=>({sourceNumericId:c.sourceNumericId,
   skillName:c.skillName,cohort:c.cohort,
   allRankTypes:c.allRankTypes,allDeferredTypes:c.allDeferredTypes,
   sameAndRows:c.sameAndRows}))},null,2));
 console.log('P2_MIXED_RANK_COHORT_SUMMARY_END');
 fs.writeFileSync('p2-condition-research-triage.json',
  JSON.stringify({source:report.source,...p2Triage},null,2)+'\n');
 console.log('P2_CONDITION_TRIAGE_SUMMARY_START');
 console.log(JSON.stringify({
  summary:p2Triage.summary,
  topAppTypes:p2Triage.byType.slice(0,30).map(x=>({
   type:x.type,matchedSkills:x.appMatchedSkills,
   group:x.group,treatment:x.treatment
  }))},null,2));
 console.log('P2_CONDITION_TRIAGE_SUMMARY_END');
 const mini=v=>({total:v.total,shape:v.shape,
  conditionTypes:v.counts.distinctConditionTypes,
  occurrences:v.counts.occurrences,
  candidateExplicitConditionTypes:v.counts.candidateExplicitConditionTypes,
  operators:v.counts.operators,
  invokeCounts:v.counts.invokeCounts,
  matrixShapes:v.counts.matrixShapes,
  tagTypes:v.counts.tagTypes,
  tags:Object.fromEntries(Object.entries(v.counts.tags).slice(0,45)),
  types:Object.fromEntries(Object.entries(v.counts.byType).map(([t,z])=>[t,{
   occurrences:z.occurrences,skills:z.skills,operators:z.operators,
   distinctValues:z.values.length,valuesSample:z.values.slice(0,15),examples:z.examples.slice(0,2)
  }]))});
 console.log('SKILL_CONDITION_P0_REPORT_START');
 console.log(JSON.stringify({source:report.source,
  all:mini(whole),
  app:{...report.app,unmatchedExamples:unknown.slice(0,10),inventory:mini(relevant)}},null,2));
 console.log('SKILL_CONDITION_P0_REPORT_END');
 const compact=x=>({skills:x.skills,clauseCount:x.clauseCount,
  rankClauseCount:x.rankClauseCount,positionWithoutTrackedPhase:x.positionWithoutTrackedPhase,
  multiInvokeRank:x.multiInvokeRank,pairKinds:x.pairKinds,
  focused:Object.fromEntries(Object.entries(x.focused).map(([k,v])=>[k,{
   andSkills:v.sameAnd.skills,invokeOnlySkills:v.sameInvokeOnly.skills,
   andExamples:v.sameAnd.examples.slice(0,4),
   invokeOnlyExamples:v.sameInvokeOnly.examples.slice(0,2)}])),
  rankWithPhase:Object.fromEntries(Object.entries(x.rankWithPhase).slice(0,30)
   .map(([k,v])=>[k,{skills:v.skills,examples:v.examples.slice(0,2)}])),
  cases:Object.fromEntries(Object.entries(x.cases)
   .filter(([k])=>!k.startsWith('position:')).map(([k,v])=>
    [k,{skills:v.skills,examples:v.examples.slice(0,5)}])),
  topPairs:Object.fromEntries(Object.entries(x.topPairs).slice(0,25)
   .map(([k,v])=>[k,{skills:v.skills}]))});
 console.log('SKILL_CONDITION_P2_REPORT_START');
 console.log(JSON.stringify({full:compact(combosAll),app:compact(combosApp)},null,2));
 console.log('SKILL_CONDITION_P2_REPORT_END');
 console.log('SKILL_RANK_TIMING_P2_REPORT_START');
 const rankMini=x=>({totalRecords:x.totalRecords,withRankTimePair:x.withRankTimePair,
  withoutRankTimePair:x.withoutRankTimePair,totalPairs:x.totalPairs,
  isolatedPairs:x.isolatedPairs,needsReviewPairs:x.needsReviewPairs,
  isolatedWithoutExplicitStyle:x.isolatedWithoutExplicitStyle,
  reviewReasons:x.reviewReasons,byTimeCode:x.byTimeCode,byPhase:x.byPhase,
  byRankConstraint:x.byRankConstraint,
  topPairEntries:Object.entries(x.byPair).slice(0,30),
  samples:x.samples});
 console.log(JSON.stringify({full:rankMini(rankTimingAll),app:rankMini(rankTimingApp)},null,2));
 console.log('SKILL_RANK_TIMING_P2_REPORT_END');
 console.log('SKILL_STYLE_TENDENCY_P2_REPORT_START');
 console.log(JSON.stringify({all:styleFull,app:styleApp,
  checkedNamedSkills:mustAgree},null,2));
 console.log('SKILL_STYLE_TENDENCY_P2_REPORT_END');
 console.log('SKILL_STYLE_REVIEW_P2_REPORT_START');
 console.log(JSON.stringify(allInferredReview,null,2));
 console.log('SKILL_STYLE_REVIEW_P2_REPORT_END');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
