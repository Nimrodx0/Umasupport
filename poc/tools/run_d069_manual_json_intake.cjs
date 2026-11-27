'use strict';
// Invoked by github-script from main only. No automatic event-source run.
const fs=require('node:fs');
const {gitBlobSha,POLICY}=require('../src/current_umasim_roster_delta.cjs');
const {emptyLedger}=require('../src/derived_github_pending_ledger.cjs');
const {planRosterFirst,preserveOnSourceOutage}=require('../src/derived_github_pending_refresh.cjs');
const {planEventDrivenIntake}=require('../src/direct_pending_review.cjs');
const {planBatch,runBatch}=require('../src/d069_json_attempt_ledger.cjs');
const {createStore}=require('../src/d069_github_attempt_store.cjs');
const {createObserver}=require('../src/d069_card_json_transport.cjs');
const policy=require('../config/direct-event-intake-policy.v1.json');
const review=require('../config/direct-event-pending-review.v1.json');
const fail=x=>{throw Error('D069 manual intake: '+x);};
async function execute({github,context,core,mode,targetText,temp=process.env.RUNNER_TEMP}={}){
 if(context?.eventName!=='workflow_dispatch'||context.ref!=='refs/heads/main'||!['plan','observe','retry'].includes(mode)||
    !/^[1-9]\d{4}(,[1-9]\d{4})?$/.test(targetText||''))fail('explicit main dispatch required');
 const targetIds=targetText.split(',');
 if(new Set(targetIds).size!==targetIds.length)fail('duplicate targets');
 const coord=context.repo,main=(await github.rest.git.getRef({...coord,ref:'heads/main'})).data.object.sha;
 if(main!==context.sha)fail('main changed; dispatch current version');
 const read=name=>fs.readFileSync(temp+'/'+name,'utf8');
 const sourcePin=JSON.parse(read('direct-uma-meta.json'));
 const previousRosterText=read('direct-before.txt'),currentRosterText=read('direct-current.txt'),skillText=read('direct-skills.txt');
 if(gitBlobSha(previousRosterText)!==POLICY.beforeBlob||gitBlobSha(currentRosterText)!==sourcePin.cardBlob||
    gitBlobSha(skillText)!==sourcePin.skillBlob)fail('immutable input mismatch');
 const existingCatalog=require('../data/reviewed_events.v1.json');
 const previous=emptyLedger();
 const {discovery}=planRosterFirst({previousRosterText,currentRosterText,previousLedger:previous,existingCatalog});
 const {ledger:next}=preserveOnSourceOutage({discovery,previousLedger:previous,existingCatalog,directReview:true});
 const plan=planEventDrivenIntake({previous,next,review,sourcePin:{commit:sourcePin.commit,cardBlob:sourcePin.cardBlob},policy});
 const store=createStore({github,...coord});
 const selected=planBatch({plan,ledger:await store.load(),targetIds,sourcePin,policy,existingCatalog});
 core.info('D069_MANUAL_SELECTION='+JSON.stringify(selected));
 let retryApproval=null;
 if(mode==='retry'){
  const config=require('../config/d069-reviewed-retries.v1.json');
  if(config.schemaVersion!==1||!Array.isArray(config.approvals)||targetIds.length!==1)fail('retry approval configuration');
  const matches=config.approvals.filter(x=>x.cardId===targetIds[0]);
  if(matches.length!==1)fail('no unique reviewed retry approval');
  retryApproval=matches[0];
 }
 if(mode==='plan'||mode==='observe'&&!selected.selectedIds.length)return {selection:selected,results:[],sourceRequestsPerformed:false};
 const result=await runBatch({plan,targetIds,sourcePin,policy,existingCatalog,skillText,store,retryApproval,now:new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),
  observeBatch:createObserver({manualAuthorized:true,knownIds:existingCatalog.cards.map(c=>c.cardId)})});
 // Prose-free review packets only, after successful completion CAS.
 // The raw body is never serialized to log or disk.
 core.info('D069_MANUAL_RESULT='+JSON.stringify(result));
 if(result.stopReason)core.setFailed('D069 observation failed; reserved IDs uncertain, no automatic retry');
 return result;
}
module.exports={execute};
