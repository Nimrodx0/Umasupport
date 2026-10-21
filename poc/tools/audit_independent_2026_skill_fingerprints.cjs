#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {audit,gitBlobSha,INDEPENDENT_SKILLS_BLOB}=
 require('../src/independent_skill_fingerprint_audit.cjs');
const fail=s=>{throw Error('独立2026スキル監査CLI: '+s);};
function main(args){
 if(args.length!==3)
  fail('usage: <numeric-only-historical-report> <version-pinned-2026-skills.json> <temporary-output.json>');
 const [historyFile,independentFile,out]=args.map(p=>path.resolve(p));
 const publicDir=path.resolve(__dirname,'../data');
 if(out.startsWith(publicDir+path.sep)||[historyFile,independentFile].includes(out))
  fail('未承認候補データを公開DBへ保存できません');
 const bytes=fs.readFileSync(independentFile);
 if(gitBlobSha(bytes)!==INDEPENDENT_SKILLS_BLOB)
  fail('独立2026スキルJSONのGit blobが固定版と一致しない');
 const records=JSON.parse(bytes.toString('utf8'));
 const historical=JSON.parse(fs.readFileSync(historyFile,'utf8'));
 const result=audit({historical,skills:records});
 if(result.independentRecordCount!==2194||
    result.totals.distinctIds!==28||
    result.totals.occurrences!==79)
  fail('固定の2025-ID不足と2026外部スキルの母集団が変化した');
 result.sourcePins.independentJsonSha256=
  crypto.createHash('sha256').update(bytes).digest('hex');
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('INDEPENDENT_2026_SKILL_NAME_FINGERPRINT_TOTALS='+JSON.stringify({
  sourceRevision:result.sourcePins.independentMetadata,
  sourceBlob:result.sourcePins.independentSkillBlob,
  sourceSha256:result.sourcePins.independentJsonSha256,
  rawSkillRecords:result.independentRecordCount,
  ...result.totals,
  mismatchIds:result.records.filter(x=>x.historicalNameFingerprintMatches===false).map(x=>x.numericId),
  absentIds:result.records.filter(x=>!x.presentIn2026Metadata).map(x=>x.numericId)
 }));
 console.log('Raw skill names are never included. No automatic publication or runtime adoption.');
}
if(require.main===module){
 try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={main};
