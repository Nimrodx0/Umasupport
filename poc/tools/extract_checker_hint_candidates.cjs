#!/usr/bin/env node
'use strict';
/* Run on legitimately obtained local input only. No network requests. */
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../src/live_loader.js');
const {extract}=require('../src/checker_hint_fact_extract.cjs');
const repo=path.resolve(__dirname,'../..');
function main(){
 if(process.argv.length!==6)throw Error('Usage: node poc/tools/extract_checker_hint_candidates.cjs <support_card.txt> <checker_Events.json> <skill_data.txt> <output.json>');
 const [support,events,skills,output]=process.argv.slice(2).map(x=>path.resolve(x));
 const appData=path.join(repo,'poc/data'),dataRoot=path.dirname(output);
 // Prohibit output in any tracked code/doc tree or into source inputs.
 if(output===repo||output.startsWith(repo+path.sep)&&!output.startsWith(path.join(repo,'local-data')+path.sep))
  throw Error('Output must be local-data/ outside tracked application data or outside repository');
 if(output===support||output===events||output===skills)throw Error('Cannot overwrite input source');
 if(fs.existsSync(output))throw Error('Refusing to overwrite an existing diagnostic report');
 if(output===appData||output.startsWith(appData+path.sep))throw Error('Cannot publish candidate report in app data');
 const model=loader.buildModel(fs.readFileSync(support,'utf8'),{mode:'audit'});
 const raw=JSON.parse(fs.readFileSync(events,'utf8'));
 const skillText=fs.readFileSync(skills,'utf8');
 const aliases=JSON.parse(fs.readFileSync(path.join(repo,'poc/config/checker-name-aliases.json'),'utf8'));
 const result=extract({source:raw,model,skillText,aliases});
 fs.mkdirSync(dataRoot,{recursive:true});
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n','utf8');
 console.log(JSON.stringify({output,approvalState:result.approvalState,stats:result.stats},null,2));
}
try{main();}catch(e){console.error('Local candidate extraction failed:',e.message);process.exitCode=1;}
