'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{preview}=require('../src/p3_source_logic_label_preview.cjs');
const c={distance_type:2,ground_type:1,ground_condition:1,eligibleStyles:[1,2,3,4],disposition:'four-style-identical-surviving-logic'};
test('general preview requires all applicable contexts to have identical paths',()=>{
 a.equal(preview({cells:[c,{eligibleStyles:[],disposition:'no-statically-eligible-style'}]}).state,'general');
 a.equal(preview({cells:[c,{...c,eligibleStyles:[2],disposition:'one-statically-eligible-style'}]}).state,'undetermined');
 a.equal(preview({cells:[{...c,disposition:'different-surviving-source-paths-held'}]}).state,'undetermined');
 a.equal(preview({disposition:'source-missing'}).state,'undetermined');
});
