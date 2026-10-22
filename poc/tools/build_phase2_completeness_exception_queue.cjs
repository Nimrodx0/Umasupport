#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {readDocuments}=require('./audit_gametora_branches.cjs');
const {build}=require('../src/phase2_completeness_exception_queue.cjs');
function main(args){
 if(args.length!==3)throw Error('usage: <complete-index.json> <pinned-GT-dir> <temporary-output.json>');
 const [input,gtDir,out]=args.map(x=>path.resolve(x));
 const publicDir=path.resolve(__dirname,'../data');
 if(input===out||out===publicDir||out.startsWith(publicDir+path.sep))
  throw Error('未承認の全件監査台帳は公開データディレクトリに出力できません');
 const result=build(JSON.parse(fs.readFileSync(input,'utf8')),readDocuments(gtDir));
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('PHASE2_COMPLETENESS_EXCEPTIONS='+JSON.stringify(result.stats));
 console.log('PHASE2_EXPLAINED_CHOICE_ROWS='+JSON.stringify(result.reviewedRepresentationExamples));
 console.log('PHASE2_TOP_PRIORITY='+JSON.stringify(result.queue.filter(x=>x.priority==='P0'||x.type==='CHOICE_COUNT_DIFFERENCE'&&x.priority==='P1').map(x=>({
  cardId:x.cardId,type:x.type,priority:x.priority,sourceOrdinal:x.sourceOrdinal,
  checkerOrdinal:x.checkerOrdinal,
  gameToraChoiceCount:x.gameToraChoiceCount,checkerChoiceCount:x.checkerChoiceCount
 }))));
}
if(require.main===module)main(process.argv.slice(2));
module.exports={main};
