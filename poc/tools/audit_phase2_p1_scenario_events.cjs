'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {TARGETS,compare}=require('../src/phase2_p1_source_title_join.cjs');
const {verify}=require('../src/phase2_p1_scenario_event_ledger.cjs');
function main(args){
 if(args.length!==2)throw Error('Usage: audit_phase2_p1_scenario_events.cjs <whole-index> <gt-dir>');
 const [indexFile,dir]=args;
 const index=JSON.parse(fs.readFileSync(indexFile,'utf8'));
 const checker=require('../data/candidates/checker_event_hints.v1.json');
 const read=id=>JSON.parse(fs.readFileSync(path.join(dir,'support_'+id+'.json'),'utf8'));
 const p1=compare({index,checker,gtDocuments:TARGETS.map(t=>read(t.cardId))},
  {strict:true});
 const docs=['10094','30067','30081','30137','30160'].map(read);
 const result=verify({comparison:p1,gtDocuments:docs},{strict:true});
 console.log('P1_SCENARIO_LEDGER='+JSON.stringify(result.summary));
 if(result.technicalRuntimeEventAdditions!==0||
    result.skillGrantsAdded!==0||result.publicEventsAdded!==0||
    result.publicationApproved!==false)
  throw Error('Never release or grant from a scenario metadata-only review');
}
if(require.main===module)main(process.argv.slice(2));
module.exports={main};
