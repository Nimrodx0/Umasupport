'use strict';
/*
 * Read-only, no-inquiry publication feasibility inventory. Accepts the
 * already built PRIVATE final catalog, its existing strict title/placeholder
 * projection, and the independently audited stage-lineage report.
 *
 * The returned report contains NUMBERS AND FIXED STATUS TOKENS ONLY. It
 * contains no event text, raw source data, skill names, event IDs or hashes
 * that might accidentally encourage publication of an unapproved dataset.
 * The result is an evidence worklist, NEVER a license or legality finding.
 */
const {project}=require('./phase2_title_choice_projection.cjs');
const {index}=require('./phase2_source_lineage_audit.cjs');
const {canonical}=require('./event_release_gate.cjs');
const fail=reason=>{throw Error('問い合わせなし公開範囲監査: '+reason);};
const idOf=(cardId,eventId)=>JSON.stringify([cardId,eventId]);
const stats=()=>({
 events:0,eventTitlesRetained:0,choiceEvents:0,choicePositions:0,
 outcomePositions:0,eventsWithPrerequisites:0,terminalBranches:0,
 skillRewardRows:0,verifiedSkillNameRows:0,nonSkillEffectRows:0,
 statusEffectRows:0,dynamicEffectRows:0,sourceOrdinalReferences:0
});
function collect(part,out){
 if(part.terminal===true)out.terminalBranches++;
 for(const row of part.rewards||[]){
  out.skillRewardRows++;
  if(typeof row.verifiedSkillName==='string')out.verifiedSkillNameRows++;
 }
 for(const row of part.effects||[]){
  out.nonSkillEffectRows++;
  if(row.sourceEffectOrdinal!==undefined)out.sourceOrdinalReferences++;
 }
 for(const row of part.statusEffects||[]){
  out.statusEffectRows++;
  if(row.sourceEffectOrdinal!==undefined)out.sourceOrdinalReferences++;
 }
 out.dynamicEffectRows+=(part.dynamicEffects||[]).length;
 for(const outcome of part.outcomes||[]){
  out.outcomePositions++;collect(outcome,out);
 }
}
function report({catalog,projection,lineage},{strict=false}={}){
 if(!catalog||!projection||!lineage||
    !Array.isArray(lineage.curatedOnlyEventIds)||
    !Array.isArray(lineage.crossSourceGtExceptionIds))
  fail('最終候補・厳密表記変換・元出典系譜が必要');
 // Reuse the existing allowlist and provisional-label transform. It already
 // blocks unknown prose fields and replaces all choice/result labels.
 const expected=project(catalog).catalog;
 if(canonical(expected)!==canonical(projection))
  fail('出典候補と最終公開形が異なる');
 const raw=index(catalog,'原候補'),visible=index(projection,'仮称化後');
 if(raw.size!==visible.size||[...raw.keys()].some(key=>!visible.has(key)))
  fail('表記変換にイベントの追加・欠落・ID移動がある');
 const cross=new Set(lineage.crossSourceGtExceptionIds.map(x=>idOf(x.cardId,x.eventId)));
 const curated=new Set(lineage.curatedOnlyEventIds.map(x=>idOf(x.cardId,x.eventId)));
 if(cross.size!==lineage.crossSourceGtExceptionIds.length||
    curated.size!==lineage.curatedOnlyEventIds.length||
    [...cross].some(k=>curated.has(k)||!raw.has(k))||
    [...curated].some(k=>!raw.has(k)))
  fail('出典横断編集例外の重複・欠落');
 const groups={
  gtDerived:stats(),gtWithCrossSourceEdit:stats(),crossSourceAdded:stats()
 };
 for(const [cardIndex,card] of catalog.cards.entries()){
  const proj=projection.cards[cardIndex];
  if(proj.cardId!==card.cardId||proj.events.length!==card.events.length)
   fail('カード／イベント収録範囲が不一致');
  for(const [eventIndex,event] of card.events.entries()){
   const view=proj.events[eventIndex];
   if(event.id!==view.id||event.name!==view.name||event.type!==view.type)
    fail('表示用イベント名・ID・種類が異なる');
   const key=idOf(card.cardId,event.id);
   const group=curated.has(key)?groups.crossSourceAdded:
     cross.has(key)?groups.gtWithCrossSourceEdit:groups.gtDerived;
   if(group===groups.gtDerived&&!event.id.startsWith('gt-')||
      group===groups.gtWithCrossSourceEdit&&!event.id.startsWith('gt-')||
      group===groups.crossSourceAdded&&!event.id.startsWith('usl:'))
    fail('系列別コホートのID形式が不一致');
   group.events++;group.eventTitlesRetained++;
   if(event.requires!==undefined)group.eventsWithPrerequisites++;
   if(event.type==='choice'){
    group.choiceEvents++;
    if(!Array.isArray(event.choices)||event.choices.length!==view.choices.length)
     fail('選択肢位置が変わった');
    for(const [i,ch] of event.choices.entries()){
     group.choicePositions++;
     if(view.choices[i].id!==ch.id||
        view.choices[i].label!=='選択肢'+(i+1)+'（仮）')
      fail('選択肢の原文が残るかID・位置が変化');
     collect(ch,group);
    }
   }else collect(event,group);
  }
 }
 const sum=name=>Object.values(groups).reduce((n,r)=>n+r[name],0);
 if(sum('events')!==raw.size||sum('outcomePositions')!==
   (Object.values(groups).reduce((n,r)=>n+r.outcomePositions,0)))
  fail('計測対象イベント数に欠落');
 if(strict&&(raw.size!==2512||sum('eventTitlesRetained')!==2512||
    groups.gtDerived.events!==2487||
    groups.gtWithCrossSourceEdit.events!==1||
    groups.crossSourceAdded.events!==24||
    sum('choicePositions')!==3269||sum('outcomePositions')!==512))
  fail('固定563枚／2512件の審査用母集団が変わった');
 return {
  status:'NO_INQUIRY_PUBLICATION_DEPENDENCY_INVENTORY_ONLY',
  groups,
  total:{...Object.fromEntries(Object.keys(stats()).map(k=>[k,sum(k)]))},
  disclosureBoundaries:{
   optionAndOutcomeWording:'replaced-by-positional-labels',
   eventTitles:'retained-from-derived-source',
   skillNames:'retained-for-verified-ID-display',
   selectionOrderAndRelationships:'inherited-from-source-facts-and-editorial-joins',
   sourceTermsAndDatabaseSelection:'not-independently-cleared',
   noInquiryLegalConclusion:'not-established',
   sourceWordingPublished:false,publicEventsAdded:0,
   licenseOrPublicationApproved:false
  }
 };
}
module.exports={report};
