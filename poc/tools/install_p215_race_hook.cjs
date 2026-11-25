#!/usr/bin/env node
'use strict';
/*
 * Ephemeral, SHA-pinned upstream source instrumentation. The original
 * version remains unchanged on disk until this script is explicitly run
 * in the CI checkout. Do NOT apply to the published application.
 */
const fs=require('node:fs'),path=require('node:path');
const pinned=require('../src/skill_phase_random_draw_support.cjs');
const ROOT=process.argv[2];
if(!ROOT||process.argv.length!==3)throw Error('usage: node install_p215_race_hook.cjs <pinned-upstream-repo-dir>');
const dir=path.join(ROOT,'race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2');
const checker=path.join(dir,'SkillChecker.kt');
const race=path.join(dir,'RaceState.kt');
const text=fs.readFileSync(checker,'utf8');
pinned.verifyPinnedSources(text,fs.readFileSync(race,'utf8'));
const needle='    return { areas.any { simulation.position in it } }';
const count=text.split(needle).length-1;
if(count!==1)throw Error('P2.15 fail closed: original random checker closure must be unique');
const injected=[
 '    return {',
 '        val originalResult = areas.any { simulation.position in it }',
 '        P215RaceWindowHook.record(key, simulation.frameElapsed, simulation.position, areas, originalResult)',
 '        originalResult',
 '    }'
].join('\n');
const output=text.replace(needle,injected);
if(!output.includes(injected)||output.length<=text.length)throw Error('unexpected patch result');
const hookTarget=path.join(dir,'P215RaceWindowHook.kt');
if(fs.existsSync(hookTarget))throw Error('hook already installed');
fs.copyFileSync(path.join(__dirname,'../source-probes/P215RaceWindowHook.kt'),hookTarget);
fs.writeFileSync(checker,output);
console.log('P2_15_SOURCE_RACE_PATCH='+JSON.stringify({
 originalSourceShaPinned:true,
 originalCheckerModifiedOnlyInTemporaryCheckout:true,
 onlyOnePredicateClosurePatched:true,
 originalPredicateBooleanPreserved:true,
 otherOriginalSourcesUnchanged:true,
 status:'instrumentation-only-no-race-measurement-yet'
}));
