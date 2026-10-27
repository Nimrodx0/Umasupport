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
 if(process.env.GITHUB_STEP_SUMMARY){
  const g=result.gameTora,u=result.umaSim,h=u.candidateHintCoverage;
  const markdown=[
   '## Candidate full-source preflight (review only)',
   '',
   '| Dataset | Pinned baseline | Proposed candidate |',
   '| --- | ---: | ---: |',
   '| GT source JSON cards | '+g.baseline.cards+' | '+g.candidate.cards+' |',
   '| GT event records | '+g.baseline.events+' | '+g.candidate.events+' |',
   '| GT choice records | '+g.baseline.choices+' | '+g.candidate.choices+' |',
   '| GT result routes | '+g.baseline.routes+' | '+g.candidate.routes+' |',
   '| UmaSim cards | '+u.cards.baselineCards+' | '+u.cards.candidateCards+' |',
   '| UmaSim numeric skill IDs | '+u.skills.baselineNumericIds+
      ' | '+u.skills.candidateNumericIds+' |',
   '',
   'Candidate GT ID changes: added '+g.diff.added.length+
    ', modified '+g.diff.modified.length+
    ', removed '+g.diff.removed.length+'.',
   '',
   'All-stage normal skill name resolution: '+h.uniqueNormalSkillIds+
    '/'+h.hintStageOccurrences+' unique, '+h.missingRegistryNames+
    ' absent, '+h.ambiguousOrNonNormalIds+' ambiguous or non-normal.',
   '',
   'Shape preflight: **'+(result.shapePreflightPassed?'PASS':'REQUIRES REVIEW')+'**.',
   'Blockers: '+(result.blockerCodes.join(', ')||'none')+'.',
   '',
   '**Important:** Source-shape success does NOT establish event rewards, internal',
   'branch adjudication, independent game completeness, third-party reuse',
   'rights or permission to publish. Runtime pins remain unchanged.'
  ].join('\n')+'\n';
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdown,'utf8');
 }
 if(!result.shapePreflightPassed){
  process.stderr.write('Candidate data shape requires review: '+result.blockerCodes.join(',')+'\n');
  process.exitCode=1;
 }
}catch(e){process.stderr.write(String(e.stack||e)+'\n');process.exitCode=1;}
