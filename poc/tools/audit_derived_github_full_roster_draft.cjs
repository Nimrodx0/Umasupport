#!/usr/bin/env node
'use strict';
/* Runs only on a pinned local Git checkout. No source prose in stdout. */
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const {auditDerivedRoster}=require('../src/derived_github_full_roster_draft_audit.cjs');
const fail=s=>{throw Error('派生GitHub全カード監査CLI: '+s);};
function run([repoDir,commit,skillPath]){
 if(arguments.length!==1||!repoDir||!/^[0-9a-f]{40}$/.test(commit||'')||
    !skillPath)fail('usage: node audit_derived_github_full_roster_draft.cjs <checkout> <commit40> <skill_data.txt>');
 const git=(...args)=>cp.execFileSync('git',['-C',repoDir,...args],{
  encoding:'utf8',maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']
 }).trim();
 if(git('rev-parse','HEAD')!==commit)
  fail('checkout-commit-does-not-match-pin');
 const root=path.resolve(repoDir),folder=path.join(root,'server/data/events/gametora');
 if(!fs.statSync(folder).isDirectory())fail('source-event-folder-missing');
 const treeSha=git('rev-parse','HEAD^{tree}');
 const tree=git('ls-tree','-r','HEAD').split('\n').map(line=>{
  const match=/^[0-7]{6} (blob|tree|commit) ([0-9a-f]{40})\t(.+)$/.exec(line);
  if(!match)fail('invalid-git-tree-record');
  return {type:match[1],sha:match[2],path:match[3]};
 });
 const target=/^server\/data\/events\/gametora\/support_([1-9]\d{4})\.json$/;
 const ids=tree.filter(e=>e.type==='blob'&&target.test(e.path));
 if(ids.length===0||ids.length>2000)fail('unexpected-source-size');
 const disk=fs.readdirSync(folder).filter(x=>/^support_[1-9]\d{4}\.json$/.test(x));
 if(disk.length!==ids.length)fail('disk-and-tree-card-file-count-drift');
 const records=ids.map(entry=>{
  const cardId=target.exec(entry.path)[1],local=path.resolve(root,entry.path);
  if(!local.startsWith(root+path.sep))fail('source-path-escape');
  const stat=fs.statSync(local);
  if(!stat.isFile()||stat.size<=0||stat.size>2*1024*1024)
   fail('invalid-source-file-size');
  return {cardId,sourceText:fs.readFileSync(local,'utf8')};
 });
 const skillStat=fs.statSync(skillPath);
 if(!skillStat.isFile()||skillStat.size<=0||skillStat.size>12*1024*1024)
  fail('invalid-skill-registry-size');
 const result=auditDerivedRoster({sourceTree:{
  sha:treeSha,truncated:false,tree
 },sourceCommit:commit,records,skillText:fs.readFileSync(skillPath,'utf8')});
 if(result.totals.sourceCards!==ids.length||
    result.publicationApproved!==false||result.sourceEventProseCopied!==false)
  fail('audit-conservation-failed');
 // Only numeric counts and reason codes are allowed in runner output.
 process.stdout.write('DERIVED_GITHUB_FULL_ROSTER_APP_DRAFT_AUDIT='+
  JSON.stringify({sourceCommit:commit,totals:result.totals,
   reasonCounts:result.reasonCounts,
   sectionCounts:result.sectionCounts,
   reasonCountsBySection:result.reasonCountsBySection,
   gameSemanticsVerified:false,publicationApproved:false})+'\n');
}
if(require.main===module)try{run(process.argv.slice(2));}catch(error){
 // No raw error details, JSON body or source paths in logs.
 process.stderr.write('DERIVED_GITHUB_FULL_ROSTER_AUDIT_FAILED\n');
 process.exitCode=1;
}
module.exports={run};
