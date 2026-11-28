'use strict';
const {MAX,activeRefusal,retryable,hardRefusal}=require('./d077_intake_recovery.cjs');
const ACCEPTANCE='umasupport/data-acceptance';
const title='Event data automatic update: action required';
function health({ledger,queue,auto,report,now=new Date().toISOString()}){
 const rows=new Map(ledger.rows.map(r=>[r.cardId,r])),alerts=[];
 if(activeRefusal(ledger))alerts.push('source-refused: review source restrictions and explicit clearance');
 for(const q of queue.rows){
  const r=rows.get(q.cardId);
  if(report?.selectedIds?.includes(q.cardId)&&report.branchWritten)continue;
  if(r?.status==='reserved')alerts.push(q.cardId+': interrupted reservation; inspect prior run');
  else if(r&&retryable(r)&&(!r.attempt||r.attempt.count>=MAX))alerts.push(q.cardId+': retry exhausted or legacy/manual retry required');
  else if(r&&hardRefusal(r)&&!activeRefusal({rows:[r]})&&(!r.attempt||r.attempt.count>=MAX))alerts.push(q.cardId+': cleared refusal; individual recovery required');
  else if(r?.status==='uncertain'&&!retryable(r)&&!hardRefusal(r))alerts.push(q.cardId+': '+(r.failureCode??'unknown failure'));
  else if(['held','catalog-drift','packet-unavailable-or-invalid','skill-dictionary-unavailable-or-invalid','skill-id-unresolved','ready-for-independent-review'].includes(q.status))alerts.push(q.cardId+': '+q.status);
 }
 if(report?.status==='legacy-proposal-open')alerts.push('obsolete release proposal remains open');
 return {alerts:[...new Set(alerts)].sort(),blocked:activeRefusal(ledger),temporary:!!auto.stopReason&&!activeRefusal(ledger)};
}
async function reconcileIssue({github,owner,repo,alerts}){
 const coord={owner,repo},issues=await github.paginate(github.rest.issues.listForRepo,{...coord,state:'open',per_page:100});
 const matches=issues.filter(x=>!x.pull_request&&x.title===title&&x.user?.login==='github-actions[bot]');
 if(matches.length>1)throw Error('Multiple automatic health issues');
 const old=matches[0];
 if(!alerts.length){if(old)await github.rest.issues.update({...coord,issue_number:old.number,state:'closed',state_reason:'completed'});return;}
 const body='Automatic update needs attention. No source prose or raw JSON.\n\n'+alerts.map(x=>'- '+x).join('\n')+'\n\nSee docs/how-to/event-data-branch-update.md. Only new or changed problems update this issue.';
 if(old){if(old.body!==body)await github.rest.issues.update({...coord,issue_number:old.number,body});}
 else await github.rest.issues.create({...coord,title,body});
}
async function pendingAcceptance({github,owner,repo,snapshot}){
 if(snapshot.manifest.revision===1)return false;
 const r=(await github.rest.repos.getCombinedStatusForRef({owner,repo,ref:snapshot.head})).data;
 return !r.statuses?.some(x=>x.context===ACCEPTANCE&&x.state==='success');
}
module.exports={health,reconcileIssue,pendingAcceptance,ACCEPTANCE};
