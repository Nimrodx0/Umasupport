'use strict';
// W1.2/W1.3: real public catalog + immutable, external UmaSim source snapshots
// in Chromium. External dictionaries are fetched only in CI memory, never
// published, logged as raw text, committed or recorded in test artifacts.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const loader=require('../src/live_loader.js');
const bridge=require('../src/skill_bridge.js');

const ROOT=path.resolve(__dirname,'../..');
const REV='cf9366f6a487bd8f197b53d8a11981207beb9f6c';
const SUPPORT_URL='https://raw.githubusercontent.com/mee1080/umasim/'+REV+'/data/support_card.txt';
const SKILL_URL=bridge.PINNED_URL;
const PINNED_SKILL_SHA=bridge.PINNED_SHA256;
const PINNED_SUPPORT_SHA='153213019b5232df6c211427b862978218b60df6baee03c2a5fee75e0966d424';
const SAVE_KEY='uma-support-lab-runtime-umasim-v1';
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');

async function readPinned(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,200,'immutable source download HTTP');
 const body=await response.text();
 assert.ok(body.length>100000,'immutable source is unexpectedly short');
 return body;
}
async function getSources(){
 const [supports,skills]=await Promise.all([readPinned(SUPPORT_URL),readPinned(SKILL_URL)]);
 assert.equal(sha(skills),PINNED_SKILL_SHA,'approved-event registry pin drift');
 assert.equal(sha(supports),PINNED_SUPPORT_SHA,'immutable support roster bytes drift');
 assert.equal(loader.parseSupportCards(supports).cards.size,563);
 assert.ok(bridge.parseSource(skills).count>=100);
 return {supports,skills};
}
function server(){
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
 return http.createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,'http://127.0.0.1');
   const file=path.resolve(ROOT,'.'+decodeURIComponent(u.pathname));
   if(!file.startsWith(ROOT+path.sep))throw Error('outside repository');
   const bytes=await fs.readFile(file);
   res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain'});
   res.end(bytes);
  }catch{
   res.writeHead(404);res.end('Not found');
  }
 });
}
const saved=page=>page.evaluate(key=>{
 const source=JSON.parse(localStorage.getItem(key));
 const active=k=>source.decks[k].find(d=>d.id===source.activeDecks[k]);
 return {main:active('main'),inherit:active('inherit'),goals:source.goalSets
  .find(g=>g.id===source.currentGoalSet).goals};
},SAVE_KEY);
async function chooseCard(page,deck,index,card){
 await page.locator('button[data-action="pick"][data-deck="'+deck+'"][data-index="'+index+'"]').click();
 await page.locator('#picker-search').fill(card.name);
 await page.locator('button[data-action="set-card"][data-id="'+card.id+'"]').click();
}
async function boot(page,url){
 const res=await page.goto(url,{waitUntil:'domcontentloaded'});
 assert.equal(res.status(),200);
 await page.locator('#app main.app').waitFor({timeout:40000});
 assert.equal(await page.locator('#bootstrap-status').getAttribute('data-mode'),'online');
}
async function appCases(page){
 const sample=await page.evaluate(()=>{
  const model=window.UmaDemoData,core=window.UmaCore;
  assertModel();
  function assertModel(){
   if(model.meta.reviewedEventRecords!==2487||model.meta.reviewedEventCards!==559)
    throw Error('Unexpected public review cohort');
   if(model.meta.runtimeSources.events.mode!=='reviewed')
    throw Error('Public event data was not attached');
  }
  let choice=null,outcome=null,hint=null;
  for(const card of model.cards){
   if(!hint&&card.hintsByStage?.['4']?.length&&card.hintPerformanceByStage?.['4'])
    hint={card:{id:card.id,name:card.name},
     skillId:card.hintsByStage['4'][0],
     stageFour:card.hintsByStage['4'].slice(),
     stageZero:card.hintsByStage['0'].slice()};
   for(const e of card.events||[]){
    if(e.type!=='choice'||e.requires)continue;
    for(const opt of e.choices){
     if(opt.requires)continue;
     if(!choice&&opt.rewards?.length){
      const empty=core.directRoutes(card,{stage:4,choices:{},outcomes:{}});
      const seen=new Set(empty.map(r=>r.skillId));
      const chosen=core.directRoutes(card,{stage:4,choices:{[e.id]:opt.id},outcomes:{}});
      const added=chosen.find(r=>r.source==='event'&&r.eventId===e.id&&
       !r.conditional&&!seen.has(r.skillId));
      if(added)choice={card:{id:card.id,name:card.name},
       eventId:e.id,choiceId:opt.id,skillId:added.skillId};
     }
     if(!outcome&&opt.outcomes?.length>=2&&opt.outcomes.every(x=>!x.requires)&&
       opt.outcomes.some(x=>(x.rewards||[]).some(r=>r.kind!=='negative'))){
      outcome={card:{id:card.id,name:card.name},eventId:e.id,choiceId:opt.id,
       firstResult:opt.outcomes[0].id,secondResult:opt.outcomes[1].id};
     }
    }
   }
  }
  return {choice,outcome,hint,cards:model.cards.length,skills:model.skills.length};
 });
 assert.ok(sample.cards>=500);
 assert.ok(sample.skills>=700);
 assert.ok(sample.choice,'No published choice grants an independent skill candidate');
 assert.ok(sample.outcome,'No published exclusive-result choice exists');
 assert.ok(sample.hint,'No actual stage-4 normal hints exist in pinned source');
 const chosen=sample.choice;
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e.message)));
 // A real, source-backed target is initially uncovered.
 await page.locator('button[data-action="goals"]').click();
 await page.locator('#new-goal-skill-search').fill(chosen.skillId);
 await page.locator('#new-goal-skill').selectOption(chosen.skillId);
 await page.locator('#new-goal-scope').selectOption('both');
 await page.locator('button[data-action="add-goal"]').click();
 await page.locator('button[data-action="close"]').click();
 assert.match(await page.locator('.goal-pill').first().innerText(),/未カバー/);
 await chooseCard(page,'main',0,chosen.card);
 // Placing a card must not auto-select a published choice event.
 assert.match(await page.locator('.goal-pill').first().innerText(),/未カバー/);
 await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').click();
 const mainChoice='input[data-event-choice][data-deck="main"][data-index="0"][data-event="'+
  chosen.eventId+'"][value="'+chosen.choiceId+'"]';
 await page.locator(mainChoice).check();
 assert.equal((await saved(page)).main.slots[0].choices[chosen.eventId],chosen.choiceId);
 await page.locator('button[data-action="close"]').click();
 // BOTH scope remains incomplete until the independent inheritance deck is set.
 assert.match(await page.locator('.goal-pill').first().innerText(),/未カバー/);
 await chooseCard(page,'inherit',0,chosen.card);
 let state=await saved(page);
 assert.equal(state.inherit.slots[0].choices[chosen.eventId],undefined);
 assert.equal(state.main.slots[0].choices[chosen.eventId],chosen.choiceId);
 await page.locator('button[data-action="edit-card"][data-deck="inherit"][data-index="0"]').click();
 const inheritChoice='input[data-event-choice][data-deck="inherit"][data-index="0"][data-event="'+
  chosen.eventId+'"][value="'+chosen.choiceId+'"]';
 await page.locator(inheritChoice).check();
 await page.locator('button[data-action="close"]').click();
 assert.match(await page.locator('.goal-pill').first().innerText(),/直接カバー/);
 const totals=await page.evaluate(({skillId,key})=>{
  const model=window.UmaDemoData,core=window.UmaCore,s=JSON.parse(localStorage.getItem(key));
  const active=k=>s.decks[k].find(d=>d.id===s.activeDecks[k]);
  const main=core.aggregate(active('main'),model),inherit=core.aggregate(active('inherit'),model);
  return {main:main[skillId]?.count,inherit:inherit[skillId]?.count,
   goal:core.goalStatus({skillId,scope:'both'},main,inherit,model)};
 },{skillId:chosen.skillId,key:SAVE_KEY});
 assert.deepEqual([totals.main,totals.inherit],[1,1]);
 assert.equal(totals.goal.satisfied,true);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#app main.app').waitFor({timeout:40000});
 state=await saved(page);
 assert.equal(state.main.slots[0].choices[chosen.eventId],chosen.choiceId);
 assert.equal(state.inherit.slots[0].choices[chosen.eventId],chosen.choiceId);
 assert.match(await page.locator('.goal-pill').first().innerText(),/直接カバー/);
 // The editing UI can independently unset main, without deleting inherit.
 await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').click();
 await page.locator('input[data-event-choice][data-deck="main"][data-index="0"][data-event="'+
  chosen.eventId+'"][value=""]').check();
 await page.locator('button[data-action="close"]').click();
 state=await saved(page);
 assert.equal(state.main.slots[0].choices[chosen.eventId],undefined);
 assert.equal(state.inherit.slots[0].choices[chosen.eventId],chosen.choiceId);
 assert.match(await page.locator('.goal-pill').first().innerText(),/未カバー/);
 // A second real event's mutually exclusive results survive the same editor.
 await chooseCard(page,'main',1,sample.outcome.card);
 await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="1"]').click();
 await page.locator('input[data-event-choice][data-deck="main"][data-index="1"][data-event="'+
  sample.outcome.eventId+'"][value="'+sample.outcome.choiceId+'"]').check();
 const resultBox=page.locator('select[data-event-outcome][data-deck="main"][data-index="1"][data-event="'+
  sample.outcome.eventId+'"]');
 await resultBox.selectOption(sample.outcome.firstResult);
 assert.equal(await resultBox.inputValue(),sample.outcome.firstResult);
 const after=await saved(page);
 assert.equal(after.main.slots[1].outcomes[sample.outcome.eventId],sample.outcome.firstResult);
 async function outcomeRouteCheck(resultId){
  const snapshot=await page.evaluate(({cardId,eventId,choiceId,resultId,key})=>{
   const model=window.UmaDemoData,core=window.UmaCore;
   const card=model.cardById[cardId],event=card.events.find(e=>e.id===eventId);
   const option=event.choices.find(c=>c.id===choiceId);
   const result=option.outcomes.find(o=>o.id===resultId);
   const settings=JSON.parse(localStorage.getItem(key));
   const deck=settings.decks.main.find(d=>d.id===settings.activeDecks.main);
   const slot=deck.slots[1];
   const direct=core.directRoutes(card,slot).filter(r=>r.source==='event'&&r.eventId===eventId);
   const project=rs=>rs.map(r=>({skillId:r.skillId,level:r.level??null}))
    .sort((x,y)=>x.skillId.localeCompare(y.skillId)||((x.level??-1)-(y.level??-1)));
   return {savedResult:slot.outcomes[eventId],
    expected:project((result.rewards||[]).filter(r=>r.kind!=='negative')),
    actual:project(direct)};
  },{cardId:sample.outcome.card.id,eventId:sample.outcome.eventId,
   choiceId:sample.outcome.choiceId,resultId,key:SAVE_KEY});
  assert.equal(snapshot.savedResult,resultId);
  assert.deepEqual(snapshot.actual,snapshot.expected,
   'selected result must replace competing event rewards without changing hint levels');
  return snapshot;
 }
 await outcomeRouteCheck(sample.outcome.firstResult);
 await resultBox.selectOption(sample.outcome.secondResult);
 await outcomeRouteCheck(sample.outcome.secondResult);
 await page.locator('input[data-event-choice][data-deck="main"][data-index="1"][data-event="'+
  sample.outcome.eventId+'"][value=""]').check();
 const resetOutcome=await saved(page);
 assert.equal(resetOutcome.main.slots[1].choices[sample.outcome.eventId],undefined);
 assert.equal(resetOutcome.main.slots[1].outcomes[sample.outcome.eventId],undefined,
  'Clearing the parent choice must invalidate its previously selected outcome');
 await page.locator('button[data-action="close"]').click();
 // Independently exercise a real UmaSim hint record through the same GUI.
 // The source snapshot is pinned, not an assertion about the current game.
 await chooseCard(page,'main',2,sample.hint.card);
 const hintAtFour=await page.evaluate(({cardId,skillId,key})=>{
  const model=window.UmaDemoData,core=window.UmaCore,s=JSON.parse(localStorage.getItem(key));
  const deck=s.decks.main.find(d=>d.id===s.activeDecks.main),slot=deck.slots[2];
  const routes=core.directRoutes(model.cardById[cardId],slot);
  const summary=core.aggregate(deck,model)[skillId];
  return {stage:slot.stage,matched:routes.some(r=>r.source==='hint'&&r.skillId===skillId),
   provider:!!summary?.providers['2']?.routes.some(r=>r.source==='hint'&&r.skillId===skillId)};
 },{cardId:sample.hint.card.id,skillId:sample.hint.skillId,key:SAVE_KEY});
 assert.deepEqual(hintAtFour,{stage:4,matched:true,provider:true});
 await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="2"]').click();
 await page.locator('select[data-stage][data-deck="main"][data-index="2"]').selectOption('0');
 const hintAtZero=await page.evaluate(({cardId,key})=>{
  const model=window.UmaDemoData,core=window.UmaCore,s=JSON.parse(localStorage.getItem(key));
  const deck=s.decks.main.find(d=>d.id===s.activeDecks.main),slot=deck.slots[2];
  return {stage:slot.stage,hints:core.directRoutes(model.cardById[cardId],slot)
   .filter(r=>r.source==='hint').map(r=>r.skillId)};
 },{cardId:sample.hint.card.id,key:SAVE_KEY});
 assert.equal(hintAtZero.stage,0);
 assert.deepEqual(hintAtZero.hints,sample.hint.stageZero);
 await page.locator('button[data-action="close"]').click();
  // A source-backed two-stage support event is exercised through actual
  // parent/child radio controls. Unlike a synthetic chain, both event IDs
  // must exist in the published public catalog and the pinned card roster.
  const chain=await page.evaluate(()=>{
   const core=window.UmaCore;
   for(const card of window.UmaDemoData.cards){
    const events=card.events||[];
    for(const child of events){
     const reqs=child.requires?.all||[];
     if(reqs.length!==1||reqs[0].choiceId!==undefined||
       reqs[0].outcomeId!==undefined||child.availabilityKind)continue;
     const parent=events.find(e=>e.id===reqs[0].eventId);
     if(!parent||parent.type!=='choice'||parent.requires||parent.availabilityKind)continue;
     const parentChoice=parent.choices.find(c=>
      c.terminal!==true&&!c.requires&&!c.outcomes?.length);
     if(!parentChoice)continue;
     const childChoice=child.type==='choice'?child.choices.find(c=>
      !c.requires&&!c.outcomes?.length&&(c.rewards||[]).some(r=>r.kind!=='negative')):null;
     if(child.type==='choice'&&!childChoice)continue;
     if(child.type==='auto'&&(child.outcomes?.length||
       !(child.rewards||[]).some(r=>r.kind!=='negative')))continue;
     const choices={[parent.id]:parentChoice.id};
     if(childChoice)choices[child.id]=childChoice.id;
     const selected=core.directRoutes(card,{stage:4,choices,outcomes:{}})
      .find(r=>r.source==='event'&&r.eventId===child.id&&!r.conditional);
     if(!selected)continue;
     if(core.reachability(child,{},events).status!=='blocked')continue;
     return {card:{id:card.id,name:card.name},parentId:parent.id,
      parentChoiceId:parentChoice.id,childId:child.id,
      childChoiceId:childChoice?.id||null,skillId:selected.skillId};
    }
   }
   return null;
  });
  assert.ok(chain,'No actual approved parent-choice gated event was found');
  await chooseCard(page,'main',3,chain.card);
  await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="3"]').click();
  const parentRadio='input[data-event-choice][data-deck="main"][data-index="3"][data-event="'+
   chain.parentId+'"][value="'+chain.parentChoiceId+'"]';
  const childRadio=chain.childChoiceId?
   'input[data-event-choice][data-deck="main"][data-index="3"][data-event="'+
    chain.childId+'"][value="'+chain.childChoiceId+'"]':null;
  if(childRadio)assert.equal(await page.locator(childRadio).isDisabled(),true);
  await page.locator(parentRadio).check();
  if(childRadio){
   assert.equal(await page.locator(childRadio).isDisabled(),false);
   await page.locator(childRadio).check();
  }
  const checkChain=async ()=>{
   return page.evaluate(({id,childId,skillId,key})=>{
    const s=JSON.parse(localStorage.getItem(key));
    const d=s.decks.main.find(x=>x.id===s.activeDecks.main),slot=d.slots[3];
    const event=window.UmaDemoData.cardById[id];
    const routes=window.UmaCore.directRoutes(event,slot);
    return {choice:slot.choices[childId]||null,
     route:routes.some(r=>r.eventId===childId&&r.skillId===skillId&&
       r.source==='event'&&!r.conditional)};
   },{id:chain.card.id,childId:chain.childId,skillId:chain.skillId,key:SAVE_KEY});
  };
  const liveChain=await checkChain();
  assert.equal(liveChain.route,true,
   'published chained reward must emerge only when the parent selection is set');
  if(childRadio)assert.equal(liveChain.choice,chain.childChoiceId);
  await page.locator('input[data-event-choice][data-deck="main"][data-index="3"][data-event="'+
   chain.parentId+'"][value=""]').check();
  const removedChain=await checkChain();
  assert.equal(removedChain.route,false,'unselected parent must remove downstream reward');
  if(childRadio)assert.equal(removedChain.choice,null,
   'editing parent must clear previously selected downstream child');
  await page.locator('button[data-action="close"]').click();
 // Viewport smoke is NOT an Android physical-device acceptance.
 await page.setViewportSize({width:390,height:844});
 const geometry=await page.evaluate(()=>({
  width:innerWidth,documentWidth:document.documentElement.scrollWidth
 }));
 assert.ok(geometry.documentWidth<=geometry.width+3,
  'Page-wide overflow at simulated mobile width: '+JSON.stringify(geometry));
 assert.deepEqual(errors,[]);
 return {cards:sample.cards,skills:sample.skills,reviewedEvents:2487,
  goalByBothDecks:true,choicePersistedAfterReload:true,exclusiveResultUI:true,
  pinnedRealNormalHintsChecked:true,sourceBackedParentChildUI:true,
  simulatedMobileWidth:geometry.width};
}
async function main(){
 const inputs=await getSources(),srv=server();
 await new Promise((resolve,reject)=>{
  srv.once('error',reject);srv.listen(0,'127.0.0.1',resolve);
 });
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({locale:'ja-JP',viewport:{width:1280,height:900}});
  const page=await context.newPage();
  await page.route('**/data/support_card.txt',route=>route.fulfill({
   status:200,contentType:'text/plain; charset=utf-8',body:inputs.supports
  }));
  await page.route('**/data/skill_data.txt',route=>route.fulfill({
   status:200,contentType:'application/json; charset=utf-8',body:inputs.skills
  }));
  const app='http://127.0.0.1:'+srv.address().port+'/poc/live.html';
  await boot(page,app);
  const outcome=await appCases(page);
  console.log('W1_PINNED_PUBLIC_BROWSER_PASS='+JSON.stringify({
   ...outcome,umasimRevision:REV,supportSha256:sha(inputs.supports),
   skillSha256:PINNED_SKILL_SHA,publishedPayloadUnchanged:true,
   testsUseRealEventData:true,physicalWindowsAndroidTested:false
  }));
  await context.close();
 }finally{
  await browser?.close();
  await new Promise(resolve=>srv.close(resolve));
 }
}
if(require.main===module)main().catch(e=>{console.error('W1 browser test failed:',e);process.exitCode=1});
module.exports={main,getSources,server,boot,chooseCard,SAVE_KEY};
