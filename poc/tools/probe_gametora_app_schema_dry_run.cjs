#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {project}=require('../src/gametora_app_schema_dry_run.cjs');
const loader=require('../src/live_loader.js');
const {CANONICAL_SOURCE_SHA}=require('../src/gametora_event_skill_crosswalk.cjs');
const supplemental=require('../data/curation/supplemental_skills.v1.json');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const fail=x=>{throw Error('GameToraイベント実行スキーマ検証: '+x);};
function main(args){
 if(![5,7].includes(args.length))
  fail('usage: <numeric-candidate> <crosswalk> <skill_data.txt> <support_card.txt> <numeric-summary-output> [historical-report.json private-historical-records.json]');
 const [candidateFile,crosswalkFile,skillFile,rosterFile,out,
   historicalReportFile,privateRecordsFile]=args.map(x=>path.resolve(x));
 if(out.startsWith(path.resolve(__dirname,'../data')+path.sep)||
    [candidateFile,crosswalkFile,skillFile,rosterFile].includes(out))
  fail('未承認データを公開領域に書き込めません');
 const raw=fs.readFileSync(skillFile),roster=fs.readFileSync(rosterFile);
 const expected=require('../data/candidates/checker_event_hints.v1.json').sourcePins.umasimCards.sha256;
 if(hash(raw)!==CANONICAL_SOURCE_SHA||hash(roster)!==expected)
  fail('独立ソースのSHA-256検証に失敗');
 const model=loader.buildModel(roster.toString('utf8'),{mode:'audit'});
 if(model.cards.length!==563)fail('サポカカード数が変化');
 const historicalPreview=historicalReportFile?{
  report:JSON.parse(fs.readFileSync(historicalReportFile,'utf8')),
  privateRecords:JSON.parse(fs.readFileSync(privateRecordsFile,'utf8'))}:undefined;
 const result=project({candidate:JSON.parse(fs.readFileSync(candidateFile,'utf8')),
  crosswalk:JSON.parse(fs.readFileSync(crosswalkFile,'utf8')),
  skillText:raw.toString('utf8'),model,supplemental,historicalPreview});
 console.log('GAMETORA_HISTORICAL_PRECHECK_TOTALS='+JSON.stringify(result.report.totals));
 console.log('GAMETORA_HISTORICAL_PRECHECK_REASONS='+JSON.stringify(result.report.excludedReasons));
 if(result.report.totals.sourceEvents!==2488||
    result.report.totals.sourceChoices!==4129||
    result.report.totals.sourceRoutes!==4376||
    result.report.totals.sourceCards!==563||
    result.report.totals.candidateSchemaEvents+result.report.totals.skippedEvents!==2488||
    result.report.totals.candidateConditionalAvailabilityEvents!==
      result.report.totals.candidateSpecialTriggerEvents+
      result.report.totals.candidateOutingSequenceEvents+
      result.report.totals.candidateOutingRandomEvents||
    (!historicalPreview&&(
      result.report.totals.candidateSchemaEvents!==2347||
      result.report.totals.skippedEvents!==141||
      result.report.totals.blockedDependentStages!==36))||
    (historicalPreview&&(
      result.report.totals.candidateSchemaEvents!==2449||
      result.report.totals.skippedEvents!==39||
      result.report.totals.blockedDependentStages!==4||
      result.report.totals.candidateHistorical2025HintMentions!==77||
      result.report.totals.candidateHistorical2025Events!==73||
      result.report.totals.candidateRewardMentions!==1638||
      result.report.totals.candidateTerminalPaths!==90))||
    result.report.totals.candidateCurationOnlyHintMentions!==11||
    result.report.totals.candidateCurationOnlyEvents!==11||
    result.report.totals.candidateConditionalAvailabilityEvents!==(historicalPreview?251:249)||
    result.report.totals.candidateSpecialTriggerEvents!==113||
    result.report.totals.candidateOutingSequenceEvents!==(historicalPreview?111:109)||
    result.report.totals.candidateOutingRandomEvents!==27)
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
