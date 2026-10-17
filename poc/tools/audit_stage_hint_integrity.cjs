'use strict';
// Audits the publisher's all-card/all-stage source schema against source-local
// invariants and one explicitly sourced third-party 0-4 limit break example.
// The publisher's raw data is only streamed to this process; not stored in git.
const fs=require('node:fs');
const crypto=require('node:crypto');
const {parseSupportCards}=require('../src/live_loader.js');
const norm=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();

// Independent reference: GameWith SSR Efforia, updated 2026-10-12.
// https://gamewith.jp/uma-musume/article/show/573288
// Listed "ヒントLv" means the modifier, not acquisition level (modifier+1).
const EFFORIA={id:'30311',hintLevels:[2,2,3,3,4],hintFrequencies:[60,70,80,90,100]};

function compareStages(text,{reference=EFFORIA}={}){
 const parsed=parseSupportCards(text);
 const distribution=[0,0,0,0,0],changeCount=[0,0,0,0,0],lvs=[0,0,0,0,0],rates=[0,0,0,0,0];
 const issues=[];
 let commonHintLinks=0,distinctNames=0,lowerHintLevel=0,lowerFrequency=0,added=0,removed=0;
 for(const [id,card] of parsed.cards){
  const initial=new Set(card.stages['0'].map(norm));
  distinctNames+=initial.size;
  if(initial.size!==card.stages['0'].length)issues.push({id,type:'duplicate-0-hint'});
  for(let i=0;i<5;i++){
   const key=String(i),names=card.stages[key],set=new Set(names.map(norm)),p=card.hintPerformanceStages[key];
   distribution[i]+=set.size;
   if(set.size!==names.length)issues.push({id,type:'duplicate-stage-hint',stage:i});
   if(i===0)continue;
   const prev=new Set(card.stages[String(i-1)].map(norm));
   const gained=[...set].filter(n=>!prev.has(n));
   const lost=[...prev].filter(n=>!set.has(n));
   if(gained.length||lost.length){changeCount[i]++;added+=gained.length;removed+=lost.length;}
   const old=card.hintPerformanceStages[String(i-1)];
   if(p.levelBase+p.levelUnique<old.levelBase+old.levelUnique){lowerHintLevel++;issues.push({id,type:'lower-hint-level',stage:i});}
   if(p.frequencyBase+p.frequencyUnique<old.frequencyBase+old.frequencyUnique){lowerFrequency++;issues.push({id,type:'lower-hint-frequency',stage:i});}
  }
  commonHintLinks+=initial.size;
  lvs[0]+=card.hintPerformanceStages['0'].levelBase+card.hintPerformanceStages['0'].levelUnique;
  rates[0]+=card.hintPerformanceStages['0'].frequencyBase+card.hintPerformanceStages['0'].frequencyUnique;
  for(let i=1;i<5;i++){
   const key=String(i),p=card.hintPerformanceStages[key];
   lvs[i]+=p.levelBase+p.levelUnique;
   rates[i]+=p.frequencyBase+p.frequencyUnique;
  }
 }
 let external={id:reference.id,present:false,levelPass:false,frequencyPass:false};
 const card=parsed.cards.get(reference.id);
 if(card){
  const levels=Array.from({length:5},(_,i)=>{
   const p=card.hintPerformanceStages[String(i)];return p.levelBase+p.levelUnique;
  });
  const frequency=Array.from({length:5},(_,i)=>{
   const p=card.hintPerformanceStages[String(i)];return p.frequencyBase+p.frequencyUnique;
  });
  external={id:reference.id,present:true,levelPass:JSON.stringify(levels)===JSON.stringify(reference.hintLevels),
   frequencyPass:JSON.stringify(frequency)===JSON.stringify(reference.hintFrequencies),
   levelMismatchStages:levels.flatMap((x,i)=>x===reference.hintLevels[i]?[]:[i]),
   frequencyMismatchStages:frequency.flatMap((x,i)=>x===reference.hintFrequencies[i]?[]:[i])};
 }
 return {cards:parsed.cards.size,stageRows:parsed.lines,hintsByStage:distribution,
  cardsWithStageHintChanges:changeCount,stageAddedHintLinks:added,stageRemovedHintLinks:removed,
  cardsWithHintLevelDecreases:lowerHintLevel,cardsWithFrequencyDecreases:lowerFrequency,
  fourStageHintNamesAlsoPresentAtZero:commonHintLinks,externalEfforia0to4:external,issues};
}
function assertSnapshot(result){
 if(result.cards!==563||result.stageRows!==2815)throw Error('Publisher card/stage population drift');
 if(result.hintsByStage.some(n=>n!==4015))throw Error('Publisher hint list stage totals changed');
 if(result.cardsWithStageHintChanges.some(n=>n!==0)||result.stageAddedHintLinks!==0||result.stageRemovedHintLinks!==0)
  throw Error('Limit-break-dependent support hint source data changed; manual review required');
 if(result.cardsWithHintLevelDecreases||result.cardsWithFrequencyDecreases||result.issues.length)
  throw Error('Source stage performance/hint monotonicity or uniqueness unexpectedly changed');
 if(!result.externalEfforia0to4.present||!result.externalEfforia0to4.levelPass||
    !result.externalEfforia0to4.frequencyPass)
  throw Error('Publisher source no longer matches independent 5-stage Efforia reference');
 return true;
}
if(require.main===module){
 const source=fs.readFileSync(0,'utf8'),sha=crypto.createHash('sha256').update(source).digest('hex');
 const result=compareStages(source);
 console.log(JSON.stringify({sourceSha256:sha,reference:'GameWith SSR Efforia 2026-10-12',result},null,2));
 try{assertSnapshot(result);}catch(e){console.error(String(e));process.exitCode=1;}
}
module.exports={compareStages,assertSnapshot,EFFORIA};
