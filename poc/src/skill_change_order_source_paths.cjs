'use strict';
/*
 * Original pinned UmaSim skill source conditions containing change_order_onetime.
 * Read-only inventory of individual Invoke / OR / AND rows. It deliberately
 * does not join different alternatives or infer skill/card activation rates.
 */
const TARGET='change_order_onetime';
function audit(records){
 if(!Array.isArray(records))throw Error('Original matched source records required');
 const seen=new Set(),paths=[];
 for(const skill of records){
  if(!skill||!/^\d+$/.test(String(skill.id))||
   typeof skill.name!=='string'||!Array.isArray(skill.invokes)||
   seen.has(String(skill.id)))throw Error('Invalid or duplicate source skill');
  seen.add(String(skill.id));
  for(const [invokeOffset,inv] of skill.invokes.entries()){
   for(const side of ['preConditions','conditions']){
    const ors=inv[side]||[];
    if(!Array.isArray(ors))throw Error('Invalid source OR layout');
    for(const [orIndex,and] of ors.entries()){
     if(!Array.isArray(and))throw Error('Invalid source AND layout');
     const uses=and.filter(c=>c?.type===TARGET);
     if(!uses.length)continue;
     paths.push({
      sourceNumericId:String(skill.id),sourceName:skill.name,
      invokeOffset,invokeIndex:inv.index??invokeOffset,
      invokeCount:skill.invokes.length,
      side,orIndex,orCount:ors.length,
      hasPreconditions:(inv.preConditions||[]).length>0,
      conditions:uses.map(c=>({operator:c.operator,value:c.value})),
      sameAndOtherTypes:and.filter(c=>c?.type!==TARGET).map(c=>c.type),
      sameAndPredicateCount:and.length,
      status:'source-signed-rank-change-subcondition-only',
      fullSkillEvaluated:false
     });
    }
   }
  }
 }
 paths.sort((a,b)=>a.sourceNumericId.localeCompare(b.sourceNumericId)||
  a.invokeOffset-b.invokeOffset||a.side.localeCompare(b.side)||
  a.orIndex-b.orIndex);
 const distinct=xs=>new Set(xs.map(p=>p.sourceNumericId)).size;
 const counts={};
 for(const p of paths)for(const v of p.conditions){
  const k=String(v.operator)+' '+String(v.value);
  counts[k]=(counts[k]||0)+1;
 }
 const other={};
 for(const p of paths)for(const type of new Set(p.sameAndOtherTypes))
  other[type]=(other[type]||0)+1;
 return {schemaVersion:1,
  status:'P2-source-change-order-path-structure-not-complete-proc',
  matchedSkillDenominator:records.length,
  targetType:TARGET,
  summary:{
   sourceSkills:distinct(paths),sourceAndPaths:paths.length,
   sourcePredicateUses:paths.reduce((n,x)=>n+x.conditions.length,0),
   inPreConditions:paths.filter(x=>x.side==='preConditions').length,
   inConditions:paths.filter(x=>x.side==='conditions').length,
   extraSameAnd:paths.filter(x=>x.sameAndOtherTypes.length>0).length,
   alternatives:paths.filter(x=>x.orCount>1).length,
   withPreconditions:paths.filter(x=>x.hasPreconditions).length,
   withMultipleInvokes:paths.filter(x=>x.invokeCount>1).length,
   byOriginalOperatorAndValue:counts,
   otherAndTypeOccurrences:other
  },
  paths,
  limitations:[
   'Exact original source operator/value are recorded without converting negative signed rank change to a generic overtaking proxy.',
   'Preconditions, OR alternatives, other AND requirements and multiple Invokes are not combined into a proc probability.',
   'A model state being true does NOT prove an actual skill can trigger at that tick or a card can acquire it.',
   'No four-style final suitability label or skill effect usefulness is computed.'
  ]};
}
module.exports={TARGET,audit};
