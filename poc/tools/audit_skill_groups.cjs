'use strict';
// Read-only skill group coverage audit. Only explicit CLI --online fetches publisher data.
const {parseSource,SOURCE_URL}=require('../src/skill_bridge.js');
const fs=require('node:fs');
const crypto=require('node:crypto');
function inspect(source){
  if(!source?.byId||!source?.byName)throw Error('Skill source is missing');
  const groups=new Map(),rarityCounts={};
  for(const skill of source.byId.values()){
    rarityCounts[skill.rarity]=(rarityCounts[skill.rarity]||0)+1;
    const g=groups.get(skill.group)||{group:skill.group,rare:[],normal:[],others:[]};
    (skill.rarity==='rare'?g.rare:skill.rarity==='normal'?g.normal:g.others).push(skill);
    groups.set(skill.group,g);
  }
  const status={uniquePair:[],noNormal:[],multiRare:[],multiNormal:[],ambiguousNames:[],idPatternMismatch:[]};
  let eligibleRare=0;
  for(const g of groups.values()){
    if(!g.rare.length)continue;
    eligibleRare+=g.rare.length;
    if(!g.normal.length){status.noNormal.push(g);continue;}
    if(g.rare.length!==1){status.multiRare.push(g);continue;}
    if(g.normal.length!==1){status.multiNormal.push(g);continue;}
    const r=g.rare[0],n=g.normal[0];
    if(source.byName.get(r.name).length!==1||source.byName.get(n.name).length!==1){
      status.ambiguousNames.push(g);continue;
    }
    if(!r.id.endsWith('1')||!n.id.endsWith('2')||
       !/^\d+$/.test(r.id)||!/^\d+$/.test(n.id)||
       Math.floor(Number(r.id)/10)!==g.group||
       Math.floor(Number(n.id)/10)!==g.group){
      status.idPatternMismatch.push(g);continue;
    }
    status.uniquePair.push({goldId:r.id,goldName:r.name,whiteId:n.id,whiteName:n.name,group:g.group});
  }
  const byGroup=Object.fromEntries(Object.entries(status).map(([name,list])=>[name,list.length]));
  const rareCovered=status.uniquePair.length;
  const unresolved=[...status.noNormal,...status.multiRare,...status.multiNormal,
                    ...status.ambiguousNames,...status.idPatternMismatch];
  return {sourceRecords:source.count,sourceGroups:groups.size,rarityCounts,
    totalRare:eligibleRare,uniqueStructuralPairs:rareCovered,
    rareCoveragePercent:eligibleRare?Math.round(rareCovered/eligibleRare*10000)/100:0,
    byGroup,
    unresolvedGroups:unresolved.map(g=>({
      group:g.group,rare:g.rare.map(x=>({id:x.id,name:x.name})),
      normal:g.normal.map(x=>({id:x.id,name:x.name}))
    })).sort((a,b)=>a.group-b.group),
    pairs:status.uniquePair};
}
async function main(){
 const arg=process.argv.slice(2),mode=arg[0];
 if(!['--online','--local'].includes(mode))throw Error('Use --online or --local FILE');
 let text;
 if(mode==='--online'){
   const res=await fetch(SOURCE_URL,{headers:{'User-Agent':'UmaSupportLab-SkillAudit/1.0'}});
   if(!res.ok)throw Error('Publisher returned HTTP '+res.status);
   text=await res.text();
 }else {
   if(!arg[1])throw Error('Missing local source path');
   text=fs.readFileSync(arg[1],'utf8');
 }
 const report=inspect(parseSource(text)),sha256=crypto.createHash('sha256').update(text).digest('hex');
 console.log(JSON.stringify({source:SOURCE_URL,sha256,
   ...report,pairs:undefined,unresolvedGroups:report.unresolvedGroups.slice(0,40),
   unresolvedGroupCount:report.unresolvedGroups.length,
   samplePairs:report.pairs.slice(0,8)},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={inspect};
