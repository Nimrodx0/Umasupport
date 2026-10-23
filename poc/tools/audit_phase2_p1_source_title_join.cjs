'use strict';
/*
 * CI-only metadata report. All source prose stays in the pinned input or in RAM.
 * Usage: node poc/tools/audit_phase2_p1_source_title_join.cjs <whole-index.json> <gt-dir>
 */
const fs=require('node:fs');
const path=require('node:path');
const {TARGETS,sourceKey,compare}=require('../src/phase2_p1_source_title_join.cjs');
function main(args){
 if(args.length!==3)throw Error('Expected whole-event index, pinned GT dir, pinned raw Checker');
 const [indexPath,dir,checkerPath]=args;
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
 // Diagnostic never emits Checker original event titles or option/effect text.
 const rawChecker=JSON.parse(fs.readFileSync(checkerPath,'utf8').replace(/^\\uFEFF/,''));
 const profiles=report.rows.map(r=>{
  const target=TARGETS.find(t=>t.cardId===r.cardId),found=[];
  for(const group of Object.values(rawChecker.Skills?.SSR||{})){
   for(const [i,ev] of (group.Events||[]).entries()){
    const heading=Object.keys(ev)[0];
    if(i+1===r.checkerOrdinal&&sourceKey(r.cardId,i+1,heading)===r.sourceKey)
     found.push(heading.normalize('NFKC').trim());
   }
  }
  const t=found.length===1?found[0]:null;
  const base=target.gtName.normalize('NFKC');
  return {cardId:r.cardId,sourceTitleCandidates:found.length,
   length:t?.length??null,
   baseLength:base.length,
   equalsBase:t===base,
   containsBase:t?.includes(base)??false,
   startsBase:t?.startsWith(base)??false,
   endsBase:t?.endsWith(base)??false,
   containsWarmContext:t?.includes('温かなメッセージ')??false,
   containsTraining:t?.includes('トレーニング')??false,
   includesSpecialResult:t?.includes('成功')??false,
   // Character counts only; the original title must not leave RAM.
   commonPrefixLength:t?[...base].reduce((n,ch,i)=>n===i&&[...t][i]===ch?n+1:n,0):null};
 });
 console.log('P1_SOURCE_TITLE_META_ONLY='+JSON.stringify(profiles));
 if(report.summary.publicEventsAdded!==0||report.skillGrantsAdded!==0||
    report.chainFlagsChanged!==0)
  throw Error('P1検証の非公開／非書換ゲート違反');
}
if(require.main===module)main(process.argv.slice(2));
module.exports={main};
