'use strict';
/** One-time reproducible audit of the 2026-11-10 documentation reorganisation.
 * Run from the repository root after checking out the PR branch, with origin/main
 * pointing to the pre-migration state. The original commit is fixed below.
 */
const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path').posix;
const BASE='1e366e2e5513d19171606b77b16a59a06c1f2e3a';
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',maxBuffer:15*1024*1024});
const root=process.cwd();
const original=git('ls-tree','-r','--name-only',BASE).trim().split('\n');
const core=new Set('index.md requirements.md decisions.md roadmap.md status.md architecture.md event-schema.md data-sources.md documentation-policy.md verification-plan.md verification-history.md development-history.md evidence-index.md runtime-data-loading.md skill-activation-tendencies-design.md event-adjudication-enforcement.md event-source-selection.md curated-event-intake.md upstream-refresh-operations.md checker-public-catalog.md checker-persistent-candidate-database.md reviewed-skill-hierarchy.md card-image-rights-decision.md event-data-acquisition-rights-20261019.md gamewith-offline-ingest.md'.split(' '));
function group(n) {
 if(n.startsWith('skill-')&&!n.includes('acceptance'))return 'skills';
 if(/^(derived-github|official-gametora|gametora|gamewith|wiki-|utools|checker|upstream-|independent-|historical-|master-|game8-|new-card|efforia|release-card|expanded-card|card-population)/.test(n))return 'sources';
 if(/^(phase2-|event-|choice-|editorial-|f08-|candidate-|route-|story-|unreviewed-)/.test(n))return 'events';
 return 'quality';
}
const moved=original.filter(n=>/^docs\/[^/]+\.md$/.test(n)&&!core.has(path.basename(n))).map(from=>({from,to:'docs/evidence/'+group(path.basename(from))+'/'+path.basename(from)}));
function normalize(text) {
 return text.replace(/\n> \*\*個別の参照先\*\*：[^\n]*\n/g,'\n')
 .replace(/\n> \*\*資料の位置づけ\*\*：[^\n]*\n> \*\*現行の参照先\*\*：[^\n]*\n/g,'')
 .replace(/\r\n/g,'\n')
 .replace(/(!?\[[^\]\n]*\]\()([^) \n]+)([^)\n]*\))/g,(m,p,url,tail)=>{
  if(/^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(url))return m;
  return p+'__LOCAL_DESTINATION__'+tail;
 })
 // Repairing explicit paths in prose or code is not a change to the technical claim.
 .replace(/(?:\.\.\/)*(?:docs\/)?(?:[A-Za-z0-9_.-]+\/)*([A-Za-z0-9_.-]+\.md)/g,
     (m,filename)=>'__DOC_PATH__'+(filename==='log.md'&&/decisions\/log\.md$/.test(m)?'decisions.md':filename==='catalog.md'&&/evidence\/catalog\.md$/.test(m)?'evidence-index.md':filename))
 .replace(/[ \t]+$/gm,'');
}
function numbered(text){return [...normalize(text).matchAll(/(?<!\w)[0-9][0-9.,%/-]*/g)].map(m=>m[0]);}
function headings(text){return text.split(/\r?\n/).filter(line=>/^#{1,6} /.test(line));}
function getOld(f){return git('show',BASE+':'+f);}
const reports=[];
for(const {from,to} of moved){
 if(!fs.existsSync(to)){reports.push({from,to,exists:false});continue;}
 const before=getOld(from),after=fs.readFileSync(to,'utf8');
 reports.push({from,to,exists:true,identical:before===after,
   proseMatch:normalize(before)===normalize(after),
   headingsMatch:JSON.stringify(headings(before))===JSON.stringify(headings(after)),
   numberTokensMatch:JSON.stringify(numbered(before))===JSON.stringify(numbered(after)),
   oldLines:before.split('\n').length,newLines:after.split('\n').length});
}
const currentCanonical={"docs/architecture.md":"docs/reference/architecture.md","docs/checker-persistent-candidate-database.md":"docs/reference/checker-persistent-candidate-database.md","docs/data-sources.md":"docs/reference/data-sources.md","docs/event-adjudication-enforcement.md":"docs/reference/event-adjudication-enforcement.md","docs/event-schema.md":"docs/reference/event-schema.md","docs/requirements.md":"docs/reference/requirements.md","docs/reviewed-skill-hierarchy.md":"docs/reference/reviewed-skill-hierarchy.md","docs/runtime-data-loading.md":"docs/reference/runtime-data-loading.md","docs/card-image-rights-decision.md":"docs/decisions/card-image-rights-decision.md","docs/event-data-acquisition-rights-20261019.md":"docs/decisions/event-data-acquisition-rights-20261019.md","docs/event-source-selection.md":"docs/decisions/event-source-selection.md","docs/checker-public-catalog.md":"docs/how-to/checker-public-catalog.md","docs/curated-event-intake.md":"docs/how-to/curated-event-intake.md","docs/gamewith-offline-ingest.md":"docs/how-to/gamewith-offline-ingest.md","docs/upstream-refresh-operations.md":"docs/how-to/upstream-refresh-operations.md","docs/development-history.md":"docs/history/development-history.md","docs/verification-history.md":"docs/history/verification-history.md","docs/documentation-methodology.md":"docs/governance/documentation-methodology.md","docs/documentation-policy.md":"docs/governance/documentation-policy.md","docs/skill-activation-tendencies-design.md":"docs/explanation/skill-activation-tendencies-design.md","docs/roadmap.md":"docs/project/roadmap.md","docs/status.md":"docs/project/status.md","docs/verification-plan.md":"docs/quality/verification-plan.md","docs/decisions.md":"docs/decisions/log.md","docs/evidence-index.md":"docs/evidence/catalog.md"};
const rootFiles=original.filter(x=>/^docs\/[^/]+\.md$/.test(x)&&core.has(path.basename(x)));
const rootChanged=rootFiles.filter(p=>fs.existsSync(p)&&getOld(p)!==fs.readFileSync(p,'utf8')).map(p=>({path:p,oldBytes:Buffer.byteLength(getOld(p)),newBytes:fs.statSync(p).size}));
const nonDocChanges=original.filter(x=>!x.endsWith('.md')&&fs.existsSync(x)&&getOld(x)!==fs.readFileSync(x,'utf8')&&/\.(?:cjs|js|json|yml|yaml)$/.test(x));
const nonDoc=nonDocChanges.map(file=>({file,changesOnlyPath:normalize(getOld(file))===normalize(fs.readFileSync(file,'utf8'))}));
const errors=reports.filter(x=>!x.exists||!x.proseMatch||!x.headingsMatch||!x.numberTokensMatch);
const otherIssues=nonDoc.filter(x=>!x.changesOnlyPath&&x.file!=='poc/tests/handoff_quality.test.cjs');
if(!fs.readFileSync('poc/tests/handoff_quality.test.cjs','utf8').includes('all tracked Markdown documents keep valid local links'))otherIssues.push({file:'poc/tests/handoff_quality.test.cjs',reason:'missing added whole-repository link test'});

// For non-shortened canonical documents, verify all pre-migration paragraphs
// remain in order even when navigation sections are added.
function orderedSubset(a,b){
 const before=normalize(a).split('\n').map(x=>x.trim()).filter(Boolean);
 const after=normalize(b).split('\n').map(x=>x.trim()).filter(Boolean);
 let k=0;
 for(const line of after){if(k<before.length && line===before[k])k++;}
 return {ok:k===before.length,matched:k,total:before.length,next:before[k]||null};
}
const shortened=new Set(['index.md','roadmap.md','status.md','documentation-policy.md']);
const canonicalPreservation=rootFiles.filter(p=>!shortened.has(path.basename(p)))
  .map(p=>{const current=currentCanonical[p]||p;return {file:current,...(fs.existsSync(current)?orderedSubset(getOld(p),fs.readFileSync(current,'utf8')):{ok:false,reason:'missing canonical document'})};});
const snapshots=[...shortened].map(n=>{
 const former='docs/'+n,stored='docs/archive/pre-reorganization-20261110/'+n;
 if(!fs.existsSync(stored))return {file:stored,ok:false,reason:'snapshot missing'};
 const text=fs.readFileSync(stored,'utf8').replace(/^<!-- Preservation snapshot:[^\n]*-->\n/,'');
 return {file:stored,...orderedSubset(getOld(former),text)};
});
const canonicalIssues=canonicalPreservation.filter(x=>!x.ok);
const snapshotIssues=snapshots.filter(x=>!x.ok);

const out={baseSha:BASE,movedCount:moved.length,identical:moved.filter((_,i)=>reports[i].identical).length,existsCount:reports.filter(x=>x.exists).length,normalizedProseEqual:reports.filter(x=>x.proseMatch).length,headingsEqual:reports.filter(x=>x.headingsMatch).length,numericTokensEqual:reports.filter(x=>x.numberTokensMatch).length,mismatches:errors.slice(0,40),otherNonDocChanges:nonDoc,rootChanged,canonicalPreservation,snapshots};
console.log(JSON.stringify(out,null,2));
if(process.argv.includes('--strict')&&(errors.length||otherIssues.length||canonicalIssues.length||snapshotIssues.length))process.exitCode=1;
