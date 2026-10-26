'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {readDocuments}=require('./audit_gametora_branches.cjs');
const {analyze}=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const {analyze:reviewConditionalSegments}=require('../src/phase2_gt_conditional_segment_review.cjs');
const {candidates:reviewCorrelatedRanges}=require('../src/phase2_gt_correlated_numeric_range.cjs');
const {analyze:classifyBlockedCohorts}=require('../src/phase2_gt_blocker_cohorts.cjs');
const fail=s=>{throw Error('全件非スキル出典監査CLI: '+s);};
function main(args){
 if(args.length!==3)fail('usage: <whole-provisional-index.json> <fixed-GT-dir> <private-CI-output.json>');
 const [indexPath,gtDir,outPath]=args;
 const index=JSON.parse(fs.readFileSync(indexPath,'utf8'));
 const docs=readDocuments(gtDir);
 const result=analyze({documents:docs,index},{strict:true});
 const guarded=reviewConditionalSegments({documents:docs,index,inventory:result});
 const ranged=reviewCorrelatedRanges({documents:docs,index});
 const cohorts=classifyBlockedCohorts({inventory:result,documents:docs,index},
  {strict:true});
 if(ranged.summary.sourceRangeEvents!==14||
    ranged.summary.sourceRangeCards!==12||
    ranged.summary.sourceRangeChoices!==14||
    ranged.summary.rangedValueMentions!==15||
    ranged.summary.rangeEffectComponents!==6||
    ranged.summary.rangeOutcomeCandidates!==9||
    ranged.summary.uncertainChoices!==5||
    ranged.publicationApproved!==false||ranged.automaticRuntimeAdoption!==false||
    ranged.sourceNarrativeIncluded!==false||
    ranged.rows.length!==14)
  fail('連動範囲の2結果を無条件の報酬として昇格');
 if(guarded.summary.sourceSegmentEvents!==3||
    guarded.summary.sourceSegmentCards!==3||
    guarded.summary.sourceSegments!==8||
    guarded.summary.segmentRoutes!==8||
    guarded.summary.guardedRoutes!==7||
    guarded.summary.opaqueScriptedClassGuards!==6||
    guarded.summary.moodGuards!==0||
    guarded.summary.fallbackGuards!==1||
    guarded.summary.unsupportedGuards!==0||
    guarded.publicationApproved!==false||guarded.automaticRuntimeAdoption!==false||
    guarded.sourceNarrativeIncluded!==false||
    guarded.summary.quarantineConfirmedRoutes!==8)
  fail('ガード条件が未解決のまま獲得確定・公開へ昇格');
 if(result.summary.rosterCards!==563||result.summary.sourceCards!==559||
    result.summary.sourceEvents!==2488||result.summary.sourceChoices!==4129||
    result.summary.expandedRoutes!==4376||
    result.summary.allEffectMentions!==13263||
    result.summary.allStatsMentions!==68||
    result.summary.allStatsValidMentions!==68||
    result.summary.allStatsExpandedEffectComponents!==340||
    result.summary.allStatsInvalidMentions!==0||
    result.summary.statusSourceMentions!==121||
    result.summary.statusValidMentions!==121||
    result.summary.statusInvalidMentions!==0||
    result.summary.isolatedPreviewStatusRecords!==98||
    result.summary.isolatedPreviewEffectRecords!==11179||
    result.summary.randomStatMentions!==18||
    result.summary.validRandomStatMentions!==18||
    result.summary.invalidRandomStatMentions!==0||
    result.summary.scenarioCurrencyMentions!==4||
    result.summary.validScenarioCurrencyMentions!==4||
    result.summary.invalidScenarioCurrencyMentions!==0||
    result.summary.contextOperationMentions!==38||
    result.summary.validContextOperationMentions!==38||
    result.summary.invalidContextOperationMentions!==0||
    result.summary.zeroContextOperationMentions!==0||
    result.summary.contextOperationTypes?.ntsr!==14||
    result.summary.contextOperationTypes?.yhs_tix!==12||
    result.summary.contextOperationTypes?.yhs_sr!==12||
    result.summary.scenarioResourceMentions!==16||
    result.summary.validScenarioResourceMentions!==16||
    result.summary.invalidScenarioResourceMentions!==0||
    result.summary.zeroScenarioResourceMentions!==0||
    result.summary.scenarioResourceTypes?.veggies!==10||
    result.summary.scenarioResourceTypes?.ken_ing!==6||
    result.summary.uafAllDiscMentions!==14||
    result.summary.validUafAllDiscMentions!==14||
    result.summary.invalidUafAllDiscMentions!==0||
    result.summary.zeroUafAllDiscMentions!==0||
    result.summary.fullEnergyMentions!==1||
    result.summary.validFullEnergyMentions!==1||
    result.summary.invalidFullEnergyMentions!==0||
    result.summary.isolatedPreviewDynamicRecords!==91||
    result.summary.chainEndMentions!==109||
    result.summary.chainEndAcceptedSourceMentions!==91||
    result.summary.chainEndRejectedSourceMentions!==18||
    result.summary.isolatedTerminalOutcomeRecords!==90||
    result.summary.repeatedNumericSourceMentions!==25||
    result.summary.eligibleRepeatedNumericSourceMentions!==12||
    result.summary.isolatedOrderedRepeatedNumericMentions!==12||
    result.summary.repeatedStatusSourceMentions!==5||
    result.summary.eligibleRepeatedStatusSourceMentions!==2||
    result.summary.isolatedOrderedRepeatedStatusMentions!==2||
    result.summary.isolatedPreviewEventRecords!==2449||
    result.summary.eligibleRoutes!==4319||
    result.summary.blockedRoutes!==57||
    result.summary.blockedEvents!==39||
    result.summary.unrecognizedEffectMentions!==22||
    result.publicationApproved!==false||
    result.automaticRuntimeAdoption!==false||
    result.chainTopologyVerified!==false||
    result.sourceProseIncluded!==false||
    result.summary.publishedEventRecords!==0)
  fail('固定全母数・無公開／無自動導入ゲートが不一致 '+
    JSON.stringify({summary:result.summary,blockers:result.blockedReasons}));
 fs.mkdirSync(path.dirname(outPath),{recursive:true});
 fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');
 const guardPath=path.join(path.dirname(outPath),'phase2_gt_conditional_segments_review_private.v1.json');
 fs.writeFileSync(guardPath,JSON.stringify(guarded,null,2)+'\n');
 const rangePath=path.join(path.dirname(outPath),'phase2_gt_correlated_numeric_range_private.v1.json');
 fs.writeFileSync(rangePath,JSON.stringify(ranged,null,2)+'\n');
 console.log('GT_CORRELATED_NUMERIC_RANGE_SUMMARY='+JSON.stringify(ranged.summary));
 console.log('GT_CORRELATED_NUMERIC_RANGE_POSITIONS='+JSON.stringify(ranged.rows.map(r=>({cardId:r.cardId,sourceOrdinal:r.sourceOrdinal,choiceOrdinal:r.choiceOrdinal,rangeMentions:r.sourceRangeEffectCount,numericTierCandidate:r.canProjectNumericTiers,blockers:r.blockers}))));
 console.log('GT_CONDITIONAL_SEGMENTS_REVIEW_SUMMARY='+JSON.stringify(guarded.summary));
 console.log('GT_CONDITIONAL_SEGMENTS_SOURCE_POSITIONS='+JSON.stringify(
  guarded.rows.map(x=>({cardId:x.cardId,sourceOrdinal:x.sourceOrdinal,
   choiceOrdinal:x.choiceOrdinal,segmentOrdinal:x.segmentOrdinal,
   guardClasses:x.guardDescriptors.map(g=>g.reviewClass)}))));
 // Aggregate by root-cause cohort rather than writing one overlay per event.
 // Metadata is ID/shape only. Still 84 blocked events, not published records.
 console.log('GT_NONSKILL_BLOCKER_COHORTS='+JSON.stringify({
  sourceEvents:cohorts.sourceEvents,blockedEvents:cohorts.blockedEvents,
  affectedCards:cohorts.affectedCards,blockedRoutes:cohorts.blockedRoutes,
  groups:cohorts.cohorts,sourceEffectTypes:cohorts.involvedSourceEffectTypes,
  reasonSignatures:cohorts.reasonSignatures,
  publicationApproved:false
 }));
 console.log('GT_NONSKILL_BLOCKER_COHORT_ROWS='+JSON.stringify(cohorts.rows.map(x=>({
  cardId:x.cardId,sourceOrdinal:x.sourceOrdinal,
  group:x.priorityGroup,reasonCodes:x.reasonCodes,
  types:x.sourceEffectTypes
 }))));
 console.log('GT_ALL_NONSKILL_EFFECT_AUDIT_SUMMARY='+JSON.stringify(result.summary));
 console.log('GT_ALL_NONSKILL_EFFECT_TYPES='+JSON.stringify(result.sourceEffectTypes));
 console.log('GT_ALL_NONSKILL_EFFECT_BLOCKERS='+JSON.stringify(result.blockedReasons));
 console.log('PRIVATE_EFFECT_CANDIDATES_CI_ONLY='+outPath);
}
if(require.main===module){
 try{main(process.argv.slice(2));}catch(e){console.error(e.stack||e.message);process.exitCode=1;}
}
module.exports={main};
