#!/usr/bin/env node
'use strict';
/*
 * Deterministic offline DB build. Input files are read from trusted local paths,
 * not from GameWith. Only derived factual IDs, levels, ordinals and hashes are
 * stored; never the source article text or original event/choice/effect strings.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const loader=require('../src/live_loader.js');
const {extract}=require('../src/checker_hint_fact_extract.cjs');
const {compare}=require('../src/event_gap_audit.js');
const {build}=require('../src/checker_review_queue.cjs');
const {compile,validate}=require('../src/checker_candidate_database.cjs');
const root=path.resolve(__dirname,'../..');
const sources={
 checker:{revision:'8cf9fcb3cc7239041161be75c84daf9f8f22d29f',
  path:'UmaUmaChecker/Library/Events.json',repo:'Cilda/UmaUmaChecker'},
 cruise:{revision:'56b679c582ce2138823eb52796d553d33cdd4862',
  path:'UmaMusumeLibrary.json',repo:'po-po-po-pong/umaumacruise_customjson'},
 umasimCards:{revision:'cf9366f6a487bd8f197b53d8a11981207beb9f6c',
  path:'data/support_card.txt',repo:'mee1080/umasim',
  expected:'153213019b5232df6c211427b862978218b60df6baee03c2a5fee75e0966d424'},
 umasimSkills:{revision:'cf9366f6a487bd8f197b53d8a11981207beb9f6c',
  path:'data/skill_data.txt',repo:'mee1080/umasim',
  expected:'b7ba1d6c5dd2af9ed1f4e649f16ec1d319198e2f1ac9db07c54e14d29f0b25ec'}
};
const norm=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim();
function generate([supportPath,skillsPath,checkerPath,cruisePath]){
 const text={
  umasimCards:fs.readFileSync(supportPath,'utf8'),
  umasimSkills:fs.readFileSync(skillsPath,'utf8'),
  checker:fs.readFileSync(checkerPath,'utf8'),
  cruise:fs.readFileSync(cruisePath,'utf8')
 };
 const sourcePins={};
 for(const [key,p] of Object.entries(sources)){
  const hash=crypto.createHash('sha256').update(text[key]).digest('hex');
  if(p.expected&&p.expected!==hash)throw Error('Pinned UmaSim source checksum mismatch: '+key);
  sourcePins[key]={url:'https://raw.githubusercontent.com/'+p.repo+'/'+p.revision+'/'+p.path,
   revision:p.revision,sha256:hash};
 }
 const model=loader.buildModel(text.umasimCards,{mode:'audit'});
 const checker=JSON.parse(text.checker.replace(/^\uFEFF/,''));
 const cruise=JSON.parse(text.cruise.replace(/^\uFEFF/,''));
 if(!cruise.Support||!['SSR','SR'].every(x=>cruise.Support[x]&&typeof cruise.Support[x]==='object'))
  throw Error('Second source has invalid or missing supports');
 const aliases=JSON.parse(fs.readFileSync(path.join(root,'poc/config/checker-name-aliases.json'),'utf8'));
 const candidates=extract({source:checker,model,skillText:text.umasimSkills,aliases});
 const checkerRows=['SSR','SR'].flatMap(r=>Object.entries(checker.Skills[r]).map(([name,data])=>({rarity:r,name,events:data.Events})));
 const cruiseRows=['SSR','SR'].flatMap(r=>Object.entries(cruise.Support[r]).map(([name,data])=>({rarity:r,name,events:data.Event})));
 const gaps=compare({modelCards:model.cards,checkerCards:checkerRows,cruiseCards:cruiseRows});
 const queue=build({candidates,gaps});
 const database=compile({candidates,queue,sourcePins});
 if(database.stats.cardsWithCandidates!==417||database.stats.eventsObserved!==2109||
    database.stats.choiceRowsObserved!==3458||database.stats.extractedHintRows!==1504||
    database.stats.matchedNumericHints!==1406||database.stats.queueEntries!==344)
  throw Error('Pinned input coverage changed: investigate rather than silently regenerate');
 return database;
}
function main(){
 if(process.argv.length!==7)throw Error('Usage: node poc/tools/build_checker_candidate_database.cjs <support_card.txt> <skill_data.txt> <checker.json> <cruise.json> <output.json>');
 const args=process.argv.slice(2).map(x=>path.resolve(x));
 const output=args.pop();
 const dst=path.join(root,'poc/data/candidates/checker_event_hints.v1.json');
 if(output!==dst)throw Error('Only versioned Umasupport candidate DB destination allowed: '+dst);
 const db=generate(args);
 const payload=JSON.stringify(db,null,2)+'\n';
 // Keep the original data and public event catalog completely untouched.
 fs.mkdirSync(path.dirname(output),{recursive:true});
 const tmp=output+'.tmp';
 fs.writeFileSync(tmp,payload,{encoding:'utf8',flag:'wx'});
 fs.renameSync(tmp,output);
 console.log(JSON.stringify({output,sourcePins:db.sourcePins,
  ...validate(db)},null,2));
}
if(require.main===module){try{main();}catch(e){console.error('候補DB生成失敗:',e.message);process.exitCode=1;}}
module.exports={generate};
