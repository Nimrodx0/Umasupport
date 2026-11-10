'use strict';
/** Agent-first documentation integrity checks, run with full git history. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const here=p=>path.join(root,p);
const get=p=>fs.readFileSync(here(p),'utf8');
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
const hasGitPath=(sha,p)=>{try{git('cat-file','-e',sha+':'+p);return true}catch{return false}};
test('pinned research references resolve in BOTH current and historical repository states',()=>{
 const j=JSON.parse(get('poc/data/p2_position_condition32_research.v1.json'));
 const p=j.source;
 assert.match(p.commitOfReview,/^[a-f0-9]{40}$/);
 assert.ok(p.previousResearch&&p.previousResearchAtCommit);
 assert.ok(fs.existsSync(here(p.previousResearch)),'Current research path must exist');
 assert.ok(hasGitPath(p.commitOfReview,p.previousResearchAtCommit),
  'Historical reference must exist under the pinned commit');
 assert.notEqual(p.previousResearch,p.previousResearchAtCommit,'An explicitly relocated historical path must be distinct');
});
test('all immutable GitHub documentation permalinks resolve in their pinned commits',()=>{
 const tracked=git('ls-files','--','*.md').trim().split('\n').filter(Boolean);
 const missing=[];
 const rx=/https:\/\/github\.com\/Nimrodx0\/Umasupport\/blob\/([a-f0-9]{40})\/(docs\/[A-Za-z0-9_.\/-]+\.md)/g;
 for(const file of tracked){
  const src=get(file);
  for(const m of src.matchAll(rx))if(!hasGitPath(m[1],m[2]))missing.push(file+': '+m[1]+':'+m[2]);
 }
 assert.deepEqual(missing,[], 'Immutable commit links must point to files in that historical tree');
});
test('all dated user decisions have IDs, explicit review state and stable anchors',()=>{
 const registry=JSON.parse(get('docs/decisions/registry.json'));
 const log=get('docs/decisions/log.md');
 const index=get('docs/decisions/index.md');
 const headings=[...log.matchAll(/^## (20\d{2}-\d\d-\d\d[^\n]*)$/gm)].map(x=>x[1]);
 const entries=registry.entries;
 assert.equal(entries.length,headings.length);
 assert.deepEqual(entries.map(x=>x.heading),headings,'A new dated decision requires registry update');
 assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);
 const statuses=new Set(['current','superseded','qualified','review-required']);
 const ids=new Set(entries.map(e=>e.id));
 for(const entry of entries){
  assert.match(entry.id,/^D-\d{3}$/);
  assert.ok(statuses.has(entry.status),entry.id);
  assert.ok(log.includes('<a id="decision-'+entry.id.toLowerCase()+'"></a>\n## '+entry.heading),
   'Missing stable anchor '+entry.id);
  assert.ok(index.includes('log.md#decision-'+entry.id.toLowerCase()),'Not indexed '+entry.id);
  assert.ok(index.includes(entry.id+' '+entry.heading),'Index title drift '+entry.id);
  for(const dest of entry.relation)assert.ok(ids.has(dest),'Unknown successor '+entry.id+' -> '+dest);
  if(['superseded','qualified'].includes(entry.status))assert.ok(entry.relation.length>0,entry.id+' must link successor');
 }
 const expected=Object.groupBy(entries,e=>e.status);
 for(const name of statuses)assert.ok(index.includes(name+' '+(expected[name]?.length||0)+'件'),name+' count drift');
});
test('historical operations are preserved and current guides are marked as current',()=>{
 const pairs={
  'docs/how-to/curated-event-intake.md':'docs/evidence/events/curated-event-intake-legacy-20261019.md',
  'docs/how-to/gamewith-offline-ingest.md':'docs/evidence/sources/gamewith-offline-ingest-legacy-20261019.md',
  'docs/how-to/checker-public-catalog.md':'docs/evidence/events/checker-public-catalog-history-20261016-20261102.md'
 };
 for(const [guide,history] of Object.entries(pairs)){
  assert.ok(fs.existsSync(here(history)),'Historical original is missing: '+history);
  const now=get(guide);
  assert.ok(now.includes(history.split('/').at(-1)),guide+' must link to its complete original');
  assert.ok(now.length<6500,guide+' has grown to a long history in an active procedure');
 }
});
test('dated document inventory is explicitly frozen; current inventory comes from Git',()=>{
 const old=get('docs/evidence/quality/document-review-inventory-20261110.md');
 assert.match(old,/固定/);
 assert.ok(fs.existsSync(here('poc/tools/list_doc_inventory.cjs')));
 const j=JSON.parse(git('ls-files','--','docs/**/*.md','docs/*.md').split('\n').filter(Boolean).length>0 ? cp.execFileSync(process.execPath,['poc/tools/list_doc_inventory.cjs','--json'],{cwd:root,encoding:'utf8'}):'{}');
 const actual=git('ls-files','--','docs/**/*.md','docs/*.md').split('\n').filter(Boolean).filter(p=>fs.existsSync(here(p))).sort();
 assert.equal(j.rows.length,j.count);
 assert.deepEqual(j.rows.map(x=>x.file),actual,'Live inventory must exactly match tracked documentation rather than a frozen minimum count');
 assert.ok(!j.rows.some(x=>!fs.existsSync(here(x.file))),'Live inventory must exclude non-existing docs');
});
