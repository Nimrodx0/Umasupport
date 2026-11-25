'use strict';
const fs=require('node:fs'),a=require('node:assert/strict'),crypto=require('node:crypto'),cat=require('../src/skill_catalog.js');
const [input,output]=process.argv.slice(2),d=JSON.parse(fs.readFileSync(input,'utf8'));
a.equal(d.status,'P3.4j-D052-initial-scoped-skill-labels');a.equal(d.policySHA256,cat.POLICY_HASH);a.deepEqual(d.counts,{general:257,targeted:43,undetermined:581});
const bundle={schemaVersion:1,decisionId:'D-052',sourceRegistrySHA256:cat.SOURCE_HASH,policySHA256:d.policySHA256,rows:d.rows.filter(r=>r.label.state!=='undetermined').map(({appSkillId,sourceNumericId,explicitNecessaryMasks,label})=>({appSkillId,sourceNumericId,explicitNecessaryMasks,label}))};
const bytes=JSON.stringify(bundle)+'\n';
a.equal(crypto.createHash('sha256').update(bytes).digest('hex'),cat.BUNDLE_HASH);fs.writeFileSync(output,bytes);
console.log('P4_D052_LOCAL_BUNDLE='+cat.BUNDLE_HASH);
