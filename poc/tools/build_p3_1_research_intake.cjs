#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const intake=require('../src/p3_research_evidence_intake.cjs');
function main(args){
 if(args.length!==3)throw Error(
  'Usage: build_p3_1_research_intake.cjs <source32-manifest.json> <p2-18-unqualified.json> <research-only-receipt.json>');
 const [manifestFile,evidenceFile,outFile]=args;
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 const input=JSON.parse(fs.readFileSync(evidenceFile,'utf8'));
 const receipt=intake.build(manifest,input);
 intake.validateReceipt(receipt,manifest,input);
 fs.writeFileSync(outFile,JSON.stringify(receipt,null,2)+'\n');
 const digest=crypto.createHash('sha256').update(fs.readFileSync(outFile))
  .digest('hex');
 console.log('P3_1_QUARANTINED_RESEARCH_INTAKE='+JSON.stringify({
  status:receipt.status,population:receipt.population,
  originalSourceIds:receipt.sourceConditionEvidence.map(x=>
   x.originalSourceCondition.originalSourceNumericId),
  outputSha256:digest,
  noProductAdoption:true
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={main};
