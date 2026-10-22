'use strict';
/*
 * Precisely reviewed event identity aliases; metadata hashes only.
 * This does NOT transfer event reward authority, certify current gameplay,
 * or publish source event titles. Restrict to pinned one-to-one source cases.
 */
const fail=msg=>{throw Error('Phase2 P0イベント同定: '+msg);};
const CASES=Object.freeze([
 {
  cardId:'30139',checkerOrdinal:3,sourceKey:'checker:30139:1fb0bc07b47e6c3519b2',
  sourceOrdinal:5,gtLocalId:857,section:'arrows',checkerChoices:1,gtChoices:1,
  checkerTitleSha:'sha256:ffedb2a1ae173a568bb652c1478302066f461ef6697904dd0a2dcf10afd8df23',
  gtTitleSha:'sha256:c03ac5ed70e5afb12487bb27aa5b85cb3e61250f4c768c491616c50a4be0da3c',
  evidence:[
   'https://gamewith.jp/uma-musume/article/show/393389',
   'https://game8.jp/umamusume/520179'
  ],
  decision:'SAME_EVENT_KANJI_VARIANT',hintId:202581,hintLevels:[3,1]
 },
 {
  cardId:'30198',checkerOrdinal:1,sourceKey:'checker:30198:e7635856789a93b65b31',
  sourceOrdinal:3,gtLocalId:1017,section:'arrows',checkerChoices:2,gtChoices:2,
  checkerTitleSha:'sha256:00521f8a7574bb8953742b9f60939a03605787fd953cc12ebb5a0f9353e13ee4',
  gtTitleSha:'sha256:b375c832551b3b98b540b52b5f143eccf24785e059426aec62d869b37d944d51',
  evidence:[
   'https://gamewith.jp/uma-musume/article/show/444503',
   'https://game8.jp/umamusume/603618'
  ],
  decision:'SAME_EVENT_ABBREVIATED_TITLE'
 }
]);
function applyReviewedAliases({cardId,checkerEvents,gtEvents,rawGtEvents,paired}){
 if(!Array.isArray(checkerEvents)||!Array.isArray(gtEvents)||!paired||
    !Array.isArray(paired.selected)||!Array.isArray(paired.unmatchedC)||
    !Array.isArray(paired.unmatchedG))fail('元索引の形式が不正');
 const cases=CASES.filter(x=>x.cardId===cardId);
 if(!cases.length)return {paired,matched:[]};
 const selected=[...paired.selected],
   unmatchedC=new Set(paired.unmatchedC),
   unmatchedG=new Set(paired.unmatchedG),matched=[];
 for(const rule of cases){
  const cIdx=rule.checkerOrdinal-1,gIdx=rule.sourceOrdinal-1;
  const c=checkerEvents[cIdx],g=gtEvents[gIdx],original=rawGtEvents?.[gIdx];
  if(!unmatchedC.has(cIdx)||!unmatchedG.has(gIdx)||
     !c||!g||!original||c.sourceKey!==rule.sourceKey||
     c.sourceIndex!==cIdx||c.strict!==rule.checkerTitleSha||
     g.strict!==rule.gtTitleSha||
     c.optionCount!==rule.checkerChoices||
     g.choiceCount!==rule.gtChoices||
     g.sourceOrdinal!==rule.sourceOrdinal||
     g.sourceLocalEventId!==rule.gtLocalId||
     g.section!==rule.section||
     original.id!==rule.gtLocalId||original.section!==rule.section||
     original.choices?.length!==rule.gtChoices)
    fail('個別のタイトル・カードID・元の選択/結果構造が変更されています: '+cardId);
  if(rule.decision==='SAME_EVENT_KANJI_VARIANT'){
   const choice=original.choices[0];
   const hints=choice?.outcomes?.map(outcome=>
    outcome.filter(e=>e.type==='skill_hint').map(e=>[e.skill_id,e.value]));
   if(choice.label!==''||choice.random_either!==true||
      hints?.length!==2||hints.some((h,i)=>h.length!==1||
       h[0][0]!==rule.hintId||h[0][1]!=='+'+rule.hintLevels[i]))
    fail('大成功／成功のヒントLvが変化した: '+cardId);
  }else if(rule.decision==='SAME_EVENT_ABBREVIATED_TITLE'){
   if(original.choices[0].label===''||
      original.choices[1].label===''||
      (original.choices[0].effects||[]).some(x=>x.type==='chain_end')||
      !(original.choices[1].effects||[]).some(x=>x.type==='chain_end'))
    fail('前段イベントの選択肢別終了状態が変化した: '+cardId);
  }else fail('不明な同定の根拠');
  unmatchedC.delete(cIdx);unmatchedG.delete(gIdx);
  selected.push({ci:cIdx,gi:gIdx,status:'reviewed-alias-paired',reviewEvidence:{
   decision:rule.decision,
   evidenceUrls:rule.evidence,sourceRevisionPinned:true,
   currentGameVerified:false,publicationApproved:false
  }});
  matched.push({cardId,sourceKey:rule.sourceKey,checkerOrdinal:rule.checkerOrdinal,
   sourceOrdinal:rule.sourceOrdinal,gtLocalId:rule.gtLocalId,
   decision:rule.decision,evidenceUrls:rule.evidence,
   currentGameVerified:false,publicationApproved:false});
 }
 return {paired:{selected,unmatchedC:[...unmatchedC].sort((a,b)=>a-b),
  unmatchedG:[...unmatchedG].sort((a,b)=>a-b)},matched};
}
module.exports={CASES,applyReviewedAliases};
