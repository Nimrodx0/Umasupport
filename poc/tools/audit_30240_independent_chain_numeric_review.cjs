#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {make}=require('../src/phase2_30240_independent_chain_numeric_review.cjs');
function main(args){
 if(args.length!==6)throw Error('usage: <whole-index.json> <all-card-triage.json> <exception-queue.json> <GT-numeric.json> <pinned-2026-skills.json> <temporary-output.json>');
 const paths=args.map(x=>path.resolve(x)),
   publicDir=path.resolve(__dirname,'../data'),out=paths[5];
 if(out===publicDir||out.startsWith(publicDir+path.sep)||
    paths.slice(0,5).includes(out))
   throw Error('未承認の30240イベント事実候補を公開用データへ書き出せません');
 const result=make(...paths.slice(0,5).map(p=>JSON.parse(fs.readFileSync(p,'utf8'))));
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('PHASE2_30240_EXTERNAL_CHAIN_NUMERIC='+JSON.stringify({
  cardId:result.cardId,
  externalSourceFamilies:result.externalEditorialSourceFamilies,
  editorialStages:result.stageRows.length,
  missingBothFixedSources:result.stageRows.filter(x=>
   x.sourceStageIsMissingFromBothFixedEventSources).length,
  numericHintCandidates:result.stageRows.reduce((s,x)=>s+x.reportedSkillHintCandidates.length,0),
  verifiedCurrentGameplay:result.game2026Verified,
  publicationApproved:result.publicationApproved
 }));
}
if(require.main===module)main(process.argv.slice(2));
module.exports={main};
