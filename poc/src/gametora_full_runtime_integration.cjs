'use strict';
/*
 * Use the ACTUAL UmaCore.directRoutes/aggregate engine on the unpublished
 * GameTora-derived 563-card / 2488-event catalog in CI memory only.
 * The candidate event names, options, reward text and JSON must never leave
 * the runner. This is route EXECUTION coverage, not editorial/game approval.
 */
const core=require('./core.js');
const crypto=require('node:crypto');
const publicCatalog=require('./public_event_catalog.js');
const fail=s=>{throw Error('GT全イベント集計統合試験: '+s);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function exercise({catalog,report,model,rawCatalog=null,mergedSkillText=null},{strict=false}={}){
 if(catalog?.schemaVersion!==1||!Array.isArray(catalog.cards)||
    report?.dataKind!=='gametora-app-schema-dry-run'||
    report.publicationApproved!==false||report.gameVerified!==false||
    report.sourceProseIncluded!==false||report.allPublishedNamesAreUnreviewedPlaceholders!==true||
    !Array.isArray(model?.cards)||!obj(model.cardById)||
    !Number.isSafeInteger(report.totals?.sourceEvents)||
    report.totals.sourceCards!==model.cards.length||
    report.totals.candidateSchemaCards!==catalog.cards.length||
    report.totals.candidateSchemaEvents+report.totals.skippedEvents!==
      report.totals.sourceEvents)
  fail('固定出典の全件候補と未公開フラグが一致しません');
 const totals={sourceModelCards:model.cards.length,projectedCards:0,
  projectedEvents:0,choiceEvents:0,autoEvents:0,choiceOptions:0,
  outcomeVariants:0,unselectedEventRoutes:0,
  plannedEventRoutes:0,plannedNormalHints:0,
  checkedDuplicateCardAggregations:0,checkedProviderSkillCounts:0,
  checkedUnselectedChoiceEvents:0,checkedSelectedChoiceRoutes:0,
  checkedBlockedByTerminal:0};
 let effectiveModel=model;
 let publicLoaderAttachedInMemory=false;
 if(rawCatalog!==null||mergedSkillText!==null){
  if(rawCatalog?.schemaVersion!==1||
     !Array.isArray(rawCatalog.cards)||
     typeof mergedSkillText!=='string'||mergedSkillText.length<100)
   fail('本番イベント読込の実行元データとスキル辞書が不足');
  // The real public_event_catalog.attach API labels a successfully loaded
  // catalog "reviewed". NEVER call it on the real model or deploy this catalog.
  // A throwaway clone guarantees those runtime metadata cannot escape.
  const cloned=JSON.parse(JSON.stringify(model));
  // JSON cloning breaks the shared card identity between cards[] and
  // cardById. Restore it before invoking the actual attachment path.
  cloned.cards=cloned.cards.map(c=>cloned.cardById[c.id]||c);
  const summary=publicCatalog.attach(cloned,rawCatalog,{
   skillText:mergedSkillText,fullRegistry:false});
  if(summary.cardsWithRecords!==catalog.cards.length||
     summary.eventsWithRecords!==report.totals.candidateSchemaEvents||
     cloned.meta.eventStatus!=='reviewed-partial')
   fail('本番イベントDBの結合結果が元GTの投影数と異なる');
  const attached={schemaVersion:1,cards:rawCatalog.cards.map(x=>({
   cardId:x.cardId,coverageStatus:x.coverageStatus,
   events:cloned.cardById[x.cardId]?.events
  }))};
  const originalDigest=crypto.createHash('sha256')
   .update(JSON.stringify(catalog)).digest('hex');
  const loadedDigest=crypto.createHash('sha256')
   .update(JSON.stringify(attached)).digest('hex');
  if(originalDigest!==loadedDigest||
     report.runtimeSkillProjectionSha256!==originalDigest)
   fail('本番イベントDB読込後のルートと元GT投影のSHA-256が不一致');
  effectiveModel=cloned;
  publicLoaderAttachedInMemory=true;
 }
 const seenCards=new Set();
 for(const entry of catalog.cards){
  if(!obj(entry)||!Array.isArray(entry.events)||
     typeof entry.cardId!=='string'||seenCards.has(entry.cardId)||
     !obj(effectiveModel.cardById[entry.cardId]))
    fail('アプリの元カードとイベントカードIDが不一致');
  seenCards.add(entry.cardId);
  const card={...effectiveModel.cardById[entry.cardId],events:entry.events};
  const byEvent=new Map(),choices={},outcomes={};
  for(const e of entry.events){
   if(!e||typeof e.id!=='string'||byEvent.has(e.id)||
      !['auto','choice'].includes(e.type))
    fail('公開形式のイベント識別子・型が不正');
   byEvent.set(e.id,e);
   if(e.type==='choice'){
    if(!Array.isArray(e.choices)||e.choices.length===0)
      fail('選択肢のあるイベントに選択肢がありません');
    totals.choiceEvents++;
    totals.choiceOptions+=e.choices.length;
    // Choose a hypothetical path. It need not be reachable; actual
    // route reachability decides, never synthesize an event reward.
    const choice=e.choices.find(x=>x.terminal!==true)||e.choices[0];
    choices[e.id]=choice.id;
    const variants=choice.outcomes||[];
    if(variants.length)outcomes[e.id]=
      (variants.find(x=>x.terminal!==true)||variants[0]).id;
    for(const ch of e.choices)totals.outcomeVariants+=(ch.outcomes||[]).length;
   }else{
    totals.autoEvents++;
    const variants=e.outcomes||[];
    if(variants.length)outcomes[e.id]=
      (variants.find(x=>x.terminal!==true)||variants[0]).id;
    totals.outcomeVariants+=variants.length;
   }
  }
  totals.projectedEvents+=entry.events.length;totals.projectedCards++;
  const blank=core.directRoutes(card,{stage:4,choices:{},outcomes:{}});
  for(const route of blank.filter(x=>x.source==='event')){
   const e=byEvent.get(route.eventId);
   if(!e||e.type!=='auto')fail('未選択のプレイヤー選択式イベントの報酬が自動算入された');
   totals.unselectedEventRoutes++;
  }
  const setting={stage:4,choices,outcomes};
  const planned=core.directRoutes(card,setting);
  const normal=planned.filter(x=>x.source==='hint');
  const eventRoutes=planned.filter(x=>x.source==='event');
  totals.plannedEventRoutes+=eventRoutes.length;
  totals.plannedNormalHints+=normal.length;
  for(const route of eventRoutes){
   const e=byEvent.get(route.eventId);
   if(!e||typeof route.skillId!=='string'||!route.skillId)
    fail('存在しないスキルIDまたはイベントIDが集計された');
   if(e.type==='choice'){
    const selected=e.choices.find(x=>x.id===choices[e.id]);
    if(!selected||route.choiceLabel!==selected.label)
     fail('選択していないルートからスキルが集計された');
    totals.checkedSelectedChoiceRoutes++;
   }
   if(!['hint','obtained'].includes(route.kind)||route.level!==null&&
      (!Number.isSafeInteger(route.level)||route.level<1))
    fail('獲得種別・ヒントLvが不正');
  }
  for(const ev of entry.events.filter(x=>x.type==='choice')){
   if(!blank.some(x=>x.source==='event'&&x.eventId===ev.id))
    totals.checkedUnselectedChoiceEvents++;
  }
  // Test the exact user-facing deck aggregation path with two slots holding
  // the SAME physical card ID. Provider count is unique by card, routes
  // remain slot-specific, regardless of event branching.
  const fakeData={cardById:{[card.id]:card}};
  const deck={slots:[{cardId:card.id,...setting},{cardId:card.id,...setting}]};
  const aggregated=core.aggregate(deck,fakeData);
  const expectedBySkill=new Map();
  for(const route of planned)expectedBySkill.set(route.skillId,
   (expectedBySkill.get(route.skillId)||0)+1);
  if(Object.keys(aggregated).length!==expectedBySkill.size)
   fail('デッキ集計がスキルを余分に作成または欠落');
  for(const [skillId,count] of expectedBySkill){
   const s=aggregated[skillId];
   if(!s||s.count!==1||
      Object.keys(s.providers).length!==2||
      s.providers[0]?.routes.length!==count||
      s.providers[1]?.routes.length!==count)
    fail('同一カードを2枠に置くと提供カード枚数・経路に誤差');
   totals.checkedProviderSkillCounts++;
  }
  totals.checkedDuplicateCardAggregations++;
  // For any explicitly terminal parent SELECTED branch, the next stage
  // that directly depends on the parent must be blocked by production core.
  for(const parent of entry.events.filter(x=>x.type==='choice')){
   const terminal=parent.choices.find(x=>x.terminal===true);
   if(!terminal)continue;
   for(const child of entry.events){
    const refs=child.requires?.all||[];
    if(!refs.some(x=>x.eventId===parent.id))continue;
    const hypothetical={...choices,[parent.id]:terminal.id};
    if(core.reachability(child,hypothetical,entry.events,outcomes).status!=='blocked')
     fail('連続イベントの明示打ち切り後に報酬へ到達');
    totals.checkedBlockedByTerminal++;
   }
  }
 }
 if(totals.projectedEvents!==report.totals.candidateSchemaEvents||
    totals.autoEvents!==report.totals.candidateAutoEvents||
    totals.choiceEvents!==report.totals.candidateChoiceEvents)
  fail('元データ全件と実際に使用したランタイム候補件数が不一致');
 if(strict&&(totals.sourceModelCards!==563||
   totals.projectedCards!==559||totals.projectedEvents!==2488||
   totals.choiceEvents!==1595||totals.autoEvents!==893||
   totals.checkedDuplicateCardAggregations!==559||
   totals.checkedUnselectedChoiceEvents!==1595))
  fail('固定563カードの最終CI母集団が変化');
 return {schemaVersion:1,
  dataKind:'nonpublishing-full-gametora-core-integration-summary',
  status:'CORE_AGGREGATION_EXECUTED_IN_MEMORY',
  sourceDerivedEventsAreNotGameVerified:true,
  candidateEditorialFactsAreNotApproved:true,
  eventTextOrPrivateCatalogReturned:false,
  actualProductionCatalogAttachExercised:publicLoaderAttachedInMemory,
  attachedOnlyToTemporaryModel:publicLoaderAttachedInMemory,
  publicationApproved:false,gameVerified:false,
  totals};
}
module.exports={exercise};
