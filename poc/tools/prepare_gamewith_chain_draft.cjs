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
function main(argv){
 if(argv.length!==2)fail('usage: <manual-card-review.json> <local-draft-output.json>');
 const [source,destination]=argv.map(x=>path.resolve(x));
 const publicDB=path.resolve(__dirname,'../data/reviewed_events.v1.json');
 if(source===destination||destination===publicDB||
    !destination.includes(path.sep+'local-data'+path.sep))
   fail('出力はlocal-data内の未承認草稿に限定します');
 const req=JSON.parse(fs.readFileSync(source,'utf8'));
 if(req?.schemaVersion!==1||!Array.isArray(req.events)||!req.cardId||!req.review)
  fail('手動記録の形式が不正');
 const {events,reviewSummary}=applyGameWithChainReview(req);
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
module.exports={main};
