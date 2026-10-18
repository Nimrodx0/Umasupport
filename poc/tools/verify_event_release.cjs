#!/usr/bin/env node
/* Offline, read-only preflight of the exact public event catalog. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {verifyRelease}=require('../src/event_release_gate.cjs');
const root=path.resolve(__dirname,'../..');
const catalogPath=process.argv[2]||path.join(root,'poc/data/reviewed_events.v1.json');
const approvalsPath=process.argv[3]||path.join(root,'poc/config/event-release-approvals.v1.json');
try{
 const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
 const approvals=JSON.parse(fs.readFileSync(approvalsPath,'utf8'));
 const result=verifyRelease(catalog,approvals);
 console.log('Event release preflight PASSED:',JSON.stringify(result));
}catch(error){
 console.error('Event release preflight FAILED:',error.message);
 process.exitCode=1;
}
