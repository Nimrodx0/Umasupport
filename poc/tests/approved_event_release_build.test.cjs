'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {prepare}=require('../src/approved_event_release_build.cjs');
const {project}=require('../src/phase2_title_choice_projection.cjs');
const {inventory}=require('../src/event_release_cohorts.cjs');
const {options,run}=require('../tools/build_approved_event_catalog.cjs');
const {fixture}=require('./private_local_2512_fixture.cjs');
const clone=x=>structuredClone(x);
const FIELDS=['card','event','choices','outcomes','dependencies','publication',
 'sourceAccessTerms','databaseReuse','gameMaterialAndTitles','choiceWording'];
const REV='6e38b54af4fad397ff4491e63007a90705a4fe67';
function syntheticApprovals(catalog){
 const selected=inventory(catalog,[{eventIdPrefix:'synthetic-'}]).groups[0];
 return {schemaVersion:2,cohorts:[{
  id:'Fictional cohort for tests only',
  selector:{eventIdPrefix:'synthetic-'},expectedEvents:selected.events,
  eventsSha256:selected.eventsSha256,
  review:{
   reviewer:'Fictional reviewed data test',
   reviewedAt:'2026-11-02',sourceRevision:REV,
   accessMethod:'reviewed-no-new-access',
   checks:Object.fromEntries(FIELDS.map(x=>[x,true])),
   evidence:Object.fromEntries(FIELDS.map(x=>[x,['https://example.org/'+x]])),
   publicationBasis:{kind:'original-factual-description',
    reason:'Only invented synthetic test events are included',
    scope:'Invented 563 cards with no third-party expressions'}
  }
 }],entries:[]};
}
test('563-card, 2512-event wholly fictional catalogue is normalized and approved before release',()=>{
 const f=fixture(),candidate=f.bundle.catalog;
 const original=JSON.stringify(candidate);
 const clean=project(candidate).catalog;
 const approvals=syntheticApprovals(clean);
 const p=prepare({candidate,approvals,model:f.model,skillText:f.skillText});
 assert.equal(p.report.events,2512);
 assert.equal(p.report.cards,563);
 assert.equal(p.report.choices,2);
 assert.equal(p.report.titlesPreserved,2512);
 assert.equal(p.report.reviewedCohorts,1);
 assert.equal(p.report.exactApprovalLedgerPassed,true);
 assert.equal(p.catalog.cards[0].events[0].name,'架空の選択式');
 assert.equal(p.catalog.cards[0].events[0].choices[0].label,'選択肢1（仮）');
 assert.equal(p.catalog.cards[0].events[0].choices[0].id,'option1');
 assert.equal(p.catalog.cards[0].events[0].choices[0].rewards[0].level,2);
 assert.equal(JSON.stringify(candidate),original);
});
test('unapproved real-shaped data is rejected and no one can approve pre-normalized source text',()=>{
 const f=fixture(),candidate=f.bundle.catalog;
 assert.throws(()=>prepare({candidate,approvals:{schemaVersion:2,cohorts:[],entries:[]},
  model:f.model,skillText:f.skillText}),/未承認/);
 const approvalForRaw=syntheticApprovals(candidate);
 assert.throws(()=>prepare({candidate,approvals:approvalForRaw,
  model:f.model,skillText:f.skillText}),/SHA不一致/);
});
test('any change after approval to title, hint level, event presence or rights evidence fails closed',()=>{
 const f=fixture(),safe=project(f.bundle.catalog).catalog,
  approvals=syntheticApprovals(safe);
 for(const change of [
  data=>{data.cards[0].events[0].name='新しい見出し';},
  data=>{data.cards[0].events[0].choices[0].rewards[0].level=3;},
  data=>{data.cards[0].events.pop();}
 ]){
  const mutated=clone(safe);change(mutated);
  assert.throws(()=>prepare({candidate:mutated,approvals,
   model:f.model,skillText:f.skillText}),/SHA不一致/);
 }
 const bad=clone(approvals);
 bad.cohorts[0].review.checks.databaseReuse=false;
 assert.throws(()=>prepare({candidate:safe,approvals:bad,
  model:f.model,skillText:f.skillText}),/人手審査/);
});
test('no original dialogue or invented unknown source fields survive the build',()=>{
 const f=fixture(),candidate=clone(f.bundle.catalog);
 candidate.cards[0].events[0].choices[0].label='保護された想定の長文';
 const safe=project(candidate).catalog;
 const p=prepare({candidate,approvals:syntheticApprovals(safe),
  model:f.model,skillText:f.skillText});
 assert.equal(p.catalog.cards[0].events[0].choices[0].label,'選択肢1（仮）');
 candidate.cards[0].events[0].dialogue='原文の台詞';
 assert.throws(()=>prepare({candidate,approvals:syntheticApprovals(safe),
  model:f.model,skillText:f.skillText}),/未分類/);
});
test('command defaults to read-only and only a validated explicitly named destination may be written',()=>{
 const inputs=['--candidate','private.json','--approvals','v2.json',
  '--support','supports.txt','--skills','skills.txt'];
 assert.equal(options(inputs).publishApproved,false);
 assert.throws(()=>options([...inputs,'--output','reviewed_events.v1.json']),/セット/);
 assert.throws(()=>options([...inputs,'--publish-approved']),/セット/);
 assert.throws(()=>options([...inputs,'--publish-approved','--output','unsafe.json']),/ファイル名/);
 assert.equal(options([...inputs,'--publish-approved','--output','/tmp/reviewed_events.v1.json']).publishApproved,true);
});
test('CLI does not create or overwrite an output if the approval ledger is empty',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'uma-approved-event-cli-'));
 const f=fixture();
 const cat=path.join(dir,'candidate.json'),proof=path.join(dir,'approvals.json'),
  support=path.join(dir,'support.txt'),skills=path.join(dir,'skills.txt'),
  output=path.join(dir,'reviewed_events.v1.json');
 try{
  await Promise.all([
   fs.writeFile(cat,JSON.stringify(f.bundle.catalog)),
   fs.writeFile(proof,JSON.stringify({schemaVersion:2,cohorts:[],entries:[]})),
   fs.writeFile(support,'short intentionally invalid input'),
   fs.writeFile(skills,f.skillText),
   fs.writeFile(output,'prior approved catalog remains intact')
  ]);
  await assert.rejects(()=>run(['--candidate',cat,'--approvals',proof,
   '--support',support,'--skills',skills,'--output',output,
   '--publish-approved']),/サポカデータが短すぎます|カードデータが短すぎます/);
  assert.equal(await fs.readFile(output,'utf8'),'prior approved catalog remains intact');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
