#!/usr/bin/env node
'use strict';
/*
 * Read-only inventory by default; published JSON is generated only if a
 * reviewed manifest is explicitly supplied. Do not commit raw source inputs.
 */
const fs=require('node:fs/promises');
const path=require('node:path');
const loader=require('../src/live_loader.js');
const pipeline=require('../src/checker_candidate_pipeline.cjs');
const urls={
 uma:'https://raw.githubusercontent.com/mee1080/umasim/main/data/support_card.txt',
 checker:'https://raw.githubusercontent.com/Cilda/UmaUmaChecker/master/UmaUmaChecker/Library/Events.json'
};
function options(argv){
 const result={local:null,aliases:null,review:null,output:null,candidates:null};
 for(let i=0;i<argv.length;i++){
   const flag=argv[i];
   if(flag==='--local'){
     if(result.local||!argv[i+1]||!argv[i+2])throw Error('--localは2ファイル指定');
     result.local=[argv[++i],argv[++i]];
   }else if(['--aliases','--review','--output','--candidates'].includes(flag)){
     const key=flag.slice(2);
     if(result[key]||!argv[i+1])throw Error(flag+'のファイル指定が必要');
     result[key]=argv[++i];
   }else throw Error('不明な引数: '+flag);
 }
 if(Boolean(result.review)!==Boolean(result.output))throw Error('--reviewと--outputはセットで指定');
 return result;
}
async function download(url){
 const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{accept:'application/json,text/plain'}});
 if(!r.ok)throw Error('HTTP '+r.status+' '+url);
 return r.text();
}
async function run(){
 const flags=options(process.argv.slice(2));
 const [umaText,checkerText]=flags.local?
   await Promise.all(flags.local.map(x=>fs.readFile(x,'utf8'))):
   await Promise.all([download(urls.uma),download(urls.checker)]);
 const model=loader.buildModel(umaText);
 const source=JSON.parse(checkerText.replace(/^\uFEFF/,''));
 const aliases=flags.aliases?JSON.parse(await fs.readFile(flags.aliases,'utf8')):{};
 const candidate=pipeline.inventory({source,model,aliases});
 if(flags.candidates){
   const dest=path.resolve(flags.candidates);
   await fs.mkdir(path.dirname(dest),{recursive:true});
   await fs.writeFile(dest,JSON.stringify(candidate,null,2)+'\n','utf8');
 }
 const report={
   ...candidate.stats,unmatchedModelIds:candidate.unmatchedModelIds,
   incompleteCardIds:candidate.cards.filter(c=>c.events.length===0).map(c=>c.cardId),
   eventStatus:'CANDIDATES_ONLY',
   warning:candidate.warning
 };
 if(flags.review){
   const review=JSON.parse(await fs.readFile(flags.review,'utf8'));
   const {catalog,summary}=pipeline.publishReviewed({candidate,review,model});
   const output=path.resolve(flags.output);
   await fs.mkdir(path.dirname(output),{recursive:true});
   // Only approved facts, no raw Event / Effect / Title objects.
   await fs.writeFile(output,JSON.stringify(catalog,null,2)+'\n','utf8');
   report.approvedEvents=summary.eventsWithRecords;
   report.approvedCards=summary.cardsWithRecords;
   report.output=output;
 }
 console.log(JSON.stringify(report,null,2));
}
run().catch(e=>{console.error('インポート失敗:',e.message);process.exitCode=1;});
