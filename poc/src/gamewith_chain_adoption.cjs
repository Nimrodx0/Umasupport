'use strict';
/*
 * Offline, reviewer-attested GameWith canonical chain interpretation.
 *
 * GameWith's editorial convention is "ordinary continuation unless a special
 * ending/condition is described". For a COMPLETE reviewed chain section,
 * omission of an ending marker means ordinary continuation (NOT game proof).
 * Incomplete/missing pages, route mismatches, and special gated continuations
 * fail closed. No network GET, raw source article prose, or auto-publication.
 */
const {URL}=require('node:url');
const POLICY=require('../config/event-source-priority.v1.json');
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const word=x=>typeof x==='string'&&x.trim().length>0;
const fail=x=>{throw Error('GameWith正本イベント審査: '+x);};
const COVERAGE=['allEventHeadingsReviewed','allStageOrderReviewed',
 'allChoicesReviewed','allResultsReviewed','allExceptionsReviewed'];
function sourceReview(review,cardId){
 if(POLICY.schemaVersion!==1||POLICY.eventListPrimary!=='GameWith'||
    POLICY.eventChoicePrimary!=='GameWith'||POLICY.eventResultPrimary!=='GameWith'||
    POLICY.eventContinuationPrimary!=='GameWith'||
    POLICY.unmarkedNonFinalChainRule!==
      'ordinary-continuation-only-after-complete-human-reviewed-article-and-branch-coverage'||
    POLICY.humanReviewedCompletenessRequired!==true||
    POLICY.automaticPublicationAllowed!==false)
  fail('正本の設定が無効・不一致');
 if(!obj(review)||review.schemaVersion!==1||review.source!=='GameWith'||
    review.cardId!==cardId||!word(review.reviewer)||
    !/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt||'')||
    !Number.isFinite(Date.parse(review.reviewedAt+'T00:00:00Z'))||
    !/^sha256:[a-f0-9]{64}$/.test(review.articleSha256||'')||
    !Array.isArray(review.chains)||!review.chains.length)
  fail('完全なGameWith記事のレビュー記録が必要');
 try{
  const u=new URL(review.articleUrl);
  if(u.protocol!=='https:'||u.hostname!=='gamewith.jp'||u.username||u.password||
     !/^\/uma-musume\/article\/show\/\d+\/?$/.test(u.pathname)||u.search||u.hash)
   fail('GameWith個別記事URL以外を正本にできません');
 }catch(e){fail('GameWith個別記事URLが不正');}
 if(!obj(review.coverage)||COVERAGE.some(x=>review.coverage[x]!==true)||
    review.coverage.articleSectionStatus!=='complete')
  fail('未確認範囲のある記事では通常継続を推定しません');
}
// Unique identifiers, exact card + stage position, outcome coverage and
// no pre-existing terminal semantics. The supplied target event list must
// come from a separately verified input/source crosswalk.
function applyGameWithChainReview({cardId,review,events}){
 if(!word(cardId)||!Array.isArray(events)||!events.length)fail('カードまたはイベント入力が不正');
 sourceReview(review,cardId);
 const byId=new Map();
 const revised=events.map(e=>{
  if(!obj(e)||!word(e.id)||byId.has(e.id))fail('対象イベントIDが不正・重複');
  byId.set(e.id,e);
  return structuredClone(e);
 });
 const writable=new Map(revised.map(x=>[x.id,x]));
 const seenStages=new Set(),chainKeys=new Set();
 let implicitContinuationRoutes=0,explicitTerminals=0,chainPairs=0,checkedChoices=0,checkedOutcomes=0;
 for(const chain of review.chains){
  if(!obj(chain)||!word(chain.chainKey)||chainKeys.has(chain.chainKey)||!Array.isArray(chain.stages)||
     !chain.stages.length||chain.stages.some((x,i)=>x.stageNumber!==i+1))
   fail('正本の段階順が不完全・不連続');
  chainKeys.add(chain.chainKey);
  for(let si=0;si<chain.stages.length;si++){
   const stage=chain.stages[si],event=writable.get(stage.eventId);
   if(!event||seenStages.has(stage.eventId))fail('GameWith段階が対象イベントへ一意に対応しない');
   seenStages.add(stage.eventId);
   if(!obj(stage)||!Array.isArray(stage.choices)||!stage.choices.length||
      !Array.isArray(stage.exceptions))fail('全選択肢と明示例外のレビューが必要');
   if(event.type!=='choice'&&event.type!=='auto')fail('未対応イベント形式');
   if(si===0&&event.requires!==undefined)fail('最初の段階に未確認の到達条件が存在します');
   const parts=event.type==='choice'?event.choices:[event];
   if(!Array.isArray(parts)||parts.length!==stage.choices.length)
    fail('GameWith記事と候補の選択肢数が異なります');
   const sourceChoiceKeys=new Set();
   const stageChoiceKeys=new Set();
   const terminalKeys=new Set();
   const resultKey=(c,r)=>JSON.stringify([c,r??null]);
   for(const v of stage.choices){
    if(!obj(v)||!word(v.choiceId)||!Array.isArray(v.outcomeIds)||
       stageChoiceKeys.has(v.choiceId)||v.outcomeIds.some(r=>!word(r))||
       new Set(v.outcomeIds).size!==v.outcomeIds.length)
     fail('記事の全選択肢・結果の照合が未完');
    stageChoiceKeys.add(v.choiceId);
    const part=event.type==='auto'
      ?(v.choiceId==='$auto'?event:null)
      :parts.find(x=>x.id===v.choiceId);
    if(!part)fail('記事の選択肢IDと候補が対応していません');
    if(part.terminal!==undefined)fail('正本未確認の既存打ち切りが混入');
    const results=part.outcomes||[];
    if(results.length!==v.outcomeIds.length||
       results.some(x=>!v.outcomeIds.includes(x.id)||x.terminal!==undefined))
     fail('記事の全結果と候補が対応していません');
    if(results.length===1)fail('結果数が1つの未標準化イベント');
    checkedChoices++;checkedOutcomes+=results.length||1;
    sourceChoiceKeys.add(v.choiceId);
   }
   if(sourceChoiceKeys.size!==parts.length)fail('記事の全選択肢が照合されていません');
   for(const ex of stage.exceptions){
    if(!obj(ex)||ex.kind!=='terminal'||!word(ex.choiceId)||
       ex.outcomeId!==undefined&&!word(ex.outcomeId))fail('未知の終了以外の特例は個別レビュー');
    const key=resultKey(ex.choiceId,ex.outcomeId);
    if(terminalKeys.has(key))fail('重複した打ち切り例外');
    terminalKeys.add(key);
    if(!stageChoiceKeys.has(ex.choiceId))fail('未登録の終了選択肢');
    const part=event.type==='auto'?event:event.choices.find(x=>x.id===ex.choiceId);
    if(ex.outcomeId!==undefined){
      const o=part.outcomes?.find(x=>x.id===ex.outcomeId);
      if(!o)fail('未登録の終了結果');
      if(terminalKeys.has(resultKey(ex.choiceId,undefined)))
       fail('選択肢全体と結果別の打ち切りが重複');
      o.terminal=true;
    }else{
      if(event.type==='auto')fail('選択肢なしイベントの無条件打ち切りは別の手動審査が必要');
      if(part.outcomes?.some(o=>terminalKeys.has(resultKey(ex.choiceId,o.id))))
       fail('選択肢全体と結果別の打ち切りが重複');
      part.terminal=true;
    }
    explicitTerminals++;
   }
   // Exception map is exhaustive only because a reviewer has verified the
   // full article, all choices/results, AND the convention of reporting ends.
   if(si<chain.stages.length-1){
    const following=chain.stages[si+1],n=writable.get(following.eventId);
    if(!n)fail('後続イベントが候補に存在しません');
    const gate={all:[{eventId:event.id}]};
    if(n.requires!==undefined&&JSON.stringify(n.requires)!==JSON.stringify(gate))
      fail('明示的な特殊到達条件を通常継続で上書きできません');
    n.requires=gate;
    chainPairs++;
    for(const part of parts){
      if(part.terminal)continue;
      const outcomes=part.outcomes||[];
      if(!outcomes.length)implicitContinuationRoutes++;
      else implicitContinuationRoutes+=outcomes.filter(x=>!x.terminal).length;
    }
    if(!parts.some(p=>!p.terminal&&
       !(p.outcomes?.length&&p.outcomes.every(x=>x.terminal===true))))
      fail('全結果終了の段階に後続イベントを作成できません');
   }
  }
 }
 return {events:revised,
  reviewSummary:{cardId,source:'GameWith',articleUrl:review.articleUrl,
   articleSha256:review.articleSha256,reviewedAt:review.reviewedAt,
   reviewedStages:seenStages.size,reviewedChoices:checkedChoices,
   reviewedOutcomePositions:checkedOutcomes,
   sourceOrderAdjacentPairs:chainPairs,implicitContinuationRoutes,
   explicitTerminalExceptions:explicitTerminals,
   interpretation:'GAMEWITH_EDITORIAL_DEFAULT_NOT_VERIFIED_GAMEPLAY',
   gameVerified:false,publicationApproved:false}};
}
module.exports={applyGameWithChainReview};
