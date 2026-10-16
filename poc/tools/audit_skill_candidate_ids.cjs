#!/usr/bin/env node
'use strict';
// Ad hoc strict lookup, fetches UmaSim skill_data.txt once if --local absent.
// Does not write source's full skill records or game/event source prose.
const fs=require('node:fs/promises');
const path=require('node:path');
const {parseSkillData,audit,verifyCandidateTable}=require('../src/skill_candidate_id_audit.cjs');
const URL='https://raw.githubusercontent.com/mee1080/umasim/main/data/skill_data.txt';
async function run(){
 const args=process.argv.slice(2);
 if(args.length>2||args.length&&!(args.length===2&&args[0]==='--local'))throw Error('usage: node poc/tools/audit_skill_candidate_ids.cjs [--local /path/to/skill_data.txt]');
 const text=args.length===2?
   await fs.readFile(path.resolve(args[1]),'utf8'):
   await (async()=>{
     const r=await fetch(URL,{signal:AbortSignal.timeout(20000)});
     if(!r.ok)throw Error('UmaSim skill_data.txt HTTP '+r.status);
     return r.text();
   })();
 const facts=require('../config/missing-ssr-event-facts.v1.json');
 const parsed=parseSkillData(text);
 const r=audit(facts,parsed);
 r.candidateTableVerification=verifyCandidateTable(facts,parsed,require('../config/missing-ssr-skill-id-candidates.v1.json'));
 console.log('UMA_SKILL_ID_AUDIT_START');
 console.log(JSON.stringify(r,null,2));
 console.log('UMA_SKILL_ID_AUDIT_END');
 if(r.missingNames||r.ambiguousNames)console.error('Unresolved skill names remain; no automatic publication permitted');
}
run().catch(e=>{console.error('Skill ID audit failed: '+e.message);process.exitCode=1});
