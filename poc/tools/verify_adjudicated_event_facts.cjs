#!/usr/bin/env node
'use strict';
/* Review-only: no network, no event text, no production JSON output. */
const {validate}=require('../src/phase2_adjudicated_fact_intake.cjs');
const facts=require('../data/curation/adjudicated_event_facts.v1.json');
try{
 const stats=validate(facts);
 console.log('Adjudicated numeric event facts (NOT PUBLISHED): '+JSON.stringify(stats));
}catch(e){
 console.error(e.message);
 process.exitCode=1;
}
