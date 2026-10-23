'use strict';
/*
 * Combine the entire PINNED GT numeric projection and two independently
 * adjudicated exceptions in CI RAM only. NOT a distributable event catalog.
 * 2488 GT events -> correct SSR30080/6 one-row option topology -> add 8
 * GameWith-adjudicated RANDOM events on the four GT-missing SSR cards.
 *
 * Missing chain stages and unapproved source prose must stay out.
 */
const crypto=require('node:crypto');
const schema=require('./event_schema.js');
const core=require('./core.js');
const {digest}=require('./event_release_gate.cjs');
const {apply:repair30080}=require('./phase2_30080_runtime_overlay.cjs');
const {build:buildEight}=require('./phase2_eight_release_candidate.cjs');
const fail=s=>{throw Error('Phase2非公開2496イベント統合: '+s);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const EXPECTED_MISSING=['30318','30319','30320','30321'];
function mapByCard(catalog){
 const rows=new Map();
 for(const card of catalog.cards){
  if(rows.has(card.cardId)||!/^\d{5}$/.test(card.cardId)||
     !Array.isArray(card.events))
   fail('イベントカードが重複、または形式が不正');
  rows.set(card.cardId,card);
 }
 return rows;
}
function build({normalized,enriched,review,triage},{strict=false}={}){
 if(normalized?.dataKind!=='gametora-whole-event-numeric-candidate'||
    normalized.releaseApproved!==false||
    !Array.isArray(normalized.cards)||
    enriched?.publicationApproved!==false||
    enriched.noAutomaticRuntimeAdoption!==true||
    enriched.catalog?.schemaVersion!==1||
    !Array.isArray(enriched.catalog.cards)||
    review?.dataKind!=='gametora-2488-unsigned-publication-review-queue'||
    review.automaticallyReleaseApproved!==false||
    !Array.isArray(review.rows)||
    triage?.dataKind!=='phase2-cross-source-publication-triage'||
    triage.publicReleaseApproved!==false||
    !Array.isArray(triage.rows)||
    !obj(review.sourcePins)||!obj(triage.sourcePins)||
    review.sourcePins.gameToraDerived!==normalized.sourcePins?.gameToraDerived||
    review.sourcePins.checkerIndex!==normalized.sourcePins?.checkerIndex||
    triage.sourcePins.gameToraDerived!==normalized.sourcePins.gameToraDerived||
    triage.sourcePins.checkerIndex!==normalized.sourcePins.checkerIndex)
  fail('固定出典の未署名元候補・公開審査・例外台帳が必要');
 const roster=new Set();
 const missing=[];
 for(const card of normalized.cards){
  if(roster.has(card.cardId)||!/^\d{5}$/.test(card.cardId))
   fail('サポカ母集団が不正');
  roster.add(card.cardId);
  if(card.sourceMissing===true){
   if(!Array.isArray(card.events)||card.events.length!==0)
    fail('固定GT欠損カードに元イベントが創作されています');
   missing.push(card.cardId);
  }
 }
 if(JSON.stringify(missing.sort())!==JSON.stringify(EXPECTED_MISSING)||
    triage.rows.length!==review.rows.length)
  fail('固定GTにない4SSRの範囲と審査母集団が一致しない');
 const original=mapByCard(enriched.catalog),before=new Map(),triageByEvent=new Map();
 for(const card of enriched.catalog.cards){
  if(!roster.has(card.cardId)||missing.includes(card.cardId))
   fail('固定GT欠損4SSRのイベントが元GT候補に紛れ込みました');
  for(const event of card.events){
   const k=JSON.stringify([card.cardId,event.id]);
   if(before.has(k))fail('同じカードのイベントIDが重複');
   before.set(k,digest(event));
  }
 }
 if(before.size!==review.rows.length)fail('元GT全イベントの件数が不一致');
 const seenReview=new Set();
 for(const row of review.rows){
  const k=JSON.stringify([row.cardId,row.eventId]);
  if(seenReview.has(k)||before.get(k)!==row.eventSha256||
     row.status!=='PENDING_HUMAN_PUBLICATION_REVIEW'||
     row.releaseApproved!==false)
   fail('GT未署名イベントのSHAと原IDが一致しない');
  seenReview.add(k);
 }
 for(const row of triage.rows){
  const k=JSON.stringify([row.cardId,row.eventId]);
  if(triageByEvent.has(k)||!seenReview.has(k)||
     row.eventSha256!==before.get(k)||row.approved!==false||
     !Array.isArray(row.crossSourceFlags))
   fail('GT出典差異分類とイベント内容SHAが一致しない');
  triageByEvent.set(k,row);
 }
 if(triageByEvent.size!==before.size)fail('一部イベントの出典差異分類が欠けています');
 const specialKey=JSON.stringify(['30080','gt-30080-event-006']);
 const specialTriage=triageByEvent.get(specialKey);
 if(!specialTriage||
    JSON.stringify(specialTriage.crossSourceFlags)!==
      JSON.stringify(['FIXED_GT_PLAYER_CHOICE_TOPOLOGY_INCOMPLETE']))
  fail('SSR30080/6の特定の操作3択不足が出典照合上未確定');
 const fixed=repair30080({catalog:enriched.catalog,normalized,review});
 if(fixed.reviewEvidence.publicationApproved!==false||
    fixed.reviewEvidence.beforeEventSha256!==before.get(specialKey)||
    fixed.reviewEvidence.runtimeSelectedHintRoutes.join(',')!=='0,1,1,1')
  fail('個別3択補正の未署名状態と4つの結果が不正');
 const output=structuredClone(fixed.catalog);
 const after=mapByCard(output);
 for(const card of EXPECTED_MISSING)if(after.has(card))fail('SSRイベントが予期せず重複');
 const additions=buildEight();
 if(additions.status!=='NOT_APPROVED_FOR_PUBLICATION'||
    additions.summary.cards!==4||additions.summary.events!==8||
    additions.summary.choices!==16||additions.summary.hints!==4||
    additions.summary.approvedEvents!==0||
    additions.approvalWorksheet?.entries.length!==8)
  fail('通常8件の個別編集裁定と未署名証跡が不正');
 for(const card of additions.catalog.cards){
  if(!missing.includes(card.cardId)||!roster.has(card.cardId)||
     after.has(card.cardId)||card.coverageStatus!=='partial'||
     card.events.length!==2)
   fail('独立GameWith通常イベントが4SSR外へ結合されました');
  output.cards.push(structuredClone(card));
 }
 const final=mapByCard(output);
 if(final.size!==roster.size||
    [...roster].some(card=>!final.has(card))||
    [...final].some(([id])=>!roster.has(id)))
  fail('563対象カードの配分が変化した');
 let unchanged=0,auto=0,choice=0,choiceOptions=0;
 const skills=new Set(),seen=new Set();
 const collect=value=>{
  if(Array.isArray(value)){value.forEach(collect);return;}
  if(!obj(value))return;
  for(const [k,v] of Object.entries(value)){
   if(k==='skillId'){
    if(typeof v!=='string'||!/^skill:\d+$/.test(v))fail('イベントヒントに無効な数値スキルID');
    skills.add(v);
   }else collect(v);
  }
 };
 for(const card of output.cards){
  for(const event of card.events){
   const key=JSON.stringify([card.cardId,event.id]);
   if(seen.has(key))fail('統合したイベントIDが重複');
   seen.add(key);
   collect(event);
   if(event.type==='auto')auto++;
   else if(event.type==='choice'){choice++;choiceOptions+=event.choices.length;}
   else fail('イベント型が不正');
   if(card.cardId!=='30080'&&
      !missing.includes(card.cardId)&&digest(event)!==before.get(key))
    fail('対象外の元GTイベントが変化しました');
   if(card.cardId==='30080'&&event.id!=='gt-30080-event-006'&&
      digest(event)!==before.get(key))
    fail('SSR30080の別のイベントまで変化しました');
   if(before.has(key)&&key!==specialKey)unchanged++;
  }
 }
 const model={cards:[...roster].map(id=>({id})),
  cardById:Object.fromEntries([...roster].map(id=>[id,{id}])),
  skillById:Object.fromEntries([...skills].map(id=>[id,{id}]))};
 const checked=schema.validateCatalog(output,model);
 if(checked.cardsWithRecords!==roster.size||
    checked.eventsWithRecords!==seen.size)
  fail('統合した候補が本番イベントスキーマを満たさない');
 let testedChoices=0,testedHints=0;
 for(const card of additions.catalog.cards){
  const attached=final.get(card.cardId);
  const runtime={id:card.cardId,hints:[],events:attached.events};
  for(const event of card.events){
   if(core.directRoutes(runtime,{stage:4,choices:{},outcomes:{}})
      .some(x=>x.source==='event'&&x.eventId===event.id))
    fail('通常イベントの未選択ヒントが発生しました');
   for(const selection of event.choices){
    const picked=core.directRoutes(runtime,{stage:4,choices:{
     [event.id]:selection.id},outcomes:{}})
     .filter(x=>x.source==='event'&&x.eventId===event.id);
    const grants=selection.rewards;
    if(picked.length!==grants.length||
       picked.some((x,i)=>x.skillId!==grants[i].skillId||
          x.level!==grants[i].level))
     fail('通常8イベントの結果・選択位置が元採用値と違います');
    testedChoices++;testedHints+=picked.length;
   }
  }
 }
 const extraSet=new Set(additions.catalog.cards.flatMap(c=>c.events.map(e=>e.id)));
 if(testedChoices!==16||testedHints!==4||extraSet.size!==8||
    unchanged!==before.size-1||seen.size!==before.size+8)
  fail('統合した2,496候補の保存則が破損');
 if(strict&&(roster.size!==563||before.size!==2488||seen.size!==2496||
    auto!==892||choice!==1604||
    choiceOptions!==3255||unchanged!==2487))
  fail('固定GTと例外補正を統合した本番候補の全件母数が不一致');
 const catalogSha256=crypto.createHash('sha256')
  .update(JSON.stringify(output)).digest('hex');
 return {
  dataKind:'phase2-nonpublishing-2496-event-assembled-runtime',
  publicationApproved:false,reviewedEventsPublished:0,
  sourceNarrativeOrChoiceProseIncluded:false,noAutomaticRuntimeAdoption:true,
  catalog:output,
  reviewPackets:{
   gameToraUnapprovedEvents:review.rows.length,
   gameWithEightUnapprovedEvents:additions.approvalWorksheet.entries.length,
   correctionSourceEventId:'gt-30080-event-006',
   correctionOldSha256:fixed.reviewEvidence.beforeEventSha256,
   correctionNewSha256:fixed.reviewEvidence.afterEventSha256
  },
  summary:{rosterCards:roster.size,sourceGTCards:original.size,
   missingGTSSR:missing.length,GTSourceEvents:before.size,
   gameWithAddedStandaloneEvents:8,
   adjudicatedChoiceTopologyCorrections:1,
   totalCandidateEvents:seen.size,choiceEvents:choice,autoEvents:auto,
   choiceOptions,unchangedGTEvents:unchanged,
   gameWithChoiceOptionsValidated:testedChoices,
   gameWithSkillHintsValidated:testedHints,approvedEvents:0,
   catalogSha256}
 };
}
module.exports={build};
