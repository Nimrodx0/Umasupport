'use strict';
/*
 * The actual public-event skill-name preflight and model attachment, run
 * for 2511 PRIVATE candidate events on a disposable in-memory card model.
 * No event content or source prose is emitted/published by this module.
 */
const crypto=require('node:crypto');
const loader=require('./public_event_catalog.js');
const core=require('./core.js');
const {build:buildChain}=require('./phase2_chain_plan_build.cjs');
const fail=s=>{throw Error('Phase2全2511件読込監査: '+s);};
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function accept({assembled,model,skillText},{strict=false}={}){
 if(assembled?.dataKind!=='phase2-2511-nonpublishing-gt-and-curated-chain-runtime'||
    assembled.publicationApproved!==false||assembled.reviewedEventsPublished!==0||
    assembled.noAutomaticRuntimeAdoption!==true||
    assembled.sourceNarrativeOrChoiceProseIncluded!==false||
    assembled.catalog?.schemaVersion!==1||
    !Array.isArray(assembled.catalog.cards)||
    assembled.summary?.catalogSha256!==hash(assembled.catalog)||
    assembled.summary.rosterCards!==model?.cards?.length||
    !model?.cardById||!model?.skillById||
    typeof skillText!=='string'||skillText.length<100)
  fail('統合候補の元SHA・未承認状態・スキル辞書が不正');
 const beforeModelHash=hash(model),beforeCatalogHash=hash(assembled.catalog);
 const result=loader.preflight(model,assembled.catalog,{skillText,fullRegistry:false});
 if(result.summary.cardsWithRecords!==assembled.summary.rosterCards||
    result.summary.eventsWithRecords!==assembled.summary.totalCandidateEvents)
  fail('全カード・イベント件数が辞書照合前後で不一致');
 const temporary=JSON.parse(JSON.stringify(model));
 temporary.cards=temporary.cards.map(c=>temporary.cardById[c.id]||c);
 const attached=loader.attach(temporary,assembled.catalog,{skillText,fullRegistry:false});
 if(attached.eventsWithRecords!==result.summary.eventsWithRecords||
    attached.cardsWithRecords!==result.summary.cardsWithRecords||
    temporary.meta?.eventStatus!=='reviewed-partial')
  fail('本番イベントattachが一時モデルで失敗');
 const attachedCatalog={schemaVersion:1,
  cards:result.prepared.catalog.cards.map(c=>({
   cardId:c.cardId,coverageStatus:c.coverageStatus,
   events:temporary.cardById[c.cardId]?.events
  }))};
 if(hash(attachedCatalog)!==hash(result.prepared.catalog)||
    hash(model)!==beforeModelHash||hash(assembled.catalog)!==beforeCatalogHash)
  fail('preflight/attachの内容SHAまたは元モデルが不正');
 const plan=buildChain();
 let stages=0,options=0,hints=0,flags=0;
 for(const sourceCard of plan.cards){
  const card=temporary.cardById[sourceCard.cardId];
  if(!card)fail('5枚の連続補完カードが本番モデルに存在しない');
  const chain=sourceCard.events.map(source=>{
   const found=card.events.find(e=>e.id===source.id);
   if(!found||found.name!==source.title)fail('GameWith短見出しと本番カードが不一致');
   return found;
  });
  for(const [i,event] of chain.entries()){
   const src=sourceCard.events[i];stages++;
   if(i>0&&JSON.stringify(event.requires)!==
      JSON.stringify({all:[{eventId:chain[i-1].id}]}))
    fail('連続イベントの直前段階フラグを保持していない');
   if(i<2){
    for(const edge of src.nextStageEdges){
     flags++;
     if(!edge.setsNextStageFlag||edge.terminal)fail('通常継続フラグが喪失');
    }
   }
   for(const a of src.alternatives){
    options++;hints+=a.hints.length;
    const choiceState={};
    for(const prior of chain.slice(0,i))if(prior.type==='choice')
     choiceState[prior.id]=prior.choices[0].id;
    if(event.type==='choice')choiceState[event.id]=a.id;
    const routes=core.directRoutes(card,{stage:4,choices:choiceState,outcomes:{}})
     .filter(r=>r.source==='event'&&r.eventId===event.id);
    if(routes.length!==a.hints.length||
       routes.some((r,j)=>r.skillId!==a.hints[j][0]||
        r.level!==a.hints[j][1]))
     fail('本番辞書解決後にルート別スキルID/Lvが変化: '+
      sourceCard.cardId+'/'+event.id+'/'+a.id+
      ' expected='+JSON.stringify(a.hints.map(h=>[h[0],h[1]]))+
      ' actual='+JSON.stringify(routes.map(r=>[r.skillId,r.level])));
   }
  }
 }
 if(stages!==15||options!==22||hints!==9||flags!==17||
    assembled.summary.appendedChainStages!==stages||
    assembled.summary.enabledChainFlags!==flags)
  fail('新規15段階／17解放フラグ／9ヒントの全件数値監査に失敗');
 if(strict&&(assembled.summary.rosterCards!==563||
    assembled.summary.unchangedSourceEvents!==2496||
    assembled.summary.totalCandidateEvents!==2511))
  fail('563枚・2,511件の固定全件スキル名照合が不正');
 return {
  status:'NONPUBLIC_2511_PRODUCTION_LOADER_ACCEPTED',
  publicationApproved:false,modelMutated:false,
  attachedOnlyToDisposableModel:true,actualEventOccurrenceModeled:false,
  summary:{
   cards:attached.cardsWithRecords,events:attached.eventsWithRecords,
   appendedChainStages:stages,appendedAlternativeRows:options,
   appendedSkillHints:hints,continuationFlagsVerified:flags,
   registryMatchedHints:result.prepared.matchedHints,
   independentlyRegisteredSkillRecords:result.prepared.skills.length,
   inputCatalogSha256:beforeCatalogHash,
   attachedCatalogSha256:hash(attachedCatalog)
  }
 };
}
module.exports={accept};
