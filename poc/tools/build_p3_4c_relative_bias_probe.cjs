#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const probe=require('../src/p3_4c_relative_bias_decision_probe.cjs');
function main(files){
 if(files.length!==2)throw Error('usage: node build_p3_4c_relative_bias_probe.cjs <verified-p3.4a-881.json> <out-research-no-labels.json>');
 const [src,out]=files;
 const data=JSON.parse(fs.readFileSync(src,'utf8'));
 const report=probe.inspectP34aRealResearch(data);
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log('P3_4C_RELATIVE_BIAS_NO_REAL_SKILL_LABELS='+JSON.stringify({
  status:report.status,summary:report.summary,
  noApprovalGranted:!report.provenance.modelComparisonToUserLabelConversionApproved
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={main};
