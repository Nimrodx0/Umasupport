'use strict';
/*
 * Editorially adopted NUMERIC facts, not a release catalog or runtime input.
 * Pinned GT lacks 30318-30321. This ledger records only the GameWith
 * exception facts already established in the independent four-SSR review.
 * It deliberately does not generate "auto" runtime routes: an observed
 * no-choice event is not proof of unconditional availability/reachability.
 */
const {REVIEW}=require('./phase2_four_ssr_editorial_review.cjs');
const {evaluateException}=require('./event_exception_adjudication.cjs');
const fail=s=>{throw Error('GameWith例外の編集採用台帳: '+s);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const PIN={gameToraDerived:'6e38b54af4fad397ff4491e63007a90705a4fe67',
 checker:'8cf9fcb3cc7239041161be75c84daf9f8f22d29f',
 independentSkills:'0cacbb1aaf9dca10283d5b9ea20b205b9d204535'};
const ROOT_FIELDS=['schemaVersion','dataKind','sourcePins','sourceProseIncluded',
 'game2026Verified','publicationApproved','noAutomaticRuntimeAdoption','cards'];
const ADOPTED_FIELDS=['sourceOrdinal','decision','playerSelectableChoiceCount',
 'reportedSingleResult','numericEffects','skillHints','gameToraLivePage',
 'gameWithArticle','checkedAt','priorStageDependenceVerified',
 'game2026Verified','publicationApproved'];
const PENDING_FIELDS=['sourceOrdinal','decision','missing','publicationApproved'];
function exactKeys(o,keys,where){
 if(!object(o)||!same(Object.keys(o).sort(),[...keys].sort()))
  fail(where+': 追加・欠落フィールドは禁止');
}
function validate(doc){
 exactKeys(doc,ROOT_FIELDS,'root');
 if(doc.schemaVersion!==1||doc.dataKind!=='phase2-adjudicated-numeric-event-ledger'||
    !same(doc.sourcePins,PIN)||doc.sourceProseIncluded!==false||
    doc.game2026Verified!==false||doc.publicationApproved!==false||
    doc.noAutomaticRuntimeAdoption!==true||!Array.isArray(doc.cards)||
    doc.cards.length!==REVIEW.length)
  fail('固定版・未公開・4枚の境界が不正');
 const expected=new Map(REVIEW.map(c=>[c.cardId,c])),seen=new Set();
 const totals={sourceCards:0,sourcePositions:0,adoptedNumericalEvents:0,
  pendingRoutePositions:0,adoptedSkillHintFacts:0,
  adoptedNonSkillEffectFacts:0,pendingSkillHintMentions:0,publishedEvents:0};
 for(const card of doc.cards){
  exactKeys(card,['cardId','events'],'card');
  const ref=expected.get(card.cardId);
  if(!ref||seen.has(card.cardId)||!Array.isArray(card.events)||
     card.events.length===ref.optionRows.length)
   { // length equality is checked below; keep explicit failure for invalid.
    if(!ref||seen.has(card.cardId)||!Array.isArray(card.events)||
       card.events.length!==ref.optionRows.length)
     fail('4SSRまたはイベント位置が欠落・重複');
   }
  seen.add(card.cardId);totals.sourceCards++;
  for(let index=0;index<ref.optionRows.length;index++){
   const event=card.events[index],ordinal=index+1;
   if(!object(event)||event.sourceOrdinal!==ordinal)
    fail(card.cardId+': Checker元イベント位置に欠落・入替');
   totals.sourcePositions++;
   const decision=(ref.gameWithAdjudications||[]).find(e=>e.checkerOrdinal===ordinal);
   if(decision){
    exactKeys(event,ADOPTED_FIELDS,card.cardId+'/'+ordinal);
    if(event.decision!=='GAMEWITH_NUMERIC_FACTS_ADOPTED'||
       event.playerSelectableChoiceCount!==0||event.reportedSingleResult!==true||
       event.priorStageDependenceVerified!==false||
       event.game2026Verified!==false||event.publicationApproved!==false||
       event.gameToraLivePage!==ref.references.gameTora||
       event.gameWithArticle!==ref.references.gameWith||
       event.checkedAt!=='2026-10-22'||
       !same(event.numericEffects,decision.reportedRewardFacts.map(
        ([kind,value])=>({kind,value})))||
       !same(event.skillHints,decision.reportedHintFacts.map(
        ([skillNumericId,hintLevel])=>({skillNumericId,hintLevel}))))
      fail(card.cardId+'/'+ordinal+': GameWith採用事実が既存裁定と一致しない');
    const verified=evaluateException({
     cardId:card.cardId,sourceEventOrdinal:ordinal,baseline:'MISSING',
     gtWebsite:{url:event.gameToraLivePage,checkedAt:event.checkedAt,
      status:'EVENT_LIST'},
     gameWith:{url:event.gameWithArticle,checkedAt:event.checkedAt,
      factStatus:'EXPLICIT',facts:{
       playerSelectableChoiceCount:event.playerSelectableChoiceCount,
       reportedEffects:event.numericEffects,
       reportedSkillHints:event.skillHints
      }},
     proposedDecision:'ADOPT'
    });
    if(verified.status!=='GAMEWITH_ADJUDICATED_GT_GAP'||
       verified.editorialDecisionComplete!==true||
       verified.publicationApproved!==false)
     fail('採用事実の裁定器・公開状態が不正');
    totals.adoptedNumericalEvents++;
    totals.adoptedSkillHintFacts+=event.skillHints.length;
    totals.adoptedNonSkillEffectFacts+=event.numericEffects.length;
   }else{
    exactKeys(event,PENDING_FIELDS,card.cardId+'/'+ordinal);
    if(event.decision!=='PENDING_ROUTE_REVIEW'||
       event.missing!=='PLAYER_CHOICE_OR_RESULT_REWARD_SEMANTICS'||
       event.publicationApproved!==false)
     fail(card.cardId+'/'+ordinal+': 未裁定を確定ルートへ変更');
    totals.pendingRoutePositions++;
    totals.pendingSkillHintMentions+=ref.hints.filter(h=>h[0]===ordinal).length;
   }
  }
 }
 if(seen.size!==4||totals.sourcePositions!==20||
    totals.adoptedNumericalEvents!==2||
    totals.pendingRoutePositions!==18||
    totals.adoptedSkillHintFacts!==1||
    totals.pendingSkillHintMentions!==11||
    totals.adoptedNonSkillEffectFacts!==5)
  fail('既存SSR20イベント・12ヒントの保存則が不一致');
 return totals;
}
module.exports={validate};
