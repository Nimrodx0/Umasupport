from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=ROOT/'uma_support_lab_v8_1.html'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],**({'executable_path':shutil.which('chromium')} if shutil.which('chromium') else {}))
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[];network=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda req:network.append(req.url))
    page.set_content(HTML.read_text(encoding='utf-8'),wait_until='domcontentloaded')
    assert page.locator('.slot').count()==12
    status=page.evaluate('''() => { const d=window.UmaDemoData; return { cards:d.cards.length, mapped:d.meta.idMappedCards, hints:d.meta.hintsTotal, uniqueIds: new Set(d.cards.map(c=>c.id)).size, uniqueStageCounts: [...new Set(d.cards.filter(c=>c.hintsByStage).map(c=>Object.keys(c.hintsByStage).length))], sample:d.cardById['30321']?.hints.length, gold:d.skillById['202871'].lowerId, network:typeof window.fetch }; }''')
    print('DATA',status)
    assert status['cards']==564 and status['mapped']==563 and status['hints']==4015
    assert status['uniqueIds']==564 and status['uniqueStageCounts']==[5]
    assert status['sample']==8
    assert status['gold'] in page.evaluate("Object.keys(UmaDemoData.skillById)")
    # Search by an actual recently collected card, add it, inspect hints.
    # First empty slot can be slot 4: first three slots contain demo defaults.
    first_empty=page.locator('[data-action=pick]').first
    slot_index=int(first_empty.get_attribute('data-index'))
    deck_key=first_empty.get_attribute('data-deck')
    first_empty.click()
    page.locator('#picker-search').fill('なる眷属')
    n=page.locator('#picker-cards .picker-card').count()
    print('RECENT CARD SEARCH',n,page.locator('#picker-cards').inner_text()[:160])
    assert n>=1
    page.locator('#picker-cards .picker-card').first.click()
    target_slot=page.locator(f'.slot[data-deck="{deck_key}"][data-index="{slot_index}"]')
    assert 'ドゥラメンテ' in target_slot.inner_text()
    # open card via slot detail button
    target_slot.click()
    detail=page.locator('.modal').inner_text()
    print('DETAIL',detail[:400])
    assert '巨歩' in detail and '末脚' in detail
    assert page.locator('#stage-select').count()==1
    page.locator('#stage-select').select_option('0')
    # Known zero hints must never be confused with missing data.
    page.locator('[data-action=close]').first.click()
    page.locator('[data-action=pick]').first.click()
    page.locator('#picker-search').fill('[トレセン学園]ハルウララ')
    page.locator('#picker-cards .picker-card').first.click()
    page.locator('[data-action=edit-card]').filter(has_text='ハルウララ').first.click()
    assert '通常ヒントなし（データ収録済み）' in page.locator('.modal').inner_text()
    page.locator('[data-action=close]').first.click()
    # Catalog-only entries must be explicitly labeled as unverified.
    page.locator('[data-action=pick]').first.click()
    page.locator('#picker-search').fill('[トレセン学園]タッカーブライン')
    page.locator('#picker-cards .picker-card').first.click()
    page.locator('[data-action=edit-card]').filter(has_text='タッカーブライン').first.click()
    assert '通常ヒントは未収録' in page.locator('.modal').inner_text()
    # event/status and hints should remain valid at each stage
    assert not errors, errors
    assert not network, network
    page.screenshot(path=str(ROOT/'v8_preview.png'),full_page=True)
    print('PASS browser v8.1')
    browser.close()