#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {sourceInventory}=require('./build_whole_event_index.cjs');
const {make,IDS}=require('../src/missing_four_ssr_skill_fact_candidates.cjs');
const {gitBlobSha,INDEPENDENT_SKILLS_BLOB}=
 require('../src/independent_skill_fingerprint_audit.cjs');
const norm=x=>String(x).normalize('NFKC').replace(/\s+/g,' ').trim();
const fail=x=>{throw Error('4SSR未収録候補CLI: '+x);};
function main(args){
 if(args.length!==5)fail('usage: <index> <checker-events> <roster> <pinned-2026-skills> <private-output>');
 const [indexPath,checkerPath,rosterPath,skillsPath,out]=args.map(x=>path.resolve(x));
 const dataDir=path.resolve(__dirname,'../data');
 if(out===indexPath||out===dataDir||out.startsWith(dataDir+path.sep))
  fail('未承認の外部イベント候補を配信用データへ出力できません');
 const checkerBytes=fs.readFileSync(checkerPath),rosterBytes=fs.readFileSync(rosterPath);
 const pins=require('../data/candidates/checker_event_hints.v1.json').sourcePins;
 const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
 if(sha(checkerBytes)!==pins.checker?.sha256||
    sha(rosterBytes)!==pins.umasimCards?.sha256)
  fail('Checkerまたは固定サポカの元データハッシュが違います');
 const skillBytes=fs.readFileSync(skillsPath);
 if(gitBlobSha(skillBytes)!==INDEPENDENT_SKILLS_BLOB||
    sha(skillBytes)!=='11bf7aa86d611047f5052b48059cf77d6aa9b4a7ad8e25ba2f7f901dcd267e62')
  fail('2026年スキル名称辞書の固定版と異なる');
 const checker=JSON.parse(checkerBytes.toString('utf8').replace(/^\uFEFF/,''));
 const rosterText=rosterBytes.toString('utf8');
 const {inventory,model,activeAliases}=sourceInventory({
  checker,rosterText,aliases:require('../config/checker-name-aliases.json')});
 const relevant=IDS.map(cardId=>{
  const card=inventory.cards.find(x=>x.cardId===cardId);
  if(!card||card.events.length!==5)fail('元イベントカードが不足: '+cardId);
  const sourceName=activeAliases[cardId]||model.cardById?.[cardId]?.name;
  const rows=Object.entries(checker.Skills.SSR).filter(([n])=>norm(n)===norm(sourceName));
  if(rows.length!==1||rows[0][1].Events.length!==5)fail('Checkerのカード名照合が一意でありません: '+cardId);
  return {cardId,events:card.events.map((ev,i)=>{
   const raw=rows[0][1].Events[i];
   if(!raw||Object.keys(raw).length!==1)fail('候補イベントの元形式不正');
   return {...ev,options:Object.values(raw)[0]};
  })};
 });
 const output=make({index:JSON.parse(fs.readFileSync(indexPath,'utf8')),
  cards:relevant,skills:JSON.parse(skillBytes.toString('utf8'))});
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');
 console.log('MISSING_FOUR_SSR_SKILL_CANDIDATES='+JSON.stringify(output.totals));
 console.log('MISSING_FOUR_SSR_HINT_POSITIONS='+JSON.stringify(output.cards.map(c=>({
  cardId:c.cardId,hints:c.events.flatMap(e=>e.hintMentions.map(h=>({
   checkerOrdinal:e.checkerOrdinal,checkerOptionOrdinal:h.checkerOptionOrdinal,
   numericId:h.skillNumericId,level:h.hintLevel,resolution:h.sourceNameResolution
  })))
 }))));
 console.log('All source prose and option labels remain transient. Nothing is release approved.');
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={main};
