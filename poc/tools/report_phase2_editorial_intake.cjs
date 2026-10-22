#!/usr/bin/env node
'use strict';
// Offline fact-adoption gate: deliberately print ONLY numeric aggregates.
const {build}=require('../src/phase2_editorial_intake.cjs');
const document=require('../data/curation/adjudicated/30321.v1.json');
const out=build(document);
const expected={editoriallyAdoptedEvents:5,provisionalStandaloneEvents:2,
 blockedChainEvents:3,numericSkillHintMentions:2};
for(const [key,value] of Object.entries(expected))
 if(out.summary[key]!==value)throw Error('30321の編集採用数値が変化: '+key);
console.log(JSON.stringify(out.summary,null,2));
