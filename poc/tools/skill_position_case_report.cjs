#!/usr/bin/env node
'use strict';
/* Only writes small derived probabilities/conditions, never third-party
 * dictionary, deck/event DB, or full simulator replay positions. */
const fs=require('node:fs');
const join=require('../src/skill_position_model_join.cjs');
function main([auditPath,modelPath,outputPath]){
 if(!auditPath||!modelPath||!outputPath)
  throw Error('Usage: skill_position_case_report.cjs skill-condition-inventory-audit.json stability.json report.json');
 const audit=JSON.parse(fs.readFileSync(auditPath,'utf8'));
 const model=JSON.parse(fs.readFileSync(modelPath,'utf8'));
 const result=join.compare(audit,model);
 fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
 const examples=['201052','200702','200722','202312','202311'];
 console.log(JSON.stringify({status:result.status,counts:result.counts,
  examples:examples.map(id=>{
   const item=result.cases.find(x=>x.sourceNumericId===id);
   const preferred=item?.strata?.find(x=>x.fieldSize===9&&
    x.scenario==='balanced'&&x.mode==='equal');
   return {id,name:item?.name||'not-in-source-reviewed-cohort',
    sourceStatus:item?.sourceStatus||'not-in-cohort',
    comparisonStatus:item?.status||'not-in-cohort',
    courseId:preferred?.courseId??null,
    styles:preferred?Object.fromEntries(Object.entries(preferred.styles)
     .map(([style,value])=>[style,{status:value.status,
      percent:value.positionPercent??null,runners:value.runners??null}])):null};
  })},null,2));
}
if(require.main===module){
 try{main(process.argv.slice(2))}catch(e){console.error(e);process.exitCode=1}
}
module.exports={main};
