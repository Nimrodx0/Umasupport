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
const STATUS='P2.57-native-neighbour-model-source-logic-projection-only';
const TARGETS=["blocked_front_continuetime","blocked_side_continuetime","infront_near_lane_time","behind_near_lane_time","is_overtake","overtake_target_time","is_move_lane","is_surrounded","near_count","near_infront_count","lane_type"];
const PREFIX=256**6;
function unpack(p,q,n){
 function read(x){a(Number.isSafeInteger(x)&&x>=PREFIX&&x<2*PREFIX,'invalid packet');x-=PREFIX;const out=Array(6);for(let i=5;i>=0;i--){out[i]=x%256;x=Math.floor(x/256);}return out;}
 const f=read(p),g=read(q),current=Math.floor(f[0]/16),previous=f[0]%16;
 a(current>=1&&current<=n&&previous<=n);
 const values=Object.fromEntries(TARGETS.map((t,i)=>[t,[...f.slice(1),...g][i]]));
 a(values.is_overtake<=1&&values.is_surrounded<=1&&values.is_move_lane<=2&&values.lane_type<=3);
 a(values.near_infront_count<=values.near_count&&values.near_count<n);
 return {current,previous,values};
}
function patch(root){
 const file=path.join(root,'src/activation_conditions.rs'),source=fs.readFileSync(file,'utf8');
 for(const x of ["c.insert(\"blocked_front_continuetime\".into(), live_simple(lv_blocked_front_continuetime));","c.insert(\"blocked_side_continuetime\".into(), live_simple(lv_blocked_side_continuetime));","c.insert(\"infront_near_lane_time\".into(), live_simple(lv_infront_near_lane_time));","c.insert(\"behind_near_lane_time\".into(), live_simple(lv_behind_near_lane_time));","c.insert(\"is_overtake\".into(), live_simple(is_overtaking_value));","c.insert(\"overtake_target_time\".into(), live_simple(|s,_| s.overtake_target_time.floor()));","c.insert(\"is_move_lane\".into(), live_simple(lv_is_move_lane));","c.insert(\"is_surrounded\".into(), live_simple(lv_is_surrounded));","c.insert(\"near_count\".into(), live_simple(lv_near_count));","c.insert(\"near_infront_count\".into(), live_simple(lv_near_infront_count));","c.insert(\"lane_type\".into(), live_simple(lane_type_value));"])a(source.includes(x),'native getter registration changed: '+x);
 fs.writeFileSync(file,source+'\n'+"\n // Research-only observer, calls the original model getters.\n pub(crate) fn p257_packets(s: &RaceSolver, f: &RaceField, current: usize, previous: usize) -> (f64,f64) {\n     assert!(current > 0 && current < 16 && previous < 16);\n     let field = Some(f);\n     fn pack(values: [f64;6]) -> f64 {\n         values.iter().fold(1u64, |acc, &v| {\n             assert!(v.is_finite() && v >= 0.0 && v < 256.0 && v.fract() == 0.0);\n             acc * 256 + v as u64\n         }) as f64\n     }\n     (pack([(current*16+previous) as f64, lv_blocked_front_continuetime(s,field), lv_blocked_side_continuetime(s,field), lv_infront_near_lane_time(s,field), lv_behind_near_lane_time(s,field), is_overtaking_value(s,field)]),\n      pack([s.overtake_target_time.floor(), lv_is_move_lane(s,field), lv_is_surrounded(s,field), lv_near_count(s,field), lv_near_infront_count(s,field), lane_type_value(s,field)]))\n }\n".replace(/\n/g,source.includes('\r\n')?'\r\n':'\n'));
 stage.patch(root);
 for(const [file,pairs] of Object.entries({"src/race_field.rs":[["pub(crate) p2_priority_rank: RefCell<Vec<(usize,usize)>>,","pub(crate) p2_priority_rank: RefCell<Vec<(usize,usize)>>,\n    pub(crate) p257_native: RefCell<Vec<(f64,f64)>>,"],["p2_priority_rank: RefCell::new(vec![(0,0); 2*n]),","p2_priority_rank: RefCell::new(vec![(0,0); 2*n]),\n            p257_native: RefCell::new(vec![(-999.0,-999.0); 2*n]),"]],"src/race_field_retail.rs":[["(self.order_of(i), self.previous_order_of(i));","(self.order_of(i), self.previous_order_of(i));\n                self.p257_native.borrow_mut()[slot] = crate::activation_conditions::p257_packets(&self.solvers[i].borrow(),self,self.order_of(i),self.previous_order_of(i));"]],"src/lib.rs":[["let pair = field.p2_priority_rank.borrow()[i];\n                      pair.0 as f64 - pair.1 as f64","let p = field.p257_native.borrow();\n                      assert_eq!(p[i],p[i+n]);\n                      p[i].0"],["let snap = field.p2_priority_rank.borrow(); let (a,b) = snap[i]; let (c,d) = snap[i+n];\n                      let e = field.order_of(i); let f = field.previous_order_of(i);\n                      (((((a*32+b)*32+c)*32+d)*32+e)*32+f) as f64","field.p257_native.borrow()[i].1"]]})){
  const name=path.join(root,file);let s=fs.readFileSync(name,'utf8');const nl=s.includes('\r\n')?'\r\n':'\n';
  for(let [from,to] of pairs){from=from.replace(/\n/g,nl);to=to.replace(/\n/g,nl);a.equal(s.split(from).length,2,'pinned patch anchor '+file);s=s.replace(from,to);}
  fs.writeFileSync(name,s);
 }
 return {status:STATUS,modifiedTemporaryFiles:['src/activation_conditions.rs','src/lib.rs','src/race_field.rs','src/race_field_retail.rs'],skillLogicUntouched:true};
}
function cohort(raw,queue){
 a.equal(crypto.createHash('sha256').update(raw).digest('hex'),distance.SOURCE_SHA);
 a.equal(queue.denominators.appSkills,881);a.equal(queue.denominators.sourceMatchedSkills,818);
 const byId=new Map(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')).map(x=>[x.id,x]));
 const ids=new Set(),out=[],counts=Object.fromEntries(TARGETS.map(t=>[t,0]));
 for(const row of queue.rows){
  if(row.sourceNumericId===null)continue;
  a(!ids.has(row.sourceNumericId));ids.add(row.sourceNumericId);
  const record=byId.get(row.sourceNumericId);a(record);
  const p=profiles.project(record,'pinned');const ast=monitor.compile(p);
  const types=new Set([...ast.lookup.values()].map(x=>x.type));
  for(const t of TARGETS)if(types.has(t))counts[t]++;
  if(TARGETS.some(t=>types.has(t)))out.push({p,ast});
 }
 a.equal(ids.size,818);a.deepEqual(counts,{"blocked_front_continuetime":4,"blocked_side_continuetime":20,"infront_near_lane_time":10,"behind_near_lane_time":4,"is_overtake":21,"overtake_target_time":6,"is_move_lane":4,"is_surrounded":2,"near_count":2,"near_infront_count":2,"lane_type":2});
 return out;
}
function targetFacts(ast,values,level){
 if(!level)return [];
 return [...ast.lookup.values()].filter(p=>Object.hasOwn(values,p.type)).map(p=>({...p,satisfied:full.check(values[p.type],p.operator,p.value)}));
}
function analyze(plans,base,probe,skills){
 const totals={races:plans.length,activeTicks:0,initialPreviousRankHeld:0,physicsValuesMatched:0,firstAndFinishedHeld:0};
 const cells=new Map(),aggregate=[{true:0,false:0,unknown:0},{true:0,false:0,unknown:0}],marginal=new Map();
 for(let r=0;r<plans.length;r++){
  const plan=plans[r],b=base[r],p=probe[r];totals.physicsValuesMatched+=distance.validatePaired(plan,b,p);
  const traces=plan.strategies.map(()=>skills.map(s=>{
   const ms=[0,1].map(()=>new monitor.WholeTickMonitor(s.p));
   for(const m of ms)m.preState=m.preState.map((v,i)=>s.ast.invokes[i].preConditions.length?monitor.UNKNOWN:v);
   return {s,ms,tick:0};
  }));
  for(let t=1;t<b.frames.length;t++)for(let i=0;i<plan.fieldSize;i++){
   const h=p.frames[t].horses[i],time=legacy.get(h,4),packet=legacy.get(h,5);
   if(time===-999&&packet===-999){totals.firstAndFinishedHeld++;continue;}
   const q=unpack(time,packet,plan.fieldSize);
   if(q.previous===0)totals.initialPreviousRankHeld++;
   const key=[plan.course.id,plan.fieldSize,plan.scenario,plan.strategies[i]].join('|');
   if(!marginal.has(key))marginal.set(key,{courseId:plan.course.id,fieldSize:plan.fieldSize,scenario:plan.scenario,style:plan.strategies[i],ticks:0,nonzero:Object.fromEntries(TARGETS.map(t=>[t,0]))});
   const m=marginal.get(key);m.ticks++;
   for(const t of TARGETS)if(q.values[t]>0)m.nonzero[t]++;
   const position=legacy.get(b.frames[t-1].horses[i],0);
   a(Number.isFinite(position));totals.activeTicks++;
   const context=distance.context(plan,i);
   for(const tr of traces[i]){
    const ast=tr.s.ast;
    const common=[...rank.observedOrderRateFacts(ast,q.current,plan.fieldSize),
     ...rank.observedAbsoluteOrderFacts(ast,q.current,plan.fieldSize),
     ...pos.observations(ast,position,plan.course.distance),
     ...distance.observations(ast,distance.originalRate(position,plan.course.distance))];
    const v=tr.ms.map((m,level)=>m.step({tickIndex:tr.tick,staticContext:context,
     observations:[...common,...targetFacts(ast,q.values,level)]}).overallCondition);
    // Adding exact facts cannot reverse a previously conclusive result.
    for(let k=1;k<2;k++)if(v[k-1]!==monitor.UNKNOWN)a.equal(v[k],v[k-1]);
    tr.tick++;
   }
  }
  totals.firstAndFinishedHeld+=plan.fieldSize;
  for(let i=0;i<traces.length;i++)for(const tr of traces[i]){
   a(tr.tick>0);
   const verdict=tr.ms.map(m=>m.anyTickTrue);
   const k=[tr.s.ast.sourceNumericId,plan.course.id,plan.fieldSize,plan.scenario,plan.strategies[i]].join('|');
   if(!cells.has(k))cells.set(k,{sourceNumericId:tr.s.ast.sourceNumericId,courseId:plan.course.id,fieldSize:plan.fieldSize,scenario:plan.scenario,style:plan.strategies[i],trials:0,counts:[{true:0,false:0,unknown:0},{true:0,false:0,unknown:0}]});
   const c=cells.get(k);c.trials++;
   verdict.forEach((v,n)=>{c.counts[n][v]++;aggregate[n][v]++;});
   for(let j=1;j<2;j++)if(verdict[j-1]!==monitor.UNKNOWN)a.equal(verdict[j],verdict[j-1]);
  }
 }
 a.equal(totals.races,32);a(totals.activeTicks>0&&totals.initialPreviousRankHeld>0);
 const rows=[...cells.values()];a(rows.length>0);
 return {status:STATUS,sourceSkills:skills.length,totals,aggregate,rows,marginal:[...marginal.values()],
  boundary:{noSkillModel:true,globalSimNativeNeighbourGetters:true,sourceRuntimeNotEquivalent:true,unknownHistoryRetained:true,unobservedPredicatesHeld:true,formalLabels:0,gameRate:null}};
}
function main(args){
 if(args[0]==='patch'){a.equal(args.length,2);console.log(JSON.stringify(patch(args[1])));return;}
 a.equal(args.length,10);
 const [cmd,template,original,probe,raw,queue,checker,state,calculator,out]=args;a.equal(cmd,'replay');
 const c=fs.readFileSync(checker,'utf8');
 const st=fs.readFileSync(state,'utf8');a(st.includes('val currentTime get() = frameElapsed * secondPerFrame - startTime'));
 pos.verifyPinnedSources(c,st,fs.readFileSync(calculator,'utf8'));
 const skills=cohort(fs.readFileSync(raw),JSON.parse(fs.readFileSync(queue,'utf8')));
 const plans=legacy.plans(),t=JSON.parse(fs.readFileSync(template,'utf8').trim());
 const races=plans.map(p=>expanded.makeRace(t,p));
 a(races.every(r=>r.horses.every(h=>h.skills?.length===0)));
 const result=analyze(plans,legacy.replay(original,races),legacy.replay(probe,races),skills);
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('P2_57_NATIVE_NEIGHBOUR='+JSON.stringify({sourceSkills:result.sourceSkills,totals:result.totals,aggregate:result.aggregate,marginal:result.marginal,boundary:result.boundary}));
}
if(require.main===module)try{main(process.argv.slice(2))}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={unpack,targetFacts,cohort,patch,analyze};
