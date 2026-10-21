'use strict';
/* Compare complete in-memory catalog hashes, never catalogs or source prose. */
const fail=s=>{throw Error('非公開スキル候補構造比較: '+s);};
function check(older,newer){
 for(const r of [older,newer]){
  if(r?.dataKind!=='gametora-app-schema-dry-run'||
     r.schemaVersion!==1||r.sourceProseIncluded!==false||
     r.publicationApproved!==false||r.gameVerified!==false||
     !/^[a-f0-9]{64}$/.test(r.runtimeSkillProjectionSha256||'')||
     r.totals?.sourceEvents!==2488||
     r.totals?.candidateSchemaEvents!==2488||
     r.totals?.skippedEvents!==0)
   fail('プレビュー証拠の版・母集団・公開不可の前提が不正');
 }
 if(older.historicalSkillPreviewUsed!==true||
    older.independent2026NamePreviewUsed!==false||
    newer.historicalSkillPreviewUsed!==false||
    newer.independent2026NamePreviewUsed!==true||
    newer.independent2026NamePreviewRetains2025NumericRarityEvidence!==true||
    older.runtimeSkillProjectionSha256!==newer.runtimeSkillProjectionSha256)
  fail('2025旧名と2026別名で候補内容が一致しません');
 const keys=['sourceEvents','sourceChoices','sourceRoutes','candidateRewardMentions',
  'candidateTerminalPaths','candidateSourceReviewedConditionalEvents',
  'candidateSourceReviewedPriorChoiceEvents','candidateNegativeSkillMentions',
  'candidateOutingUnlockEvents','candidateHistorical2025HintMentions'];
 for(const key of keys){
  if(older.totals[key]!==newer.totals[key])fail('構造内訳の不一致: '+key);
 }
 return {dataKind:'private-event-catalog-digest-parity-audit',
  sourceEvents:2488,identicalCatalog:true,
  digest:older.runtimeSkillProjectionSha256,
  noUnapprovedCatalogPublished:true,
  noGameVerificationImplied:true};
}
module.exports={check};
