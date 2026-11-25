'use strict';
const a=require('node:assert/strict'),fs=require('node:fs');
const clock=require('./p2_clock_rank_joint_model.cjs'),near=require('./p2_native_neighbour_model.cjs');
const stage=require('../tools/globalsim_change_order_skill_tick.cjs'),legacy=require('../tools/globalsim_change_order_internal_probe.cjs');
const distance=require('../tools/globalsim_p2_15_source_distance_rate_ticks.cjs'),expanded=require('../tools/globalsim_position_expanded.cjs');
const rank=require('./skill_source_rank_tick_bridge.cjs'),pos=require('./skill_source_position_stage_facts.cjs');
const monitor=require('./skill_source_whole_tick_monitor.cjs'),axis=require('./skill_p2_15_parameterized_axis_gates.cjs');
const STATUS='P2.59-joint-native-model-logic-and-comparison-bounds-not-game-rate';
const zero=()=>({true:0,false:0,unknown:0});
function cohort(raw,queue){
 const c=clock.cohort(raw,queue),n=near.cohort(raw,queue),by=new Map();
 for(const [kind,group] of [['clock',c],['near',n]])for(const s of group){
  const id=s.ast.sourceNumericId;
  const old=by.get(id)||{...s,clock:false,near:false};
  a.equal(JSON.stringify(old.p),JSON.stringify(s.p));old[kind]=true;by.set(id,old);
 }
 a.equal(c.length,59);a.equal(n.length,73);
 return [...by.values()];
}
function mask(ast,ctx){
 let m=0;
 for(const inv of ast.invokes)for(const c of inv.conditions)
  for(const p of inv.preConditions.length?inv.preConditions:[[]])m|=axis.maskFor([...c,...p],ctx);
 return m;
}
function interval(c){
 const n=c.true+c.false+c.unknown;a(n>0);
 return [c.true/n,(c.true+c.unknown)/n];
}
function compare(x,y){
 // Integer cross products avoid rounding at equal interval endpoints.
 const nx=x.true+x.false+x.unknown,ny=y.true+y.false+y.unknown;
 a(nx>0&&ny>0);
 if(x.true*ny>(y.true+y.unknown)*nx)return 'left-separated';
 if(y.true*nx>(x.true+x.unknown)*ny)return 'right-separated';
 if(x.unknown===0&&y.unknown===0&&x.true*ny===y.true*nx)return 'exact-tie-in-sample';
 return 'overlap-or-uncertain';
}
function analyze(plans,base,cp,np,skills){
 const totals={races:plans.length,activeTicks:0,physicsValuesMatched:0,unknownPreviousRank:0};
 const aggregate=Array.from({length:4},zero),oldClock=Array.from({length:2},zero),oldNear=Array.from({length:2},zero);
 const cells=new Map();
 for(let r=0;r<plans.length;r++){
  const plan=plans[r],b=base[r],c=cp[r],n=np[r];
  totals.physicsValuesMatched+=distance.validatePaired(plan,b,c)+distance.validatePaired(plan,b,n);
  const runners=plan.strategies.map((_,i)=>({ctx:distance.context(plan,i),tick:0,traces:skills.map(s=>{
   const ms=Array.from({length:4},()=>new monitor.WholeTickMonitor(s.p));
   for(const m of ms)m.preState=m.preState.map((v,j)=>s.ast.invokes[j].preConditions.length?monitor.UNKNOWN:v);
   return {s,ms};
  })}));
  for(let t=1;t<b.frames.length;t++)for(let i=0;i<plan.fieldSize;i++){
   const ch=c.frames[t].horses[i],nh=n.frames[t].horses[i];
   const time=legacy.get(ch,4),cr=legacy.get(ch,5),nf=legacy.get(nh,4),ng=legacy.get(nh,5);
   const held=time===-999&&cr===-999;
   a.equal(held,nf===-999&&ng===-999);
   if(held)continue;
   const q=stage.unpack(cr,plan.fieldSize),v=near.unpack(nf,ng,plan.fieldSize);
   a.deepEqual(q.priority1,q.priority0);a.equal(q.priority1.current,v.current);a.equal(q.priority1.previous,v.previous);
   a(Number.isSafeInteger(time)&&time>=0);
   const delta=v.previous===0?null:v.current-v.previous;
   if(delta===null)totals.unknownPreviousRank++;
   const position=legacy.get(b.frames[t-1].horses[i],0),runner=runners[i];
   for(const tr of runner.traces){
    const ast=tr.s.ast;
    const common=[...rank.observedOrderRateFacts(ast,v.current,plan.fieldSize),
     ...rank.observedAbsoluteOrderFacts(ast,v.current,plan.fieldSize),
     ...pos.observations(ast,position,plan.course.distance),
     ...distance.observations(ast,distance.originalRate(position,plan.course.distance))];
    const cf=clock.targetFacts(ast,time,delta,2),nf=near.targetFacts(ast,v.values,1);
    const obs=[common,[...common,...cf],[...common,...nf],[...common,...cf,...nf]];
    const vs=tr.ms.map((m,j)=>m.step({tickIndex:runner.tick,staticContext:runner.ctx,observations:obs[j]}).overallCondition);
    for(const [l,h] of [[0,1],[0,2],[1,3],[2,3]])if(vs[l]!==monitor.UNKNOWN)a.equal(vs[l],vs[h]);
   }
   runner.tick++;totals.activeTicks++;
  }
  for(const runner of runners)for(const tr of runner.traces){
   const s=tr.s,id=s.ast.sourceNumericId,ctx=runner.ctx;
   a(runner.tick>0);const vs=tr.ms.map(m=>m.anyTickTrue);
   for(const [l,h] of [[0,1],[0,2],[1,3],[2,3]])if(vs[l]!==monitor.UNKNOWN)a.equal(vs[l],vs[h]);
   vs.forEach((v,j)=>aggregate[j][v]++);
   if(s.clock){oldClock[0][vs[0]]++;oldClock[1][vs[1]]++;}
   if(s.near){oldNear[0][vs[0]]++;oldNear[1][vs[2]]++;}
   const k=[id,plan.course.id,plan.fieldSize,plan.scenario,ctx.running_style].join('|');
   if(!cells.has(k))cells.set(k,{sourceNumericId:id,courseId:plan.course.id,fieldSize:plan.fieldSize,scenario:plan.scenario,style:ctx.running_style,
    groundStateNecessaryMask:mask(s.ast,ctx),counts:Array.from({length:4},zero)});
   const row=cells.get(k);vs.forEach((v,j)=>row.counts[j][v]++);
  }
 }
 // Independently reproduce the two previously successful experiments from
 // raw fixed inputs. Do not consume expiring cross-run artifacts.
 a.deepEqual(oldClock,[{true:92,false:11648,unknown:8084},{true:2564,false:12341,unknown:4919}]);
 a.deepEqual(oldNear,[{true:94,false:14638,unknown:9796},{true:3054,false:16672,unknown:4802}]);
 a.equal(totals.activeTicks,435558);a.equal(totals.physicsValuesMatched,3503448);
 const rows=[...cells.values()],groups=new Map();
 for(const r of rows){
  r.interval=interval(r.counts[3]);
  const k=[r.sourceNumericId,r.courseId,r.fieldSize,r.scenario].join('|');
  if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);
 }
 const comparisons=[],summary={};
 for(const g of groups.values()){
  g.sort((a,b)=>a.style-b.style);
  for(let i=0;i<g.length;i++)for(let j=i+1;j<g.length;j++){
   const x=g[i],y=g[j],shared=x.groundStateNecessaryMask&y.groundStateNecessaryMask;
   const disposition=!shared?'static-incomparable':shared!==15?'ground-state-context-held':compare(x.counts[3],y.counts[3]);
   const {sourceNumericId,courseId,fieldSize,scenario}=x;
   summary[disposition]=(summary[disposition]||0)+1;
   comparisons.push({sourceNumericId,courseId,fieldSize,scenario,styles:[x.style,y.style],disposition});
  }
 }
 return {status:STATUS,sourceSkills:skills.length,cohortOverlap:59+73-skills.length,totals,aggregate,oldClock,oldNear,rows,comparisons,summary,
  boundary:{fixedNoSkillModel:true,unknownBoundsNotConfidenceIntervals:true,noGameRate:true,formalLabels:0,thresholdApproved:false}};
}
function main(args){
 a.equal(args.length,11);
 const [template,original,cp,np,raw,queue,checker,state,calculator,out,expected]=args;
 pos.verifyPinnedSources(fs.readFileSync(checker,'utf8'),fs.readFileSync(state,'utf8'),fs.readFileSync(calculator,'utf8'));
 const skills=cohort(fs.readFileSync(raw),JSON.parse(fs.readFileSync(queue,'utf8')));
 const plans=legacy.plans(),t=JSON.parse(fs.readFileSync(template,'utf8').trim()),races=plans.map(p=>expanded.makeRace(t,p));
 a(races.every(r=>r.horses.every(h=>h.skills?.length===0)));
 const v=analyze(plans,legacy.replay(original,races),legacy.replay(cp,races),legacy.replay(np,races),skills);
 fs.writeFileSync(out,JSON.stringify(v,null,2)+'\n');
 const s={sourceSkills:v.sourceSkills,cohortOverlap:v.cohortOverlap,totals:v.totals,aggregate:v.aggregate,summary:v.summary,boundary:v.boundary};
 fs.writeFileSync(expected,JSON.stringify(s,null,2)+'\n');
 console.log('P2_59_JOINT='+JSON.stringify(s));
}
if(require.main===module)try{main(process.argv.slice(2))}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={cohort,mask,interval,compare,analyze};
