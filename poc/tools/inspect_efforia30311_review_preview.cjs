#!/usr/bin/env node
/* Read-only metadata diagnostic: never writes an actual event JSON. */
'use strict';
const {inspect}=require('../src/efforia30311_review_preview.cjs');
try {console.log(JSON.stringify(inspect(),null,2));}
catch(e){console.error('SSR30311 review preview failed:',e.message);process.exitCode=1;}
