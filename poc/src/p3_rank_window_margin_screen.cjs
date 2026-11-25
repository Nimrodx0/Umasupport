'use strict';
// P3.4h: exact paired W-window and D-point observations, no production labels.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const join=require('../tools/p2_g3g4_combined_short_window_881.cjs');
const STYLES=join.STYLES,MARGINS=[0,5,10,20],HALVES=['all','first15','last15'];
const STATUS='P3.4h-paired-rank-window-margins-and-source-branch-consistency-only';
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function pairEnvelopes(byStyle){
 const groups=STYLES.map(s=>byStyle[s]);
 a(groups.every(g=>Array.isArray(g)&&g.length>0));
 const reference=groups[0],key=x=>[x.courseId,x.fieldSize,x.mode].join('|');
 a.equal(new Set(reference.map(key)).size,reference.length);
 const indexed=groups.map(g=>{
  const m=new Map(g.map(r=>[key(r),r]));a.equal(g.length,m.size);a.equal(m.size,reference.length);
  return reference.map(r=>{const v=m.get(key(r));a(v);return v;});
 });
 for(const g of indexed)for(const row of g)for(const h of HALVES){
  a(row[h]&&Number.isFinite(row[h].W)&&row[h].W>=0&&row[h].W<=100);
  a(Number.isFinite(row[h].D)&&row[h].D>=-100&&row[h].D<=100);
 }
 const pairs=[];
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
  const p={first:STYLES[i],second:STYLES[j]};
  for(const m of ['W','D']){
   const values=indexed[i].flatMap((row,k)=>HALVES.map(h=>row[h][m]-indexed[j][k][h][m]));
   p[m]={min:Math.min(...values),max:Math.max(...values)};
  }
  pairs.push(p);
 }
 return pairs;
}
// A top group is a separated set, not a complete ranking of all lower styles.
// Demand within-group equivalence and every member winning over every outside style.
// W measures the short-window opportunity. D is supporting/contradictory
// point occupancy, never added to W.
function choose(pairs,margin,requireD){
 const map=new Map(pairs.map(p=>[p.first+'|'+p.second,p]));
 a.equal(map.size,6);a(MARGINS.includes(margin));
 const get=(i,j,m)=>{
  const forward=i<j,x=map.get(STYLES[Math.min(i,j)]+'|'+STYLES[Math.max(i,j)]);
  a(x);const r=x[m];a(Number.isFinite(r.min)&&Number.isFinite(r.max)&&r.min<=r.max);
  return forward?r:{min:-r.max,max:-r.min};
 };
 const EPS=1e-9;
 const groups=[];
 for(let mask=1;mask<15;mask++){
  const inside=[0,1,2,3].filter(i=>mask&(1<<i)),outside=[0,1,2,3].filter(i=>!(mask&(1<<i)));
  if(!inside.every((i,k)=>inside.slice(k+1).every(j=>{
   const w=get(i,j,'W');return w.min>=-margin-EPS&&w.max<=margin+EPS;
  })))continue;
  if(!inside.every(i=>outside.every(j=>get(i,j,'W').min>margin+EPS)))continue;
  if(requireD&&!inside.every(i=>outside.every(j=>get(i,j,'D').min>EPS)))continue;
  groups.push(inside.map(i=>STYLES[i]));
 }
 a(groups.length<=1,'two distinct groups cannot strictly dominate their complements');
 const within=pairs.every(p=>p.W.min>=-margin-EPS&&p.W.max<=margin+EPS);
 return groups.length?{state:'targeted-window-candidate',styles:groups[0]}:
  {state:within?'within-window-margin-only':'undetermined-window',styles:[]};
}
function screen(branches,margin,requireD){
 if(branches.some(b=>b.pairs===null))return {state:'explicit-style-not-comparable',styles:[]};
 const r=branches.map(b=>choose(b.pairs,margin,requireD));
 const states=r.map(x=>JSON.stringify(x));
 if(states.every(x=>x===states[0]))return r[0];
 return {state:'branch-results-differ-held',styles:[]};
}
function audit(direct,exception,ledger){
 a.equal(direct.status,'P2.28-balanced-two-axis-source-short-window-model-not-game-proc');
 a.equal(ledger.status,join.STATUS);
 a.equal(ledger.summary.appSkills,881);a.equal(direct.items.length,75);a.equal(exception.rows.length,12);
 const ds=new Map(direct.items.map(x=>[x.skillId,x])),es=new Map(exception.rows.map(x=>[x.skillId,x]));
 a.equal(ds.size,75);a.equal(es.size,12);
 const rows=[],summary=Object.fromEntries(MARGINS.map(m=>[m,{WOnly:{},WAndD:{}}]));
 let excludedGround=0,oneStyle=0,branches=0;
 const count=(obj,k)=>obj[k]=(obj[k]||0)+1;
 for(const r of ledger.rows){
  if(r.decision==='hold-turf-model-transfer'){excludedGround++;continue;}
  let bs=[];
  if(r.decision==='conditionally-use-short-window-rank-evidence'){
   const x=ds.get(r.skillId);a(x);a.equal(x.sourceNumericId,r.sourceNumericId);
   a.equal(x.skillName,r.skillName);
   a([1,4].includes(x.eligibleStyles.length));
   const pairs=x.eligibleStyles.length===4?pairEnvelopes(Object.fromEntries(STYLES.map(s=>[s,x.styles[s].detail]))):null;
   if(!pairs)oneStyle++;
   bs=[{distanceType:null,windowKey:x.windowKey,bandId:x.bandId,courseIds:x.modelCourses,pairs}];
  }else if(r.decision==='conditionally-use-source-exception-branch-W-D'){
   const x=es.get(r.skillId);a(x);a.equal(x.sourceNumericId,r.sourceNumericId);a.equal(x.skillName,r.skillName);
   a([1,2].includes(x.branchAnalyses.length));
   bs=x.branchAnalyses.map(b=>({distanceType:b.distanceType,windowKey:b.windowKey,bandId:b.bandId,
    courseIds:b.modelCourses,pairs:pairEnvelopes(b.observationContextsByStyle)}));
  }else continue;
  branches+=bs.length;
  const sweeps=MARGINS.map(margin=>{
   const WOnly=screen(bs,margin,false),WAndD=screen(bs,margin,true);
   count(summary[margin].WOnly,WOnly.state);count(summary[margin].WAndD,WAndD.state);
   if(WAndD.state==='targeted-window-candidate')a.deepEqual(WAndD,WOnly);
   return {margin,WOnly,WAndD};
  });
  rows.push({appSkillId:r.skillId,sourceNumericId:r.sourceNumericId,branches:bs,sweeps,formalLabel:null});
 }
 a.equal(rows.length,81);a.equal(branches,91);a.equal(oneStyle,30);a.equal(excludedGround,6);
 return {status:STATUS,source:{directSHA256:digest(direct),exceptionSHA256:digest(exception),ledgerSHA256:digest(ledger)},
  population:{skills:81,branches,oneStyle,excludedGround},summary,rows,
  boundary:{fixedBalancedTurfOnly:true,split15AndFull30Used:true,partialWDOnly:true,approvedMargin:null,formalLabels:0,gameRate:null}};
}
if(require.main===module)try{
 const args=process.argv.slice(2);a.equal(args.length,4);
 const r=audit(...args.slice(0,3).map(p=>JSON.parse(fs.readFileSync(p,'utf8'))));
 fs.writeFileSync(args[3],JSON.stringify(r,null,2)+'\n');
 console.log('P3_4H_WINDOW_SWEEP='+JSON.stringify({population:r.population,summary:r.summary}));
}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={pairEnvelopes,choose,screen,audit};
