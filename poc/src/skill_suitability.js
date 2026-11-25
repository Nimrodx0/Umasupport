/* D-052: browser-compatible scope resolution, separate from explicit eligibility. */
(function(g){
'use strict';
const STYLES=['逃げ','先行','差し','追込'];
const PANEL=[1,2,3,4].flatMap(running_style=>[1,2,3,4].flatMap(distance_type=>[1,2].map(ground_type=>({running_style,distance_type,ground_type}))));
const COURSES={10501:1,10502:2,10304:2,10504:3,10604:3,10506:4};
const unknown=reason=>({state:'undetermined',styles:[],reason});
function applicability(row,ctx={}){
 const m=row?.explicitNecessaryMasks;
 if(!Array.isArray(m)||m.length!==32||!m.every(x=>Number.isInteger(x)&&x>=0&&x<=15))return 'unknown';
 const axes={running_style:[1,2,3,4],distance_type:[1,2,3,4],ground_type:[1,2],ground_condition:[1,2,3,4]};
 if(Object.keys(axes).some(k=>ctx[k]!=null&&!axes[k].includes(ctx[k])))return 'unknown';
 if(ctx.courseId!=null&&ctx.distance_type!=null&&COURSES[ctx.courseId]&&COURSES[ctx.courseId]!==ctx.distance_type)return 'unknown';
 const selected=PANEL.map((p,i)=>({p,i})).filter(({p})=>['running_style','distance_type','ground_type'].every(k=>ctx[k]==null||p[k]===ctx[k]));
 const bits=ctx.ground_condition==null?15:1<<(ctx.ground_condition-1);
 return selected.some(({i})=>m[i]&bits)?'possible':'outside';
}
const DIMENSIONS={running_style:STYLES,distance_type:['短距離','マイル','中距離','長距離'],ground_type:['芝','ダート'],ground_condition:['良','稍重','重','不良']};
function explicitScope(row){
 const m=row?.explicitNecessaryMasks;
 if(!Array.isArray(m)||m.length!==32||!m.every(x=>Number.isInteger(x)&&x>=0&&x<=15))return {text:'適用範囲未確認',correlated:false,groups:[]};
 const axes=Object.keys(DIMENSIONS),valid=Object.fromEntries(axes.map(k=>[k,new Set()])),cells=[];
 for(let i=0;i<PANEL.length;i++)for(let c=1;c<=4;c++)if(m[i]&(1<<(c-1))){
  const x={...PANEL[i],ground_condition:c};cells.push(x);for(const k of axes)valid[k].add(x[k]);
 }
 if(!cells.length)return {text:'明示4軸の対象候補なし',correlated:false,groups:[]};
 const correlated=axes.reduce((n,k)=>n*valid[k].size,1)!==cells.length;
 const names=axes.flatMap(k=>valid[k].size===DIMENSIONS[k].length?[]:[[...valid[k]].sort((a,b)=>a-b).map(i=>DIMENSIONS[k][i-1]).join('・')]);
 const groups=[];
 if(correlated){
  // Exact 32-axis-mask representation: merge style/distance pairs only
  // when their two surface masks are identical. No Cartesian expansion.
  const grouped=new Map();
  for(let i=0;i<PANEL.length;i+=2){
   const x=PANEL[i],key=[m[i],m[i+1]].join('|');
   if(m[i]===0&&m[i+1]===0)continue;
   if(!grouped.has(key))grouped.set(key,{pairs:[],surfaces:[m[i],m[i+1]].flatMap((v,j)=>v?[DIMENSIONS.ground_type[j]+'（'+DIMENSIONS.ground_condition.filter((_,k)=>v&(1<<k)).join('・')+'）']:[])});
   grouped.get(key).pairs.push(DIMENSIONS.running_style[x.running_style-1]+'・'+DIMENSIONS.distance_type[x.distance_type-1]);
  }
  groups.push(...grouped.values());
 }
 return {text:names.length?names.join(' / ')+(correlated?'（組合せ制限あり）':''):correlated?'組合せ制限あり':'明示4軸制限なし',correlated,groups};
}
function commonStaticScope(row,ctx){
 if(![1,2,3,4].includes(ctx.ground_condition))return false;
 return [1,2,3,4].every(running_style=>applicability(row,{...ctx,running_style})==='possible');
}
function resolve(row,ctx){
 const label=row?.label;
 if(!label)return unknown('source-or-approved-label-missing');
 if(label.state==='undetermined')return label;
 if(label.state==='general'){
  if(!ctx)return label;
  return label.scope.contexts.some(x=>['distance_type','ground_type','ground_condition'].every(k=>ctx[k]==null||x[k]===ctx[k]))?label:unknown('outside-evidence-context');
 }
 if(label.state!=='targeted')return unknown('unsupported-label-state');
 if(!ctx)return unknown('scoped-evidence-context-required');
 const scope=label.scope;
 if(ctx.ground_type!==1||ctx.ground_condition!==1)return unknown('outside-measured-ground-context');
 if(COURSES[ctx.courseId]!==ctx.distance_type||!commonStaticScope(row,ctx))return unknown('inconsistent-course-or-static-scope');
 const ok=scope.kind==='rank-window-fixed-model'?scope.branches.some(b=>b.courseIds.includes(ctx.courseId)&&(b.distanceType===null||b.distanceType===ctx.distance_type))&&[9,12].includes(ctx.fieldSize)&&ctx.scenario==='balanced':
  scope.kind==='dynamic-fixed-model'&&scope.contexts.some(x=>['courseId','fieldSize','scenario'].every(k=>x[k]===ctx[k]));
 return ok?label:unknown('outside-or-unspecified-evidence-context');
}
function labelText(label){
 if(label.state==='general')return '汎用';
 if(label.state==='targeted'&&label.styles.length&&label.styles.every(s=>STYLES[s-1]))return label.styles.map(s=>STYLES[s-1]).join('・')+'向け';
 return '未判定';
}
function present(row,ctx,showLabels=true){
 const applicabilityState=applicability(row,ctx||{});
 const label=resolve(row,ctx);
 return {applicability:applicabilityState,labelState:label.state,styles:label.styles.slice(),
  labelText:showLabels?labelText(label):null,
  scopeText:applicabilityState==='outside'?'明示条件の対象外':applicabilityState==='unknown'?'適用範囲未確認':'明示条件の対象候補',
  limitedEvidence:row?.label?.state==='targeted',reason:label.reason};
}
function matches(row,{context,mode='all'}={}){
 if(mode==='all')return true;
 const p=present(row,context,false),style=context?.running_style;
 if(mode==='possible')return p.applicability!=='outside'; // unknown stays visible
 if(mode==='undetermined')return p.labelState==='undetermined'&&p.applicability!=='outside';
 if(mode==='confirmed')return p.applicability==='possible'&&(p.labelState==='general'||p.labelState==='targeted'&&(style==null||p.styles.includes(style)));
 if(mode==='targeted')return p.applicability==='possible'&&p.labelState==='targeted'&&(style==null||p.styles.includes(style));
 throw Error('Unknown suitability filter: '+mode);
}
const api={applicability,explicitScope,resolve,labelText,present,matches};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaSkillSuitability=api;
})(typeof globalThis!=='undefined'?globalThis:this);
