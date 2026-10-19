#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {build,validateStored}=require('../src/candidate_numeric_outcome_crosscheck.cjs');
const root=path.resolve(__dirname,'../data/candidates');
const target=path.join(root,'checker_first_pass_numeric_crosscheck.v1.json');
function data(name){return JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));}
function main(){
 const args=process.argv.slice(2),db=data('checker_event_hints.v1.json'),
  classification=data('checker_route_classification.v1.json'),
  stages=data('checker_chain_stage_audit.v1.json');
 if(args.length===1&&args[0]==='--verify'){
  const stored=JSON.parse(fs.readFileSync(target,'utf8'));
  const counts=validateStored({db,classification,stages,crosscheck:stored});
  console.log('Cross-source first-pass audit integrity:',JSON.stringify(counts));
  return;
 }
 if(args.length!==3)throw Error('Usage: node poc/tools/build_candidate_numeric_outcome_crosscheck.cjs <manifest.json> <supports.json> <events.json> | --verify');
 if(fs.existsSync(target))throw Error('Refusing overwrite. Remove generated sidecar explicitly before regeneration.');
 const [manifestPath,supportsPath,eventsPath]=args;
 const rawSupports=fs.readFileSync(supportsPath);
 const rawEvents=fs.readFileSync(eventsPath);
 const crosscheck=build({db,classification,stages,
  supplementManifest:JSON.parse(fs.readFileSync(manifestPath,'utf8')),
  supplementSupports:JSON.parse(rawSupports.toString('utf8')),
  supplementEvents:JSON.parse(rawEvents.toString('utf8')),
  rawSupports,rawEvents});
 validateStored({db,classification,stages,crosscheck});
 fs.writeFileSync(target,JSON.stringify(crosscheck,null,2)+'\n',{flag:'wx',encoding:'utf8'});
 console.log('Unreviewed first-pass numeric source crosscheck:',JSON.stringify(crosscheck.counts));
}
try{main()}catch(e){console.error('NUMERIC_CROSSCHECK_FAILED:',e.message);process.exitCode=1;}
