#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const p34=require('../src/p3_4_uncertainty_semantics.cjs');
function main(args){
 if(args.length!==7)throw Error('Usage: build_p3_4_uncertainty_preview.cjs <P2.G6.json> <P3.G6-receipt.json> <P2.15-axes.json> <P2.41-partial-WD.json> <P2.42-dynamic.json> <P2.43-exact-AND.json> <output.json>');
 const [g6,p3,axes,partial,dynamic,selected,out]=args;
 const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
 const report=p34.interpret(read(g6),read(p3),read(axes),
  read(partial),read(dynamic),read(selected));
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log('P3_4A_UNCERTAINTY_RESEARCH_ONLY='+JSON.stringify({
  status:report.status,denominators:report.denominators,
  noProductDecision:!report.provenance.officialPolicyApproved
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={main};
