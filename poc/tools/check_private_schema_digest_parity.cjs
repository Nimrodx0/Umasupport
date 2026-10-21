#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const {check}=require('../src/private_schema_digest_parity.cjs');
try{
 if(process.argv.length!==4)throw Error('usage: <2025-preview-report> <2026-preview-report>');
 const r=check(...process.argv.slice(2).map(p=>JSON.parse(fs.readFileSync(p,'utf8'))));
 console.log('PRIVATE_2025_VS_2026_SCHEMA_DIGEST_PARITY='+JSON.stringify(r));
}catch(err){console.error(err.message);process.exitCode=1;}
