'use strict';
// Scope-local comparison sensitivity, not a product label.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const prior=require('./p3_dynamic_margin_screen.cjs');
const S=[1,2,3,4],M=[0,5,10,20],CTX=[10502,10504].flatMap(c=>[9,12].flatMap(n=>['balanced','backHeavy'].map(s=>[c,n,s])));
const STATUS='P3.4i-scope-local-dynamic-top-group-screen-not-general-label';
function screen(cells,margin){
 a(M.includes(margin));a.equal(cells.length,8);
 const eligible=[],excluded=[];
 for(const g of cells){
  a.equal(g.length,4);a.deepEqual(g.map(r=>r.style),S);
  a(g.every(r=>Number.isSafeInteger(r.groundStateNecessaryMask)&&r.groundStateNecessaryMask>=0&&r.groundStateNecessaryMask<=15));
  const context={courseId:g[0].courseId,fieldSize:g[0].fieldSize,scenario:g[0].scenario};
  if(g.every(r=>r.groundStateNecessaryMask===0)){excluded.push(context);continue;}
  if(g.some(r=>r.groundStateNecessaryMask!==15))return {state:'scope-held',styles:[]};
  eligible.push({context,g});
 }
 if(!eligible.length)return {state:'scope-held',styles:[]};
 const relation=(g,i,j)=>prior.relation(prior.bounds(g[i-1].counts[3]),prior.bounds(g[j-1].counts[3]),margin);
 const pairs=S.flatMap((i,k)=>S.slice(k+1).map(j=>[i,j]));
 const contextRows=eligible.map(({context})=>context);
 const top=[];
 for(let mask=1;mask<15;mask++){
  const I=S.filter(i=>mask&(1<<(i-1))),O=S.filter(i=>!I.includes(i));
  if(eligible.every(({g})=>I.every((i,k)=>I.slice(k+1).every(j=>relation(g,i,j)==='within'))&&
    I.every(i=>O.every(j=>relation(g,i,j)==='left'))))top.push(I);
 }
 a(top.length<=1);
 const within=eligible.every(({g})=>pairs.every(([i,j])=>relation(g,i,j)==='within'));
 return {state:top.length?'targeted-in-eligible-fixed-contexts':within?'within-margin-in-eligible-fixed-contexts':'undetermined',
  styles:top[0]??[],evaluatedContexts:contextRows,excludedContexts:excluded};
}
function audit(report){
 const old=prior.audit(report);
 a.equal(old.sourceSkills,98);
 const groups=new Map();
 for(const r of report.rows){
  const id=r.sourceNumericId,k=[r.courseId,r.fieldSize,r.scenario,r.style].join('|');
  if(!groups.has(id))groups.set(id,new Map());const g=groups.get(id);a(!g.has(k));g.set(k,r);
 }
 const summary=Object.fromEntries(M.map(m=>[m,{}])),rows=[];
 for(const [id,g] of groups){
  a.equal(g.size,32);const cells=CTX.map(c=>S.map(s=>{const r=g.get([...c,s].join('|'));a(r);return r;}));
  const sweeps=M.map(margin=>({margin,...screen(cells,margin)}));
  for(const x of sweeps)summary[x.margin][x.state]=(summary[x.margin][x.state]||0)+1;
  rows.push({sourceNumericId:id,sweeps,formalLabel:null});
 }
 a.deepEqual(summary,{
  0:{'scope-held':56,undetermined:38,'targeted-in-eligible-fixed-contexts':4},
  5:{'scope-held':56,undetermined:38,'targeted-in-eligible-fixed-contexts':4},
  10:{'scope-held':56,undetermined:36,'targeted-in-eligible-fixed-contexts':4,'within-margin-in-eligible-fixed-contexts':2},
  20:{'scope-held':56,undetermined:36,'targeted-in-eligible-fixed-contexts':2,'within-margin-in-eligible-fixed-contexts':4}
 });
 return {status:STATUS,sourceReportSHA256:crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex'),
  sourceSkills:98,summary,rows,boundary:{formalLabels:0,scopeLocalOnly:true,unmeasuredContextsNotExtrapolated:true,notGameRate:true,approvedMargin:null}};
}
if(require.main===module)try{
 const [input,out]=process.argv.slice(2);a(input&&out);
 const r=audit(JSON.parse(fs.readFileSync(input,'utf8')));fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n');
 console.log('P3_4I_SCOPE_SWEEP='+JSON.stringify(r.summary));
}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={screen,audit};
