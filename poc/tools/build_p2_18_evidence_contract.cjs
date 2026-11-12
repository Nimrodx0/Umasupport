#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const model=require('./globalsim_roster32.cjs');
const pair=require('./skill_specificity32_research.cjs');
const contract=require('../src/p2_skill_evidence_contract.cjs');
function main(args){
 if(args.length!==3)throw Error(
  'Usage: build_p2_18_evidence_contract.cjs <source32-manifest.json> <p2-17b-fixed-source.json> <output.json>');
 const [manifestFile,studyFile,outFile]=args;
 const source=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 const sourceResearch=JSON.parse(fs.readFileSync(studyFile,'utf8'));
 const envelope=contract.compile(source,sourceResearch);
 contract.validateEnvelope(envelope);
 if(envelope.population.recordsEligibleForProductCardScoring!==0)
  throw Error('P2.18 research observations wrongly promoted to P3');
 fs.writeFileSync(outFile,JSON.stringify(envelope,null,2)+'\n');
 console.log('P2_18_UNQUALIFIED_RESEARCH_CONTRACT='+JSON.stringify({
  status:envelope.status,population:envelope.population,
  researchSummary:envelope.researchSummary,
  outputSha256:crypto.createHash('sha256').update(
   fs.readFileSync(outFile)).digest('hex'),
  modelRevision:model.PIN,skillRegistrySha256:model.SOURCE_SHA,
  immutableOriginalReportSha256:pair.PINNED
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={main};
