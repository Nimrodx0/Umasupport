'use strict';
// D058: positive relative suitability, not equivalence of a top group.
// D059: provisional practical difference = 10 percentage points.
// Same-context paired observations; unknown intervals are never treated as zero.
const a=require('node:assert/strict');
const STYLES=['Nige','Senkou','Sasi','Oikomi'],IDS=[1,2,3,4],HALVES=['all','first15','last15'],MARGIN=10,EPS=1e-9;
function classify(cells,margin=MARGIN){
 a(Array.isArray(cells)&&cells.length);a(Number.isFinite(margin)&&margin>=0&&margin<=100);
 const n=cells[0].length;a(n>=2&&n<=4);
 const ids=Array.from({length:n},(_,i)=>i);
 const hasD=cells[0][0].D!==undefined;
 for(const cell of cells){a.equal(cell.length,n);for(const q of cell){
  a(Number.isFinite(q.lo)&&Number.isFinite(q.hi)&&q.lo>=0&&q.hi<=100&&q.lo<=q.hi);
  a.equal(q.D!==undefined,hasD);if(hasD)a(Number.isFinite(q.D));
 }}
 const individual=ids.filter(i=>cells.every(c=>{
  const others=ids.filter(j=>j!==i);
  return c[i].lo-others.reduce((s,j)=>s+c[j].hi,0)/(n-1)>margin+EPS&&
   (!hasD||c[i].D-others.reduce((s,j)=>s+c[j].D,0)/(n-1)>EPS);
 }));
 const groups=[];
 for(let mask=1;mask<(1<<n)-1;mask++){
  const inside=ids.filter(i=>mask&(1<<i)),outside=ids.filter(i=>!(mask&(1<<i)));
  if(cells.every(c=>inside.every(i=>outside.every(j=>c[i].lo-c[j].hi>margin+EPS&&(!hasD||c[i].D-c[j].D>EPS)))))groups.push(inside);
 }
 const group=ids.filter(i=>groups.some(g=>g.includes(i)));
 const targets=ids.filter(i=>individual.includes(i)||group.includes(i));
 // A nonempty positive union cannot include every style in a valid common cell.
 a(targets.length<n);
 const within=cells.every(c=>ids.every(i=>ids.every(j=>i===j||c[i].hi-c[j].lo<=margin+EPS)));
 return {state:targets.length?'targeted':within?'within-margin-only':'undetermined',styles:targets.map(i=>i+1),individual:individual.map(i=>i+1),group:group.map(i=>i+1)};
}
function windowCells(byStyle){
 const key=x=>[x.courseId,x.fieldSize,x.mode].join('|');
 const idx=STYLES.map(s=>{const rows=byStyle[s];a(Array.isArray(rows)&&rows.length);const m=new Map(rows.map(r=>[key(r),r]));a.equal(m.size,rows.length);return m;});
 a(idx.every(m=>m.size===idx[0].size&&[...idx[0].keys()].every(k=>m.has(k))));
 return [...idx[0].keys()].flatMap(k=>HALVES.map(h=>idx.map(m=>{const v=m.get(k)[h];a(v);return {lo:v.W,hi:v.W,D:v.D};})));
}
function fullPhaseCells(idx,phase,band,courseIds){
 a(courseIds.length&&new Set(courseIds).size===courseIds.length);
 // U is identical for all four styles in each paired cell; D differences
 // exactly equal O differences, including the individual-average contrast.
 return courseIds.flatMap(c=>[9,12].flatMap(n=>['equal','jitter10'].flatMap(mode=>HALVES.map(h=>STYLES.map(s=>{
  const key=[c,n,mode,phase,band,s].join('|'),r=h==='all'?idx.all.get(key):idx.halves.get(key+'|'+h);a(r);
  return {lo:r.random10mOpportunityPercent,hi:r.random10mOpportunityPercent,D:r.pointPercent};
 })))));
}
function dynamicCells(rows){
 const by=new Map();
 for(const r of rows){const k=[r.courseId,r.fieldSize,r.scenario].join('|');if(!by.has(k))by.set(k,[]);by.get(k).push(r);}
 a.equal(by.size,8);const cells=[],contexts=[];
 for(const g of by.values()){
  g.sort((x,y)=>x.style-y.style);a.deepEqual(g.map(r=>r.style),IDS);
  if(g.every(r=>r.groundStateNecessaryMask===0))continue;
  if(g.some(r=>r.groundStateNecessaryMask!==15))return null;
  cells.push(g.map(r=>{const c=r.counts[3];a(['true','false','unknown'].every(k=>Number.isSafeInteger(c[k])&&c[k]>=0));const n=c.true+c.false+c.unknown;a(n>0);return {lo:100*c.true/n,hi:100*(c.true+c.unknown)/n};}));
  contexts.push({courseId:g[0].courseId,fieldSize:g[0].fieldSize,scenario:g[0].scenario});
 }
 return cells.length?{cells,contexts}:null;
}
module.exports={STYLES,IDS,MARGIN,classify,windowCells,fullPhaseCells,dynamicCells};
