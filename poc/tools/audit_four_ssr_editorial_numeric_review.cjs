#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {review}=require('../src/phase2_four_ssr_editorial_review.cjs');
function main(args){
 if(args.length!==2)throw Error('usage: <private-numeric-four-card-candidates.json> <temporary-audit-report.json>');
 const [input,output]=args.map(x=>path.resolve(x));
 const data=path.resolve(__dirname,'../data');
 if(input===output||output===data||output.startsWith(data+path.sep))
  throw Error('第三者の未承認イベント候補を配信用ディレクトリへ出力できません');
 const report=review(JSON.parse(fs.readFileSync(input,'utf8')));
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log('PHASE2_FOUR_SSR_EDITORIAL_NUMERIC_REVIEW='+JSON.stringify(report.totals));
 console.log('PHASE2_FOUR_SSR_PRESENTATION_REVIEW='+JSON.stringify(
  report.cards.flatMap(c=>c.events.filter(e=>
   e.editorialPresentation==='EDITORIAL_PRESENTATION_UNRESOLVED').map(e=>({
    cardId:c.cardId,checkerOrdinal:e.checkerOrdinal
  })))));
 console.log('No event text, option prose, or game/publication approval is produced.');
}
if(require.main===module){
 try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={main};
