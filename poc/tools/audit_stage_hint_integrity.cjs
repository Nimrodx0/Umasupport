'use strict';
// Audits the publisher's all-card/all-stage source schema against source-local
// invariants and one explicitly sourced third-party 0-4 limit break example.
// The publisher's raw data is only streamed to this process; not stored in git.
const fs=require('node:fs');
const crypto=require('node:crypto');
const {parseSupportCards}=require('../src/live_loader.js');
const norm=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();

// Reviewed GameWith card-specific "サポート効果" tables, inspected 2026-10-17.
// The new SSR entries display the effect totals. Older Winning Ticket instead
// lists base support effects separately from a fixed +20% unique hint bonus.
// Do NOT mistake a base-only listing for the card's total hint frequency.
// Values are hint LEVEL MODIFIERS, not acquisition levels (1 + modifier).
const EXTERNAL_REFERENCES=Object.freeze([
 {id:'30311',name:'[As if Guided]エフフォーリア',basis:'total',url:'https://gamewith.jp/uma-musume/article/show/573288',
  hintLevels:[2,2,3,3,4],hintFrequencies:[60,70,80,90,100]},
 {id:'30312',name:'[時に交わる海と空]ミスターシービー',basis:'total',url:'https://gamewith.jp/uma-musume/article/show/573289',
  hintLevels:[1,1,1,1,2],hintFrequencies:[60,70,80,90,100]},
 {id:'30314',name:'[わたしときみの交換こ♪]ハルウララ',basis:'total',url:'https://gamewith.jp/uma-musume/article/show/574385',
  hintLevels:[1,2,3,3,3],hintFrequencies:[5,30,60,60,60]},
 {id:'30297',name:'[全てに挑む勇ましき者]アグネスデジタル',basis:'total',url:'https://gamewith.jp/uma-musume/article/show/559252',
  hintLevels:[1,1,1,2,4],hintFrequencies:[5,5,5,50,100]},
 {id:'30292',name:'[響け、二人の凱歌]マルシュロレーヌ',basis:'total',url:'https://gamewith.jp/uma-musume/article/show/548286',
  hintLevels:[2,2,3,3,4],hintFrequencies:[60,70,80,90,100]},
 {id:'30012',name:'[B・N・Winner!!]ウイニングチケット',basis:'base',url:'https://gamewith.jp/uma-musume/article/show/257449',
  hintLevels:[0,0,0,2,3],hintFrequencies:[0,0,0,30,40]}
]);
const EFFORIA=EXTERNAL_REFERENCES[0];
function verifyReferenceShape(ref){
 if(!ref||!/^\d{5}$/.test(ref.id)||!['total','base'].includes(ref.basis??'total')||
   ![ref.hintLevels,ref.hintFrequencies].every(a=>Array.isArray(a)&&a.length===5&&a.every(Number.isSafeInteger)))
  throw Error('Invalid independent performance reference');
}
function compareReference(parsed,ref){
 verifyReferenceShape(ref);
 const card=parsed.cards.get(ref.id);
 if(!card)return {id:ref.id,basis:ref.basis??'total',present:false,namePass:false,levelPass:false,frequencyPass:false};
 const basis=ref.basis??'total';
 const levels=[],frequencies=[];
 for(let i=0;i<5;i++){
  const p=card.hintPerformanceStages[String(i)];
  levels.push(p.levelBase+(basis==='total'?p.levelUnique:0));
  frequencies.push(p.frequencyBase+(basis==='total'?p.frequencyUnique:0));
 }
 return {id:ref.id,basis,present:true,namePass:ref.name?norm(card.name)===norm(ref.name):true,
  levelPass:levels.every((value,i)=>value===ref.hintLevels[i]),
  frequencyPass:frequencies.every((value,i)=>value===ref.hintFrequencies[i]),
  levelMismatchStages:levels.flatMap((x,i)=>x===ref.hintLevels[i]?[]:[i]),
  frequencyMismatchStages:frequencies.flatMap((x,i)=>x===ref.hintFrequencies[i]?[]:[i])};
}

function compareStages(text,{reference=null,references=null}={}){
 const checks=references??(reference?[reference]:EXTERNAL_REFERENCES);
 if(!Array.isArray(checks)||!checks.length||new Set(checks.map(r=>r.id)).size!==checks.length)
  throw Error('Independent reference set is empty or contains duplicate IDs');
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
 const externalReferences=checks.map(ref=>compareReference(parsed,ref));
 const external=externalReferences[0];
 return {cards:parsed.cards.size,stageRows:parsed.lines,hintsByStage:distribution,
  cardsWithStageHintChanges:changeCount,stageAddedHintLinks:added,stageRemovedHintLinks:removed,
  cardsWithHintLevelDecreases:lowerHintLevel,cardsWithFrequencyDecreases:lowerFrequency,
  fourStageHintNamesAlsoPresentAtZero:commonHintLinks,externalEfforia0to4:external,
  externalReferences,externalReferenceCount:externalReferences.length,
  externalNumericValues:externalReferences.reduce((n,r)=>n+(r.present?10:0),0),issues};
}
function assertSnapshot(result){
 if(result.cards!==563||result.stageRows!==2815)throw Error('Publisher card/stage population drift');
 if(result.hintsByStage.some(n=>n!==4015))throw Error('Publisher hint list stage totals changed');
 if(result.cardsWithStageHintChanges.some(n=>n!==0)||result.stageAddedHintLinks!==0||result.stageRemovedHintLinks!==0)
  throw Error('Limit-break-dependent support hint source data changed; manual review required');
 if(result.cardsWithHintLevelDecreases||result.cardsWithFrequencyDecreases||result.issues.length)
  throw Error('Source stage performance/hint monotonicity or uniqueness unexpectedly changed');
 if(!Array.isArray(result.externalReferences)||!result.externalReferences.length||
    result.externalReferences.some(r=>!r.present||!r.namePass||!r.levelPass||!r.frequencyPass))
  throw Error('Publisher source no longer matches reviewed independent 5-stage card references');
 return true;
}
if(require.main===module){
 const source=fs.readFileSync(0,'utf8'),sha=crypto.createHash('sha256').update(source).digest('hex');
 const result=compareStages(source);
 console.log(JSON.stringify({sourceSha256:sha,reference:'Six reviewed GameWith support-effect tables, inspected 2026-10-17',result},null,2));
 try{assertSnapshot(result);}catch(e){console.error(String(e));process.exitCode=1;}
}
module.exports={compareStages,assertSnapshot,EFFORIA,EXTERNAL_REFERENCES,compareReference,verifyReferenceShape};
