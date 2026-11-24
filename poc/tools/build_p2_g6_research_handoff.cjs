#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const g6=require('../src/p2_g6_research_handoff_881.cjs');
const intake=require('../src/p3_g6_research_intake.cjs');
function main(args){
 if(args.length!==6)throw Error('Usage: build_p2_g6_research_handoff.cjs <p215-axes.json> <p241-partial-WD.json> <p242-source-dynamic.json> <p243-exact-AND.json> <out-p2-g6.json> <out-p3-research-receipt.json>');
 const [axesFile,partialFile,dynamicFile,selectedFile,outG6,outP3]=args;
 const files=[axesFile,partialFile,dynamicFile,selectedFile];
 const [axes,partial,dynamic,selected]=files.map(p=>
  JSON.parse(fs.readFileSync(p,'utf8')));
 const handoff=g6.build(axes,partial,dynamic,selected);
 const receipt=intake.accept(handoff,axes,partial,dynamic,selected);
 intake.validateReceipt(receipt,handoff,axes,partial,dynamic,selected);
 fs.writeFileSync(outG6,JSON.stringify(handoff,null,2)+'\n');
 fs.writeFileSync(outP3,JSON.stringify(receipt,null,2)+'\n');
 console.log('P2_44_G6_RESEARCH_QUARANTINE='+JSON.stringify({
  denominators:handoff.denominators,
  G6ParentPass:handoff.g6Decision.G6ParentPass,
  P3IntakeStatus:receipt.status,
  P3ResearchReceipt:receipt.population,
  sourceSHA:handoff.source.fixedOriginalSkillRegistrySHA256
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={main};
