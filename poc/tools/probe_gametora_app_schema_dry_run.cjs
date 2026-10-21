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
      result.report.totals.candidateSchemaEvents!==2364||
      result.report.totals.skippedEvents!==124||
      result.report.totals.blockedDependentStages!==35))||
    (historicalPreview&&(
      result.report.totals.candidateSchemaEvents!==2471||
      result.report.totals.skippedEvents!==17||
      result.report.totals.blockedDependentStages!==1||
      result.report.totals.candidateHistorical2025HintMentions!==80||
      result.report.totals.candidateHistorical2025Events!==76||
      result.report.totals.candidateRewardMentions!==1677||
      result.report.totals.candidateTerminalPaths!==106))||
    result.report.totals.candidateOutingUnlockEvents!==12||
    result.report.totals.candidateOutingFirstStagesGated!==12||
    result.report.totals.blockedOutingUnlockStarts!==2||
    result.report.totals.blockedDependentOutings!==4||
    result.report.totals.candidateExclusiveOrEvents!==4||
    result.report.totals.candidateExclusiveOrHintEffects!==4||
    result.report.totals.candidateExclusiveOrOptionMentions!==8||
    result.report.totals.candidateExclusiveOrRangedOptions!==2||
    result.report.totals.candidateRangedHintEffects!==(historicalPreview?9:6)||
    result.report.totals.candidateRangeOutcomeEvents!==(historicalPreview?11:8)||
    result.report.totals.candidateCurationOnlyHintMentions!==11||
    result.report.totals.candidateCurationOnlyEvents!==11||
    result.report.totals.candidateConditionalAvailabilityEvents!==(historicalPreview?249:245)||
    result.report.totals.candidateSpecialTriggerEvents!==(historicalPreview?117:115)||
    result.report.totals.candidateOutingSequenceEvents!==(historicalPreview?105:103)||
    result.report.totals.candidateOutingRandomEvents!==27)
  fail('固定GameTora全件数の保存条件に不一致');
 const branchTotals=result.report.branchSemanticsInventory.totals;
 if(branchTotals.multiRouteEvents!==220||
    branchTotals.multiRouteChoices!==236||
    branchTotals.explicitRandomMultiRouteChoices!==233||
    branchTotals.unflaggedMultiRouteChoices!==3||
    branchTotals.skillHintOrEffectMentions!==4||
    branchTotals.skillHintOrOptions!==8||
    branchTotals.eventsWithRangeLevels!==11||
    branchTotals.explicitChainEndRoutes!==109||
    branchTotals.nonChainEndRoutes!==18||
    branchTotals.guardedRoutes!==7||
    branchTotals.directSkillGrantMentions!==7||
    result.report.branchSemanticsInventory.terminalRoutesBySection.arrows!==91||
    result.report.branchSemanticsInventory.terminalRoutesBySection.random!==18)
  fail('分岐の分類別固定全件数が変化しました');
 // WARNING: The derived app catalog contains unreviewed placeholders,
 // numeric skills and conditional routes. Never write it to disk or upload it.
 const report=result.report;
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log('GAMETORA_APP_SCHEMA_DRY_RUN_TOTALS='+JSON.stringify(report.totals));
 console.log('GAMETORA_APP_SCHEMA_DRY_RUN_REASONS='+JSON.stringify(report.excludedReasons));
 console.log('GAMETORA_BLOCKER_DIAGNOSIS='+JSON.stringify({totalExcluded:report.blockerDiagnosis.totalExcluded,sourceSectionCounts:report.blockerDiagnosis.sourceSectionCounts,sourceEvidenceEventCounts:report.blockerDiagnosis.sourceEvidenceEventCounts,specialCaseEvidenceCombinations:report.blockerDiagnosis.specialCaseEvidenceCombinations}));
 console.log('GAMETORA_BRANCH_SEMANTICS='+JSON.stringify({totals:report.branchSemanticsInventory.totals,sourceSectionEvents:report.branchSemanticsInventory.sourceSectionEvents,terminalRoutesBySection:report.branchSemanticsInventory.terminalRoutesBySection}));
 console.log('GAMETORA_NONCHAIN_TERMINALS='+JSON.stringify(
  report.branchSemanticsInventory.numericOnlyReviewPositions
   .filter(x=>x.section!=='arrows'&&x.terminalRoutes>0)
   .map(x=>({cardId:x.cardId,sourceOrdinal:x.sourceOrdinal,
    terminalRoutes:x.terminalRoutes,section:x.section}))))
 console.log('Publication remains disabled. Runtime-compatible catalog is ephemeral and discarded.');
}
if(require.main===module){
 try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={main};
