'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const blocker=require('../src/skill_source_path_blocker_impact.cjs');
const pred=(type,operator,value)=>({type,operator,value});
const S=(id,invokes)=>({
 id:'skill:'+id,name:'Sample '+id,
 activationProfile:{status:'source-structure',sourceNumericId:id,invokes}
});
function fixture(){
 const n=pred,one=n('running_style','==',1);
 return {skills:[
  S('100',[{
   index:0,
   preConditions:[
    [n('distance_type','==',2)],
    [n('distance_type','==',3),n('phase','>=',1)]
   ],
   conditions:[
    [one,n('phase','==',2)],
    [one,n('is_overtake','==',1),n('corner','==',3)]
   ]
  }]),
  S('101',[{
   index:0,preConditions:[],
   conditions:[[n('is_overtake','==',1),n('phase_random','==',1)]]
  }]),
  S('102',[{
   index:0,preConditions:[],
   conditions:[[n('running_style','!=',1)]]
  }]),
  S('103',[{
   index:0,
   preConditions:[[n('phase','==',1)],[n('corner','>=',2)]],
   conditions:[[n('is_overtake','==',1)]]
  }]),
  {id:'skill:104',name:'Unknown',activationProfile:{status:'not-found'}}
 ],skillById:true,cards:[{id:'untouched'}]};
}
test('preConditions OR stays on its exact AND branch, with no cross-OR union',()=>{
 const app=fixture(),row=blocker.analyzeSkill(app.skills[0]);
 const nige=row.byStyle['逃げ'];
 assert.equal(nige.allSourceRouteAlternatives,4);
 assert.equal(nige.finiteCompatibleRoutes,4);
 assert.equal(nige.minimumRemainingTypeCount,1);
 assert.deepEqual(nige.singleTypeResearchCandidates,['phase']);
 assert(nige.bestRouteAlternatives.some(x=>
  x.preconditionOrIndex===0&&x.conditionOrIndex===0&&
  x.unresolvedTypes.join()==='phase'));
 assert(nige.bestRouteAlternatives.every(x=>x.unresolvedTypes.length===1));
 for(const style of ['先行','差し','追込'])
  assert.equal(row.byStyle[style].finiteCompatibleRoutes,0);
});
test('a zero-blocker path is structural-only, and does not trigger a target type',()=>{
 const app=fixture(),out=blocker.audit(app,['100','101']);
 assert.equal(out.denominators.appSkills,5);
 assert.equal(out.denominators.sourceMatchedSkills,4);
 assert.equal(out.denominators.sourceUnmatchedSkills,1);
 assert.equal(out.denominators.allSourceStyleCells,16);
 assert.equal(out.denominators.signedRankSourceSkills,2);
 assert.equal(out.zeroTypeBlockerSourceSkills,1);
 assert.equal(out.oneTypeBlockerSourceSkills,1);
 const z=out.rows.find(x=>x.sourceNumericId==='102');
 assert.equal(z.byStyle['逃げ'].status,'no-finite-domain-compatible-route');
 assert.equal(z.byStyle['先行'].status,
  'only-finite-predicate-types-in-some-route');
 assert.deepEqual(z.byStyle['先行'].singleTypeResearchCandidates,[]);
 assert(out.limitations.some(x=>x.includes('does NOT mean')));
 const unchanged=JSON.stringify(app.cards);
 blocker.audit(app,['100','101']);
 assert.equal(JSON.stringify(app.cards),unchanged);
});
test('single-type research candidate is counted once per source skill and compatible style',()=>{
 const x=blocker.audit(fixture(),['100','101']);
 const p=x.impactIfOneTypeCouldBeMeasured.find(a=>a.type==='phase');
 assert.equal(p.uniqueStyleCellsOneTypeAway,1);
 assert.equal(p.uniqueSourceSkillsWithAtLeastOneStyleCell,1);
 assert.equal(p.signedRankCohortSkills,1);
 const q=x.rows.find(x=>x.sourceNumericId==='103');
 assert.equal(q.byStyle['差し'].minimumRemainingTypeCount,2);
 assert.deepEqual(q.byStyle['差し'].twoTypeResearchCandidates,
  ['corner + is_overtake','is_overtake + phase']);
 assert.equal(q.byStyle['差し'].singleTypeResearchCandidates.length,0);
});
test('invalid and duplicate source identities are rejected rather than silently considered suitable',()=>{
 const app=fixture();
 assert.throws(()=>blocker.audit(app,['100','100']),/repeated/);
 assert.throws(()=>blocker.audit(app,['999']),/missing original/);
 const bad=fixture();
 bad.skills[0].activationProfile.invokes[0].preConditions[0][0].operator='bad';
 assert.throws(()=>blocker.audit(bad,['100']),/invalid original predicate/);
});
