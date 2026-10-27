#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {audit}=require('../src/upstream_candidate_full_preflight.cjs');
const fail=m=>{throw Error('候補全件preflight CLI: '+m);};
try{
 const args=process.argv.slice(2);
 if(args.length!==7)fail('usage: <manifest> <gt-base-repo> <gt-candidate-repo> <cards-base> <cards-candidate> <skills-base> <skills-candidate>');
 const [manifestPath,baselineGtRepo,candidateGtRepo,...sources]=args;
 if(manifestPath.includes('/poc/data/')||sources.includes(manifestPath))
  fail('候補出典を公開データ領域に格納できません');
 const file=path.resolve(manifestPath);
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 const [baselineRoster,candidateRoster,baselineSkills,candidateSkills]=
  sources.map(s=>fs.readFileSync(s,'utf8'));
 const result=audit({
  manifest,baselineGtRepo,candidateGtRepo,
  baselineGt:path.join(baselineGtRepo,'server/data/events/gametora'),
  candidateGt:path.join(candidateGtRepo,'server/data/events/gametora'),
  baselineRoster,candidateRoster,baselineSkills,candidateSkills
 });
 process.stdout.write('UPSTREAM_CANDIDATE_FULL_PREFLIGHT='+JSON.stringify(result)+'\n');
 if(!result.shapePreflightPassed){
  process.stderr.write('Candidate data shape requires review: '+result.blockerCodes.join(',')+'\n');
  process.exitCode=1;
 }
}catch(e){process.stderr.write(String(e.stack||e)+'\n');process.exitCode=1;}
