'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {privatePath,validatePolicy,parseSelection}=require('../tools/run_direct_new_card_intake.cjs');
test('D067 is a separate direct-intake contract, historical baseline unchanged',()=>{
 assert.doesNotThrow(validatePolicy);
 const direct=require('../config/direct-event-intake-policy.v1.json');
 const history=require('../config/event-source-priority.v1.json');
 assert.equal(direct.origin,'https://gametora.com');
 assert.equal(direct.automaticScheduledSiteAccessAllowed,true);
 assert.equal(history.baselineRevision,'6e38b54af4fad397ff4491e63007a90705a4fe67');
});
test('local draft output cannot be placed in repo, CI, or overwrite',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'direct-intake-'));
 try{
  const file=path.join(dir,'draft.json');
  assert.equal(privatePath(file,{}),file);
  assert.throws(()=>privatePath(file,{CI:'true'}),/forbidden/);
  assert.throws(()=>privatePath(file,{GITHUB_ACTIONS:'true'}),/forbidden/);
  assert.throws(()=>privatePath(path.resolve(__dirname,'draft.json'),{}),/outside repository/);
  fs.writeFileSync(file,'existing');
  assert.throws(()=>privatePath(file,{}),/overwrite/);
  assert.equal(fs.readFileSync(file,'utf8'),'existing');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('explicit IDs select the same pending cards after queue changes and reject imported or unknown IDs',()=>{
 const {selectIntakeTargets}=require('../src/official_gametora_new_card_locator.cjs');
 const plan={dataKind:'new-card-event-intake-plan',version:1,publicationApproved:false,
  sourceEventsPublishedAutomatically:false,existingDatabaseUnchanged:true,publishedEventsChanged:0,
  existingCatalogDigest:'a'.repeat(64),carryForwardPendingIds:['10149','30323','39999'],
  alreadyImportedIds:['30322'],newlyObservedIds:['10149','30322','30323','39999']};
 const selection=parseSelection('ids:30323');
 assert.deepEqual(selectIntakeTargets(plan,selection).targetCardIds,['30323']);
 assert.deepEqual(selectIntakeTargets({...plan,carryForwardPendingIds:['30323','39999'],
  alreadyImportedIds:['10149','30322']},selection).targetCardIds,['30323']);
 assert.deepEqual(selectIntakeTargets(plan,parseSelection('ids:10149,30323')).targetCardIds,['10149','30323']);
 assert.deepEqual(selectIntakeTargets(plan,parseSelection('1')).targetCardIds,['30323','39999']);
 for(const value of ['ids:30322','ids:30324'])
  assert.throws(()=>selectIntakeTargets(plan,parseSelection(value)),/未収録/);
 for(const value of ['','-1','1e2','1.5','ids:','ids:30323,30323','ids:10149,30323,39999','ids:30323;echo','ids:03032'])
  assert.throws(()=>parseSelection(value));
});
