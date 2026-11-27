'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {privatePath,validatePolicy}=require('../tools/run_direct_new_card_intake.cjs');
test('D067 is a separate direct-intake contract, historical baseline unchanged',()=>{
 assert.doesNotThrow(validatePolicy);
 const direct=require('../config/direct-event-intake-policy.v1.json');
 const history=require('../config/event-source-priority.v1.json');
 assert.equal(direct.origin,'https://gametora.com');
 assert.equal(direct.automaticScheduledSiteAccessAllowed,false);
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
