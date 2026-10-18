/* Runtime provenance and completeness view, independent of data loading.
 * A valid empty event catalog MUST NOT look like a failed catalog load. */
(function(g){
'use strict';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const stages=['0','1','2','3','4'];
function allStages(obj,test){
 return !!obj&&typeof obj==='object'&&stages.every(s=>own(obj,s)&&test(obj[s]));
}
function hintStageComplete(c){
 return allStages(c?.hintsByStage,Array.isArray);
}
function perfStageComplete(c){
 return allStages(c?.hintPerformanceByStage,p=>!!p&&
  ['levelBase','levelUnique','frequencyBase','frequencyUnique'].every(k=>Number.isSafeInteger(p[k])));
}
function modeLabel(mode,kind){
 if(kind==='event'){
  if(mode==='reviewed')return '公開JSONの検証成功';
  if(mode==='preview')return '未承認イベント試用中（公開承認0件）';
  if(mode==='preview-failed')return '公開JSONは正常・試用データ検証失敗';
  if(mode==='failed')return '公開JSONの検証失敗・未反映';
  return '検証状況不明';
 }
 if(mode==='online')return '公開元から取得・検証';
 if(mode==='cached')return '保存済み検証データを利用';
 if(mode==='unavailable')return '取得できず・未適用';
 return '取得状態不明';
}
function summarize(model){
 if(!model||!Array.isArray(model.cards)||!Array.isArray(model.skills)||!model.meta)
  throw Error('表示用データの構造が不正です');
 const m=model.meta,src=m.runtimeSources||{};
 const cardMode=src.cards?.mode||m.dataMode||'unknown';
 const skillMode=src.skills?.mode||'unknown';
 // Failed loading is not an empty validated catalog. The old model
 // eventStatus field is only a fallback for earlier embedded fixtures.
 const eventMode=src.events?.mode||
  (m.eventStatus==='reviewed-empty'||m.eventStatus==='reviewed-partial'?'reviewed':'unknown');
 const rows=model.cards;
 const eventsVerified=eventMode==='reviewed';
 const eventRecords=eventsVerified&&Number.isSafeInteger(m.reviewedEventRecords)?m.reviewedEventRecords:null;
 const eventCards=eventsVerified&&Number.isSafeInteger(m.reviewedEventCards)?m.reviewedEventCards:null;
 const hierarchy=m.skillHierarchy||null;
 return {
  cards:{mode:cardMode,label:modeLabel(cardMode),
   sourceUrl:src.cards?.url||m.sourceUrl||null,
   fetchedAt:src.cards?.fetchedAt||m.fetchedAt||null,
   checkedAt:src.cards?.checkedAt||m.checkedAt||null,
   count:rows.length,
   hints4:Number.isSafeInteger(m.totalHints)?m.totalHints:null,
   stageComplete:rows.filter(hintStageComplete).length,
   hintPerformanceComplete:rows.filter(perfStageComplete).length},
  skills:{mode:skillMode,label:modeLabel(skillMode),sourceUrl:src.skills?.url||null,
   fetchedAt:src.skills?.fetchedAt||null,count:model.skills.length,
   hierarchyPairs:hierarchy&&Number.isSafeInteger(hierarchy.linked)?hierarchy.linked:null,
   hierarchyTotal:hierarchy&&Number.isSafeInteger(hierarchy.totalRare)?hierarchy.totalRare:null},
  events:{mode:eventMode,label:modeLabel(eventMode,'event'),
   sourceUrl:src.events?.url||null,records:eventRecords,cards:eventCards,
   attachedRecords:rows.reduce((total,c)=>total+(Array.isArray(c.events)?c.events.length:0),0)},
  disclaimer:'取得日時はブラウザが元データを受信した日時で、ゲームでの更新日・現行ゲーム全件の網羅率ではありません。公開済みイベント0件と、公開JSONを検証できなかった状態は別です。ヒントの5段階構造が揃っていても独立資料で全ゲームデータを照合した意味ではありません。'
 };
}
const api={summarize,hintStageComplete,perfStageComplete,modeLabel};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaSourceHealth=api;
})(typeof globalThis!=='undefined'?globalThis:this);
