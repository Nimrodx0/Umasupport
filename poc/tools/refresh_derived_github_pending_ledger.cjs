#!/usr/bin/env node
'use strict';
/*
 * Local/Actions only. Fetch ONLY the missing, source-tree-listed new cards.
 * Never write upstream event JSON, names, or unreviewed runtime catalog.
 */
const fs=require('node:fs');
const path=require('node:path');
const {refresh}=require('../src/derived_github_pending_refresh.cjs');
const {verifyLedger}=require('../src/derived_github_pending_ledger.cjs');
const SHA=/^[a-f0-9]{40}$/;
const fail=x=>{throw Error('未取込サポカ継続取得CLI: '+x);};
async function main(args,{fetchImpl=fetch}={}){
 if(args.length!==8)fail('usage: <old-roster> <current-roster> <skill-data> <git-tree> <source-commit> <skill-commit> <prior-ledger> <output-prefix>');
 const [oldFile,newFile,skillFile,treeFile,sourceCommit,skillRevision,
  previousFile,outputPrefix]=args;
 if(!SHA.test(sourceCommit)||!SHA.test(skillRevision))
  fail('Git commit SHAが不正');
 const read=file=>fs.readFileSync(path.resolve(file),'utf8');
 const existingCatalog=require('../data/reviewed_events.v1.json');
 const previous=verifyLedger(JSON.parse(read(previousFile)));
 const result=await refresh({
  previousRosterText:read(oldFile),currentRosterText:read(newFile),
  skillText:read(skillFile),sourceTree:JSON.parse(read(treeFile)),
  sourceCommit,skillRevision,existingCatalog,previousLedger:previous,
  fetchDocument:async({sourceCommit:pin,sourcePath})=>{
   if(pin!==sourceCommit||
      !/^server\/data\/events\/gametora\/support_[1-9]\d{4}\.json$/.test(sourcePath))
    fail('対象外のGitHub取得先');
   const url='https://raw.githubusercontent.com/systemless10/UmamusumePS/'+
    pin+'/'+sourcePath;
   const response=await fetchImpl(url,{headers:{'Accept':'application/json'},
    signal:AbortSignal.timeout(25000)});
   if(!response?.ok)throw Error('GitHub source unavailable');
   const contentLength=Number(response.headers?.get?.('content-length')||0);
   if(contentLength>4*1024*1024)throw Error('oversized GitHub card');
   return response.text();
  }});
 const out=path.resolve(outputPrefix);
 const root=path.resolve(path.dirname(out));
 if(!fs.existsSync(root))fail('出力先ディレクトリが存在しない');
 // Files may reside ONLY in ephemeral ACTIONS runner, not in tracked tree.
 const project=path.resolve(__dirname,'../..');
 if(out===project||out.startsWith(project+path.sep))
  fail('台帳はランナー一時領域にだけ出力する');
 fs.writeFileSync(out+'.ledger.json',JSON.stringify(result.ledger,null,2)+'\n');
 fs.writeFileSync(out+'.summary.json',JSON.stringify(result.summary,null,2)+'\n');
 process.stdout.write('NEW_CARD_PENDING_REFRESH='+JSON.stringify(result.summary)+'\n');
 return result;
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{
 process.stderr.write('NEW_CARD_PENDING_REFRESH_FAILED: '+String(e.message)+'\n');
 process.exitCode=1;
});
module.exports={main};
