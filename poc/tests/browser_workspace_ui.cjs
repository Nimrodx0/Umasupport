'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const {makeServer,mockSources,boot}=require('./browser_skill_smoke.cjs');
const KEY='uma-support-lab-runtime-umasim-v1';
async function disclosure(page,id){const el=page.locator('[data-disclosure="'+id+'"]');if(!await el.evaluate(e=>e.open))await el.locator(':scope > summary').click();}
async function close(page){await page.locator('.modal-head [data-action="close"]').click();}
async function navigate(page,route){await page.locator('[data-page="'+route+'"]').click();}
async function addCard(page,deck,index,id){
 await page.locator('[data-action="pick"][data-deck="'+deck+'"][data-index="'+index+'"]').click();
 await page.locator('#picker-search').fill(id);
 await page.locator('[data-action="set-card"][data-id="'+id+'"]').click();
}
async function main(){
 const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 const output=process.env.UI_SCREENSHOT_DIR||path.resolve('scratch/ui');await fs.mkdir(output,{recursive:true});
 try{
  for(const width of (process.env.UI_WIDTHS||'1440,390,320').split(',').map(Number)){
   const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await mockSources(page);await boot(page,base);
   assert.equal(await page.locator('.slot-grid').count(),2);
   for(const grid of await page.locator('.slot-grid').all()){
    const rects=await grid.locator('.slot').evaluateAll(es=>es.map(e=>({x:e.offsetLeft,y:e.offsetTop})));
    assert.equal(new Set(rects.map(r=>r.x)).size,3,'3 columns at '+width);
    assert.equal(new Set(rects.map(r=>r.y)).size,2,'2 rows at '+width);
   }
   if(width>980)assert.equal(await page.locator('.deck-workspace').evaluate(e=>getComputedStyle(e).position),'sticky');
   else{
    assert.equal(await page.locator('.analysis-workspace').isVisible(),false);
    assert.equal(await page.locator('.primary-nav').evaluate(e=>getComputedStyle(e).position),'fixed');
   }
   await disclosure(page,'training-main');
   await page.locator('[data-deck-training-axis="running_style"][data-deck="main"]').selectOption('1');
   await page.locator('[data-deck-training-axis="distance_type"][data-deck="main"]').selectOption('3');
   assert.match(await page.locator('[data-training-summary="main"]').innerText(),/逃げ · 中距離/);
   await addCard(page,'main',0,'30001');await addCard(page,'main',1,'30001');await addCard(page,'inherit',0,'30001');
   await page.screenshot({path:path.join(output,'workspace-'+width+'.png'),fullPage:true});
   if(width<=980)await navigate(page,'compare');
   assert.equal(await page.locator('#table-region tbody tr').count(),1);
   assert.match(await page.locator('#table-region tbody tr td').nth(1).innerText(),/^1/,'same ID stays one provider');
   await page.locator('[data-action="view"][data-value="matrix"]').click();
   assert.equal(await page.locator('.matrix-table thead th').count(),13);
   assert.equal(await page.locator('.matrix-cell').count(),12);
   assert.equal(await page.locator('.matrix-cell button').count(),3,'all three occupied slots retain routes');
   assert.match(await page.locator('.matrix-table tbody th').innerText(),/本 1枚 · 継 1枚/);
   await page.screenshot({path:path.join(output,'matrix-before-'+width+'.png'),fullPage:true});
   await page.locator('.matrix-scroll').evaluate(e=>e.scrollIntoView({block:'center'}));
   await page.locator('.matrix-cell button').first().click();
   assert.equal(await page.locator('.side-panel').count(),1);
   assert.equal(await page.locator('#app-shell').getAttribute('inert'),'');
   await page.locator('.modal-head [data-action="close"]').focus();
   await page.keyboard.press('Shift+Tab');
   assert.equal(await page.locator('.modal').evaluate(e=>e.contains(document.activeElement)),true,'backward tab stays in panel');
   await page.keyboard.press('Tab');
   assert.equal(await page.locator('.modal-head [data-action="close"]').evaluate(e=>document.activeElement===e),true,'tab wraps to close');
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('.modal').count(),0);
   assert.equal(await page.locator('.matrix-cell button').first().evaluate(e=>document.activeElement===e),true,'panel returns keyboard focus');
   await disclosure(page,'comparison');await page.locator('#skill-route').selectOption('event');
   await page.locator('[data-disclosure="comparison"] > summary').click();
   assert.match(await page.locator('[data-filter-count="comparison"]').innerText(),/適用中 1/);
   assert.equal(await page.locator('.matrix-table tbody tr').count(),0);
   await page.locator('[data-action="skill-filters-reset"]').click();
   await page.screenshot({path:path.join(output,'matrix-'+width+'.png'),fullPage:true});
   // Lists are independent pages; detail/assignment preserve the background page.
   await navigate(page,'cards');assert.equal(await page.locator('[role="dialog"]').count(),0);
   assert.equal(await page.locator('#page-region').isVisible(),true);
   await page.locator('#picker-search').fill('30001');
   await page.locator('[data-action="card-detail"][data-id="30001"]').click();
   assert.equal(await page.locator('.side-panel').count(),1);
   await close(page);assert.equal(await page.locator('#picker-search').inputValue(),'30001');
   await navigate(page,'owned');await page.goBack();
   assert.equal(await page.locator('#picker-search').inputValue(),'30001','back preserves library search');
   await page.goForward();assert.equal(await page.locator('#owned-search').isVisible(),true);
   await page.goto(base+'/poc/live.html#skills');await page.locator('#catalog-query').waitFor();
   assert.equal(await page.locator('#page-title').innerText(),'全スキル一覧','direct hash opens independent page');
   await navigate(page,'skills');await page.locator('#catalog-query').fill('右回り○');
   await disclosure(page,'catalog');await page.locator('[data-catalog-axis="running_style"]').selectOption('2');
   assert.equal(await page.locator('[data-catalog-skill]').count(),0);
   await page.locator('#catalog-scope').selectOption('outside');
   assert.equal(await page.locator('[data-catalog-skill]').count(),1);
   await page.locator('[data-catalog-skill] button').click();await close(page);
   assert.equal(await page.locator('#catalog-query').inputValue(),'右回り○');
   await navigate(page,'owned');await page.locator('#owned-search').fill('30001');
   await page.locator('[data-action="owned-status"][data-status="owned"]').click();
   await page.locator('[data-owned-stage]').selectOption('2');
   await navigate(page,'workspace');
   await page.locator('[data-action="deck-events"][data-deck="main"]').click();
   assert.equal(await page.locator('[role="dialog"]').count(),0);
   assert.match(await page.locator('#page-region').innerText(),/デッキ全体のイベント設定/);
   await page.locator('#page-region [data-action="navigate"]').click();
   await navigate(page,'settings');
   await page.locator('[data-action="theme"][data-value="light"]').click();
   assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
   const before=await page.evaluate(key=>localStorage.getItem(key),KEY);
   await page.reload();await page.locator('#page-region .settings-section').first().waitFor();
   assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),before,'theme/reload never alters deck settings');
   await page.locator('[data-action="source-health"]').click();
   assert.equal(await page.locator('#source-status-events').count(),1);await close(page);
   await navigate(page,'workspace');
   await page.screenshot({path:path.join(output,'light-'+width+'.png'),fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no page overflow at '+width);
   const stored=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),KEY));
   assert.equal(stored.view,'matrix');assert.equal(stored.ownedCards['30001'].stage,2);
   assert.equal(stored.decks.main[0].slots[1].cardId,'30001');
   assert.deepEqual(errors,[],'no runtime errors at '+width);
   await context.close();
  }
  console.log('PASS: workspace navigation, 3x2, 12-slot matrix, independent pages, panels/focus, filters, owned, events, themes and persisted settings at '+(process.env.UI_WIDTHS||'1440,390,320')+'px');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
