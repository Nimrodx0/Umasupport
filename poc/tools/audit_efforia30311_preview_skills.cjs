#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const {auditSkillRegistry}=require('../src/efforia30311_skill_registry_audit.cjs');
if(process.argv.length!==3){
 console.error('Usage: node poc/tools/audit_efforia30311_preview_skills.cjs PATH_TO_PINNED_SKILL_DATA');
 process.exit(2);
}
try{
 const bytes=fs.readFileSync(process.argv[2]);
 const result=auditSkillRegistry(bytes.toString('utf8'));
 console.log(JSON.stringify({...result,sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex')},null,2));
}catch(error){console.error('SSR30311 registry audit failed:',error.message);process.exitCode=1;}
