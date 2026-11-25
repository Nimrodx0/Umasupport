'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{compare,signature}=require('../src/p3_context_source_logic_comparison.cjs');
const ctx={distance_type:2,ground_type:1,ground_condition:1},allow=new Set(['phase_random','motivation','weather','always']);
const p=(type,value=1,operator='==')=>({type,value,operator});
const inv=(...conditions)=>[{conditions,preConditions:[]}];
test('scope exclusions remain symbolic, identical surviving logic only within fixed context',()=>{
 const x=inv([p('phase_random'),p('motivation')]);
 a.equal(compare(x,ctx,allow).disposition,'four-style-identical-surviving-logic');
 a.equal(signature(x,{...ctx,running_style:1},allow)[0].or[0].residual.length,2);
 const y=inv([p('running_style',2),p('weather')]);
 a.deepEqual(compare(y,ctx,allow),{disposition:'one-statically-eligible-style',eligibleStyles:[2]});
});
test('same necessary mask does not guarantee equivalent source paths or draw identity',()=>{
 const x=inv([p('running_style',2,'<='),p('phase_random')],[p('running_style',2,'>'),p('phase_random')]);
 a.equal(compare(x,ctx,allow).disposition,'different-surviving-source-paths-held');
 a.equal(compare(inv([p('running_style',3,'<='),p('phase_random')]),ctx,allow).disposition,'restricted-style-identical-surviving-logic');
});
test('unknown history, unsupported predicate or malformed always not silently accepted',()=>{
 a.throws(()=>compare([{conditions:[[p('phase_random')]],preConditions:[[p('always')]]}],ctx,allow));
 a.throws(()=>compare(inv([p('near_count')]),ctx,allow));
 a.throws(()=>compare(inv([p('always',2)]),ctx,allow));
});
