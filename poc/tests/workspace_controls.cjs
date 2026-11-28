'use strict';
// Existing data/regression scenarios use the new navigation/disclosure controls.
// Default disclosure, routing, focus and mobile visibility are tested directly in
// browser_workspace_ui.cjs; this helper never bypasses actionability or assertions.
async function control(page,selector){
 let locator=page.locator(selector);
 const modern=await page.locator('.primary-nav').count();
 if(!modern)return locator;
 if(/data-action=["']close["']/.test(selector)&&!await page.locator('.modal').count())
  return page.locator('.primary-nav [data-page="workspace"]');
 if(!await locator.count()&&/data-action=["'](?:source-health|export|import|reset)["']/.test(selector)){
  await page.locator('[data-page="settings"]').click();locator=page.locator(selector.replace(/^header\s+/,''));
 }
 if(await locator.count()===1){
  const region=await locator.evaluate(e=>e.closest('.analysis-workspace')?'analysis':e.closest('.deck-workspace')?'decks':null);
  if(region&&!await locator.isVisible()){
   const route=region==='analysis'&&await page.locator('[data-page="compare"]').isVisible()?'compare':'workspace';
   if(await page.locator('[data-page="'+route+'"]').getAttribute('aria-current')!=='page')await page.locator('[data-page="'+route+'"]').click();
  }
  // Open native summaries by actual clicks, outside-in; no forced DOM actions.
  const ids=await locator.evaluate(e=>{const ids=[];for(let p=e.parentElement;p;p=p.parentElement)if(p.matches('details[data-disclosure]')&&!p.open)ids.unshift(p.dataset.disclosure);return ids;});
  for(const id of ids)await page.locator('[data-disclosure="'+id+'"] > summary').click();
 }
 return locator;
}
module.exports={control};
