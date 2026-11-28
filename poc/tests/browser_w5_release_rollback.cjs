'use strict';
const {control}=require('./workspace_controls.cjs');
// W5.3 local same-origin rehearsal; never change actual public Pages.
const a=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const {getSources,chooseCard,SAVE_KEY}=require('./browser_w1_pinned_public_integration.cjs');
const bridge=require('../src/skill_bridge.js');
const current=require('./current_public_event_fixture.cjs');
const root=path.resolve(__dirname,'../..');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const oldSHA='c46dcd6eb2adb462c823d0fb4a36ec38e4eda3299759b51dcb5af9c391556f86';
async function main(){
 const old=path.resolve(process.argv[2]||'');
 a.notEqual(old,root);a.equal(digest(await fs.readFile(path.join(old,'poc/data/reviewed_events.v1.json'))),oldSHA);
 const inputs=await getSources();
 const historicalBase='https://raw.githubusercontent.com/mee1080/umasim/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/data/';
 const {gitBlobSha}=require('../src/current_umasim_roster_delta.cjs');
 const load=async(name,expected)=>{const r=await fetch(historicalBase+name,{signal:AbortSignal.timeout(30000)});a(r.ok);const t=await r.text();a.equal(gitBlobSha(t),expected);return t;};
 const [oldSupports,oldSkills]=await Promise.all([load('support_card.txt','3a9204291615ce0c3573bf91e388e6ba48854848'),load('skill_data.txt','0c6ea6d72b037b24ee40860f73b0e86db47aab1d')]);
 let historicSources=false;
 let served=old;
 const srv=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1');
  const f=path.resolve(served,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
  a(f.startsWith(served+path.sep));
  const body=await fs.readFile(f);
  res.writeHead(200,{'Cache-Control':'no-store','Content-Type':({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(f)]||'text/plain'});res.end(body);
 }catch{res.writeHead(404);res.end();}});
 await new Promise((ok,bad)=>{srv.once('error',bad);srv.listen(0,'127.0.0.1',ok);});
 const url='http://127.0.0.1:'+srv.address().port+'/';
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const width of [1280,390]){
   const ctx=await browser.newContext({viewport:{width,height:850},locale:'ja-JP'});
   const page=await ctx.newPage();
   await page.route('**/data/support_card.txt',r=>r.fulfill({status:200,body:historicSources?oldSupports:inputs.supports}));
   await page.route('**/data/skill_data.txt',r=>r.fulfill({status:200,body:r.request().url()===bridge.PINNED_URL?inputs.pinnedSkills:historicSources?oldSkills:inputs.skills}));
   const saved=()=>page.evaluate(key=>localStorage.getItem(key),SAVE_KEY);
   const boot=async(dir,version,events,settingsError=false,historical=false)=>{
    served=dir;historicSources=historical;
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForURL('**/poc/live.html?v='+version);
    await page.locator('#app-release').waitFor();
    a.equal(await page.locator('#app-release').getAttribute('data-release'),version);
    if(settingsError){
     await page.locator('button[data-action="reset"]').waitFor({timeout:40000});
     a.match(await page.locator('#app').innerText(),/保存設定を読み込めませんでした/);
    }else await page.locator('#app main.app').waitFor({timeout:40000});
    a.equal(await page.evaluate(()=>UmaDemoData.meta.reviewedEventRecords),events);
    a.equal(await page.evaluate(()=>UmaDemoData.meta.runtimeSources.events.mode),'reviewed');
   };
   await boot(old,'20261127-d065-r1',2487,false,true);
   a.equal(await page.evaluate(()=>UmaDemoData.skills.length),881);
   const previous=await page.evaluate(()=>({skills:UmaDemoData.skills.map(s=>s.id),card:UmaDemoData.cards.find(c=>c.events?.length&&c.hints?.length)}));
   const version=/data-release="([^"]+)"/.exec(await fs.readFile(path.join(root,'poc/live.html'),'utf8'))[1];
   await boot(root,version,current.events);
   const newSkill=await page.evaluate(oldIds=>UmaDemoData.skills.find(s=>!oldIds.includes(s.id)&&s.tier!=='negative')?.id,previous.skills);
   a(newSkill,'No real goal ID exclusive to current source snapshot');
   const axis=(deck,n)=>control(page,'[data-deck-training-axis="'+n+'"][data-deck="'+deck+'"]');
   await (await axis('main','running_style')).selectOption('2');
   await (await axis('main','distance_type')).selectOption('3');
   await (await axis('inherit','ground_type')).selectOption('1');
   await chooseCard(page,'main',0,previous.card);
   const before=JSON.parse(await saved());
   await boot(old,'20261127-d065-r1',2487);
   a.deepEqual(JSON.parse(await saved()),before,'old release loading must not erase settings');
   await (await control(page,'button[data-action="view"][data-value="split"]')).click();
   const edited=JSON.parse(await saved());a.deepEqual(edited,{...before,view:'split'},'old release ordinary save retains newer opaque context');
   await boot(root,version,current.events);
   a.equal(await (await axis('main','running_style')).inputValue(),'2');a.equal(await (await axis('main','distance_type')).inputValue(),'3');a.equal(await (await axis('inherit','ground_type')).inputValue(),'1');
   a.deepEqual(JSON.parse(await saved()),edited);
   // A genuine newer skill ID is absent when both release and upstream snapshot roll back.
   await (await control(page,'button[data-action="goals"]')).click();
   await (await control(page,'#new-goal-skill-search')).fill(newSkill);
   await (await control(page,'#new-goal-skill')).selectOption(newSkill);
   await (await control(page,'#new-goal-scope')).selectOption('main');
   await (await control(page,'button[data-action="add-goal"]')).click();
   await (await control(page,'button[data-action="close"]')).click();
   const newer=await saved();a(JSON.parse(newer).goalSets[0].goals.some(g=>g.skillId===newSkill));
   await boot(old,'20261127-d065-r1',2487,true,true);
   a.equal(await saved(),newer,'incompatible downgrade must preserve original bytes');
   await boot(root,version,current.events);
   a.equal(await saved(),newer,'restore must recover exact original bytes');
   a.equal(await (await axis('main','running_style')).inputValue(),'2');
   console.log('W5_ROLLBACK_REHEARSAL='+JSON.stringify({width,oldEvents:2487,currentEvents:current.events,oldVersion:'20261127-d065-r1',currentVersion:version,ordinarySavePreserved:true,combinedSourceRollback:true,incompatibleGoalPreserved:true,restoreExact:true,publicDeploymentChanged:false}));
   await ctx.close();
  }
 }finally{await browser?.close();await new Promise(ok=>srv.close(ok));}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
