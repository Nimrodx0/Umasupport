'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./private_local_2512_fixture.cjs');
const {assess,independentlyLabelled}=require('../src/phase2_publication_surface_audit.cjs');
test('the complete 563 / 2512 fixture preserves numeric routes after both distinct wording scenarios',()=>{
 const f=fixture(),input=JSON.stringify(f.bundle.catalog),model=JSON.stringify(f.model);
 const report=assess({catalog:f.bundle.catalog,model:f.model,skillText:f.skillText});
 assert.equal(report.total.cards,563);
 assert.equal(report.total.events,2512);
 assert.equal(report.total.choiceEvents,1);
 assert.equal(report.simulated.numericOnly.routeStatesChecked,1126);
 assert.equal(report.simulated.shortTitleRetained.skillRoutesPreserved,true);
 assert.equal(report.contract.sourceDataPublished,false);
 assert.equal(report.contract.copyrightDetermined,false);
 assert.equal(JSON.stringify(f.bundle.catalog),input);
 assert.equal(JSON.stringify(f.model),model);
});
test('both scenarios keep event branch identity and can be distinguished only by its event heading',()=>{
 const f=fixture();
 const compact=independentlyLabelled(f.bundle.catalog);
 const titles=independentlyLabelled(f.bundle.catalog,{retainTitles:true});
 assert.equal(compact.cards[0].events[0].name,'イベント 1');
 assert.equal(titles.cards[0].events[0].name,f.bundle.catalog.cards[0].events[0].name);
 assert.equal(titles.cards[0].events[0].choices[0].label,'第1選択肢');
 assert.equal(titles.cards[0].events[0].choices[0].id,f.bundle.catalog.cards[0].events[0].choices[0].id);
});
