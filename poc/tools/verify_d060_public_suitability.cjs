'use strict';
// D060: derive the public product-only projection from the verified D059 bundle.
// Neither original predicate matrices nor names are published.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const cat=require('../src/skill_catalog.js'),fit=require('../src/skill_suitability.js');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const D059='2f7efccbf6ced322e4902b8014ba580332dd84f613c996bc4e7daca7c9b6505a';
function project(bundle){
 a.equal(bundle.decisionId,'D-059');a.equal(bundle.rows.length,404);
 const groups=new Map();
 for(const r of bundle.rows){
  const l=r.label,s=l.scope,mask=l.styles.reduce((n,v)=>n|(1<<(v-1)),0);let k;
  if(l.state==='general'){
   const m=Array(32).fill(0);
   for(const c of s.contexts)for(const style of c.running_styles??[1,2,3,4])m[(style-1)*8+(c.distance_type-1)*2+c.ground_type-1]|=1<<(c.ground_condition-1);
   k='g '+m.map(x=>x.toString(16)).join('');
  }else if(s.kind==='rank-window-fixed-model'){
   k='r '+mask+' '+[...new Set(s.branches.flatMap(b=>b.courseIds))].sort((a,b)=>a-b).join(',');
  }else{
   a.equal(s.kind,'dynamic-fixed-model');
   const cs=s.contexts.slice().sort((a,b)=>a.courseId-b.courseId||a.fieldSize-b.fieldSize||(a.scenario<b.scenario?-1:a.scenario>b.scenario?1:0));
   k='d '+mask+' '+[...new Set(cs.map(c=>[c.courseId,c.fieldSize,c.scenario].join(':')))].join(',');
  }
  if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r.sourceNumericId);
 }
 return [...groups.keys()].sort().map(k=>k+' '+groups.get(k).sort().join(',')).join('\n')+'\n';
}
function verify(bytes,publicText){
 a.equal(sha(bytes),D059);const b=JSON.parse(bytes);a.equal(project(b),publicText);a.equal(sha(publicText),cat.PUBLIC_SHA);
 const labels=cat.publicLabels(publicText);a.equal(labels.size,404);
 const dist={10501:1,10502:2,10304:2,10504:3,10604:3,10506:4};
 const key=x=>JSON.stringify([x.state,x.styles]);
 let checked=0;
 for(const r of b.rows){
  const q={...r,label:labels.get(r.sourceNumericId)};a(q.label);
  for(const style of [undefined,1,2,3,4])for(const d of [undefined,1,2,3,4])for(const g of [undefined,1,2])for(const c of [undefined,1,2,3,4]){
   const ctx={running_style:style,distance_type:d,ground_type:g,ground_condition:c};
   a.equal(key(cat.evidence(q,ctx)),key(cat.evidence(r,ctx)),r.appSkillId);checked++;
  }
  for(const courseId of Object.keys(dist).map(Number))for(const fieldSize of [9,12])for(const scenario of ['balanced','backHeavy'])for(const running_style of [1,2,3,4]){
   const ctx={courseId,distance_type:dist[courseId],fieldSize,scenario,running_style,ground_type:1,ground_condition:1};
   a.equal(key(fit.resolve(q,ctx)),key(fit.resolve(r,ctx)),r.appSkillId);checked++;
  }
 }
 console.log('D060_PUBLIC_PROJECTION='+JSON.stringify({labels:labels.size,comparisons:checked,bytes:Buffer.byteLength(publicText),sha256:cat.PUBLIC_SHA}));
}
if(require.main===module){const [bundle,path]=process.argv.slice(2);verify(fs.readFileSync(bundle),fs.readFileSync(path,'utf8'));}
module.exports={project,verify};
