#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {project}=require('../src/gametora_app_schema_dry_run.cjs');
const {exercise}=require('../src/gametora_full_runtime_integration.cjs');
const loader=require('../src/live_loader.js');
const {CANONICAL_SOURCE_SHA}=require('../src/gametora_event_skill_crosswalk.cjs');
const {gitBlobSha,INDEPENDENT_SKILLS_BLOB}=
 require('../src/independent_skill_fingerprint_audit.cjs');
const supplemental=require('../data/curation/supplemental_skills.v1.json');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const fail=x=>{throw Error('GameToraイベント実行スキーマ検証: '+x);};
function main(args){
 if(![5,7,8].includes(args.length))
  fail('usage: <numeric-candidate> <crosswalk> <skill_data.txt> <support_card.txt> <numeric-summary-output> [historical-report.json private-historical-records.json] OR [numeric-historical-report.json pinned-2026-skills.json independent-fingerprint-report.json]');
 const [candidateFile,crosswalkFile,skillFile,rosterFile,out,
   historicalReportFile,privateRecordsFile,independentAuditFile]=args.map(x=>path.resolve(x));
 if(out.startsWith(path.resolve(__dirname,'../data')+path.sep)||
    [candidateFile,crosswalkFile,skillFile,rosterFile].includes(out))
  fail('未承認データを公開領域に書き込めません');
 const raw=fs.readFileSync(skillFile),roster=fs.readFileSync(rosterFile);
 const expected=require('../data/candidates/checker_event_hints.v1.json').sourcePins.umasimCards.sha256;
 if(hash(raw)!==CANONICAL_SOURCE_SHA||hash(roster)!==expected)
  fail('独立ソースのSHA-256検証に失敗');
 const model=loader.buildModel(roster.toString('utf8'),{mode:'audit'});
 if(model.cards.length!==563)fail('サポカカード数が変化');
 const historicalReport=historicalReportFile?
  JSON.parse(fs.readFileSync(historicalReportFile,'utf8')):undefined;
 const historicalPreview=args.length===7?{
  report:historicalReport,
  privateRecords:JSON.parse(fs.readFileSync(privateRecordsFile,'utf8'))}:undefined;
 let independent2026Preview;
 if(args.length===8){
  const skillBytes=fs.readFileSync(privateRecordsFile);
  if(gitBlobSha(skillBytes)!==INDEPENDENT_SKILLS_BLOB||
     hash(skillBytes)!=='11bf7aa86d611047f5052b48059cf77d6aa9b4a7ad8e25ba2f7f901dcd267e62')
   fail('2026年別資料の固定ファイルと異なります');
  const audit=JSON.parse(fs.readFileSync(independentAuditFile,'utf8'));
  if(audit.dataKind!=='independent-2026-metadata-skill-name-fingerprint-audit'||
     audit.sourcePins?.independentSkillBlob!==INDEPENDENT_SKILLS_BLOB||
     audit.sourcePins?.independentJsonSha256!==hash(skillBytes)||
     audit.totals?.nameFingerprintMatches!==28||
     audit.automaticAdoptionAllowed!==false||
     audit.publicationApproved!==false)
   fail('2026年別資料の名称照合記録と不一致');
  independent2026Preview={historicalReport,skills:JSON.parse(skillBytes.toString('utf8'))};
 }
 const crosswalkRecord=JSON.parse(fs.readFileSync(crosswalkFile,'utf8'));
 const candidateAudit=JSON.parse(fs.readFileSync(candidateFile,'utf8'));
 const result=project({candidate:candidateAudit,
  crosswalk:crosswalkRecord,
  skillText:raw.toString('utf8'),model,supplemental,historicalPreview,independent2026Preview});
 // Exact source numeric IDs and positions only; no scraped words, names,
 // outcome prose or unpublished runtime catalog leave the temporary runner.
 // Exactly one full-coverage CI variant binds short headings from the
 // pinned GT source files to the 2,488 projected events IN MEMORY ONLY.
 // Source narrative, original options and the candidate JSON are discarded.
 if(process.env.UMASUPPORT_GT_EVENT_DIR&&independent2026Preview!==undefined){
  const {readDocuments}=require('./audit_gametora_branches.cjs');
  const {bindNames}=require('../src/gametora_short_event_title_intake.cjs');
  const enriched=bindNames({
   normalized:candidateAudit,
   projectedCatalog:result.dryRunUnpreparedCatalog,
   documents:readDocuments(process.env.UMASUPPORT_GT_EVENT_DIR)
  },{strict:true});
  const summary=enriched.summary;
  if(summary.sourceEvents!==2488||
     summary.projectedEvents!==2488||
     summary.shortTitlesJoined+summary.shortTitlesNeedsReview!==2488)
   fail('元GTイベント名と本番候補の全件照合に失敗');
  // Only metadata may leave this nonpublic runner; the source titles,
  // choice labels, effect prose and unapproved runtime catalog remain in RAM.
  if(process.env.UMASUPPORT_GT_BASELINE_REPORT||process.env.UMASUPPORT_GT_REVIEW_QUEUE_OUTPUT){
   if(!process.env.UMASUPPORT_GT_BASELINE_REPORT||
      !process.env.UMASUPPORT_GT_REVIEW_QUEUE_OUTPUT)
    fail('非公開レビュー台帳の入力・出力パスが揃っていません');
   const outputFile=path.resolve(process.env.UMASUPPORT_GT_REVIEW_QUEUE_OUTPUT);
   const checkoutRoot=path.resolve(__dirname,'../..');
   if(outputFile===checkoutRoot||outputFile.startsWith(checkoutRoot+path.sep))
    fail('未承認審査台帳をGit管理領域へ保存できません');
   const baselineReport=JSON.parse(fs.readFileSync(
    path.resolve(process.env.UMASUPPORT_GT_BASELINE_REPORT),'utf8'));
   const {build:buildQueue}=require('../src/gametora_publication_review_queue.cjs');
   const reviewQueue=buildQueue({
    normalized:candidateAudit,enriched,baselineReport,completeReport:result.report
   },{strict:true});
   fs.mkdirSync(path.dirname(outputFile),{recursive:true});
   fs.writeFileSync(outputFile,JSON.stringify(reviewQueue,null,2)+'\n');
   console.log('GAMETORA_UNSIGNED_RELEASE_REVIEW='+JSON.stringify({
    ...reviewQueue.summary,
    allHumanApprovalFieldsIntentionallyAbsent:true,
    sourceNarrativeOrChoiceProseIncluded:false
   }));
   const {apply:apply30080}=require('../src/phase2_30080_runtime_overlay.cjs');
   const fixed30080=apply30080({
    catalog:enriched.catalog,normalized:candidateAudit,review:reviewQueue
   });
   if(fixed30080.reviewEvidence.runtimeSelectedHintRoutes.join(',')!=='0,1,1,1')
    fail('SSR30080の特殊イベント3択の実集計検証に失敗');
   console.log('PHASE2_30080_PRIVATE_RUNTIME_OVERLAY='+JSON.stringify({
    cardId:fixed30080.reviewEvidence.cardId,
    sourceOrdinal:fixed30080.reviewEvidence.sourceOrdinal,
    sourceChoiceRows:fixed30080.reviewEvidence.sourceChoiceRows,
    adjudicatedPlayerChoices:fixed30080.reviewEvidence.adjudicatedPlayerChoices,
    runtimeSelectedHintRoutes:fixed30080.reviewEvidence.runtimeSelectedHintRoutes,
    conditionalSpecialTriggerPreserved:true,
    beforeEventSha256:fixed30080.reviewEvidence.beforeEventSha256,
    afterEventSha256:fixed30080.reviewEvidence.afterEventSha256,
    publicationApproved:false,publicCatalogUnchanged:true
   }));
   if(process.env.UMASUPPORT_GT_CROSS_SOURCE_QUEUE||
      process.env.UMASUPPORT_GT_TRIAGE_OUTPUT){
    if(!process.env.UMASUPPORT_GT_CROSS_SOURCE_QUEUE||
       !process.env.UMASUPPORT_GT_TRIAGE_OUTPUT)
     fail('出典横断例外キューの入力・出力パスが揃っていません');
    const triageOutput=path.resolve(process.env.UMASUPPORT_GT_TRIAGE_OUTPUT);
    if(triageOutput===checkoutRoot||triageOutput.startsWith(checkoutRoot+path.sep))
     fail('非公開例外トリアージをGit管理領域へ保存できません');
    const crossSource=JSON.parse(fs.readFileSync(
     path.resolve(process.env.UMASUPPORT_GT_CROSS_SOURCE_QUEUE),'utf8'));
    const {build:buildTriage}=require('../src/phase2_release_triage.cjs');
    const triage=buildTriage({
     review:reviewQueue,normalized:candidateAudit,baselineReport,crossSource
    },{strict:true});
    fs.mkdirSync(path.dirname(triageOutput),{recursive:true});
    fs.writeFileSync(triageOutput,JSON.stringify(triage,null,2)+'\n');
    console.log('GAMETORA_CROSS_SOURCE_RELEASE_TRIAGE='+JSON.stringify({
     ...triage.summary,publicReleaseApproved:false,
     sourceNarrativeOrChoiceProseIncluded:false
    }));
   }
  }
  // No source titles or unapproved runtime catalog are printed or written.
  const fingerprint=hash(Buffer.from(JSON.stringify(enriched.catalog)));
  console.log('GAMETORA_SHORT_TITLE_REVIEW_SCOPE='+JSON.stringify({
   ...summary,releaseApproved:false,catalogSha256:fingerprint,
   sourceChoiceOrOutcomeProseIncluded:false}));
 }
 const augmented=historicalPreview!==undefined||independent2026Preview!==undefined;
 // Execute the projected, unapproved event catalog through the ACTUAL
 // deck/choice/outcome aggregator before it is discarded. Never serialize it.
 const integration=exercise({
  catalog:result.dryRunCatalog,report:result.report,model,
  rawCatalog:result.dryRunUnpreparedCatalog,
  mergedSkillText:result.dryRunMergedSkillText
 },{strict:augmented});
 if(integration.actualProductionCatalogAttachExercised!==true||
    integration.attachedOnlyToTemporaryModel!==true)
  fail('本番イベントDB結合を経由できていません');
 console.log('GAMETORA_FULL_CORE_INTEGRATION='+JSON.stringify(integration.totals));
 if(independent2026Preview!==undefined){
  console.log('GAMETORA_INDEPENDENT_2026_NAME_PREVIEW='+JSON.stringify({
   metadataRevision:'0cacbb1aaf9dca10283d5b9ea20b205b9d204535',
   namesConfirmed:28,adoptedForPublication:false,
   historical2025NumericRarityStillUsed:true}));
 }
 const directAwardRecords=crosswalkRecord.locations.filter(x=>x.kind==='direct-skill-award');
 console.log('GAMETORA_DIRECT_AWARD_STATUS='+JSON.stringify(directAwardRecords.map(x=>({
  cardId:x.cardId,sourceOrdinal:x.sourceOrdinal,
  choiceOrdinal:x.choiceOrdinal,routeOrdinal:x.routeOrdinal,
  awardOrdinal:x.awardOrdinal,numericId:x.numericId,status:x.status,
  rarity:x.rarity||null
 }))));
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
    (!augmented&&(
      result.report.totals.candidateSchemaEvents!==2378||
      result.report.totals.skippedEvents!==110||
      result.report.totals.blockedDependentStages!==35))||
    (augmented&&(
      result.report.totals.candidateSchemaEvents!==2488||
      result.report.totals.skippedEvents!==0||
      result.report.totals.blockedDependentStages!==0||
      result.report.totals.candidateHistorical2025HintMentions!==81||
      result.report.totals.candidateHistorical2025Events!==77||
      result.report.totals.candidateRewardMentions!==1696||
      result.report.totals.candidateTerminalPaths!==109))||
    result.report.totals.candidateIndependent2026NameHintMentions!==(independent2026Preview?81:0)||
    result.report.totals.candidateIndependent2026NameEvents!==(independent2026Preview?77:0)||
    result.report.independent2026NamePreviewUsed!==(independent2026Preview!==undefined)||
    result.report.totals.candidateSourceReviewedConditionalEvents!==(augmented?2:1)||
    result.report.totals.candidateSourceReviewedDuplicateEvents!==1||
    result.report.totals.candidateSourceReviewedPriorChoiceEvents!==1||
    result.report.totals.candidateCollapsedDuplicatedSourceHints!==2||
    result.report.totals.candidateSkillInvariantScriptedEvents!==2||
    result.report.totals.candidateUnmodeledNonSkillBranches!==6||
    result.report.totals.candidateDirectAcquisitionMentions!==0||
    result.report.totals.candidateNegativeSkillMentions!==(augmented?7:6)||
    result.report.totals.candidateNegativeSkillEvents!==(augmented?5:4)||
    result.report.totals.candidateOutingUnlockEvents!==14||
    result.report.totals.candidateOutingFirstStagesGated!==14||
    result.report.totals.blockedOutingUnlockStarts!==0||
    result.report.totals.blockedDependentOutings!==0||
    result.report.totals.candidateExclusiveOrEvents!==4||
    result.report.totals.candidateExclusiveOrHintEffects!==4||
    result.report.totals.candidateExclusiveOrOptionMentions!==8||
    result.report.totals.candidateExclusiveOrRangedOptions!==2||
    result.report.totals.candidateRangedHintEffects!==(augmented?9:6)||
    result.report.totals.candidateRangeOutcomeEvents!==(augmented?11:8)||
    result.report.totals.candidateCurationOnlyHintMentions!==11||
    result.report.totals.candidateCurationOnlyEvents!==11||
    result.report.totals.candidateConditionalAvailabilityEvents!==(augmented?257:253)||
    result.report.totals.candidateSpecialTriggerEvents!==(augmented?119:117)||
    result.report.totals.candidateOutingSequenceEvents!==(augmented?111:109)||
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
 console.log('GAMETORA_FINAL_BLOCKER_LOCATIONS='+JSON.stringify(
  report.blockerDiagnosis.numericOnlyPositions.map(pos=>{
   const card=candidateAudit.cards.find(c=>c.cardId===pos.cardId);
   const event=card?.events.find(e=>e.sourceOrdinal===pos.sourceOrdinal);
   return {...pos,
    choices:(event?.choices||[]).map(choice=>({
     ordinal:choice.choiceOrdinal,random:choice.reportedRandomAlternative,
     routes:choice.routes.map(route=>({
      ordinal:route.routeOrdinal,terminal:route.explicitChainEnd,
      guarded:route.guardKinds,
      review:route.conditionsRequiringReview,
      hintIds:route.numericHintFacts.map(h=>h.skillNumericId),
      hintKinds:route.numericHintFacts.map(h=>h.originType),
      directSkillIds:route.directSkillGrantFacts.map(a=>a.skillNumericId)
     }))
    }))
   };
  })));
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
