'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {check}=require('../src/private_schema_digest_parity.cjs');
function record(kind){
 return {schemaVersion:1,dataKind:'gametora-app-schema-dry-run',
  sourceProseIncluded:false,publicationApproved:false,gameVerified:false,
  runtimeSkillProjectionSha256:'a'.repeat(64),
  historicalSkillPreviewUsed:kind==='old',
  independent2026NamePreviewUsed:kind==='new',
  independent2026NamePreviewRetains2025NumericRarityEvidence:kind==='new',
  totals:{sourceEvents:2488,candidateSchemaEvents:2488,skippedEvents:0,
   sourceChoices:4129,sourceRoutes:4376,candidateRewardMentions:1696,
   candidateTerminalPaths:109,candidateSourceReviewedConditionalEvents:2,
   candidateSourceReviewedPriorChoiceEvents:1,candidateNegativeSkillMentions:7,
   candidateOutingUnlockEvents:14,candidateHistorical2025HintMentions:81}};
}
test('hash-equivalent private catalogs pass, without leaking catalog objects',()=>{
 const p=check(record('old'),record('new'));
 assert.equal(p.identicalCatalog,true);
 assert.equal(p.noUnapprovedCatalogPublished,true);
 assert.equal(JSON.stringify(p).includes('skillId'),false);
});
test('digest mismatch, invalid release flag, changed counts or source reversal fail closed',()=>{
 const attacks=[
  (a,b)=>{b.runtimeSkillProjectionSha256='b'.repeat(64);},
  (a,b)=>{b.publicationApproved=true;},
  (a,b)=>{b.totals.sourceChoices++;},
  (a,b)=>{a.historicalSkillPreviewUsed=false;},
  (a,b)=>{b.independent2026NamePreviewRetains2025NumericRarityEvidence=false;},
  (a,b)=>{b.totals.candidateSchemaEvents=2487;},
  (a,b)=>{a.sourceProseIncluded=true;}
 ];
 for(const attack of attacks){
  const a=record('old'),b=record('new');attack(a,b);
  assert.throws(()=>check(a,b),/比較/);
 }
});
