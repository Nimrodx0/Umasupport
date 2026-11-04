/* P2 review-only cohort: normalized pattern groups of approved qualitative
 * tendency metadata. Only source condition snippets are included.
 * No full external dictionary, impact score, or invented race probability. */
'use strict';
const PHASE={0:'序盤',1:'中盤',2:'終盤前半',3:'終盤後半'};
function summarize(model){
 if(!model||!Array.isArray(model.skills))throw Error('Missing P2 reviewed skills');
 const groups=new Map(),items=[];
 for(const skill of model.skills){
  const x=skill.activationTendency;
  if(x?.status!=='inferred')continue;
  if(!Array.isArray(x.branches)||!x.branches.length)throw Error('No P2 evidence branches');
  const paths=x.branches.map(b=>{
   if(b.status!=='inferred-branch')throw Error('Unverified inferred branch');
   const periods=b.timing.flatMap(t=>t.phaseIndexes.map(k=>({
    code:t.type,operator:t.operator,value:t.value,
    phase:k,phaseName:PHASE[k]||'局面不明',
    kind:t.kind,randomWindow:t.randomWindow,
    windows:t.windows.filter(w=>w.phase===k)
   })));
   return {invokeIndex:b.invokeIndex,orIndex:b.orIndex,
    rank:b.rank,periods,
    explicitOther:b.sourceConditions.filter(c=>c.type!=='order_rate'&&
     !b.timing.some(t=>t.type===c.type)),
    sourceConditions:b.sourceConditions};
  });
  const signature=paths.map(p=>p.periods.map(t=>
   t.code+t.operator+t.value).join('&')+
   ':'+p.rank.operatorValues.map(q=>q.operator+q.value).join('&'))
   .sort().join(' OR ');
  const item={id:skill.id,name:skill.name,sourceNumericId:x.sourceNumericId,
   tendency:x.label,styles:x.styleNames,ruleIds:x.basisRuleIds,
   signature,paths};
  items.push(item);
  const key=x.label+' | '+signature;
  if(!groups.has(key))groups.set(key,{key,tendency:x.label,signature,
   count:0,skills:[]});
  const g=groups.get(key);g.count++;g.skills.push(item);
 }
 if(items.length!==(model.meta?.skillStyleTendencies?.inferred??items.length))
  throw Error('Review cohort mismatch with live tendency summary');
 const grouped=[...groups.values()].sort((a,b)=>
  a.tendency.localeCompare(b.tendency,'ja')||
  b.count-a.count||a.signature.localeCompare(b.signature));
 if(grouped.reduce((n,g)=>n+g.count,0)!==items.length)
  throw Error('P2 review groups lost skills');
 return {total:items.length,groupCount:grouped.length,
  byTendency:Object.fromEntries([...new Set(items.map(x=>x.tendency))]
   .map(t=>[t,items.filter(x=>x.tendency===t).length])),
  groups:grouped};
}
module.exports={summarize};
