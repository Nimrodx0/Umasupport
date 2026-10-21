'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {applyGameWithChainReview}=require('../src/gamewith_chain_adoption.cjs');
const schema=require('../src/event_schema.js');
const core=require('../src/core.js');
const articleUrl='https://gamewith.jp/uma-musume/article/show/261695';
const digest='sha256:'+'a'.repeat(64);
const fullCoverage=()=>({
 articleSectionStatus:'complete',allEventHeadingsReviewed:true,
 allStageOrderReviewed:true,allChoicesReviewed:true,allResultsReviewed:true,
 allExceptionsReviewed:true
});
const c1=()=>({id:'a',name:'stage1',type:'choice',choices:[
 {id:'upper',label:'上',outcomes:[
  {id:'success',label:'成功',rewards:[]},
  {id:'failure',label:'失敗',rewards:[]}]},
 {id:'lower',label:'下',rewards:[]}]});
const c2=()=>({id:'b',name:'stage2',type:'choice',choices:[
 {id:'continue',label:'上',rewards:[]},
 {id:'exit',label:'下',rewards:[]}]});
const c3=()=>({id:'c',name:'stage3',type:'choice',choices:[
 {id:'done',label:'終わり',rewards:[]}]});
const review=()=>({
 schemaVersion:1,cardId:'30026',source:'GameWith',
 articleUrl,articleSha256:digest,reviewer:'Reviewer',
 reviewedAt:'2026-10-21',coverage:fullCoverage(),
 chains:[{chainKey:'reviewed-chain-1',stages:[
 {eventId:'a',stageNumber:1,
  choices:[{choiceId:'upper',outcomeIds:['success','failure']},
   {choiceId:'lower',outcomeIds:[]}],
  exceptions:[{kind:'terminal',choiceId:'upper',outcomeId:'failure'},
   {kind:'terminal',choiceId:'lower'}]},
 {eventId:'b',stageNumber:2,
  choices:[{choiceId:'continue',outcomeIds:[]},{choiceId:'exit',outcomeIds:[]}],
  exceptions:[{kind:'terminal',choiceId:'exit'}]},
 {eventId:'c',stageNumber:3,
  choices:[{choiceId:'done',outcomeIds:[]}],exceptions:[]}
 ]}]
});
const events=()=>[c1(),c2(),c3()];
function run(r=review(),list=events()){
 return applyGameWithChainReview({cardId:'30026',review:r,events:list});
}
test('explicit success/failure stop + implicit normal continuation are compiled into app-ready graph',()=>{
 const source=events(),out=run(review(),source);
 assert.equal(out.reviewSummary.implicitContinuationRoutes,2);
 assert.equal(out.reviewSummary.explicitTerminalExceptions,3);
 assert.equal(out.reviewSummary.sourceOrderAdjacentPairs,2);
 assert.equal(out.reviewSummary.gameVerified,false);
 assert.equal(out.reviewSummary.publicationApproved,false);
 assert.equal(out.events[0].choices[0].outcomes[1].terminal,true);
 assert.equal(out.events[0].choices[1].terminal,true);
 assert.equal(out.events[1].choices[1].terminal,true);
 assert.deepEqual(out.events[1].requires,{all:[{eventId:'a'}]});
 assert.deepEqual(out.events[2].requires,{all:[{eventId:'b'}]});
 assert.equal(source[0].choices[0].outcomes[1].terminal,undefined,'input unmodified');
 schema.validateEvents(out.events,{skillById:{}},'30026');
 assert.equal(core.isReachable(out.events[1],{a:'upper'},out.events,{a:'success'}),true);
 assert.equal(core.isReachable(out.events[1],{a:'upper'},out.events,{a:'failure'}),false);
 assert.equal(core.isReachable(out.events[1],{a:'lower'},out.events),false);
 assert.equal(core.isReachable(out.events[2],{a:'upper',b:'continue'},out.events,{a:'success'}),true);
 assert.equal(core.isReachable(out.events[2],{a:'upper',b:'exit'},out.events,{a:'success'}),false);
});
test('ordinary unmentioned path gets continuation ONLY after complete inspected article evidence',()=>{
 const r=review();
 r.chains[0].stages[0].exceptions=[];
 r.chains[0].stages[1].exceptions=[];
 const out=run(r);
 assert.equal(out.reviewSummary.implicitContinuationRoutes,5);
 assert.equal(out.reviewSummary.explicitTerminalExceptions,0);
 assert.equal(core.isReachable(out.events[1],{a:'lower'},out.events),true);
 assert.equal(out.events[0].choices[1].terminal,undefined);
});
test('missing article, partial section, missing review flag never become ordinary continuation',()=>{
 for(const name of Object.keys(fullCoverage()).filter(x=>x!=='articleSectionStatus')){
  const r=review();r.coverage[name]=false;
  assert.throws(()=>run(r),/未確認範囲/,name);
 }
 const r=review();r.coverage.articleSectionStatus='partial';
 assert.throws(()=>run(r),/未確認範囲/);
 r.coverage=fullCoverage();r.articleUrl='https://gamewith.jp.evil.test/uma-musume/article/show/1';
 assert.throws(()=>run(r),/URL/);
 r.articleUrl=articleUrl;r.articleSha256='sha256:bad';
 assert.throws(()=>run(r),/レビュー記録/);
 const missed=review();missed.reviewer='';
 assert.throws(()=>run(missed),/レビュー記録/);
});
test('missing/mismatched choice/result, unknown exception, unordered stage all reject',()=>{
 const missing=review();missing.chains[0].stages[0].choices.pop();
 assert.throws(()=>run(missing),/選択肢数/);
 const wrong=review();wrong.chains[0].stages[0].choices[0].outcomeIds=['success'];
 assert.throws(()=>run(wrong),/全結果/);
 const extra=review();extra.chains[0].stages[0].exceptions.push({kind:'terminal',choiceId:'unknown'});
 assert.throws(()=>run(extra),/未登録/);
 const conditional=review();conditional.chains[0].stages[0].exceptions=[{kind:'special-access',choiceId:'upper'}];
 assert.throws(()=>run(conditional),/未知の終了以外/);
 const order=review();order.chains[0].stages[1].stageNumber=3;
 assert.throws(()=>run(order),/不完全・不連続/);
});
test('preexisting special branch requirement is never replaced by generic next-event gate',()=>{
 const input=events();input[1].requires={all:[{eventId:'a',choiceId:'upper',outcomeId:'success'}]};
 assert.throws(()=>run(review(),input),/特殊到達条件を通常継続で上書き/);
 const input2=events();input2[0].choices[1].terminal=true;
 assert.throws(()=>run(review(),input2),/既存打ち切り/);
});
test('all outgoing routes terminate cannot invent a next stage',()=>{
 const r=review();
 r.chains[0].stages[0].exceptions=[
 {kind:'terminal',choiceId:'upper'},
 {kind:'terminal',choiceId:'lower'}
 ];
 assert.throws(()=>run(r),/全結果終了/);
});
test('identical page stage must not participate in two chains or refer to missing event',()=>{
 const r=review();
 r.chains.push({chainKey:'duplicate',stages:[r.chains[0].stages[0]]});
 assert.throws(()=>run(r),/一意/);
 r.chains.pop();r.chains[0].stages[2].eventId='other';
 assert.throws(()=>run(r),/対象イベント|後続イベント/);
});
