#!/usr/bin/env node
'use strict';
/*
 * Download only the pinned original source documents. Source registry sha256
 * and Kotlin checker semantics are revalidated by the research module.
 */
const fs=require('node:fs');
const review=require('../src/p3_4d_selected_source_skill_review.cjs');
const BASE='https://raw.githubusercontent.com/mee1080/umasim/'+review.PIN+'/';
const PATHS=[
 'data/skill_data.txt',
 'race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt',
 'race/src/commonMain/kotlin/io/github/mee1080/umasim/race/data2/SkillData.kt'
];
const get=async p=>{
 const response=await fetch(BASE+p,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('pinned original source unavailable HTTP '+response.status+': '+p);
 return response.text();
};
async function main(args){
 if(args.length!==2)throw Error('usage: node build_p3_4d_selected_source_skill_review.cjs verified-p3.4a-881.json review-out.json');
 const [receiptPath,out]=args;
 const preview=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
 const [originalText,checkerText,approxText]=await Promise.all(PATHS.map(get));
 const result=review.review({originalText,checkerText,approxText,preview});
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('P3_4D_FOUR_NAMED_ORIGINAL_SKILL_REVIEWS='+JSON.stringify({
  summary:result.summary,
  kinds:result.rows.map(x=>({name:x.originalName,id:x.sourceNumericId,
   class:x.evidenceClass,approved:x.productLabelApproved,
   originalSourceStatus:x.sourceModelEvidenceStatus})),
  formalProductPolicyApproved:result.provenance.formalProductPolicyApproved
 }));
}
if(require.main===module)main(process.argv.slice(2))
 .catch(e=>{console.error(e.stack||e);process.exitCode=1});
module.exports={main,PATHS};
