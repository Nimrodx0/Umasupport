#!/usr/bin/env node
'use strict';
/* 53-item research-only overlay: do not mutate production P2 inferred labels.
 * Regenerates a compact result from the pinned, audited skill-condition review. */
const fs=require('node:fs');
const fit=require('../src/skill_activation_fit_v1.cjs');
const style=require('../src/skill_style_tendency.js');
const REV='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
function rehydrate(item){
 if(!item||typeof item.sourceNumericId!=='string'||
  !Array.isArray(item.paths)||!item.paths.length)
  throw Error('Malformed reviewed source item');
 const index=item.paths[0].invokeIndex;
 if(item.paths.some(p=>p.invokeIndex!==index||
   !Number.isSafeInteger(p.orIndex)||!Array.isArray(p.sourceConditions)))
  throw Error('Reviewed P2 source paths contain unsupported invoke alternative');
 const paths=[...item.paths].sort((a,b)=>a.orIndex-b.orIndex);
 if(paths.some((p,i)=>p.orIndex!==i))
  throw Error('Missing or duplicate P2 reviewed OR branch');
 return {status:'source-structure',sourceNumericId:item.sourceNumericId,
  invokes:[{index,conditions:paths.map(p=>p.sourceConditions),preConditions:[]}]};
}
function audit53(audit){
 if(!audit||audit.auditVersion!==7||audit.source?.revision!==REV||
  audit.source?.sha256!==SHA||!Array.isArray(audit.p2StyleReview?.groups)||
  audit.p2StyleReview.total!==53||
  audit.p2StyleTendency?.app?.inferred!==53)
  throw Error('Expected the exact pinned 53-skill style review');
 const source=audit.p2StyleReview.groups.flatMap(g=>g.skills||[]);
 if(source.length!==53)throw Error('Incomplete source-reviewed cohort');
 const seen=new Set(),items=[];
 const totals=Object.fromEntries(Object.keys(fit.LABELS).map(x=>[x,0]));
 const byExisting={};
 for(const original of source){
  if(!/^\d+$/.test(original.sourceNumericId)||
   seen.has(original.sourceNumericId)||
   !['逃げ・先行寄り','差し・追込寄り'].includes(original.tendency))
   throw Error('Unexpected or duplicate P2 skill identity');
  seen.add(original.sourceNumericId);
  const p=rehydrate(original);
  const prior=style.infer(p);
  if(prior.status!=='inferred'||prior.label!==original.tendency)
   throw Error('Rebuilt condition path disagrees with existing 53-skill review');
  const result=fit.evaluate(p);
  if(result.sourceInvokes!==1||Object.keys(result.styles).length!==4)
   throw Error('Incomplete fit style cohort');
  const styles=Object.fromEntries(Object.entries(result.styles).map(([name,v])=>{
   totals[v.status]++;
   return [name,{status:v.status,label:v.label,reason:v.reason,
    branches:v.paths.map(b=>({invokeOffset:b.invokeOffset,orIndex:b.orIndex,
     status:b.status,reason:b.reason,
     rankOnlyStatus:b.rankOnly?.status||null,
     sourceConditions:b.sourceConditions||null,
     researchBasis:b.researchBasis||null,
     contextPredicates:b.contextPredicates||[],
     raceRequirements:b.raceRequirements||[],
     surfaceTransfer:b.surfaceTransfer||null}))
   }];
  }));
  if(!byExisting[original.tendency])
   byExisting[original.tendency]={skills:0,styleStatuses:
    Object.fromEntries(Object.keys(fit.LABELS).map(x=>[x,0]))};
  byExisting[original.tendency].skills++;
  for(const v of Object.values(styles))byExisting[original.tendency].styleStatuses[v.status]++;
  items.push({sourceNumericId:original.sourceNumericId,
   appSkillId:original.id,skillName:original.name,priorStyleLabel:original.tendency,
   signature:original.signature,styles});
 }
 if(items.length*4!==Object.values(totals).reduce((a,b)=>a+b,0))
  throw Error('Style coverage count not exhaustive');
 items.sort((a,b)=>Number(a.sourceNumericId)-Number(b.sourceNumericId));
 const terrainItems=items.filter(item=>Object.values(item.styles).some(s=>
  s.branches.some(b=>(b.raceRequirements||[]).some(c=>
   c.type==='ground_type'||c.type==='ground_condition'))));
 const terrainResolved=terrainItems.filter(item=>Object.values(item.styles)
  .every(s=>s.status!=='held'));
 return {schemaVersion:1,ruleVersion:fit.VERSION,
  status:'research-only-activation-condition-fit-not-production-classification',
  source:{revision:REV,sha256:SHA,appSkillCohort:53,
   simulatorSources:['GlobalSim v77 #343 six-course 2160','GlobalSim v77 #344 four-phase 1080',
    'GlobalSim v77 #345 fixed-roster 1440','GlobalSim v77 #346 focal-control 5760']},
  counts:{skills:items.length,styleCases:items.length*4,byStatus:totals,
   byPriorStyleLabel:byExisting,
   terrainRaceGateSkills:terrainItems.length,
   terrainRaceGateResolvedSkills:terrainResolved.length,
   terrainRaceGateStillHeldSkills:terrainItems.length-terrainResolved.length},
  boundaries:[
   'Only exact order_rate<=50 and >50 with validated random phase windows receive stable relative high/low labels.',
   'Phase 3 is context-dependent because counterexamples exist, even if many tested cohorts retain the front/rear ordering.',
   'Explicit style exclusion must be shown on every reachable OR/invoke path to count as ineligible.',
   'Ground type (turf/dirt) and track condition are separate absolute race gates, not style suitability predicates; their exact source operator and value are retained.',
   'Front/rear qualitative position tendency is provisionally transferred across surfaces by user decision; dirt/track-condition-specific simulation has not been validated.',
   'Unknown AND terms and divergent OR paths remain held; partial rank evidence is shown separately.',
   'A relative high/low tendency is neither an absolute model success rate nor a Japanese game skill activation probability.',
   'No previously inferred label, support-card score, published data or UI is changed.'
  ],
  items};
}
function main([auditFile,output]){
 if(!auditFile||!output)
  throw Error('Usage: skill_activation_fit_v1_report.cjs skill-condition-inventory-audit.json result.json');
 const data=JSON.parse(fs.readFileSync(auditFile,'utf8'));
 const result=audit53(data);
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({counts:result.counts,
  examples:result.items.slice(0,8).map(x=>({id:x.sourceNumericId,name:x.skillName,
   styles:Object.fromEntries(Object.entries(x.styles).map(([s,v])=>[s,v.status]))}))},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e);process.exitCode=1}
module.exports={audit53,rehydrate,main};
