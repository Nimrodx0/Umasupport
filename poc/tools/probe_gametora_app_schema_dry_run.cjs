#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {project}=require('../src/gametora_app_schema_dry_run.cjs');
const loader=require('../src/live_loader.js');
const {CANONICAL_SOURCE_SHA}=require('../src/gametora_event_skill_crosswalk.cjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const fail=x=>{throw Error('GameToraイベント実行スキーマ検証: '+x);};
function main(args){
 if(args.length!==5)fail('usage: <numeric-candidate> <crosswalk> <skill_data.txt> <support_card.txt> <numeric-summary-output>');
 const [candidateFile,crosswalkFile,skillFile,rosterFile,out]=args.map(x=>path.resolve(x));
 if(out.startsWith(path.resolve(__dirname,'../data')+path.sep)||
    [candidateFile,crosswalkFile,skillFile,rosterFile].includes(out))
  fail('未承認データを公開領域に書き込めません');
 const raw=fs.readFileSync(skillFile),roster=fs.readFileSync(rosterFile);
 const expected=require('../data/candidates/checker_event_hints.v1.json').sourcePins.umasimCards.sha256;
 if(hash(raw)!==CANONICAL_SOURCE_SHA||hash(roster)!==expected)
  fail('独立ソースのSHA-256検証に失敗');
 const model=loader.buildModel(roster.toString('utf8'),{mode:'audit'});
 if(model.cards.length!==563)fail('サポカカード数が変化');
 const result=project({candidate:JSON.parse(fs.readFileSync(candidateFile,'utf8')),
  crosswalk:JSON.parse(fs.readFileSync(crosswalkFile,'utf8')),
  skillText:raw.toString('utf8'),model});
 if(result.report.totals.sourceEvents!==2488||
    result.report.totals.sourceChoices!==4129||
    result.report.totals.sourceRoutes!==4376||
    result.report.totals.sourceCards!==563||
    result.report.totals.candidateSchemaEvents!==2084||
    result.report.totals.skippedEvents!==404||
    result.report.totals.candidateSchemaCards!==557||
    result.report.totals.candidateRewardMentions!==1413||
    result.report.totals.candidateAutoEvents!==609||
    result.report.totals.candidateChoiceEvents!==1475||
    result.report.totals.candidateTerminalPaths!==88)
  fail('固定GameTora全件数の保存条件に不一致');
 // WARNING: The derived app catalog contains unreviewed placeholders,
 // numeric skills and conditional routes. Never write it to disk or upload it.
 const report=result.report;
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log('GAMETORA_APP_SCHEMA_DRY_RUN_TOTALS='+JSON.stringify(report.totals));
 console.log('GAMETORA_APP_SCHEMA_DRY_RUN_REASONS='+JSON.stringify(report.excludedReasons));
 console.log('Publication remains disabled. Runtime-compatible catalog is ephemeral and discarded.');
}
if(require.main===module){
 try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={main};
