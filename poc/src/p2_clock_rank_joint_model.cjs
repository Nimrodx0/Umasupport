'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const legacy=require('../tools/globalsim_change_order_internal_probe.cjs');
const stage=require('../tools/globalsim_change_order_skill_tick.cjs');
const distance=require('../tools/globalsim_p2_15_source_distance_rate_ticks.cjs');
const expanded=require('../tools/globalsim_position_expanded.cjs');
const rank=require('./skill_source_rank_tick_bridge.cjs');
const pos=require('./skill_source_position_stage_facts.cjs');
const monitor=require('./skill_source_whole_tick_monitor.cjs');
const profiles=require('./skill_condition_profiles.js');
const full=require('./skill_full_condition_path_audit.cjs');
const STATUS='P2.56-native-model-clock-signed-rank-source-logic-projection-only';
const TARGETS=['accumulatetime','change_order_onetime'];
function patch(root){
 const source=fs.readFileSync(path.join(root,'src/activation_conditions.rs'),'utf8');
 a(source.includes('cmp((s.accumulatetime.get() as f32).floor() as f64, arg)'));
 a(source.includes('f.order_of(i) as f64 - f.previous_order_of(i) as f64'));
 stage.patch(root);
 function update(file,pairs){
  const name=path.join(root,file);let s=fs.readFileSync(name,'utf8');
  const nl=s.includes('\r\n')?'\r\n':'\n';
  for(let [from,to] of pairs){from=from.replace(/\n/g,nl);to=to.replace(/\n/g,nl);a.equal(s.split(from).length,2,'pinned patch anchor '+file);s=s.replace(from,to);}
  fs.writeFileSync(name,s);
 }
 update('src/race_field.rs',[
  ['pub(crate) p2_priority_rank: RefCell<Vec<(usize,usize)>>,','pub(crate) p2_priority_rank: RefCell<Vec<(usize,usize)>>,\n    pub(crate) p2_priority_clock: RefCell<Vec<f64>>,'],
  ['p2_priority_rank: RefCell::new(vec![(0,0); 2*n]),','p2_priority_rank: RefCell::new(vec![(0,0); 2*n]),\n            p2_priority_clock: RefCell::new(vec![-999.0; 2*n]),']
 ]);
 update('src/race_field_retail.rs',[
  ['(self.order_of(i), self.previous_order_of(i));','(self.order_of(i), self.previous_order_of(i));\n                self.p2_priority_clock.borrow_mut()[slot] = (self.solvers[i].borrow().accumulatetime.get() as f32).floor() as f64;']
 ]);
 update('src/lib.rs',[
  ['let pair = field.p2_priority_rank.borrow()[i];\n                      pair.0 as f64 - pair.1 as f64',
   'let clocks = field.p2_priority_clock.borrow();\n                      assert_eq!(clocks[i], clocks[i+n]);\n                      clocks[i]']
 ]);
 return {status:STATUS,modifiedTemporaryFiles:['src/lib.rs','src/race_field.rs','src/race_field_retail.rs'],skillLogicUntouched:true};
}
function cohort(raw,queue){
 a.equal(crypto.createHash('sha256').update(raw).digest('hex'),distance.SOURCE_SHA);
 a.equal(queue.denominators.appSkills,881);a.equal(queue.denominators.sourceMatchedSkills,818);
 const byId=new Map(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')).map(x=>[x.id,x]));
 const ids=new Set(),out=[],counts={accumulatetime:0,change_order_onetime:0};
 for(const row of queue.rows){
  if(row.sourceNumericId===null)continue;
  a(!ids.has(row.sourceNumericId));ids.add(row.sourceNumericId);
  const record=byId.get(row.sourceNumericId);a(record);
  const p=profiles.project(record,'pinned');const ast=monitor.compile(p);
  const types=new Set([...ast.lookup.values()].map(x=>x.type));
  for(const t of TARGETS)if(types.has(t))counts[t]++;
  if(TARGETS.some(t=>types.has(t)))out.push({p,ast});
 }
 a.equal(ids.size,818);a.deepEqual(counts,{accumulatetime:39,change_order_onetime:30});
 return out;
}
function targetFacts(ast,time,rankDelta,level){
 const facts=[];
 for(const p of ast.lookup.values()){
  const v=p.type==='accumulatetime'&&level>=1?time:p.type==='change_order_onetime'&&level>=2?rankDelta:null;
  if(v!==null)facts.push({...p,satisfied:full.check(v,p.operator,p.value)});
 }
 return facts;
}
function analyze(plans,base,probe,skills){
 const totals={races:plans.length,activeTicks:0,initialPreviousRankHeld:0,physicsValuesMatched:0,firstAndFinishedHeld:0};
 const cells=new Map(),aggregate=[{true:0,false:0,unknown:0},{true:0,false:0,unknown:0},{true:0,false:0,unknown:0}];
 for(let r=0;r<plans.length;r++){
  const plan=plans[r],b=base[r],p=probe[r];totals.physicsValuesMatched+=distance.validatePaired(plan,b,p);
  const traces=plan.strategies.map(()=>skills.map(s=>{
   const ms=[0,1,2].map(()=>new monitor.WholeTickMonitor(s.p));
   for(const m of ms)m.preState=m.preState.map((v,i)=>s.ast.invokes[i].preConditions.length?monitor.UNKNOWN:v);
   return {s,ms,tick:0};
  }));
  const previous=Array(plan.fieldSize).fill(null);
  for(let t=1;t<b.frames.length;t++)for(let i=0;i<plan.fieldSize;i++){
   const h=p.frames[t].horses[i],time=legacy.get(h,4),packet=legacy.get(h,5);
   if(time===-999&&packet===-999){totals.firstAndFinishedHeld++;previous[i]=null;continue;}
   a(Number.isSafeInteger(time)&&time>=0);const q=stage.unpack(packet,plan.fieldSize);
   a.deepEqual(q.priority1,q.priority0);
   if(previous[i]!==null)a.deepEqual(previous[i],q.priority1);
   previous[i]=q.afterUpdate;
   const delta=q.priority1.previous===0?null:q.priority1.current-q.priority1.previous;
   if(delta===null)totals.initialPreviousRankHeld++;
   const position=legacy.get(b.frames[t-1].horses[i],0);
   a(Number.isFinite(position));totals.activeTicks++;
   const context=distance.context(plan,i);
   for(const tr of traces[i]){
    const ast=tr.s.ast;
    const common=[...rank.observedOrderRateFacts(ast,q.priority1.current,plan.fieldSize),
     ...rank.observedAbsoluteOrderFacts(ast,q.priority1.current,plan.fieldSize),
     ...pos.observations(ast,position,plan.course.distance),
     ...distance.observations(ast,distance.originalRate(position,plan.course.distance))];
    const v=tr.ms.map((m,level)=>m.step({tickIndex:tr.tick,staticContext:context,
     observations:[...common,...targetFacts(ast,time,delta,level)]}).overallCondition);
    // Adding exact facts cannot reverse a previously conclusive result.
    for(let k=1;k<3;k++)if(v[k-1]!==monitor.UNKNOWN)a.equal(v[k],v[k-1]);
    tr.tick++;
   }
  }
  totals.firstAndFinishedHeld+=plan.fieldSize;
  for(let i=0;i<traces.length;i++)for(const tr of traces[i]){
   a(tr.tick>0);
   const verdict=tr.ms.map(m=>m.anyTickTrue);
   const k=[tr.s.ast.sourceNumericId,plan.course.id,plan.fieldSize,plan.scenario,plan.strategies[i]].join('|');
   if(!cells.has(k))cells.set(k,{sourceNumericId:tr.s.ast.sourceNumericId,courseId:plan.course.id,fieldSize:plan.fieldSize,scenario:plan.scenario,style:plan.strategies[i],trials:0,counts:[{true:0,false:0,unknown:0},{true:0,false:0,unknown:0},{true:0,false:0,unknown:0}]});
   const c=cells.get(k);c.trials++;
   verdict.forEach((v,n)=>{c.counts[n][v]++;aggregate[n][v]++;});
   for(let j=1;j<3;j++)if(verdict[j-1]!==monitor.UNKNOWN)a.equal(verdict[j],verdict[j-1]);
  }
 }
 a.equal(totals.races,32);a(totals.activeTicks>0&&totals.initialPreviousRankHeld>0);
 const rows=[...cells.values()];a(rows.length>0);
 return {status:STATUS,sourceSkills:skills.length,totals,aggregate,rows,
  boundary:{noSkillModel:true,globalSimNativeClockAndRank:true,sourceClockNotSameRuntime:true,unknownHistoryRetained:true,unobservedPredicatesHeld:true,formalLabels:0,gameRate:null}};
}
function main(args){
 if(args[0]==='patch'){a.equal(args.length,2);console.log(JSON.stringify(patch(args[1])));return;}
 a.equal(args.length,10);
 const [cmd,template,original,probe,raw,queue,checker,state,calculator,out]=args;a.equal(cmd,'replay');
 const c=fs.readFileSync(checker,'utf8');
 a(c.includes('"accumulatetime" -> condition.checkInRace { simulation.currentTime.toInt() }'));
 a(c.includes('"change_order_onetime" -> condition.checkSpecialState()'));
 const st=fs.readFileSync(state,'utf8');a(st.includes('val currentTime get() = frameElapsed * secondPerFrame - startTime'));
 pos.verifyPinnedSources(c,st,fs.readFileSync(calculator,'utf8'));
 const skills=cohort(fs.readFileSync(raw),JSON.parse(fs.readFileSync(queue,'utf8')));
 const plans=legacy.plans(),t=JSON.parse(fs.readFileSync(template,'utf8').trim());
 const races=plans.map(p=>expanded.makeRace(t,p));
 a(races.every(r=>r.horses.every(h=>h.skills?.length===0)));
 const result=analyze(plans,legacy.replay(original,races),legacy.replay(probe,races),skills);
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('P2_56_CLOCK_RANK='+JSON.stringify({sourceSkills:result.sourceSkills,totals:result.totals,aggregate:result.aggregate,boundary:result.boundary}));
}
if(require.main===module)try{main(process.argv.slice(2))}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={targetFacts,cohort,patch,analyze};
