#!/usr/bin/env node
'use strict';
/** Live, non-persisted documentation listing. A dated audit stays frozen. */
const fs=require('node:fs');
const cp=require('node:child_process');
const root=require('node:path').resolve(__dirname,'../..');
const files=cp.execFileSync('git',['ls-files','--','docs/**/*.md','docs/*.md'],{cwd:root,encoding:'utf8'})
 .split('\n').filter(Boolean).filter(p=>fs.existsSync(require('node:path').join(root,p))).sort();
const rows=files.map(file=>{
 const source=fs.readFileSync(require('node:path').join(root,file),'utf8');
 return {file,bytes:Buffer.byteLength(source),headingCount:source.split(/\r?\n/).filter(x=>/^#{1,6} /.test(x)).length,longLines:source.split(/\r?\n/).filter(x=>x.length>400).length};
});
if(process.argv.includes('--json'))console.log(JSON.stringify({generatedAt:new Date().toISOString(),count:rows.length,rows},null,2));
else {
 console.log('# Current tracked Markdown inventory ('+rows.length+' files, generated on demand)');
 console.log('| Path | Headings | Lines over 400 chars |');
 console.log('| --- | ---: | ---: |');
 for(const r of rows)console.log('| '+r.file+' | '+r.headingCount+' | '+r.longLines+' |');
}
