#!/usr/bin/env node
'use strict';
const {audit}=require('../src/phase2_chain_manual_replay.cjs');
const {summary}=audit();
console.log(JSON.stringify(summary,null,2));
