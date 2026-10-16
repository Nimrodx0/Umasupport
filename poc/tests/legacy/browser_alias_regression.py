from pathlib import Path
import shutil,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=ROOT/'uma_support_lab_v8_1.html'
KEY='uma-support-lab-realdata-poc-v3'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':850})
    js_errors=[]
    page.on('pageerror',lambda x:js_errors.append(str(x)))
    # This environment prohibits file:// navigation. Mock localStorage and
    # run the real bundled HTML in set_content instead.
    legacy={'version':1,'decks':{
      'main':{'name':'メイン','slots':[{'cardId':'catalog-1o7925v','stage':4,'choices':{}}]+[{'cardId':None,'stage':4,'choices':{}}]*5},
      'inherit':{'name':'継承','slots':[{'cardId':None,'stage':4,'choices':{}}]*6}},
      'goalSets':[{'id':'g','name':'目標','goals':[]}],'currentGoalSet':'g','view':'integrated','density':'compact'}
    values=json.dumps({KEY:json.dumps(legacy,ensure_ascii=False)},ensure_ascii=False)
    script=("<script>window.__mockStorage="+values+";Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__mockStorage[k]??null,setItem:(k,v)=>{window.__mockStorage[k]=v},removeItem:k=>delete window.__mockStorage[k]}});</script>")
    html=HTML.read_text(encoding='utf-8').replace('</head>','</head>'+script,1)
    page.set_content(html,wait_until='domcontentloaded')
    result=page.evaluate('''() => {
      const d=UmaDemoData;
      const meisho=d.cards.filter(x=>x.character==='メイショウドトウ');
      const missing=d.cards.filter(x=>x.sourceStatus==='catalog_only');
      return {size:d.cards.length,meisho:meisho.map(x=>x.name),missing:missing.map(x=>x.name),aliasA:d.meta.aliasCardIds['catalog-1o7925v'],aliasB:d.meta.aliasCardIds['catalog-1m027qj'],canonical:d.cardById['catalog-1o7925v']?.id};
    }''')
    assert result['size']==564,result
    assert len(result['meisho'])==5,result
    assert result['aliasA']=='30079' and result['aliasB']=='30304',result
    assert result['canonical']=='30079',result
    assert len(result['missing'])==1,result
    assert '飛びも出でぬべき心地すれ' in page.locator('.slot').first.inner_text()
    # Both current and retired alternate spellings find the same card.
    page.locator('[data-action="pick"]').first.click()
    page.locator('#picker-search').fill('飛びも出ぬべき')
    assert page.locator('#picker-cards .picker-card').count()==1
    assert '通常ヒント7件' in page.locator('#picker-cards').inner_text()
    page.locator('[data-action="close"]').first.click()
    page.locator('[data-action="density"]').last.click()
    saved=page.evaluate('(k)=>JSON.parse(window.__mockStorage[k])',KEY)
    assert saved['decks']['main']['slots'][0]['cardId']=='30079',saved
    assert not js_errors,js_errors
    page.screenshot(path=str(ROOT/'dedup_preview.png'),full_page=True)
    print('PASS 564 cards, 30 aliases, 1 unmatched, alternate-name search, legacy saved ID migration')
    browser.close()