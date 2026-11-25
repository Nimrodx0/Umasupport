'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const STATUS='P3.4f-dynamic-fixed-context-margin-sensitivity-only';
const STYLES=[1,2,3,4],MARGINS=[0,5,10,20],COURSES=[10502,10504],SIZES=[9,12],ROSTERS=['balanced','backHeavy'];
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const contexts=COURSES.flatMap(c=>SIZES.flatMap(n=>ROSTERS.map(s=>[c,n,s])));
function bounds(c){
 a(c&&['true','false','unknown'].every(k=>Number.isSafeInteger(c[k])&&c[k]>=0));
 const n=c.true+c.false+c.unknown;a(n>0);
 return {lo:c.true,hi:c.true+c.unknown,n};
}
// Numerator comparison in exact integer arithmetic (margins are percentages).
function gap(x,y,m){
 return 100*(x.lo*y.n-y.hi*x.n)>m*x.n*y.n;
}
function relation(x,y,m){
 if(gap(x,y,m))return 'left';
 if(gap(y,x,m))return 'right';
 if(100*(x.hi*y.n-y.lo*x.n)<=m*x.n*y.n&&100*(y.hi*x.n-x.lo*y.n)<=m*x.n*y.n)return 'within';
 return 'hold';
}
function screen(cells,margin){
 a(MARGINS.includes(margin));a(cells.length===8);
 // All four styles in the identical two-course, two-roster, two-field
 // fixed panel must have comparable static eligibility. No pooled counts.
 if(cells.some(g=>g.length!==4||g.some(r=>r.groundStateNecessaryMask!==15)))
  return {state:'undetermined',reason:'static-scope-not-common-in-all-eight-contexts',styles:[]};
 const rel=[];
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
  const directions=cells.map(g=>relation(bounds(g[i].counts[3]),bounds(g[j].counts[3]),margin));
  rel.push({first:STYLES[i],second:STYLES[j],direction:directions.every(d=>d===directions[0])?directions[0]:'hold'});
 }
 const lookup=(i,j)=>{
  const p=rel.find(p=>p.first===Math.min(i,j)&&p.second===Math.max(i,j));
  if(p.direction==='left')return i<j?'win':'loss';
  if(p.direction==='right')return i>j?'win':'loss';
  return p.direction;
 };
 if(rel.some(p=>p.direction==='hold'))return {state:'undetermined',reason:'overlap-or-context-instability',styles:[],pairs:rel};
 if(rel.every(p=>p.direction==='within'))return {state:'within-margin-in-fixed-sample',reason:'not-proof-of-game-neutrality',styles:[],pairs:rel};
 const top=STYLES.filter(i=>STYLES.every(j=>i===j||lookup(i,j)!=='loss'));
 if(!top.length||top.length===4||
    !top.every(i=>top.every(j=>i===j||lookup(i,j)==='within'))||
    !top.every(i=>STYLES.filter(j=>!top.includes(j)).every(j=>lookup(i,j)==='win')))
  return {state:'undetermined',reason:'ambiguous-top-group',styles:[],pairs:rel};
 for(const i of STYLES)for(const j of STYLES)for(const k of STYLES){
  if(i===j||j===k||i===k)continue;
  for(const d of ['within','win'])if(lookup(i,j)===d&&lookup(j,k)===d&&lookup(i,k)!==d)
   return {state:'undetermined',reason:'nontransitive-order',styles:[],pairs:rel};
 }
 return {state:'targeted-in-fixed-sample',reason:'same-separated-top-group-in-eight-contexts',styles:top,pairs:rel};
}
function audit(report){
 a.equal(report.status,'P2.59-joint-native-model-logic-and-comparison-bounds-not-game-rate');
 a.equal(report.sourceSkills,98);a.equal(report.boundary.formalLabels,0);a.equal(report.totals.activeTicks,435558);
 a.deepEqual(report.aggregate[3],{true:8444,false:22081,unknown:2403});
 const map=new Map(),agg={true:0,false:0,unknown:0};
 for(const r of report.rows){
  a(STYLES.includes(r.style));a(contexts.some(c=>c[0]===r.courseId&&c[1]===r.fieldSize&&c[2]===r.scenario));
  a(Number.isSafeInteger(r.groundStateNecessaryMask)&&r.groundStateNecessaryMask>=0&&r.groundStateNecessaryMask<=15);
  const b=bounds(r.counts[3]);a(b.n>0);
  for(const k of Object.keys(agg))agg[k]+=r.counts[3][k];
  if(!map.has(r.sourceNumericId))map.set(r.sourceNumericId,new Map());
  const m=map.get(r.sourceNumericId),k=[r.courseId,r.fieldSize,r.scenario,r.style].join('|');
  a(!m.has(k));m.set(k,r);
 }
 a.equal(map.size,98);a.deepEqual(agg,report.aggregate[3]);
 const summary=Object.fromEntries(MARGINS.map(m=>[m,{}])),rows=[];
 for(const [id,m] of map){
  a.equal(m.size,32);
  const cells=contexts.map(c=>STYLES.map(s=>{const v=m.get([...c,s].join('|'));a(v);return v;}));
  const sweeps=MARGINS.map(margin=>({margin,...screen(cells,margin)}));
  for(const q of sweeps){const k=summary[q.margin];k[q.state]=(k[q.state]||0)+1;}
  rows.push({sourceNumericId:id,sweeps,formalLabel:null});
 }
 return {status:STATUS,sourceReportSHA256:digest(report),sourceSkills:98,summary,rows,
  boundary:{formalLabels:0,approvedMargin:null,withinMarginNotGeneral:true,notWD:true,notGameActivation:true,allContextsFixedTurfModelOnly:true}};
}
if(require.main===module)try{
 const [input,out]=process.argv.slice(2);a(input&&out);
 const r=audit(JSON.parse(fs.readFileSync(input,'utf8')));fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n');
 console.log('P3_4F_DYNAMIC_SWEEP='+JSON.stringify(r.summary));
}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={bounds,relation,screen,audit};
