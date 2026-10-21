#!/usr/bin/env node
'use strict';
/* Pin and hash-check two independently versioned UmaSim inputs.
 * Never export entire skill registry or source GameTora event descriptions.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {crosswalk,CANONICAL_SOURCE_SHA}=require('../src/gametora_event_skill_crosswalk.cjs');
const loader=require('../src/live_loader.js');
const supplemental=require('../data/curation/supplemental_skills.v1.json');
const fail=m=>{throw Error('GameToraイベント×UmaSimスキル全件照合: '+m);};
const hash=txt=>crypto.createHash('sha256').update(txt).digest('hex');
function main(args){
 if(args.length!==4)fail('usage: <numeric-candidate.json> <pinned-umasim-skill_data.txt> <pinned-support_card.txt> <temporary-output.json>');
 const [candidateFile,skillFile,rosterFile,outputFile]=args.map(x=>path.resolve(x));
 const publicDir=path.resolve(__dirname,'../data');
 if(outputFile.startsWith(publicDir+path.sep)||outputFile===candidateFile||
    outputFile===skillFile||outputFile===rosterFile)
  fail('未承認のスキル照合内容を公開領域へ書き込めません');
 const rawSkills=fs.readFileSync(skillFile),roster=fs.readFileSync(rosterFile);
 if(hash(rawSkills)!==CANONICAL_SOURCE_SHA)fail('UmaSimスキル辞書のSHA-256が固定版と一致しません');
 const sourcePins=require('../data/candidates/checker_event_hints.v1.json').sourcePins;
 if(hash(roster)!==sourcePins?.umasimCards?.sha256)
  fail('UmaSimカード一覧のSHA-256が固定版と一致しません');
 const model=loader.buildModel(roster.toString('utf8'),{mode:'audit'});
 if(model.cards.length!==563)fail('563サポカの基準版データと一致しません');
 const report=crosswalk({
  candidate:JSON.parse(fs.readFileSync(candidateFile,'utf8')),
  skillText:rawSkills.toString('utf8'),model,supplemental
 });
 if(report.sourceSkillRegistryCount!==2139||
    report.stats.rosterCards!==undefined||
    report.stats.cards!==563||report.stats.sourceEvents!==2488||
    report.stats.sourceChoices!==4129||report.stats.sourceRoutes!==4376||
    report.stats.numericHintMentions!==1681||report.stats.unresolvedInputHints!==13||
    report.stats.directSkillGrantMentions!==7)
  fail('固定全件母数の変更を検出。出力前に再調査してください');
 fs.mkdirSync(path.dirname(outputFile),{recursive:true});
 fs.writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n');
 console.log('GAMETORA_EVENT_SKILL_CROSSWALK_STATS='+JSON.stringify(report.stats));
 console.log('GAMETORA_EVENT_SKILL_CROSSWALK_UNMATCHED_NUMERIC_IDS='+JSON.stringify(
  [...new Set(report.unresolved.map(x=>x.numericId).filter(Boolean))].sort()));
 console.log('No original event/choice prose, no full skill registry, no automatic release');
}
if(require.main===module){
 try{main(process.argv.slice(2));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={main};
