'use strict';
/*
 * Explicit stage-by-stage review of the twelve editorially adopted chain
 * STAGES. This is NOT an inferred chain graph or a publication decision.
 * A consumer must require independent user assertion of each stage reached.
 */
const {audit}=require('./phase2_chain_manual_replay.cjs');
const {buildView}=require('./phase2_eight_event_review_view.cjs');
const fail=s=>{throw Error('Phase2連続12段階のPages試用: '+s);};
function build(){
 const source=audit(), regular=buildView();
 if(source.summary.sourceCards!==4||source.summary.chainStages!==12||
    source.summary.reportedChainAlternatives!==19||
    source.summary.unresolvedPossibleTransitions!==15||
    source.summary.establishedTransitions!==0||
    source.summary.numericChainSkillHintFacts!==8||
    source.summary.publicEvents!==0||
    source.summary.chainDependenciesVerified!==false||
    source.summary.publicationApproved!==false||
    regular.summary.events!==8||regular.summary.hintMentions!==4||
    regular.summary.approvedEvents!==0)
  fail('固定4SSR連続段階・通常デモの数値母集団が変更されました');
 let stages=0,alternatives=0,hints=0,pendingEdges=0;
 const cards=regular.cards.map(meta=>{
  const card=source.cards.get(meta.cardId);
  if(!card||card.events.length!==5||
     !/^https:\/\/gamewith\.jp\/uma-musume\/article\/show\/\d+$/.test(card.gameWith.url))
   fail('出典記事または4SSRのイベント対応が不正');
  const events=card.events.slice(0,3).map((e,i)=>{
   if(e.ordinal!==i+1||e.section!=='CHAIN'||
      e.chainPrerequisitesVerified!==false||
      ![0,2].includes(e.choiceCount)||e.alternatives.length!==(e.choiceCount||1))
    fail('前段の関係とゲーム側の選択肢数が確認されていない');
   stages++;
   if(i<2){
    const edges=source.transitions.filter(x=>x.cardId===meta.cardId&&
     x.stageOrdinal===e.ordinal);
    if(edges.length!==e.alternatives.length||
       edges.some(x=>x.continuationStatus!=='NOT_ESTABLISHED_BY_SOURCE'||
        x.terminationStatus!=='NOT_ESTABLISHED_BY_SOURCE'||
        x.nextStageOrdinal!==i+2))
     fail('不明な連続イベント遷移を自動確定できません');
    pendingEdges+=edges.length;
   }
   return {
    id:'usl:'+meta.cardId+':chain:'+e.ordinal,
    ordinal:e.ordinal,choiceCount:e.choiceCount,
    manualReachedRequired:true,priorStageDependenceVerified:false,
    nextStageTransitionStatus:i<2?'UNKNOWN':'NOT_MODELED',
    sourceUrl:card.gameWith.url,
    alternatives:e.alternatives.map((alt,j)=>{
     if(alt.ordinal!==j+1||!Array.isArray(alt.effects)||
        !Array.isArray(alt.skillHints))fail('固定結果行の構造が不正');
     alternatives++;hints+=alt.skillHints.length;
     return {
      id:'option'+(j+1),
      effects:alt.effects.map(effect=>{
       if(typeof effect.kind!=='string'||!Number.isSafeInteger(effect.value))
        fail('数値効果の不一致');
       return [effect.kind,effect.value];
      }),
      hints:alt.skillHints.map(h=>{
       if(!Number.isSafeInteger(h.skillNumericId)||h.skillNumericId<=0||
          !Number.isSafeInteger(h.hintLevel)||h.hintLevel<1||
          h.verifiedSkillName!==undefined&&
          (typeof h.verifiedSkillName!=='string'||!h.verifiedSkillName))
        fail('採用済み数値ヒントのID/Lv/名称が不正');
       // A name is displayed only if already independently reviewed;
       // otherwise the actual numeric ID is displayed, never a guess.
       return ['skill:'+h.skillNumericId,h.hintLevel,
        h.verifiedSkillName||'スキルID '+h.skillNumericId];
      })
     };
    })
   };
  });
  return {cardId:meta.cardId,name:meta.displayName,events};
 });
 if(stages!==12||alternatives!==19||hints!==8||pendingEdges!==15)
  fail('12段階・19報酬行・8スキルヒント・15未確証遷移が不一致');
 return {
  schemaVersion:1,dataKind:'phase2-twelve-manual-chain-stage-browser-review',
  previewOnly:true,formallyApproved:false,gameplayReproductionClaimed:false,
  sourceNarrativeOrChoiceProseIncluded:false,
  inferredChainTransitions:0,unresolvedPossibleTransitions:15,
  explicitStageAssertionRequired:true,
  cards
 };
}
module.exports={build};
