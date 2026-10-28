'use strict';
/*
 * Re-run the ACTUAL private skill+non-skill event merger over the two real
 * existing SSR30001 app projections, and independently crosscheck every
 * combined reward leaf against the original GameTora rendered DOM.
 * Never export source prose, merged catalog or third-party choice labels.
 * Unlike the all-563-card assemble() wrapper, this tiny one-card harness
 * exercises the SAME mergeEvent() implementation without faking 2512 records.
 */
const schema=require('./event_schema.js');
const {mergeEvent}=require('./phase2_2512_private_effect_join.cjs');
const {comparePinnedAppDraftToOriginalSite}=require('./official_gametora_app_schema_parity.cjs');
const {comparePinnedEffectsToSite}=require('./official_gametora_app_effects_parity.cjs');
const {renderedRouteFacts}=require('./official_gametora_existing_normalized_parity.cjs');
const fail=s=>{throw Error('既存SSR30001統合アプリJSON対元サイト: '+s);};
const sorted=x=>x.slice().sort().join('|');
const shortCode=r=>typeof r?.skillId==='string'&&/^skill:[1-9]\d*$/.test(r.skillId)&&
  Number.isSafeInteger(r.level)&&r.level>0&&!r.kind?
  r.skillId.slice(6)+':'+r.level:null;
