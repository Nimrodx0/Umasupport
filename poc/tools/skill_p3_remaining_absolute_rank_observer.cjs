'use strict';
// Extend the identical 720-race replay, not the simulation population.
// Only original absolute rank <=3 and >=5 in phase_random:1.
const a=require('node:assert/strict');
const old=require('./globalsim_phase_random_10m.cjs');
const {COURSES,STYLES}=require('./globalsim_position_expanded.cjs');
const BANDS=Object.freeze([{id:'absolute-top3',op:'<=',value:3},{id:'absolute-from5',op:'>=',value:5}]);
const round=x=>Number(x.toFixed(6));
function allowed(b,n){return new Set(Array.from({length:n},(_,i)=>i+1).filter(x=>b.op==='<='?x<=b.value:x>=b.value));}
function collect(){
 const agg=old.collect();
 function observe(plan,phase,segments,style,start,end){
  if(phase!==1)return;
  a(Number.isSafeInteger(plan.rep)&&plan.rep>=0&&plan.rep<30);
  for(const b of BANDS)agg.append(plan,phase,b,style,old.measureWindows(segments,allowed(b,plan.fieldSize),start,end));
 }
 function report(){
  const rows=[...agg.groups.values()].map(g=>{
   a.equal(g.phase,1);a.equal(g.n,g.split[0].n+g.split[1].n);a.equal(g.split[0].n,g.split[1].n);
   const U=100*allowed(BANDS.find(b=>b.id===g.bandId),g.fieldSize).size/g.fieldSize;
   const metric=(n,p,w)=>{a(n>0&&p>=0&&w>=p-1e-8&&w<=n+1e-8);return {runners:n,W:round(100*w/n),O:round(100*p/n),U:round(U),D:round(100*p/n-U)};};
   const half=h=>metric(h.n,h.pointSum,h.windowSum);
   return {courseId:g.courseId,fieldSize:g.fieldSize,mode:g.mode,style:g.style,bandId:g.bandId,all:metric(g.n,g.pointSum,g.windowSum),first15:half(g.split[0]),last15:half(g.split[1])};
  }).sort((a,b)=>a.bandId.localeCompare(b.bandId)||a.courseId-b.courseId||a.fieldSize-b.fieldSize||a.mode.localeCompare(b.mode)||a.style.localeCompare(b.style));
  a.equal(rows.length,192);a.equal(new Set(rows.map(r=>[r.bandId,r.courseId,r.fieldSize,r.mode,r.style].join('|'))).size,192);
  return {status:'P3-absolute-rank-same-720-replay-not-game-rate',sourceRevision:old.PIN,baseRaces:720,seedsPerHalf:15,phase:1,bands:BANDS,rows};
 }
 return {observe,report};
}
module.exports={BANDS,allowed,collect};
