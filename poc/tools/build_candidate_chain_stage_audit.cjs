#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {build,validateAudit}=require('../src/candidate_chain_stage_audit.cjs');
const root=path.resolve(__dirname,'../data/candidates');
const file=path.join(root,'checker_chain_stage_audit.v1.json');
function inputs(){
 return ['checker_event_hints.v1.json','checker_route_classification.v1.json']
  .map(name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8')));
}
function main(){
 if(process.argv.length>3||process.argv[2]&&process.argv[2]!=='--verify')
  throw Error('Usage: node poc/tools/build_candidate_chain_stage_audit.cjs [--verify]');
 const [db,cls]=inputs();
 if(process.argv[2]==='--verify'){
  const audit=JSON.parse(fs.readFileSync(file,'utf8'));
  const stats=validateAudit(db,cls,audit);
  console.log('Verified historical numerical chain-stage audit:',JSON.stringify(stats));
 }else{
  if(fs.existsSync(file))throw Error('Refusing to overwrite generated stage audit; remove or move it explicitly');
  const audit=build(db,cls);
  fs.writeFileSync(file,JSON.stringify(audit,null,2)+'\n',{flag:'wx',encoding:'utf8'});
  console.log('Built unreviewed chain-stage evidence:',JSON.stringify(audit.totals));
 }
}
try{main()}catch(e){console.error('CHAIN_STAGE_AUDIT_FAILED:',e.message);process.exitCode=1;}
