#!/usr/bin/env node
'use strict';
/* P2 research: 6-course comparison of model rank-band occupancy.
 * The input is a nine-position approximation, NOT game skill activation.
 * Keep style labels/UI unchanged. */
const fs=require('node:fs');
const pilot=require('./globalsim_position_pilot.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const windows=require('./globalsim_window_profile.cjs');
const sensitivity=require('./globalsim_window_sensitivity.cjs');
const COURSES=expanded.COURSES.map(c=>c.id),STYLES=expanded.STYLES;
const contexts=['fieldSize','scenario','mode','windowId'];
const k=(x,fields)=>fields.map(f=>String(x[f])).join('|');
const pp=x=>Number((100*x).toFixed(6));
const stats=a=>{
 if(!a.length)return {n:0,median:null,max:null,min:null};
 const x=[...a].sort((u,v)=>u-v),mid=x.length/2;
 return {n:x.length,min:Number(x[0].toFixed(6)),
  median:Number(((x.length%2)?x[Math.floor(mid)]:
   (x[mid-1]+x[mid])/2).toFixed(6)),
  max:Number(x.at(-1).toFixed(6))};
};
function analyze(profile,{strict=false}={}){
 if(profile?.schemaVersion!==1||
  profile.sourceRevision!==pilot.PIN||
  profile.status!=='model-window-rank-occupancy-estimate-not-skill-activation-rate'||
  !Array.isArray(profile.windows)||!profile.windows.length)
  throw Error('Expected source-pinned GlobalSim window profile');
 const groups=new Map(),seen=new Set();
 for(const w of profile.windows){
  if(!COURSES.includes(w.courseId)||![9,12].includes(w.fieldSize)||
   !Object.hasOwn(expanded.SOURCES,w.scenario)||
   !expanded.MODES.includes(w.mode)||!STYLES.includes(w.style)||
   !windows.WINDOWS.some(x=>x.id===w.windowId)||
   w.scenario==='noFront'&&w.style==='Nige')
   throw Error('Unexpected model group identity');
  if(w.status!=='estimate'||!Number.isFinite(w.pTopHalf)||
   !Number.isFinite(w.pBackHalf)||w.pTopHalf<0||w.pTopHalf>1||
   w.pBackHalf<0||w.pBackHalf>1||
   Math.abs(w.pTopHalf+w.pBackHalf-1)>1e-8||
   !Number.isSafeInteger(w.minValidRunners)||w.minValidRunners<=0)
   throw Error('Unresolved or invalid rank model cell');
  const id=k(w,['courseId',...contexts,'style']);
  if(seen.has(id))throw Error('Duplicate model cell '+id);
  seen.add(id);
  const key=k(w,['courseId',...contexts]);
  if(!groups.has(key))groups.set(key,{courseId:w.courseId,
   fieldSize:w.fieldSize,scenario:w.scenario,mode:w.mode,
   windowId:w.windowId,styles:{}});
  groups.get(key).styles[w.style]=w;
 }
 if(strict){
  if(profile.sourceRaceCount!==2160||profile.sourceSeedCount!==15||
   groups.size!==576||profile.windows.length!==2208)
   throw Error('Missing expected 2160-race evidence');
  for(const courseId of COURSES)
   for(const fieldSize of [9,12])
    for(const scenario of Object.keys(expanded.SOURCES))
     for(const mode of expanded.MODES)
      for(const win of windows.WINDOWS){
       const g=groups.get(k({courseId,fieldSize,scenario,mode,
        windowId:win.id},['courseId',...contexts]));
       const required=STYLES.filter(s=>scenario!=='noFront'||s!=='Nige');
       if(!g||Object.keys(g.styles).length!==required.length||
        required.some(s=>!g.styles[s]))
        throw Error('Incomplete style population for '+courseId+'/'+scenario);
      }
 }
 const rows=[],nigeSenkou={nigeAhead:0,senkouAhead:0,tie:0},
  sasiOikomi={sasiAhead:0,oikomiAhead:0,tie:0};
 for(const g of groups.values()){
  const front=['Nige','Senkou'].filter(s=>g.styles[s]),
   rear=['Sasi','Oikomi'].filter(s=>g.styles[s]);
  const p=s=>g.styles[s].pTopHalf;
  const gap=front.length&&rear.length?
   pp(Math.min(...front.map(p))-Math.max(...rear.map(p))):null;
  const relation=gap===null?'unknown':gap>1e-9?'front-ahead':
   gap< -1e-9?'counterexample':'tie';
  if(front.length===2){
   const d=p('Nige')-p('Senkou');
   nigeSenkou[d>1e-9?'nigeAhead':d< -1e-9?'senkouAhead':'tie']++;
  }
  if(rear.length===2){
   const d=p('Sasi')-p('Oikomi');
   sasiOikomi[d>1e-9?'sasiAhead':d< -1e-9?'oikomiAhead':'tie']++;
  }
  rows.push({...g,front,rear,gap,relation});
 }
 const byContext=new Map();
 for(const row of rows){
  const id=k(row,contexts);
  if(!byContext.has(id))byContext.set(id,[]);
  byContext.get(id).push(row);
 }
 const spreadGroups=[],sameDistance=[];
 for(const x of byContext.values()){
  if(x.length===COURSES.length){
   spreadGroups.push({fieldSize:x[0].fieldSize,scenario:x[0].scenario,
    mode:x[0].mode,windowId:x[0].windowId,
    allFrontAhead:x.every(z=>z.relation==='front-ahead'),
    hasNige:x.every(z=>z.styles.Nige!==undefined)});
  }
  for(const style of STYLES){
   const available=x.filter(y=>y.styles[style]);
   if(available.length===COURSES.length){
    const vals=available.map(y=>y.styles[style].pTopHalf);
    spreadGroups.push({kind:'course-spread',style,
     fieldSize:x[0].fieldSize,scenario:x[0].scenario,mode:x[0].mode,
     windowId:x[0].windowId,rangePoints:pp(Math.max(...vals)-Math.min(...vals)),
     minRunners:Math.min(...available.map(y=>y.styles[style].minValidRunners))});
   }
   for(const [distanceMetres,a,b] of [[1600,10502,10304],[2000,10504,10604]]){
    const aa=x.find(y=>y.courseId===a)?.styles[style],
     bb=x.find(y=>y.courseId===b)?.styles[style];
    if(aa&&bb)sameDistance.push({distanceMetres,style,
     fieldSize:x[0].fieldSize,scenario:x[0].scenario,
     mode:x[0].mode,windowId:x[0].windowId,
     differencePoints:pp(Math.abs(aa.pTopHalf-bb.pTopHalf)),
     firstPercent:pp(aa.pTopHalf),secondPercent:pp(bb.pTopHalf),
     minRunners:Math.min(aa.minValidRunners,bb.minValidRunners)});
   }
  }
 }
 const spreads=spreadGroups.filter(x=>x.kind==='course-spread');
 const byStyle=Object.fromEntries(STYLES.map(style=>{
  const x=spreads.filter(y=>y.style===style)
   .sort((a,b)=>b.rangePoints-a.rangePoints);
  return [style,{spread:stats(x.map(y=>y.rangePoints)),
   largest:x[0]||null}];
 }));
 const withinSameDistance=Object.fromEntries([1600,2000].map(m=>[
  String(m),Object.fromEntries(STYLES.map(style=>{
   const x=sameDistance.filter(y=>y.distanceMetres===m&&y.style===style)
    .sort((a,b)=>b.differencePoints-a.differencePoints);
   return [style,{difference:stats(x.map(y=>y.differencePoints)),
    largest:x[0]||null}];
  }))
 ]));
 const top=rows.filter(x=>x.gap!==null).sort((a,b)=>a.gap-b.gap);
 const byWindow=Object.fromEntries(windows.WINDOWS.map(win=>{
  const x=rows.filter(y=>y.windowId===win.id);
  return [win.id,{n:x.length,frontAhead:x.filter(y=>y.relation==='front-ahead').length,
   gap:stats(x.filter(y=>y.gap!==null).map(y=>y.gap))}];
 }));
 return {schemaVersion:1,sourceRevision:pilot.PIN,
  sourceRaceCount:profile.sourceRaceCount,sourceSeedCount:profile.sourceSeedCount,
  status:'P2-six-course-model-directional-review-not-skill-activation-rate',
  counts:{courseContexts:rows.length,allSixCourseMatched:spreadGroups.filter(x=>x.allFrontAhead!==undefined).length,
   allSixCourseFrontAhead:spreadGroups.filter(x=>x.allFrontAhead===true).length,
   frontAhead:rows.filter(x=>x.relation==='front-ahead').length,
   tied:rows.filter(x=>x.relation==='tie').length,
   counterexample:rows.filter(x=>x.relation==='counterexample').length,
   unknown:rows.filter(x=>x.relation==='unknown').length,
   noNige:rows.filter(x=>x.front.length===1&&x.front[0]==='Senkou').length,
   bothFrontStyles:rows.filter(x=>x.front.length===2).length},
  byWindow,withinStylePairOrdering:{nigeVsSenkou:nigeSenkou,
   sasiVsOikomi:sasiOikomi},
  courseSpreadByStyle:byStyle,withinSameDistance,
  weakestFrontRear:top[0]?{courseId:top[0].courseId,
   fieldSize:top[0].fieldSize,scenario:top[0].scenario,
   mode:top[0].mode,windowId:top[0].windowId,
   gapPercentagePoints:top[0].gap}:null,
  generalization:{candidate:'Only the directional front-group versus rear-group position tendency for order_rate <= 50 in these four windows.',
   adopted:false,
   reasonsNotUniversal:['Only one 50% rank split; no other rank bands.',
    'Only four middle/final-first-half position windows.',
    'Six course IDs do not isolate distance from course geometry and random seed.',
    'Fifteen seeds per cell and nine sampled position points; not exact rank integrals.',
    'The noFront scenario compares Senkou with the rear pair, not Nige.',
    'Not Japanese-game activation probability or skill effects.']},
  limitations:['Six fixed GlobalSim courses with distinct seed sequences.',
   'Same-distance 1600m and 2000m course comparisons retain geometry differences.',
   'Runner count differs across styles and event-prior scenarios.',
   'Do not pool numerical estimates into a real population rate or change 53 existing labels.']};
}
function main([summaryPath,profilePath,output]){
 if(!summaryPath||!profilePath||!output)
  throw Error('Usage: globalsim_course_generalization.cjs summary.json profile.json result.json');
 const source=JSON.parse(fs.readFileSync(summaryPath,'utf8')),
  profile=JSON.parse(fs.readFileSync(profilePath,'utf8'));
 sensitivity.validate(source,profile);
 const recomputed=windows.analyze(source);
 if(JSON.stringify(recomputed.windows)!==JSON.stringify(profile.windows))
  throw Error('Recomputed position windows disagree with original data');
 const result=analyze(profile,{strict:true});
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({counts:result.counts,
  withinStylePairOrdering:result.withinStylePairOrdering,
  weakestFrontRear:result.weakestFrontRear,
  courseSpreadByStyle:Object.fromEntries(Object.entries(result.courseSpreadByStyle)
   .map(([s,v])=>[s,v.spread]))},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}catch(e){console.error(e);process.exitCode=1}
module.exports={analyze,main};
