#!/usr/bin/env node
'use strict';
/*
 * Manual build of the already-approved same-origin JSON, NOT a source
 * downloader. Default mode only audits, even when inputs are real.
 * --publish-approved is a separate explicit opt-in and cannot override
 * missing factual/legal approval. Never creates approval records.
 */
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {prepare,assertRetainsPublished}=require('../src/approved_event_release_build.cjs');
const {buildModel}=require('../src/live_loader.js');
function options(args){
 const allowed=['--candidate','--approvals','--support','--skills','--output'];
 const out={publishApproved:false};
 for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(arg==='--publish-approved'){
   if(out.publishApproved)throw Error('出版フラグが重複しています');
   out.publishApproved=true;
  }else{
   if(!allowed.includes(arg)||!args[i+1]||args[i+1].startsWith('--')||
       out[arg.slice(2)]!==undefined)throw Error('引数が不正: '+arg);
   out[arg.slice(2)]=args[++i];
  }
 }
 for(const key of ['candidate','approvals','support','skills'])
  if(!out[key])throw Error('入力ファイルが不足: --'+key);
 if(out.publishApproved!==Boolean(out.output))
  throw Error('--publish-approved と --output はセットで明示してください');
 if(out.output&&path.basename(out.output)!=='reviewed_events.v1.json')
  throw Error('出力ファイル名は reviewed_events.v1.json のみです');
 if(out.output){
  const root=path.resolve(__dirname,'../..');
  const target=path.resolve(out.output);
  if(target.startsWith(root+path.sep)&&
     target!==path.join(root,'poc/data/reviewed_events.v1.json'))
   throw Error('Git管理下の別ファイルを上書きできません');
 }
 return out;
}
async function run(argv=process.argv.slice(2)){
 const opt=options(argv);
 const [candidate,approvals,support,skillText]=await Promise.all([
  fs.readFile(opt.candidate,'utf8').then(JSON.parse),
  fs.readFile(opt.approvals,'utf8').then(JSON.parse),
  fs.readFile(opt.support,'utf8'),
  fs.readFile(opt.skills,'utf8')
 ]);
 const {catalog,report}=prepare({
  candidate,approvals,model:buildModel(support),skillText
 });
 if(opt.publishApproved){
  if(report.events===0)
   throw Error('0件を明示出版モードで出力することはできません');
  const output=path.resolve(opt.output);
  // The new approval ledger validates the candidate. Independently protect
  // events already published by an earlier reviewed catalog. A missing target
  // means first publication; any unreadable/invalid existing file fails closed.
  let prior;
  try{
   prior=JSON.parse(await fs.readFile(output,'utf8'));
  }catch(e){
   if(e.code!=='ENOENT')throw Error('既存公開JSONを検査できません: '+e.message);
  }
  if(prior!==undefined)assertRetainsPublished(prior,catalog);
  const temp=output+'.approved-staging-'+crypto.randomBytes(8).toString('hex');
  try{
   // Fully validate before writing a SINGLE byte. Atomic rename ensures a
   // failed build does not leave a partial catalog for Pages to serve.
   await fs.writeFile(temp,JSON.stringify(catalog,null,2)+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
   await fs.rename(temp,output);
  }finally{await fs.rm(temp,{force:true});}
 }
 const result={...report,outputWritten:opt.publishApproved};
 console.log('EVENT_APPROVED_BULK_BUILD='+JSON.stringify(result));
 return result;
}
if(require.main===module)run().catch(e=>{
 console.error('EVENT_APPROVED_BULK_BUILD_FAILED: '+e.message);
 process.exitCode=1;
});
module.exports={options,run};
