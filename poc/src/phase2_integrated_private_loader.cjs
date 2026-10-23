'use strict';
/*
 * Production event-loader acceptance for the ENTIRE PRIVATE 2496 event
 * candidate on a DISPOSABLE cloned 563-card runtime model.
 *
 * public_event_catalog.attach() internally marks a successful catalog
 * "reviewed-partial". This status exists only in the THROWAWAY CLONE:
 * neither source model nor public DB is ever mutated or published here.
 */
const crypto=require('node:crypto');
const publicCatalog=require('./public_event_catalog.js');
const core=require('./core.js');
const fail=s=>{throw Error('Phase2全件本番ローダーの非公開受入: '+s);};
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const four=new Set(['30318','30319','30320','30321']);
function acceptance({assembled,model,skillText},{strict=false}={}){
 if(assembled?.dataKind!=='phase2-nonpublishing-2496-event-assembled-runtime'||
    assembled.publicationApproved!==false||
    assembled.noAutomaticRuntimeAdoption!==true||
    assembled.reviewedEventsPublished!==0||
    assembled.sourceNarrativeOrChoiceProseIncluded!==false||
    assembled.catalog?.schemaVersion!==1||
    !Array.isArray(assembled.catalog.cards)||
    !obj(assembled.summary)||
    assembled.summary.catalogSha256!==hash(assembled.catalog)||
    !Array.isArray(model?.cards)||!obj(model.cardById)||
    !obj(model.skillById)||typeof skillText!=='string'||skillText.length<100||
    assembled.summary.rosterCards!==model.cards.length)
  fail('GTとGameWithを統合した元モデル・出典SHA・スキル辞書が不正');
 const modelBefore=hash(model);
 const sourceCatalogBefore=hash(assembled.catalog);
 // The very same preflight that loads approved public data checks numeric
 // ID, rarity and independently verified names for EVERY reward.
 const {prepared,summary}=publicCatalog.preflight(model,assembled.catalog,{
  skillText,fullRegistry:false});
 if(summary.cardsWithRecords!==assembled.summary.rosterCards||
    summary.eventsWithRecords!==assembled.summary.totalCandidateEvents)
  fail('公開ローダーの名前・数字照合後にイベント数が変化');
 const temporary=JSON.parse(JSON.stringify(model));
 // Keep both indexed and ordered cards referencing the same objects.
 temporary.cards=temporary.cards.map(x=>temporary.cardById[x.id]||x);
 const actual=publicCatalog.attach(temporary,assembled.catalog,{
  skillText,fullRegistry:false});
 if(actual.cardsWithRecords!==summary.cardsWithRecords||
    actual.eventsWithRecords!==summary.eventsWithRecords||
    temporary.meta.eventStatus!=='reviewed-partial')
  fail('実本番アタッチの件数または開発用モデル状態が不正');
 const attached={schemaVersion:1,cards:prepared.catalog.cards.map(c=>({
  cardId:c.cardId,coverageStatus:c.coverageStatus,
  events:temporary.cardById[c.cardId]?.events
 }))};
 const preparedHash=hash(prepared.catalog);
 if(hash(attached)!==preparedHash||
    hash(assembled.catalog)!==sourceCatalogBefore||
    hash(model)!==modelBefore)
  fail('本番読込後の結果がpreflightと不一致、または元データが破壊された');
 // Exercise each of the independently adjudicated eight choice events
 // THROUGH THE ACTUALLY ATTACHED CARD MODEL (after numeric ID resolution).
 let extraCards=0,extraEvents=0,extraChoices=0,extraHints=0;
 for(const id of four){
  const card=temporary.cardById[id];
  if(!card||!Array.isArray(card.events))continue;
  if(card.events.length!==2)fail('追加4SSRの通常イベント数が変化');
  extraCards++;
  for(const ev of card.events){
   if(!['usl:'+id+':random:4','usl:'+id+':random:5'].includes(ev.id)||
      ev.type!=='choice'||ev.choices.length!==2)
    fail('通常イベントの実読込時に元位置が不正');
   extraEvents++;
   const blank=core.directRoutes(card,{
    stage:4,choices:{},outcomes:{}
   }).filter(x=>x.source==='event'&&x.eventId===ev.id);
   if(blank.length)fail('未選択の通常イベントから報酬が混入');
   for(const ch of ev.choices){
    extraChoices++;
    const selected=core.directRoutes(card,{
     stage:4,choices:{[ev.id]:ch.id},outcomes:{}
    }).filter(x=>x.source==='event'&&x.eventId===ev.id);
    if(selected.length!==ch.rewards.length||
       selected.some((x,i)=>
        x.skillId!==ch.rewards[i].skillId||
        x.level!==ch.rewards[i].level))
     fail('数値ID変換後の選択経路とヒントLvの対応が不正');
    extraHints+=selected.length;
   }
  }
 }
 if(strict&&(temporary.cards.length!==563||
    summary.eventsWithRecords!==2496||
    extraCards!==4||extraEvents!==8||
    extraChoices!==16||extraHints!==4))
  fail('固定563枚／統合2,496件の本番ローダー全件受入ゲート不一致');
 return {
  status:'PRIVATE_PRODUCTION_LOADER_ACCEPTED',
  attachesOnlyToDisposableModel:true,
  temporaryRuntimeMarkedReviewedButNotPublished:true,
  approvedEvents:0,sourceProseIncluded:false,
  summary:{
   cards:summary.cardsWithRecords,events:summary.eventsWithRecords,
   extraCards,extraEvents,extraChoices,extraHints,
   registryMatchedHints:prepared.matchedHints,
   newSkillRecords:prepared.skills.length,
   originalCatalogSha256:sourceCatalogBefore,
   attachedPreparedCatalogSha256:preparedHash
  }
 };
}
module.exports={acceptance};
