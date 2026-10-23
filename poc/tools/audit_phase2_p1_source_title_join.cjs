'use strict';
/*
 * CI-only metadata report. All source prose stays in the pinned input or in RAM.
 * Usage: node poc/tools/audit_phase2_p1_source_title_join.cjs <whole-index.json> <gt-dir>
 */
const fs=require('node:fs');
const path=require('node:path');
const {TARGETS,compare}=require('../src/phase2_p1_source_title_join.cjs');
function main(args){
 if(args.length!==2)throw Error('Expected whole-event index and pinned GameTora directory');
 const [indexPath,dir]=args;
 const index=JSON.parse(fs.readFileSync(indexPath,'utf8'));
 const checker=require('../data/candidates/checker_event_hints.v1.json');
 const docs=TARGETS.map(t=>JSON.parse(fs.readFileSync(
  path.join(dir,'support_'+t.cardId+'.json'),'utf8')));
 const report=compare({index,checker,gtDocuments:docs},{strict:true});
 console.log('P1_SOURCE_TITLE_JOIN_SUMMARY='+JSON.stringify(report.summary));
 console.log('P1_SOURCE_TITLE_JOIN_ROWS='+JSON.stringify(report.rows.map(r=>({
  cardId:r.cardId,checkerOrdinal:r.checkerOrdinal,
  gtOrdinal:r.gameToraSourceOrdinal,gtLocalId:r.gameToraLocalId,
  matched:r.titleKeyMatchesKnownGameWithHeading,
  titleVariantClass:r.titleVariantClass,
  resultsVerified:r.outcomeSemanticsProvenEquivalent,
  publicationApproved:r.publicationApproved
 }))));
 if(report.summary.publicEventsAdded!==0||report.skillGrantsAdded!==0||
    report.chainFlagsChanged!==0)
  throw Error('P1検証の非公開／非書換ゲート違反');
}
if(require.main===module)main(process.argv.slice(2));
module.exports={main};
