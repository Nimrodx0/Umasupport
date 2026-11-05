'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const a=require('../tools/order_rate_integer_audit.cjs');
const cond=(operator,value)=>({type:'order_rate',operator,value});
const time=()=>({type:'phase_random',operator:'==',value:1});
function fake(){
 return [
  {id:'1',invokes:[{conditions:[
   [cond('<=',50),time()],
   [cond('>=',40),cond('<=',80),time()]],
   preConditions:[[cond('>',50),time()]]}]},
  {id:'2',invokes:[{conditions:[
   [cond('<=',50)],
   [cond('<=',5),time()]]}]},
  {id:'3',invokes:[{conditions:[[time()]]}]}
 ];
}
test('aggregated original AND/OR shape and rank terms are counted separately',()=>{
 const x=a.audit(fake());
 assert.equal(x.totals.sourceSkills,3);
 assert.equal(x.totals.skillsWithOrderRate,2);
 assert.equal(x.totals.rankTerms,6);
 assert.equal(x.totals.rankAndRows,5);
 assert.equal(x.totals.rankPreconditionRows,1);
 assert.equal(x.totals.compoundRankRows,1);
 assert.equal(x.totals.rowsWithAdditionalAndConditions,4);
 assert.equal(x.totals.zeroBoundaryHeld9,1);
 assert.equal(x.totals.zeroBoundaryHeld12,0);
 assert.equal(x.totals.emptyProjected9,0);
 const named=x.byOperatorValue.find(x=>x.sourceCode==='<=50');
 assert.equal(named.occurrences,2);
 assert.equal(named.uniqueSkills,2);
 assert.deepEqual(named.integerRankProjection[9].positions,[1,2,3,4,5]);
 assert.deepEqual(named.integerRankProjection[12].positions,[1,2,3,4,5,6]);
 const compound=x.compoundRowExamples.find(x=>x.predicateTokens.includes('>=40'));
 assert.deepEqual(compound.ranks9,[4,5,6,7]);
 assert.deepEqual(compound.ranks12,[5,6,7,8,9,10]);
 assert.equal(compound.nonRankAndCount,1);
 assert.equal(x.version,'order-rate-integer-projection-v1');
});
test('projection produces no inferred skill activation percentage or redundant raw dictionary',()=>{
 const x=a.audit(fake());
 assert.equal(x.status,
  'source-pinned-aggregate-rank-projections-not-skill-activation-probabilities');
 assert.deepEqual(x.examples[1].nine,[4,5,6,7]);
 assert.deepEqual(x.examples[1].twelve,[5,6,7,8,9,10]);
 assert.equal(Object.hasOwn(x,'records'),false);
 assert.equal(Object.hasOwn(x,'activationProbability'),false);
 assert.match(x.limitations[1],/ignores order_rate/);
});
test('duplicate skill or malformed source branch must not silently merge records',()=>{
 const x=fake();
 assert.throws(()=>a.audit([...x,x[0]]),/Malformed or duplicate/);
 const y=fake();y[0].invokes[0].conditions=null;
 assert.throws(()=>a.audit(y),/Missing OR branches/);
 const z=fake();z[0].invokes[0].conditions[0]={};
 assert.throws(()=>a.audit(z),/Malformed AND row/);
 assert.throws(()=>a.audit([]),/Missing UmaSim/);
});
