/* P0 whole-registry shape and condition-code inventory.
 * Read-only: this module neither evaluates race probabilities nor maps
 * simulation-ignored predicates to unconditional activation. */
'use strict';
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const OPS=new Set(['==','!=','>=','<=','>','<']);
const EXPLICIT_TYPES=new Set(['running_style','distance_type','ground_type',
 'ground_condition','rotation','track_id','is_basis_distance']);
const tagParser=require('./skill_condition_tags.js');
const allAngleCandidates=info=>tagParser.candidates(info).map(x=>x.text);
const isCategoryTag=text=>!!tagParser.parse(text);
const tagsOf=info=>tagParser.recognized(info).map(x=>x.text);
function inventory(records){
 if(!Array.isArray(records)||records.length===0)throw Error('Skill registry must be a nonempty array');
 const total=records.length,ids=new Set();
 const shape={valid:0,invalid:0,withoutInvoke:0,multipleInvokes:0,
  invokes:0,withPreconditions:0,withConditions:0,withAnyCondition:0,
  withTags:0,withUnrecognizedAngleCandidates:0,invalidExamples:[],invalidReasons:{},byRarity:{}};
 const counts={types:{},tags:{},operators:{},effects:{},matrixShapes:{},invokeCounts:{},unknownValues:[]};
 function bump(obj,key,n=1){obj[key]=(obj[key]||0)+n;}
 function check(groups){
  if(!Array.isArray(groups))return false;
  return groups.every(g=>Array.isArray(g)&&g.every(c=>
   isObj(c)&&typeof c.type==='string'&&c.type.length>0&&
   typeof c.operator==='string'&&OPS.has(c.operator)&&
   Number.isSafeInteger(c.value)));
 }
 for(const skill of records){
  const id=skill?.id,name=skill?.name;
  let reason=null;
  if(!isObj(skill)||typeof id!=='string'||!/^\d+$/.test(id)||
     typeof name!=='string'||!name.trim())reason='invalid-skill-identity';
  else if(!Array.isArray(skill.invokes))reason='missing-invokes-array';
  else if(ids.has(id))reason='duplicate-id';
  ids.add(id);
  const invokes=!reason?skill.invokes:[];
  if(!reason)for(const invoke of invokes){
   if(!isObj(invoke)){reason='invalid-invoke-record';break;}
   // UmaSim Kotlin model provides default empty lists; JSON may omit them.
   for(const side of ['preConditions','conditions','effects']){
    const value=invoke[side]===undefined?[]:invoke[side];
    const valid=side==='effects'?Array.isArray(value):check(value);
    if(!valid){reason='invalid-'+side;break;}
   }
   if(reason)break;
  }
  if(reason){
   shape.invalid++;
   bump(shape.invalidReasons,reason);
   if(shape.invalidExamples.length<25)shape.invalidExamples.push({id:String(id??''),reason});
   continue;
  }
  shape.valid++;
  bump(shape.byRarity,skill.rarity||'unknown');
  bump(counts.invokeCounts,String(invokes.length));
  if(!invokes.length)shape.withoutInvoke++;
  if(invokes.length>1)shape.multipleInvokes++;
  const candidates=allAngleCandidates(skill.info);
  const tags=candidates.filter(isCategoryTag);
  if(tags.length)shape.withTags++;
  if(candidates.some(t=>!isCategoryTag(t)))shape.withUnrecognizedAngleCandidates++;
  for(const tag of new Set(tags))bump(counts.tags,tag);
  let hasPre=false,hasCond=false;
  for(const invoke of invokes){
   shape.invokes++;
   for(const effect of invoke.effects||[])if(typeof effect?.type==='string')bump(counts.effects,effect.type);
   for(const side of ['preConditions','conditions']){
    const groups=invoke[side]===undefined?[]:invoke[side];
    bump(counts.matrixShapes,side+':'+groups.length+'-OR-groups');
    if(groups.length)(side==='preConditions'?hasPre=true:hasCond=true);
    for(const andGroup of groups){
     bump(counts.matrixShapes,side+':'+andGroup.length+'-AND-terms');
     for(const c of andGroup){
      const row=counts.types[c.type]??={occurrences:0,skills:new Set(),operators:{},values:new Set(),sides:{},examples:[]};
      row.occurrences++;row.skills.add(id);
      bump(row.operators,c.operator);bump(row.sides,side);
      row.values.add(c.value);
      if(row.examples.length<3&&!row.examples.some(x=>x.id===id))
       row.examples.push({id,operator:c.operator,value:c.value,side});
      bump(counts.operators,c.operator);
     }
    }
   }
  }
  if(hasPre)shape.withPreconditions++;
  if(hasCond)shape.withConditions++;
  if(hasPre||hasCond)shape.withAnyCondition++;
 }
 const types=Object.fromEntries(Object.entries(counts.types).sort(([a],[b])=>a.localeCompare(b)).map(([k,r])=>[k,{
  occurrences:r.occurrences,skills:r.skills.size,
  operators:r.operators,values:[...r.values].sort((a,b)=>a-b),
  sides:r.sides,examples:r.examples,category:EXPLICIT_TYPES.has(k)?'candidate-explicit':'review-required'
 }]));
 const sortedTags=Object.entries(counts.tags).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 return {total,shape,counts:{distinctConditionTypes:Object.keys(types).length,
  occurrences:Object.values(types).reduce((a,b)=>a+b.occurrences,0),
  candidateExplicitConditionTypes:[...EXPLICIT_TYPES].filter(t=>Object.hasOwn(types,t)),
  byType:types,tagTypes:sortedTags.length,
  tags:Object.fromEntries(sortedTags),operators:counts.operators,
  effects:counts.effects,matrixShapes:counts.matrixShapes,invokeCounts:counts.invokeCounts}};
}
module.exports={inventory,tagsOf,allAngleCandidates,isCategoryTag,EXPLICIT_TYPES};
