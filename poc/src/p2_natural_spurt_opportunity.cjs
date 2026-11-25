'use strict';
const a=require('node:assert/strict'),fs=require('node:fs');
const STATUS='P2.55-natural-source-single-runner-window-sensitivity';
// Exact measure of uniform rate in [0,1), under the pinned source chooseRandom
// clamp (zoneEnd-2), 10m closed window, and this observed trajectory.
// The last 2m of random-start mass maps to the same clamped start.
function opportunity(positions,lo,hi){
 a(Number.isFinite(lo)&&Number.isFinite(hi)&&hi-lo>2);
 const cap=hi-2,intervals=[];let tail=false;
 for(const p of positions){
  a(Number.isFinite(p));
  if(p<lo||p>hi)continue;
  const l=Math.max(lo,p-10),r=Math.min(cap,p);
  if(r>l)intervals.push([l,r]);
  if(p>=cap&&p<=Math.min(cap+10,hi))tail=true;
 }
 intervals.sort((x,y)=>x[0]-y[0]);
 let measure=0,end=lo;
 for(const [l,r] of intervals){if(r>end){measure+=r-Math.max(l,end);end=r;}}
 const w=(measure+(tail?2:0))/(hi-lo);
 a(w>=0&&w<=1+1e-10);
 return Math.min(1,w);
}
function audit(raw){
 a.equal(raw.status,STATUS);
 a.equal(raw.sourceRevision,'f6e4501ee6c6c2d4ac8698e7796e309d31575bde');
 a.equal(raw.equippedSkills,false);a.equal(raw.fixedAbilities,true);a.equal(raw.seedControlled,false);
 const styles=['NIGE','SEN','SASI','OI'],courses={10501:1200,10504:2000};
 a.equal(raw.trials.length,240);
 const seen=new Set(),groups=new Map();
 for(const r of raw.trials){
  a.equal(r.distance,courses[r.course]);a(styles.includes(r.style));
  a([0,1].includes(r.block)&&Number.isInteger(r.trial)&&r.trial>=0&&r.trial<15);
  const key=[r.course,r.style,r.block,r.trial].join('|');a(!seen.has(key));seen.add(key);
  a(Math.abs(r.phase3Start-r.distance*5/6)<1e-7);
  a(Math.abs(r.phase3End-r.distance)<1e-7);
  a(Number.isFinite(r.raceTime)&&r.raceTime>0&&typeof r.maxSpurt==='boolean');
  a(r.positions.length>100&&r.positions.every(Number.isFinite));
  const set=new Set(r.positions);a(r.spurtPositions.every(p=>set.has(p)));
  const lo=r.phase3Start,hi=r.phase3End,mid=(lo+hi)/2;
  const windows={firstHalf:[lo,mid],full:[lo,hi]};
  const gkey=[r.course,r.style,r.block].join('|');
  if(!groups.has(gkey))groups.set(gkey,[]);
  const values={raceTime:r.raceTime,maxSpurt:r.maxSpurt?1:0,
   firstSpurtFraction:r.spurtPositions.length?r.spurtPositions[0]/r.distance:null};
  for(const [name,[l,h]] of Object.entries(windows)){
   const all=opportunity(r.positions,l,h),joint=opportunity(r.spurtPositions,l,h);
   a(joint<=all+1e-10);values[name]=joint;values[name+'WindowOnly']=all;
  }
  groups.get(gkey).push(values);
 }
 const cells=[...groups.entries()].map(([k,rows])=>{
  a.equal(rows.length,15);
  const [course,style,block]=k.split('|');
  const means=Object.fromEntries(Object.keys(rows[0]).map(f=>{
   const vals=rows.map(r=>r[f]).filter(v=>v!==null);
   return [f,vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:null];
  }));
  return {course:Number(course),style,block:Number(block),trials:15,spurtObservedTrials:rows.filter(r=>r.firstSpurtFraction!==null).length,means};
 });
 a.equal(cells.length,16);
 const contrasts=[];
 for(const course of Object.keys(courses).map(Number))for(const window of ['firstHalf','full']){
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
   const delta=[0,1].map(block=>cells.find(c=>c.course===course&&c.style===styles[i]&&c.block===block).means[window]-
    cells.find(c=>c.course===course&&c.style===styles[j]&&c.block===block).means[window]);
   contrasts.push({course,window,styles:[styles[i],styles[j]],blockDifferences:delta,
    direction:delta.every(v=>v>0)?'positive-both':delta.every(v=>v<0)?'negative-both':delta.every(v=>v===0)?'equal-both':'held-zero-or-reversal'});
  }
 }
 return {status:STATUS,sourceRevision:raw.sourceRevision,trials:240,cells,contrasts,
  boundary:{singleRunner:true,seedControlled:false,conditionalOnObservedNoSkillTrajectory:true,
   sourceRandomWindowIntegratedNotActualDraw:true,notWholeSkillAND:true,notGameProcRate:true,formalLabels:0}};
}
if(require.main===module)try{
 const [input,out]=process.argv.slice(2);a(input&&out);
 const x=audit(JSON.parse(fs.readFileSync(input,'utf8')));
 fs.writeFileSync(out,JSON.stringify(x,null,2)+'\n');
 console.log('P2_55_SPURT_SENSITIVITY='+JSON.stringify(x));
}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={opportunity,audit};