const slimEffect=e=>e?.kind+':'+e?.delta;
function combineActualAppDrafts({skillDraft,effectDraft}){
 const skillCard=skillDraft?.appCard,effectCard=effectDraft?.isolatedAppCard;
 if(skillDraft?.sourceEventCount!==5||skillDraft.sourceRouteCount!==9||
  effectDraft?.sourceEventCount!==5||effectDraft.sourceRouteCount!==9||
  skillCard?.cardId!=='30001'||effectCard?.cardId!=='30001'||
  !Array.isArray(skillCard.events)||skillCard.events.length!==5||
  !Array.isArray(effectCard.events)||effectCard.events.length!==5||
  skillDraft.runtimeEventCount!==5||effectDraft.eligibleEffectEventCount!==5||
  effectDraft.blockedSourceEvents!==0)
  fail('既存のスキル・非スキル二系統の5イベント投影が揃わない');
 const effects=new Map(effectCard.events.map(e=>[e.id,e]));
 if(effects.size!==5)fail('効果用イベントが重複');
 const combined=[];
 let effectCount=0,mergedEvents=0,skippedOrRejected=0;
 for(const event of skillCard.events){
  const m=/^gt-30001-event-(\d{3})$/.exec(event.id);
  if(!m)fail('実アプリ用スキル候補に旧固定元イベントの位置がない');
  const effect=effects.get('gt:30001:'+m[1]+':effect-only');
  if(!effect){skippedOrRejected++;continue;}
  const result=mergeEvent(event,effect);
  if(!result.event){skippedOrRejected++;continue;}
  if(result.statusRows!==0||result.dynamicRows!==0)
   fail('非スキル整数スカラー以外の結果が混入');
  combined.push(result.event);
  effectCount+=result.effectRows;
  mergedEvents++;
 }
 if(mergedEvents!==5||skippedOrRejected!==0||combined.length!==5||
  effectCount!==31)
  fail('元サイト31数値と全5イベントの実結合ができない');
 const mergedCatalog={schemaVersion:1,cards:[{
  cardId:'30001',coverageStatus:'partial',events:combined
 }]};
 // The real runtime schema must validate BOTH reward and effect leaves.
 const skillIds=new Set();
 for(const e of combined)for(const p of e.type==='choice'?e.choices:[e])
  for(const r of p.outcomes||[p])
   for(const x of r.rewards||[])skillIds.add(x.skillId);
 const model={cards:[{id:'30001'}],cardById:{'30001':{id:'30001'}},
  skillById:Object.fromEntries([...skillIds].map(id=>[id,{id}]))};
 const validation=schema.validateCatalog(mergedCatalog,model);
 if(validation.eventsWithRecords!==5)fail('統合後の実行時スキーマ検証失敗');
 return {
  // RAM-only private model: caller must NEVER serialize to CI / repository.
  mergedCatalog,mergedEvents,mergedNumericEffects:effectCount,
  skillProjectionUnchanged:true,unpublished:true
 };
}
function compareCombinedToOriginalSite({
 skillDraft,effectDraft,siteParity,siteEventGroups,siteChoiceSemantics
}){
 const skillProof=comparePinnedAppDraftToOriginalSite({
  draft:skillDraft,siteParity,siteEventGroups,siteChoiceSemantics});
 const effectProof=comparePinnedEffectsToSite({
  draft:effectDraft,siteParity,siteEventGroups});
 if(skillProof.appSkillRouteParity!==true||
   skillProof.matchedSkillRoutes!==9||skillProof.matchedHintRewards!==5||
   effectProof.allRenderedNonSkillNumericEffectsMatch!==true||
   effectProof.matchedEffectRoutes!==9||effectProof.matchedEffectCount!==31)
  fail('元サイトに独立一致した二系統の投影証拠が不完全');
 const combined=combineActualAppDrafts({skillDraft,effectDraft});
 const byId=new Map(combined.mergedCatalog.cards[0].events.map(x=>[x.id,x]));
 const seenEvent=new Set(),seenDisplayed=new Set(),rows=[];
 let matchedRoutes=0,matchedSkills=0,matchedEffects=0,
   siteSkills=0,siteEffects=0,confirmedTerminalRouteLocations=0,
   mergedSkillCount=0,mergedEffectCount=0,mergedBondEffects=0,
   retainedRequires=0;
 for(const binding of siteParity.events){
  const n=binding.sourceOrdinal,di=binding.displayedEventOrdinal;
  if(!Number.isSafeInteger(n)||n<1||n>5||seenEvent.has(n)||
    !Number.isSafeInteger(di)||di<1||di>5||seenDisplayed.has(di)||
    !Array.isArray(binding.routeLinks))fail('元サイト5イベント紐付けが不正');
  seenEvent.add(n);seenDisplayed.add(di);
  const origin=skillDraft.normalized.events[n-1];
  const app=byId.get(origin.eventId);
  if(!app)fail('結合後に元イベントが欠損');
  const site=renderedRouteFacts(siteEventGroups[di-1]);
  const seenGroup=new Set(),seenSourceRoute=new Set();
  if(app.requires)retainedRequires++;
  for(const link of binding.routeLinks){
   const ci=link.sourceChoiceOrdinal,ri=link.sourceOutcomeOrdinal,
     pos=link.renderedGroupOrdinal;
   if(!Number.isInteger(ci)||ci<1||ci>origin.choices.length||
    !Number.isInteger(ri)||ri<1||ri>origin.choices[ci-1].routes.length||
    !Number.isInteger(pos)||pos<1||pos>site.length||
    seenGroup.has(pos)||seenSourceRoute.has(ci+':'+ri))
    fail('サイト経路の選択・結果位置が欠損／重複');
   seenGroup.add(pos);seenSourceRoute.add(ci+':'+ri);
   const parent=app.type==='auto'?ci===1?app:null:app.choices?.[ci-1];
   const routeCount=origin.choices[ci-1].routes.length;
   const leaf=routeCount>1?parent?.outcomes?.[ri-1]:
    parent?.outcomes?null:ri===1?parent:null;
   if(!leaf||routeCount>1&&parent.outcomes.length!==routeCount)
    fail('統合後の選択肢／結果の階層が破損');
   const observed=site[pos-1];
   const siteHintCodes=observed.hintSignature?observed.hintSignature.split('|'):[];
   const siteEffectCodes=observed.effectSignature?
    observed.effectSignature.split('|').filter(x=>!x.startsWith('skill_hint:')):[];
   const actualHints=Array.isArray(leaf.rewards)?leaf.rewards.map(shortCode):[];
   const actualEffects=(leaf.effects||[]).map(slimEffect);
   const skillMatch=Array.isArray(leaf.rewards)&&actualHints.every(Boolean)&&
    sorted(siteHintCodes)===sorted(actualHints);
   const effectMatch=sorted(siteEffectCodes)===sorted(actualEffects);
   if(!skillMatch||!effectMatch)
    fail('統合後の同一結果経路に元サイトのスキルと非スキルを共存できない');
   matchedRoutes++;matchedSkills+=siteHintCodes.length;
   matchedEffects+=siteEffectCodes.length;
   siteSkills+=siteHintCodes.length;siteEffects+=siteEffectCodes.length;
   mergedSkillCount+=actualHints.length;mergedEffectCount+=actualEffects.length;
   mergedBondEffects+=actualEffects.filter(x=>x.startsWith('bond:')).length;
   if(leaf.terminal===true){
    const proof=siteChoiceSemantics?.find(p=>p.historicalEventOrdinal===n);
    if(proof?.explicitTerminalRouteCheck?.explicitTerminalRouteLocationVerified===true&&
       proof.siteTerminalGroupOrdinals?.includes(pos))
      confirmedTerminalRouteLocations++;
   }
  }
  if(seenGroup.size!==site.length)fail('サイト結果の取りこぼし');
  rows.push({sourceOrdinal:n,matchedRoutes:seenGroup.size,combinedEventPresent:true});
 }
 if(matchedRoutes!==9||matchedSkills!==5||matchedEffects!==31||
   siteSkills!==mergedSkillCount||siteEffects!==mergedEffectCount||
   mergedBondEffects!==8||retainedRequires!==2||
   confirmedTerminalRouteLocations!==1)
  fail('統合した全イベント経路の保存則が不一致');
 // Metadata only. Never return the ephemeral event catalog.
 return {
  cardId:'30001',
  joinedRealMerger:'phase2_2512_private_effect_join.mergeEvent',
  validRuntimeSchema:true,
  sameRouteSkillAndEffectParity:true,
  events:5,routes:9,hints:matchedSkills,numericEffects:matchedEffects,
  bondNumericEffects:mergedBondEffects,
  sourceConfirmedTerminalRoutes:confirmedTerminalRouteLocations,
  existingRequiresUnchangedCount:retainedRequires,
  siteHasProvenBondRecipientIds:false,
  siteHasProvenFullChainReachability:false,
  siteHasProvenGameChoiceVsOutcomeSemantics:false,
  sourceLanguageContentCopied:false,
  fullApplicationJSONEquivalent:false,
  publicationApproved:false,
  eventsVerified:rows
 };
}
module.exports={combineActualAppDrafts,compareCombinedToOriginalSite};
