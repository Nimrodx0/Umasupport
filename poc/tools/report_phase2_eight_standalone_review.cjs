#!/usr/bin/env node
'use strict';
/* Only console review facts: never writes source text, public JSON or approvals. */
const {build}=require('../src/phase2_eight_standalone_review_pack.cjs');
try{
 const out=build();
 console.log('Nonpublic SSR 8-standalone-event editorial review. NEVER publish this output.');
 if(process.argv.includes('--json')){
  const {model,previewCatalog,...safe}=out;
  console.log(JSON.stringify({...safe,
   previewCatalogSchemaValidated:true,publicPreviewCatalogOmitted:true},null,2));
 }else{
  console.log(JSON.stringify(out.summary));
  for(const row of out.records){
   console.log(row.cardId+'/'+row.sourceOrdinal,
    row.proposedReviewKey,row.neutralDisplayDraft.name);
   for(const alt of row.choiceFacts)
    console.log('  '+alt.displayPlaceholder,
     'hints='+alt.skillHints.map(x=>x.skillNumericId+':'+x.hintLevel).join(','),
     'effects='+alt.numericEffects.map(x=>x.kind+'='+x.value).join(','));
   console.log('  review blockers='+row.blockers.join(','));
  }
 }
}catch(e){console.error(e.message);process.exitCode=1;}
