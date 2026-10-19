#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../data/candidates');
const {verify}=require('../src/route_classification_verify.cjs');
try{
 const db=JSON.parse(fs.readFileSync(path.join(root,'checker_event_hints.v1.json'),'utf8'));
 const cls=JSON.parse(fs.readFileSync(path.join(root,'checker_route_classification.v1.json'),'utf8'));
 const result=verify(db,cls);
 if(result.classifiedEvents!==2109||result.verifiedRoutes!==0)
  throw Error('Unexpected 2026-10-19 fixed-source classification coverage');
 console.log('Full candidate route classification verified:',JSON.stringify(result));
}catch(e){console.error('ROUTE_CLASSIFICATION_VERIFICATION_FAILED',e.message);process.exitCode=1;}
