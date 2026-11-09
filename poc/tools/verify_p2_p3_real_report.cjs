#!/usr/bin/env node
'use strict';
/* Validate the REAL pinned P2 32-condition two-axis replay, after upstream
 * 5760-race research artifacts pass the generator's five SHA-256 checks.
 * This is an evidence-integrity gate only, not a card/style grading engine. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const bridge=require('../src/p2_p3_evidence_contract.cjs');
const research=require('./skill_specificity32_research.cjs');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const strict=new Set(['first-strict-all-matched-contexts',
 'second-strict-all-matched-contexts']);
function auditReal(report,manifest){
 const {byCondition,byHeadcountPair}=bridge.validate(report,manifest);
 const stats=report.summary;
 assert(stats&&typeof stats==='object','missing P2 summary');
 assert.equal(byCondition.size,64);
 assert.equal(byHeadcountPair.size,192);
 const cells=[...byCondition.values()];
 const pairs=cells.flatMap(c=>c.pairwise);
 assert.equal(pairs.length,384);
 const strictlySigned=pairs.filter(p=>strict.has(
  p.balancedMatchedContextDirection)).length;
 assert.equal(strictlySigned,337,'real fixed P2 strict-direction population drift');
 assert.equal(pairs.length-strictlySigned,47,'real P2 held comparison population drift');
 assert.equal(cells.filter(c=>
  c.allSixPairDirectionsStrictAcrossBalancedContexts).length,21);
 assert.equal(cells.filter(c=>c.fieldSize===9&&
  c.allSixPairDirectionsStrictAcrossBalancedContexts).length,1);
 assert.equal(cells.filter(c=>c.fieldSize===12&&
  c.allSixPairDirectionsStrictAcrossBalancedContexts).length,20);
 const sensitivity=[...byHeadcountPair.values()];
 assert.equal(sensitivity.filter(p=>p.relation==='same-strict-direction').length,156);
 assert.equal(sensitivity.filter(p=>p.relation==='held-at-least-one-headcount').length,36);
 assert.equal(sensitivity.filter(p=>p.relation==='headcount-reversal').length,0);
 const nonbalanced=pairs.map(p=>p.underFourArtificialRosters);
 assert.equal(nonbalanced.filter(x=>
  x==='not-four-way-comparable-style-absent').length,192);
 assert.equal(nonbalanced.filter(x=>
  x==='first-higher-in-all-four-rosters-and-matched-contexts'||
  x==='second-higher-in-all-four-rosters-and-matched-contexts').length,143);
 // Independently check that derived summary agrees with its source records.
 assert.equal(stats.totalConditionHeadcounts,cells.length);
 assert.equal(stats.totalConditionHeadcountPairs,pairs.length);
 assert.equal(stats.fullyStrictBalancedFourStyleOrders,21);
 assert.equal(stats.fullyStrictOrdersByHeadcount['9'],1);
 assert.equal(stats.fullyStrictOrdersByHeadcount['12'],20);
 assert.equal(stats.crossHeadcountPairs['same-strict-direction'],156);
 assert.equal(stats.crossHeadcountPairs['held-at-least-one-headcount'],36);
 const index=bridge.openEvidence(report,manifest);
 const examples=['200681','202671','101902211','202261','202951']
  .map(id=>manifest.profiles.find(p=>p.sourceNumericId===id))
  .map(p=>{
   assert(p,'missing pinned source example');
   const row=index.lookup(p);
   assert.equal(row.status,'source-rank-condition-only-not-full-skill');
   assert.deepEqual(row.fields.map(x=>x.fieldSize),[9,12]);
   return {sourceSignature:p,fieldSizes:row.fields.map(x=>x.fieldSize),
    opportunity10mByField:Object.fromEntries(row.fields.map(x=>[
     x.fieldSize,Object.fromEntries(
      Object.entries(x.styles).map(([s,val])=>[s,val.W10mOpportunityPercent]))
    ])),
    nineVsTwelveHolds:row.headcountSensitivity.filter(x=>
     x.status!=='same-strict-direction').length};
  });
 return {
  schemaVersion:1,
  status:'verified-fixed-P2-source32-to-P3-evidence-contract-not-card-grade',
  sourceModelRevision:report.source.modelRevision,
  sourceSkillRegistrySha256:report.source.fixedUmaSimSkillRegistrySha256,
  manifestPriorReviewSha256:report.source.sourceManifestPreviousReviewSha256,
  metrics:{sourceConditionSignatures:32,conditionHeadcounts:64,stylePairs:384,
   stableWithinBalancedContexts:337,heldWithinBalancedContexts:47,
   completeFourStyleOrders:21,headcountConsistentPairs:156,
   headcountHeldPairs:36},
  researchOnly:true,seedSplitConfirmation:'unverified',
  cardSuitabilityCalculated:false,applicationUIChanged:false,
  examples
 };
}
function main([manifestPath,reportPath,proofPath]){
 if(!proofPath)throw Error(
  'Usage: verify_p2_p3_real_report.cjs manifest.json pinned-two-axis-32.json proof.json');
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 const raw=fs.readFileSync(reportPath);
 const report=JSON.parse(raw);
 const result=auditReal(report,manifest);
 result.derivedReportSha256=digest(raw);
 fs.writeFileSync(proofPath,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,
  sha256:result.derivedReportSha256,metrics:result.metrics,
  sampleCount:result.examples.length},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(err){console.error(err.stack||err);process.exitCode=1}
module.exports={auditReal,main};
