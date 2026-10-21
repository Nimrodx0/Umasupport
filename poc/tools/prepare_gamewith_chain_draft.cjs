'use strict';
/*
 * Local, explicitly supplied reviewer notes only. This tool does NOT fetch
 * GameWith and its output is NOT the reviewed public catalog.
 *
 * Usage:
 * node poc/tools/prepare_gamewith_chain_draft.cjs \
 *   local-data/card-review.json local-data/card-chain-draft.json
 */
const fs=require('node:fs');
const path=require('node:path');
const {applyGameWithChainReview}=require('../src/gamewith_chain_adoption.cjs');
const fail=x=>{throw Error('GameWith連続イベント草稿: '+x);};
function extractImporterChainEvents(proposal,cardId){
 if(!proposal||!Array.isArray(proposal.manualCandidates)||
    !Number.isSafeInteger(proposal.observedEventHeadings)||
    !Array.isArray(proposal.reviewRequired))
   fail('既存GameWithオフライン抽出の全件情報がありません');
 const from=proposal.proposal?.cards;
 if(!Array.isArray(from)||from.length!==1||from[0].cardId!==cardId||
    !Array.isArray(from[0].events)||
    proposal.observedEventHeadings!==from[0].events.length+proposal.manualCandidates.length)
  fail('オフライン抽出の見出し総数が一致しません');
 const chains=proposal.manualCandidates.filter(x=>x.category==='chain');
 if(!chains.length||proposal.manualCandidates.some(x=>
    x.category==='chain'&&x.reason!=='chain-needs-manual-requires-and-termination'))
  fail('未解析の連続イベントは通常継続で補完できません');
 const numbers=chains.map(x=>x.categoryOrdinal);
 if(numbers.some((n,i)=>n!==i+1))fail('元記事に連続段階の欠落・逆順があります');
 const ids=new Set();
 return chains.map(x=>{
  const id='draft_'+cardId+'_chain_'+String(x.categoryOrdinal).padStart(2,'0');
  if(ids.has(id))fail('イベントIDが重複');ids.add(id);
  if(x.eventKind==='auto'){
   if(!obj(x.facts))fail('選択肢なしの効果情報が不正');
   return {id,name:'連続'+x.categoryOrdinal+'（仮）',type:'auto',...x.facts};
  }
  if(!Array.isArray(x.choices)||!x.choices.length)
   fail('選択肢未解析の連続イベントを継続とみなせません');
  return {id,name:'連続'+x.categoryOrdinal+'（仮）',type:'choice',choices:x.choices};
 });
}
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function main(argv){
 if(argv.length!==2)fail('usage: <manual-card-review.json> <local-draft-output.json>');
 const [source,destination]=argv.map(x=>path.resolve(x));
 const publicDB=path.resolve(__dirname,'../data/reviewed_events.v1.json');
 if(source===destination||destination===publicDB||
    !destination.includes(path.sep+'local-data'+path.sep))
   fail('出力はlocal-data内の未承認草稿に限定します');
 const req=JSON.parse(fs.readFileSync(source,'utf8'));
 if(req?.schemaVersion!==1||!req.cardId||!req.review)
  fail('手動記録の形式が不正');
 const sourceEvents=Array.isArray(req.events)?req.events:
  extractImporterChainEvents(req.importerProposal,req.cardId);
 if(req.importerProposal!==undefined){
  // The offline importer knows exactly which chain headings it recognized.
  // A partial review cannot claim full article coverage by omitting some.
  const ids=req.review?.chains?.flatMap(c=>c.stages?.map(s=>s.eventId)||[])||[];
  if(ids.length!==sourceEvents.length||new Set(ids).size!==ids.length||
     sourceEvents.some(e=>!ids.includes(e.id)))
   fail('GameWithの全連続イベント候補をレビュー対象に含めてください');
 }
 const {events,reviewSummary}=applyGameWithChainReview({
  cardId:req.cardId,review:req.review,events:sourceEvents
 });
 const draft={schemaVersion:1,kind:'gamewith-manually-reviewed-chain-draft',
  sourceUsed:'GameWith',releaseApproved:false,gameVerified:false,
  mustPassSeparateSkillEventAndPublicationGates:true,
  reviewSummary,cardId:req.cardId,events};
 fs.mkdirSync(path.dirname(destination),{recursive:true});
 fs.writeFileSync(destination,JSON.stringify(draft,null,2)+'\n');
 console.log('GAMEWITH_CHAIN_DRAFT_STATS='+JSON.stringify({
  cardId:req.cardId,events:events.length,reviewedStages:reviewSummary.reviewedStages,
  editorialImplicitContinuationRoutes:reviewSummary.implicitContinuationRoutes,
  editorialTerminalExceptions:reviewSummary.explicitTerminalExceptions,
  publicationApproved:false}));
}
if(require.main===module){
 try{main(process.argv.slice(2));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={main,extractImporterChainEvents};
