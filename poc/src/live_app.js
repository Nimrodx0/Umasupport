(function(){
'use strict';
const data=window.UmaDemoData, core=window.UmaCore;
// Preview event selections must not modify the normal-production saved decks.
const SAVE_KEY='uma-support-lab-runtime-umasim-v1'+
 (window.UmaPreviewRequested==='expanded'?'-event-preview-expanded':
   window.UmaPreviewRequested==='facts'?'-event-preview-facts':
   window.UmaPreviewRequested==='results'?'-event-preview-results':
   window.UmaPreviewRequested?'-event-preview':'');
const blank=()=>({cardId:null,stage:4,choices:{},outcomes:{}});
const deck=(id,name,ids)=>({id,name,slots:Array.from({length:6},(_,i)=>ids[i]?{cardId:ids[i],stage:4,choices:{},outcomes:{}}:blank())});
const DEFAULT=()=>({version:3,ownedCards:{},decks:{main:[deck('main-default','本育成デッキ',[])],inherit:[deck('inherit-default','継承育成デッキ',[])]},activeDecks:{main:'main-default',inherit:'inherit-default'},nextDeckId:1,goalSets:[{id:'goals-default',name:'目標スキル',goals:[]}],currentGoalSet:'goals-default',view:'integrated',density:'compact'});
let state=DEFAULT(),ui={modal:null,search:'',onlyGoals:false,onlyDuplicate:false,skillTier:'all',skillRoute:'all',skillCoverage:'all',skillSort:'name',reverseOnlyOwned:false,reverseRoute:'all',pickerSearch:'',pickerOnlyOwned:false,pickerSkillQuery:'',pickerRarity:'all',pickerType:'all',pickerRoute:'all',pickerPage:0,ownedQuery:'',ownedSkillQuery:'',ownedRoute:'all',ownedRarity:'all',ownedType:'all',ownedFilter:'all',ownedPage:0,eventFilter:'all',importCandidate:null,importPreview:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
const goalSet=()=>state.goalSets.find(x=>x.id===state.currentGoalSet)||state.goalSets[0];
const activeDeck=k=>window.UmaSettings.activeDeck(state,k);
const results=()=>{const main=core.aggregate(activeDeck('main'),data),inherit=core.aggregate(activeDeck('inherit'),data),goals=goalSet().goals;return {main,inherit,goals,rows:core.combinedRows(main,inherit,goals,data)};};
let settingsLoadError=null;
function store(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch(e){console.warn('保存できません',e)}}
try {
 const raw=localStorage.getItem(SAVE_KEY);
 if(raw)state=window.UmaSettings.parse(raw,data);
} catch(e) {
 settingsLoadError=String(e.message||e);
 console.warn('保存設定を読み込めませんでした',e);
}
function saveRender(){store();render();}
function cardIcon(c,sm=false){return `<span class="card-icon${sm?' small':''}" style="background:${esc(c.accent)}" aria-hidden="true">${esc((c.character||'?').slice(0,2))}</span>`;}
function hintDetailText(c,sl){const hints=c.hintsByStage?.[String(sl.stage)]??c.hints;return hints.map(id=>esc(data.skillById[id]?.name||id)).join(' / ')||(c.sourceStatus?.startsWith('verified_hints')?'通常ヒントなし（データ収録済み）':'通常ヒントは未収録');}
function countCell(v,mode,deckKey){
 if(!v)return `<span class="count zero">－</span>`;
 const slotCount=Object.keys(v.providers).length;
 const duplicateNote=slotCount>v.count?' <span class="tiny-note" title="同じカードIDの別スロットは別枚数に加算しません">同カード複数枠</span>':'';
 const n=`<span class="count${v.count>1?' dup':''}">${v.count}</span>${v.conditionalOnly?' <span class="tag condition">条件付のみ</span>':''}${duplicateNote}`;
 if(mode==='detailed'){return `<span class="providers">${n}　${Object.values(v.providers).map(p=>{let c=data.cardById[p.cardId];return `<button class="mini" type="button" data-action="edit-card" data-deck="${deckKey}" data-index="${p.slotIndex}" style="background:${esc(c.accent)}" title="${esc(c.name)}のイベント設定">${esc((c.character||'?').slice(0,1))}</button>`}).join('')}</span>`;}
 return n;
}
function goalLabel(st){if(!st.satisfied)return '<span class="bad">未カバー</span>';let s=st.indirect?'間接カバー':'直接カバー';if(st.conditional)s+='（条件付き）';return `<span class="${st.conditional?'warn':'good'}">${s}</span>`;}
const scopeLabel={main:'本育成',inherit:'継承育成',either:'どちらか',both:'両方'};
function slotHTML(sl,deckKey,i){const c=sl.cardId&&data.cardById[sl.cardId];if(!c)return `<button class="slot empty" data-action="pick" data-deck="${deckKey}" data-index="${i}" aria-label="${scopeLabel[deckKey]}の${i+1}番スロットにカードを追加"><strong>＋</strong><span class="slotnum">スロット ${i+1}</span></button>`;return `<button class="slot" data-action="edit-card" data-deck="${deckKey}" data-index="${i}" aria-label="${esc(c.name)}のイベントを設定">${cardIcon(c)}<span style="min-width:0"><span class="card-name">${esc(c.name)}</span><span class="card-sub">${esc(c.type)} · ${esc(c.rarity)} · ${sl.stage}凸</span></span></button>`;}
function deckHTML(k){
 const d=activeDeck(k),count=d.slots.filter(s=>s.cardId).length;
 return `<section class="surface" aria-label="${scopeLabel[k]}デッキ"><div class="deck-top"><div class="deck-heading"><h2>${scopeLabel[k]}</h2><small>${count} / 6 枚 · 全枠対等 · 保存済み ${state.decks[k].length} 件</small></div><button class="btn tiny" data-action="deck-events" data-deck="${k}">イベント一括設定</button></div><div class="deck-switch"><label for="deck-select-${k}">${scopeLabel[k]}デッキ</label><select id="deck-select-${k}" class="field grow" aria-label="${scopeLabel[k]}の保存済みデッキを選択">${state.decks[k].map(item=>`<option value="${esc(item.id)}" ${d.id===item.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select><button class="btn tiny" data-action="deck-manage" data-deck="${k}">管理</button></div><div class="slot-grid">${d.slots.map((sl,i)=>slotHTML(sl,k,i)).join('')}</div></section>`;
}
function goalHTML(r){return `<section class="surface goals"><div class="section-top"><div><h2>目標スキル</h2><div class="tiny-note">現在の編成にない目標も一覧に残します</div></div><div class="controls"><select class="field" id="goal-set" aria-label="目標スキルセット">${state.goalSets.map(g=>`<option value="${esc(g.id)}" ${g.id===state.currentGoalSet?'selected':''}>${esc(g.name)}</option>`).join('')}</select><button class="btn tiny" data-action="goals">セットを編集</button></div></div><div class="goal-strip">${r.goals.length?r.goals.map(g=>{const st=core.goalStatus(g,r.main,r.inherit,data);return `<button class="goal-pill" data-action="skill" data-id="${esc(g.skillId)}" style="color:var(--text);text-align:left;cursor:pointer"><span>☆ ${esc(data.skillById[g.skillId].name)}</span><small>対象：${scopeLabel[g.scope]} / ${goalLabel(st)}</small></button>`}).join(''):'<span class="muted">目標スキルが未登録です。</span>'}</div></section>`;}
function statsHTML(r){const skills=new Set([...Object.keys(r.main),...Object.keys(r.inherit)]);const same=[...skills].filter(x=>r.main[x]&&r.inherit[x]).length;const overlaps=Object.values(r.main).filter(v=>v.count>1).length+Object.values(r.inherit).filter(v=>v.count>1).length;const achieved=r.goals.filter(g=>core.goalStatus(g,r.main,r.inherit,data).satisfied).length;return `<div class="stats"><section class="surface stat"><div class="stat-label">獲得候補スキル</div><div class="stat-num">${skills.size}</div><div class="stat-label">両デッキのユニーク数</div></section><section class="surface stat"><div class="stat-label">デッキ間共通</div><div class="stat-num">${same}</div><div class="stat-label">両デッキに直接経路あり</div></section><section class="surface stat"><div class="stat-label">デッキ内重複</div><div class="stat-num">${overlaps}</div><div class="stat-label">各デッキ内の重複件数の合計</div></section><section class="surface stat"><div class="stat-label">目標カバー</div><div class="stat-num">${achieved}<span style="font-size:14px;color:var(--muted)"> / ${r.goals.length}</span></div><div class="stat-label">間接・条件付きも含む</div></section></div>`;}
function skillLabel(row){
 const child=row.groupRole==='child';
 const extraIndent=Math.max(0,Math.min(3,Number(row.hierarchyDepth)||0)-1)*16;
 const lower=row.skill.lowerId&&data.skillById[row.skill.lowerId];
 let relation='';
 if(row.groupRole==='solo'&&lower){
   relation=`<span class="skill-relation-note">↳ 下位：${esc(lower.name)} <span class="relation-unlisted">（一覧外）</span></span>`;
 }
 return `<span class="skill-label-block ${child?'lower-child':''}"${extraIndent?' style="margin-left:'+extraIndent+'px"':''}><span class="skill-cell">${child?'<span class="skill-branch" aria-hidden="true">└</span>':''}<span class="skill-name">${esc(row.skill.name)}</span>${row.skill.tier==='gold'?'<span class="tag gold">金</span>':''}${child?'<span class="tag lower-tag">下位</span>':''}${row.goal?'<span class="tag goal">☆ 目標</span>':''}${row.goal&&!row.main&&!row.inherit?'<span class="tag missing">直接提供なし</span>':''}</span>${relation}</span>`;
}
function skillRowClass(row){return row.groupRole==='parent'?'class="skill-group-parent"':row.groupRole==='child'?'class="skill-group-child"':'';}
function filteredRows(r){return window.UmaSkillTable.build(r.rows,core,data,{query:ui.search,onlyGoals:ui.onlyGoals,onlyDuplicate:ui.onlyDuplicate,tier:ui.skillTier,route:ui.skillRoute,coverage:ui.skillCoverage,sort:ui.skillSort});}
function integratedTable(rows){const ordered=rows;return `<div class="table-scroll"><table><thead><tr><th>スキル</th><th>本育成の提供枚数</th><th>継承育成の提供枚数</th><th class="center">両デッキ</th></tr></thead><tbody>${ordered.map(r=>`<tr ${skillRowClass(r)} data-skill="${r.skill.id}" data-action="skill" data-id="${r.skill.id}"><td>${skillLabel(r)}</td><td>${countCell(r.main,state.density,'main')}</td><td>${countCell(r.inherit,state.density,'inherit')}</td><td class="center">${r.main&&r.inherit?'<span class="common">✓ 共通</span>':'<span class="muted">－</span>'}</td></tr>`).join('')}</tbody></table>${!rows.length?'<p class="help">一致するスキルはありません。</p>':''}</div>`;}
function splitTable(rows){return `<div class="split-grid">${['main','inherit'].map(k=>`<section class="surface"><h3>${scopeLabel[k]}</h3><div class="table-scroll"><table><thead><tr><th>スキル</th><th>提供</th></tr></thead><tbody>${window.UmaSkillTable.build(rows.filter(r=>r[k]||r.goal),core,data,{sort:ui.skillSort}).map(r=>`<tr ${skillRowClass(r)} data-action="skill" data-id="${r.skill.id}" data-skill="${r.skill.id}"><td>${skillLabel(r)}${r.main&&r.inherit?' <span class="common">⇄</span>':''}</td><td>${countCell(r[k],state.density,k)}</td></tr>`).join('')}</tbody></table></div></section>`).join('')}</div>`;}
function tableHTML(r){const rows=filteredRows(r);return state.view==='integrated'?integratedTable(rows):splitTable(rows);}
function render(){
 if(settingsLoadError) {
  document.getElementById('app').innerHTML='<main class="app"><section class="surface" role="alert"><h1>保存設定を読み込めませんでした</h1><p class="help">保存形式またはカード・スキルIDが現在の開発版と一致しません。初期化すると現在の保存内容は上書きされます。</p><p class="help">'+esc(settingsLoadError)+'</p><button class="btn primary" data-action="reset">設定を初期化して続ける</button></section></main>';
  return;
 }
 const r=results();
 const h=data.meta.skillHierarchy;
 const skillStatus=h
  ? '金白の構造上の対応候補 '+h.linked+'/'+h.totalRare+'組（ソース上の白なし '+h.withoutLower+
    '組、構造上の未解決 '+h.unresolved+'組）。独立資料との全件照合は未完です。'
  : '金白スキル辞書は未取得・未適用です。通常ヒントのみで比較します。';
 const previewActive=data.meta.runtimeSources?.events?.mode==='preview';
 const eventStatus=data.meta.previewError
  ? '試用イベントは適用されませんでした。'+data.meta.previewError
  :previewActive
    ? '承認済み実イベントは0件です。未承認の試用候補 '+data.meta.previewEvents.records+'件は正確性未確定です。'
    :data.meta.runtimeSources?.events?.mode==='failed'
      ? '公開イベントJSONの検証に失敗しました。現在のイベント報酬は反映していません。'
      :data.meta.reviewedEventRecords
        ? '承認済み実イベント '+data.meta.reviewedEventRecords+'件（全件の収録は未確認）。'
        : '承認済み実イベントは0件です（公開JSONの検証成功時）。';
 const previewChainNotice=['facts','results'].includes(window.UmaPreviewRequested)
  ? ' この試用DBでは連続イベントの選択による後続分岐・打ち切りをまだ復元していません。表示される全候補が同じ育成で選択可能とは限りません。'
  : '';
 const previewBanner=window.UmaPreviewRequested
  ? '<div class="notice" role="alert" id="candidate-preview-warning"><strong>開発用・未承認イベントの試用モードです。</strong> イベントID・後続条件・スキル報酬には未検証部分があり、実ゲームでの獲得を保証しません。'+previewChainNotice+' 通常版とは保存設定を分離します。 <a href="./live.html">通常版に戻る</a></div>'
  : '';
 document.getElementById('app').innerHTML=`<main class="app"><header class="top"><div><div class="brand">UMA SUPPORT LAB / LIVE SOURCE PROTOTYPE</div><h1>サポカ編成 × スキル可視化</h1><p class="lede">本育成と継承育成のスキル獲得候補を比較します。${previewActive?'開発用イベント候補を試用中です。正式な獲得情報ではありません。':'イベント経路は承認済みデータのみ反映します。'}</p></div><div class="controls top-actions"><button class="btn" data-action="source-health">データの収録状況</button><button class="btn" data-action="owned-manage">所持サポカ管理</button><button class="btn" data-action="reset">設定を初期化</button><button class="btn" data-action="import">JSON読込</button><button class="btn primary" data-action="export">JSON保存</button></div></header>${previewBanner}<div class="notice"><strong>UmaSimの通常ヒントを利用しています。</strong> ${data.cards.length}枚・通常ヒント${data.meta.totalHints}件。${esc(skillStatus)} ${esc(eventStatus)} 段階別ヒント性能は公開元パラメータから表示し、その他のカード性能は未検証です。スキル・サポカの元データは起動時に公開元へアクセスし、レビュー済みイベントは独自JSONから読み込みます。</div>${statsHTML(r)}<div class="deck-grid">${deckHTML('main')}${deckHTML('inherit')}</div>${goalHTML(r)}<section class="surface comparison"><div class="comparison-head"><div><h2>獲得候補スキルの比較</h2><div class="tiny-note">数値＝そのスキルを直接提供する異なるサポカIDの枚数。同じカードの複数経路・複数枠は1枚で集計（枠ごとの経路は詳細で確認可能）。</div></div><div class="switches"><div class="tabs" aria-label="一覧形式"><button data-action="view" data-value="integrated" aria-pressed="${state.view==='integrated'}">統合表</button><button data-action="view" data-value="split" aria-pressed="${state.view==='split'}">左右比較</button></div><div class="tabs" aria-label="表示密度"><button data-action="density" data-value="compact" aria-pressed="${state.density==='compact'}">コンパクト</button><button data-action="density" data-value="detailed" aria-pressed="${state.density==='detailed'}">カード付き</button></div></div></div><div class="filterbar"><input id="skill-search" class="field search" placeholder="スキル名で検索…" aria-label="スキル名で検索" value="${esc(ui.search)}"><label class="filterlabel"><input type="checkbox" id="only-goals" ${ui.onlyGoals?'checked':''}>目標のみ</label><label class="filterlabel"><input type="checkbox" id="only-duplicate" ${ui.onlyDuplicate?'checked':''}>重複・共通のみ</label><select id="skill-tier" class="field skill-filter" aria-label="スキル分類"><option value="all">全分類</option><option value="gold" ${ui.skillTier==='gold'?'selected':''}>金スキル</option><option value="white" ${ui.skillTier==='white'?'selected':''}>白スキル</option><option value="unknown" ${ui.skillTier==='unknown'?'selected':''}>分類未確認</option></select><select id="skill-route" class="field skill-filter" aria-label="スキルの直接提供経路"><option value="all">全経路</option><option value="hint" ${ui.skillRoute==='hint'?'selected':''}>通常ヒント</option><option value="event" ${ui.skillRoute==='event'?'selected':''}>選択済みイベント</option><option value="both" ${ui.skillRoute==='both'?'selected':''}>通常ヒント＋イベント</option></select><select id="skill-coverage" class="field skill-filter" aria-label="スキルのカバー状態"><option value="all">全カバー</option><option value="direct" ${ui.skillCoverage==='direct'?'selected':''}>直接提供あり</option><option value="indirect" ${ui.skillCoverage==='indirect'?'selected':''}>間接のみ</option><option value="uncovered" ${ui.skillCoverage==='uncovered'?'selected':''}>未カバーの目標</option><option value="conditional" ${ui.skillCoverage==='conditional'?'selected':''}>条件付き経路あり</option></select><select id="skill-sort" class="field skill-filter" aria-label="スキル一覧の並べ替え"><option value="name">スキル名順</option><option value="total-desc" ${ui.skillSort==='total-desc'?'selected':''}>提供合計が多い順</option><option value="main-desc" ${ui.skillSort==='main-desc'?'selected':''}>本育成が多い順</option><option value="inherit-desc" ${ui.skillSort==='inherit-desc'?'selected':''}>継承育成が多い順</option><option value="goals-first" ${ui.skillSort==='goals-first'?'selected':''}>目標を先頭</option></select><span class="tiny-note">${filteredRows(r).length} 件表示</span></div><div id="table-region">${tableHTML(r)}</div><div class="summary-legend"><span><b>2以上</b> デッキ内重複</span><span><span class="common">✓</span> デッキ間共通</span><span>金スキル → インデントした下位スキル（それぞれ独立集計）</span><span>☆ 目標</span><span>「条件付のみ」は成功・失敗等に依存</span></div></section><footer class="footer">検証用PoC · 通常ヒントとスキル辞書（構造候補） · イベントは承認済み分のみ表示 · 外部取得失敗時は検証済み保存版を使用</footer></main><input id="import-file" type="file" accept="application/json,.json" hidden><div id="modal-layer"></div>`;renderModal();}
function refreshTable(){let r=results();document.getElementById('table-region').innerHTML=tableHTML(r);document.querySelector('.filterbar .tiny-note').textContent=`${filteredRows(r).length} 件表示`;}
function titleModal(title,subtitle,body,foot=''){document.getElementById('modal-layer').innerHTML=`<div class="overlay" data-action="close-overlay"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><div><h2>${esc(title)}</h2><div class="modal-sub">${esc(subtitle)}</div></div><button class="btn tiny" data-action="close">閉じる ×</button></div><div class="modal-body">${body}</div>${foot?`<div class="modal-foot">${foot}</div>`:''}</section></div>`;}
function ownedLabel(c){
 const rec=state.ownedCards[c.id];
 return rec?.status==='owned'?'所持 '+rec.stage+'凸':rec?.status==='unowned'?'未所持':'未登録';
}
function matchOwned(c){return window.UmaCardSearch.matches(c,data,{query:ui.ownedQuery,skillQuery:ui.ownedSkillQuery,route:ui.ownedRoute,rarity:ui.ownedRarity,type:ui.ownedType,ownership:ui.ownedFilter},state.ownedCards);}
function ownedCardHtml(c){
 const rec=state.ownedCards[c.id],status=rec?.status||'unregistered';
 return `<article class="owned-card" data-owned-id="${esc(c.id)}">${cardIcon(c,true)}<div class="owned-card-detail"><strong>${esc(c.name)}</strong><span class="muted">${esc(c.type)} · ${esc(c.rarity)}</span><div class="owned-states" role="group" aria-label="${esc(c.name)}の所持状態">${[['owned','所持'],['unowned','未所持'],['unregistered','未登録']].map(([k,name])=>`<button type="button" class="btn tiny" data-action="owned-status" data-id="${esc(c.id)}" data-status="${k}" aria-pressed="${status===k}">${name}</button>`).join('')}</div>${status==='owned'?`<label class="owned-stage">所持凸 <select class="field" data-owned-stage="${esc(c.id)}" aria-label="${esc(c.name)}の所持凸">${[0,1,2,3,4].map(i=>`<option value="${i}" ${rec.stage===i?'selected':''}>${i}凸</option>`).join('')}</select></label>`:''}</div></article>`;
}
function filteredOwned(){return data.cards.filter(matchOwned);}
function ownedGridHtml(){
 const candidates=filteredOwned(),pageSize=36;
 const pages=Math.max(1,Math.ceil(candidates.length/pageSize));
 ui.ownedPage=Math.max(0,Math.min(ui.ownedPage,pages-1));
 const visible=candidates.slice(ui.ownedPage*pageSize,(ui.ownedPage+1)*pageSize);
 const total=Object.values(state.ownedCards).filter(x=>x.status==='owned').length;
 return `<div class="tiny-note">登録済み所持 ${total} / ${data.cards.length}枚 · 条件一致 ${candidates.length}枚 · ${ui.ownedPage+1} / ${pages}ページ（1ページ最大36枚）</div><div class="owned-grid">${visible.map(ownedCardHtml).join('')||'<p class="help">該当するカードがありません。フィルターを変えてください。</p>'}</div><div class="owned-pages"><button class="btn tiny" data-action="owned-prev" ${ui.ownedPage===0?'disabled':''}>前へ</button><span class="tiny-note">${ui.ownedPage+1} / ${pages}</span><button class="btn tiny" data-action="owned-next" ${ui.ownedPage===pages-1?'disabled':''}>次へ</button></div>`;
}
function refreshOwnedGrid(){
 const el=document.getElementById('owned-results');if(el)el.innerHTML=ownedGridHtml();
}
function ownedManagerModal(){
 const rarities=[...new Set(data.cards.map(c=>c.rarity))].sort();
 const types=[...new Set(data.cards.map(c=>c.type))].sort();
 const opts=(list,chosen)=>list.map(v=>`<option value="${esc(v)}" ${v===chosen?'selected':''}>${esc(v==='all'?'すべて':v)}</option>`).join('');
 const routes=[['all','すべての獲得経路'],['hint','通常ヒント'],['event','承認済みイベント'],['both','通常ヒント＋承認済みイベント']];
 const routeOptions=routes.map(([v,label])=>`<option value="${v}" ${ui.ownedRoute===v?'selected':''}>${label}</option>`).join('');
 const body=`<p class="help">所持・未所持・未登録を区別して記録します。所持凸は編成内の想定凸とは独立です。カード画像の代わりに現在はキャラクター略字を表示しています。</p><div class="owned-filters"><input id="owned-search" class="field search" placeholder="カード名・キャラクター名…" aria-label="所持サポカ検索" value="${esc(ui.ownedQuery)}"><input id="owned-skill-search" class="field search" placeholder="提供スキル名・ID…" aria-label="提供スキル名で検索" value="${esc(ui.ownedSkillQuery)}"><select class="field" id="owned-route" aria-label="獲得経路">${routeOptions}</select><select class="field" id="owned-rarity" aria-label="レアリティ">${opts(['all',...rarities],ui.ownedRarity)}</select><select class="field" id="owned-type" aria-label="タイプ">${opts(['all',...types],ui.ownedType)}</select><select class="field" id="owned-filter" aria-label="所持状況">${[['all','すべて'],['owned','所持'],['unowned','未所持'],['unregistered','未登録']].map(([v,t])=>`<option value="${v}" ${ui.ownedFilter===v?'selected':''}>${t}</option>`).join('')}</select></div><p class="tiny-note">「提供スキル」は照合済み通常ヒントと公開承認済みイベントだけを対象にします。未承認イベントや参考候補は含めません。イベントで候補0件は「イベントが存在しない」意味ではありません。</p><div class="owned-bulk"><span class="tiny-note">一括操作は表示中のページではなく、<b>検索条件に一致する全カード</b>が対象です。確認後に適用します。</span><button class="btn tiny" data-action="owned-bulk" data-status="owned">一致する全件を所持に</button><button class="btn tiny" data-action="owned-bulk" data-status="unowned">全件を未所持に</button><button class="btn tiny" data-action="owned-bulk" data-status="unregistered">全件を未登録に</button></div><div id="owned-results">${ownedGridHtml()}</div>`;
 titleModal('所持サポカを一括登録',data.cards.length+'枚を検索・整理',body);
}
function pickerMatches(){
 return window.UmaCardSearch.filterCards(data.cards,data,{query:ui.pickerSearch,skillQuery:ui.pickerSkillQuery,rarity:ui.pickerRarity,type:ui.pickerType,route:ui.pickerRoute,ownership:ui.pickerOnlyOwned?'owned':'all'},state.ownedCards);
}
function pickerFiltersHtml(){
 const rarities=[...new Set(data.cards.map(c=>c.rarity))].sort(),types=[...new Set(data.cards.map(c=>c.type))].sort();
 const opts=(list,current)=>list.map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(v==='all'?'すべて':v)}</option>`).join('');
 const routeOptions=[['all','全経路'],['hint','通常ヒント'],['event',window.UmaPreviewActive?'未承認候補イベント':'承認済みイベント'],['both',window.UmaPreviewActive?'通常ヒント＋未承認候補':'通常ヒント＋承認済みイベント']].map(([v,t])=>`<option value="${v}" ${ui.pickerRoute===v?'selected':''}>${t}</option>`).join('');
 return `<div class="picker-filters"><input class="field search" id="picker-search" placeholder="カード名・キャラクター…" aria-label="カードを検索" value="${esc(ui.pickerSearch)}"><input class="field search" id="picker-skill-search" placeholder="提供スキル名・ID…" aria-label="編成候補の提供スキル検索" value="${esc(ui.pickerSkillQuery)}"><select id="picker-route" class="field" aria-label="編成候補の獲得経路">${routeOptions}</select><select id="picker-rarity" class="field" aria-label="編成候補のレアリティ">${opts(['all',...rarities],ui.pickerRarity)}</select><select id="picker-type" class="field" aria-label="編成候補のタイプ">${opts(['all',...types],ui.pickerType)}</select><label class="filterlabel"><input type="checkbox" id="picker-only-owned" ${ui.pickerOnlyOwned?'checked':''}>所持サポカのみ表示</label></div><p class="tiny-note">提供スキルの絞り込みは照合済み通常ヒントと${window.UmaPreviewActive?'未承認の開発用イベント候補':'承認済みイベント'}のみ。参考スキルは検索対象にしません。</p>`;
}
function pickerCardsHtml(){
 const matched=pickerMatches(),perPage=120,pages=Math.max(1,Math.ceil(matched.length/perPage));
 ui.pickerPage=Math.max(0,Math.min(ui.pickerPage,pages-1));
 const shown=matched.slice(ui.pickerPage*perPage,(ui.pickerPage+1)*perPage);
 return `<p class="tiny-note">候補 ${matched.length} 件 / ${ui.pickerPage+1} / ${pages} ページ（1ページ最大120枚）</p><div class="picker-list">${shown.map(pickerCard).join('')||'<p class="help">該当なし</p>'}</div><div class="owned-pages"><button class="btn tiny" data-action="picker-prev" ${ui.pickerPage===0?'disabled':''}>前へ</button><span class="tiny-note">${ui.pickerPage+1} / ${pages}</span><button class="btn tiny" data-action="picker-next" ${ui.pickerPage===pages-1?'disabled':''}>次へ</button></div>`;
}
function pickerModal(){
 const {deckKey,index}=ui.modal,d=activeDeck(deckKey),selected=d.slots[index];
 const body=`<p class="help">${scopeLabel[deckKey]}のスロット${index+1}に設定するサポカを選択。所持・未所持に関係なく編成できます。所持凸はこの枠の想定凸を自動変更しません。</p>${pickerFiltersHtml()}<div id="picker-cards">${pickerCardsHtml()}</div>`;
 titleModal('サポカを選択',`${scopeLabel[deckKey]} / スロット${index+1}`,body,selected.cardId?`<button class="btn danger" data-action="remove-card" data-deck="${deckKey}" data-index="${index}">この枠を空にする</button>`:'');
}
function pickerCard(c){return `<button class="picker-card" data-action="set-card" data-id="${c.id}">${cardIcon(c)}<span><strong>${esc(c.name)}</strong><br><small class="muted">${esc(c.type)} · ${esc(c.rarity)} · ${c.sourceStatus?.startsWith('verified_hints')?'通常ヒント'+c.hints.length+'件':'通常ヒント未収録'} · ${ownedLabel(c)}</small></span></button>`;}
function pickerRefresh(){
 const el=document.getElementById('picker-cards');if(el)el.innerHTML=pickerCardsHtml();
}
function eventRewardHTML(rewards){if(!rewards||!rewards.length)return window.UmaPreviewActive
 ? '<span class="muted">資料にヒント記載なし（実ゲームの獲得可否は不明）</span>'
 : '<span class="muted">スキル獲得なし</span>';return rewards.map(r=>`${esc(data.skillById[r.skillId]?.name||r.skillId)}${r.kind==='negative'?'（マイナススキル付与）':r.kind==='obtained'?'（スキル直接習得）':r.level?`（ヒントLv.${r.level}）`:''}${r.condition?` <span class="tag condition">${esc(r.condition)}</span>`:''}`).join(' / ');}
function eventCandidateHTML(part){
 const guaranteed=(part.rewards||[]).length?eventRewardHTML(part.rewards):'';
 const alternatives=(part.outcomes||[]).map(o=>`<span class="tag condition">${esc(o.label)}時</span> ${eventRewardHTML(o.rewards)}`).join(' / ');
 return [guaranteed,alternatives].filter(Boolean).join(' / ')||
  (window.UmaPreviewActive?'<span class="muted">資料にヒント記載なし（実ゲームの獲得可否は不明）</span>':
   '<span class="muted">スキル獲得なし</span>');
}
function resultSelector(part,slot,k,i,event,active,card){
 if(!part||!Array.isArray(part.outcomes))return '';
 const current=slot.outcomes?.[event.id]||'';
 return '<label class="tiny-note">結果を指定： <select class="field" data-event-outcome data-deck="'+k+
  '" data-index="'+i+'" data-event="'+esc(event.id)+'" '+(!active?'disabled':'')+'>'+
  '<option value="" '+(!current?'selected':'')+'>結果未確定（候補）</option>'+
  part.outcomes.map(o=>{
   const state=core.outcomeReachability(o,event,slot.choices,card.events,slot.outcomes||{});
   const disabled=state.status==='blocked';
   return '<option value="'+esc(o.id)+'" '+(current===o.id&&!disabled?'selected':'')+
    (disabled?' disabled':'')+'>'+esc(o.label)+
    (disabled?'（前段結果と両立しません）':state.status==='conditional'?'（前段結果未確定）':'')+
    (o.terminal?'（連続終了）':'')+'</option>';
  }).join('')+'</select></label>';
}

function eventHTML(card,slot,k,i,onlyEventId=null){
 return card.events.filter(e=>onlyEventId===null||e.id===onlyEventId).map(e=>{
  const progress=core.reachability(e,slot.choices,card.events,slot.outcomes||{});
  const blocked=progress.status==='blocked',conditional=progress.status==='conditional';
  const selected=e.type==='choice'?slot.choices[e.id]:null;
  const selectedPart=e.type==='auto'?e:e.choices.find(c=>c.id===selected);
  const status=blocked?'到達不可':conditional?'条件付き到達':e.type==='auto'?'自動集計':selected?'設定済み':'未設定';
  const requirements=e.requires?(e.requires.all||[e.requires]).map(r=>esc(r.eventId)+
   (r.choiceId?' → '+esc(r.choiceId):'')+(r.outcomeId?' / '+esc(r.outcomeId)+'時':'')).join(' ＋ '):'';
  const intro='<div class="event '+(blocked?'dim':'')+'"><div class="event-head"><h3>'+esc(e.name)+'</h3><span class="'+(e.type==='auto'?'auto':'slot-badge')+'">'+status+'</span></div>'+
    (requirements?'<div class="tiny-note">必要条件：'+requirements+'</div>':'')+
    (conditional?'<div class="tiny-note">仮定：'+esc(progress.conditions.join(' / '))+'。確定した報酬には含めません。</div>':'');
  if(e.type==='auto')return intro+'<div class="help" style="margin-top:7px">獲得候補：'+eventCandidateHTML(e)+'</div>'+
    resultSelector(e,slot,k,i,e,!blocked,card)+'</div>';
  const unknown='<label class="option"><input type="radio" data-event-choice data-deck="'+k+'" data-index="'+i+'" data-event="'+esc(e.id)+'" value="" '+(!selected?'checked':'')+(blocked?' disabled':'')+'><span>未設定<small>このイベント由来のスキルは集計しません</small></span></label>';
  const options=e.choices.filter(opt=>core.choiceReachability(opt,e,slot.choices,card.events,slot.outcomes||{}).status!=='blocked')
   .map(opt=>{
    const availability=core.choiceReachability(opt,e,slot.choices,card.events,slot.outcomes||{});
    const note=availability.status==='conditional'?'（前段結果によって選択可能）':'';
    return '<label class="option"><input type="radio" data-event-choice data-deck="'+k+'" data-index="'+i+'" data-event="'+esc(e.id)+'" value="'+esc(opt.id)+'" '+(selected===opt.id?'checked':'')+(blocked?' disabled':'')+'><span>'+
     esc(opt.label)+note+'<small>獲得候補：'+eventCandidateHTML(opt)+(opt.terminal?'（ここで連続イベント終了）':'')+'</small></span></label>';
   }).join('');
  return intro+'<div class="event-options">'+unknown+options+'</div>'+
   resultSelector(selectedPart,slot,k,i,e,!blocked,card)+'</div>';
 }).join('');
}
function hintPerformanceHTML(card,slot){
 const p=card.hintPerformanceByStage?.[String(slot.stage)];
 if(!p)return '<div class="info-item"><strong>ヒント関連性能</strong><div class="sub">未収録・不明</div></div>';
 const hintLevel=1+p.levelBase+p.levelUnique;
 return `<div class="info-item"><strong>ヒント関連性能（${slot.stage}凸）</strong><div class="sub">通常ヒント取得Lv：基礎 Lv.${hintLevel}（ヒントLvアップ：基本 +${p.levelBase} / 固有 +${p.levelUnique}）</div><div class="sub">ヒント発生率アップ：基本 ${p.frequencyBase}% / 固有 ${p.frequencyUnique}%</div><p class="help">公開シミュレータの段階別パラメータ。発生率の確率推定ではありません。シナリオ効果・特殊な条件付き効果は含みません。</p></div>`;
}
function editCardModal(){const {deckKey,index}=ui.modal,sl=activeDeck(deckKey).slots[index],c=data.cardById[sl.cardId];if(!c){ui.modal={kind:'pick',deckKey,index};return pickerModal();}let r=core.directRoutes(c,sl);const body=`<div class="flex">${cardIcon(c)}<div><strong>${esc(c.character)}</strong><div class="muted">${esc(c.type)} / ${esc(c.rarity)} / ${esc(c.dataStatus||'獲得条件未検証')}</div></div></div><div class="select-row"><label for="stage-select">想定性能解放：</label><select class="field stage" id="stage-select" data-stage data-deck="${deckKey}" data-index="${index}">${[0,1,2,3,4].map(x=>`<option value="${x}" ${sl.stage===x?'selected':''}>${x}凸</option>`).join('')}</select><span class="tiny-note">ヒント関連性能を解放段階別に表示（提供枚数には加算しません）</span></div><div class="info-item"><strong>照合済み通常ヒント（自動集計）</strong><div class="sub">${hintDetailText(c,sl)}</div></div>${hintPerformanceHTML(c,sl)}${c.referenceSkills?.length?`<div class="info-item"><strong>参考：スキル候補（集計対象外）</strong><div class="sub">${c.referenceSkills.map(esc).join(' / ')}</div><p class="help">古い公開カード一覧由来。通常ヒントとイベント報酬が混在する可能性があるため集計には加えません。</p></div>`:''}<h3 style="margin:15px 0 6px">イベント選択と分岐</h3><p class="help">選択式イベントは初期状態では未設定。${window.UmaPreviewActive?'このイベントは開発用の仮データです。進行条件と報酬には実ゲームで未確認の部分があります。':'公開データの候補分岐であり、実ゲーム上のイベント選択・到達関係とは未照合です。'}</p>${eventHTML(c,sl,deckKey,index)}<div class="info-item"><strong>現在の獲得候補</strong><div class="sub">${r.length?r.map(x=>`${esc(data.skillById[x.skillId].name)}${x.conditional?`［${esc(x.condition)}］`:''}`).join(' / '):'候補なし'}</div></div>`;
 titleModal(c.name,`${scopeLabel[deckKey]} / スロット ${index+1}`,body,`<button class="btn danger" data-action="remove-card" data-deck="${deckKey}" data-index="${index}">この枠を空にする</button><button class="btn primary" data-action="pick" data-deck="${deckKey}" data-index="${index}">カードを入れ替える</button>`);}
function deckEventsModal(){
 const k=ui.modal.deckKey,deck=activeDeck(k);
 const {cards,totals}=window.UmaDeckEvents.summarize(deck,data,core);
 const filter=ui.eventFilter||'all';
 const countChoices=deck.slots.reduce((a,s)=>a+Object.keys(s.choices||{}).length+Object.keys(s.outcomes||{}).length,0);
 const chooser=[['all','すべて'],['pending','未設定'],['configured','設定済み'],['conditional','条件付き到達'],['blocked','到達不可'],['automatic','自動候補'],['unknown','イベント未収録']];
 const bar=`<div class="event-overview-stats"><span>選択肢の未設定 <b>${totals.pending}</b></span><span>設定済み <b>${totals.configured}</b></span><span>条件付き到達 <b>${totals.conditional}</b></span><span>到達不可 <b>${totals.blocked}</b></span><span>自動候補 <b>${totals.automatic}</b></span><span>イベント未収録のカード <b>${totals.unknown}</b></span><span>条件付きの報酬経路 <b>${totals.conditionalRoutes}</b></span></div>`;
 const controls=`<div class="event-overview-controls"><label>表示 <select id="event-status-filter" class="field" aria-label="イベント状態の絞り込み">${chooser.map(([v,n])=>`<option value="${v}" ${filter===v?'selected':''}>${n}</option>`).join('')}</select></label><button class="btn tiny danger" data-action="deck-events-reset" data-deck="${k}" ${countChoices===0?'disabled':''}>このデッキの選択を全解除（${countChoices}件）</button></div>`;
 const content=cards.flatMap(info=>{
  const i=info.index,sl=deck.slots[i],c=sl.cardId&&data.cardById[sl.cardId];
  if(!c){return filter==='all'?['<div class="info-item"><strong>スロット'+(i+1)+'：空</strong></div>']:[];}
  if(filter==='unknown'&&!info.unknown||filter!=='unknown'&&filter!=='all'&&!info[filter])return [];
  const chosen=Object.keys(sl.choices||{}).length+Object.keys(sl.outcomes||{}).length;
  const infoLine=info.unknown?'イベント未収録（存在しないという意味ではありません）':
    '選択未設定 '+info.pending+' / 設定済み '+info.configured+' / 条件付き到達 '+info.conditional+' / 到達不可 '+info.blocked+' / 自動 '+info.automatic;
  const events=info.unknown?'<p class="help">このカードに公開承認済みイベントの記録はありません。ゲーム内イベントが無いという意味ではありません。</p>':
    c.events.filter(e=>filter==='all'||filter==='unknown'||info.events.some(x=>x.id===e.id&&x.status===filter)).map(e=>eventHTML(c,sl,k,i,e.id)).join('');
  // Always evaluate reachability against the FULL card graph, including hidden prerequisites.
  return [`<section class="info-item event-slot" data-event-slot="${i}"><div class="flex">${cardIcon(c,true)}<strong>${esc(c.name)}</strong><span class="slot-badge">スロット${i+1}</span></div><div class="tiny-note">${esc(infoLine)}</div>${events}<div class="event-slot-actions"><button class="btn tiny" data-action="edit-card" data-deck="${k}" data-index="${i}">カード詳細</button><button class="btn tiny danger" data-action="deck-event-slot-reset" data-deck="${k}" data-index="${i}" ${chosen===0?'disabled':''}>このカードの選択を解除（${chosen}件）</button></div></section>`];
 }).join('')||'<p class="help">この条件に該当するイベント記録はありません。情報未収録と実ゲームに存在しないことは別です。</p>';
 const body=`<p class="help">現在選択中の「${esc(deck.name)}」の6枚を確認します。各カード詳細と同じ選択値を使い、別デッキには反映しません。自動候補は到達条件を満たした場合のみ集計され、条件付き報酬は獲得確定ではありません。公開承認済みイベントがないカードは「未収録」と表示します。</p>${bar}${controls}<div id="deck-event-results">${content}</div>`;
 titleModal('デッキ全体のイベント設定',scopeLabel[k]+' / '+deck.name,body);
}
function reverseCards(id){
 return data.cards.flatMap(c=>{
  const hint=window.UmaCardSearch.normalHintIds(c,data).has(id);
  const event=window.UmaCardSearch.approvedEventSkillIds(c,data).has(id);
  if(!hint&&!event||ui.reverseOnlyOwned&&window.UmaSettings.ownedStatus(state,c.id)!=='owned')return [];
  if(ui.reverseRoute==='hint'&&!hint||ui.reverseRoute==='event'&&!event)return [];
  return [{card:c,hint,event}];
 });
}
function skillDetailModal(){
 const id=ui.modal.id,skill=data.skillById[id],r=results(),reverse=reverseCards(id);
 if(!skill){titleModal('詳細不明','スキルIDを確認できません','<p class="help">現在のスキル辞書には存在しません。</p>');return;}
 const scopes=['main','inherit'].map(k=>{
  const item=r[k][id],cov=core.coverage(id,r[k],data);
  return `<div class="info-item" style="margin-bottom:10px"><strong>${scopeLabel[k]}</strong><div class="sub">${item?`直接提供：${item.count}枚${item.conditionalOnly?'（すべて条件付き）':''}`:cov.kind==='indirect'?'上位スキル経由の間接カバー':'直接提供なし'}</div>${item&&Object.keys(item.providers).length>item.count?'<p class="tiny-note">同じサポカが複数枠にあります。提供枚数はカードIDで重複排除し、以下の経路は枠ごとに表示します。</p>':''}${item?Object.values(item.providers).map(p=>`<div style="margin:10px 0"><b>${esc(data.cardById[p.cardId].name)}（スロット${p.slotIndex+1}）</b><div class="sub">${p.routes.map(x=>`${x.source==='hint'?'通常ヒント':esc(x.eventName)+(x.choiceLabel?' / '+esc(x.choiceLabel):'')}${x.kind==='obtained'?' · スキル直接習得':x.level?` · ヒントLv.${x.level}`:''}${x.conditional?' · '+esc(x.condition):''}`).join(' / ')}</div></div>`).join(''):''}</div>`;
 }).join('');
 const reverseHtml=reverse.map(({card:c,hint,event})=>`<div class="info-item flex">${cardIcon(c,true)}<div class="grow"><b>${esc(c.name)}</b><div class="sub">${[hint?'通常ヒント（0～4凸のいずれか）':'',event?'公開承認済みイベント（分岐・到達条件あり）':''].filter(Boolean).join(' / ')} · ${esc(ownedLabel(c))}</div></div><button class="btn tiny" data-action="assign" data-id="${esc(c.id)}">編成へ</button></div>`).join('')||'<p class="help">選択した条件に該当するサポカがありません。情報未収録とゲーム内に存在しないことは別です。</p>';
 const filterHtml=`<div class="reverse-filter"><label class="filterlabel"><input type="checkbox" id="reverse-only-owned" ${ui.reverseOnlyOwned?'checked':''}>所持サポカのみ</label><select class="field" id="reverse-route" aria-label="逆引きの獲得経路"><option value="all">全経路</option><option value="hint" ${ui.reverseRoute==='hint'?'selected':''}>通常ヒント</option><option value="event" ${ui.reverseRoute==='event'?'selected':''}>公開承認済みイベント</option></select><span class="tiny-note">${reverse.length}枚</span></div>`;
 const upper=data.skills.filter(s=>s.lowerId===id);
 const body=`<p class="help">現在の編成で選択済みの直接提供枚数と、全サポカの提供経路を区別します。逆引きの通常ヒントは0～4凸いずれかのデータであり、現在の編成の解放段階やイベント到達・実獲得を保証しません。</p>${scopes}<h3 style="margin:15px 0 9px">全カードから逆引き</h3>${filterHtml}<div class="info-list">${reverseHtml}</div>${upper.length?`<div class="info-item" style="margin-top:11px"><strong>上位スキル経由</strong><div class="sub">${upper.map(s=>esc(s.name)).join(' / ')} からの間接カバーは、直接提供枚数には加算しません。</div></div>`:''}${skill.lowerId?`<div class="info-item" style="margin-top:11px">下位スキル：${esc(data.skillById[skill.lowerId]?.name||skill.lowerId)}</div>`:''}`;
 titleModal(skill.name,skill.tier==='gold'?'金スキル':'スキル詳細',body);
}
function assignModal(){const c=data.cardById[ui.modal.cardId];const body=`<p class="help">${esc(c.name)}をどの枠へ配置しますか？選んだ枠に登録済みのカードは置き換わります。</p><div class="picker-list">${['main','inherit'].flatMap(k=>activeDeck(k).slots.map((sl,i)=>`<button class="picker-card" data-action="assign-slot" data-deck="${k}" data-index="${i}"><span class="grow"><b>${scopeLabel[k]} · ${i+1}番枠</b><br><small class="muted">${sl.cardId?esc(data.cardById[sl.cardId].name):'空スロット'}</small></span><span>→</span></button>`)).join('')}</div>`;titleModal('配置先を選択',c.name,body);}
function deckManagerModal(){
 const k=ui.modal.deckKey,d=activeDeck(k);
 const body=`<p class="help">${scopeLabel[k]}の保存済みデッキを管理します。編成6枠、凸段階、イベント選択はデッキごとに独立し、目標セットも変更されません。</p><div class="select-row"><label for="deck-name">デッキ名：</label><input class="field grow" id="deck-name" maxlength="60" value="${esc(d.name)}"><button class="btn tiny" data-action="deck-rename" data-deck="${k}">名前を保存</button></div><div class="select-row"><button class="btn tiny" data-action="deck-new" data-deck="${k}" ${state.decks[k].length>=window.UmaSettings.MAX_DECKS?'disabled':''}>空のデッキを作成</button><button class="btn tiny" data-action="deck-copy" data-deck="${k}" ${state.decks[k].length>=window.UmaSettings.MAX_DECKS?'disabled':''}>現在のデッキを複製</button><button class="btn tiny danger" data-action="deck-delete" data-deck="${k}" ${state.decks[k].length===1?'disabled':''}>現在のデッキを削除</button></div><p class="tiny-note">保存件数：${state.decks[k].length} / ${window.UmaSettings.MAX_DECKS}。最後の1件は削除できません。削除するとそのデッキの選択状態も失われます。</p>`;
 titleModal(`${scopeLabel[k]}デッキを管理`,d.name,body);
}
function sourceHealthModal(){
 const h=window.UmaSourceHealth.summarize(data);
 const section=(id,title,status,rows)=>'<section class="info-item" id="'+id+'"><h3>'+esc(title)+'</h3><strong class="source-health-state">'+esc(status)+'</strong><dl class="source-health-detail">'+rows.map(([a,b])=>'<div><dt>'+esc(a)+'</dt><dd>'+esc(b)+'</dd></div>').join('')+'</dl></section>';
 const c=h.cards,sk=h.skills,ev=h.events;
 const body='<p class="help">'+esc(h.disclaimer)+'</p>'+
 section('source-status-cards','サポカ・通常ヒント',c.label,[['採用公開元カード',c.count+'枚'],['0～4凸ヒント5段階',c.stageComplete+' / '+c.count+'枚'],['段階別ヒント性能',c.hintPerformanceComplete+' / '+c.count+'枚'],['4凸の通常ヒント記録',c.hints4===null?'不明':c.hints4+'件'],['受信日時',c.fetchedAt||'記録なし'],['確認日時',c.checkedAt||'記録なし'],['公開元',c.sourceUrl||'不明']])+
 section('source-status-skills','数値スキル辞書',sk.label,[['アプリ内スキル候補',sk.count+'件（通常ヒント由来も含む）'],['金白関係の構造候補',sk.hierarchyPairs===null?'未適用':sk.hierarchyPairs+' / '+sk.hierarchyTotal+'組'],['受信日時',sk.fetchedAt||'記録なし'],['公開元',sk.sourceUrl||'不明']])+
 section('source-status-events','公開承認済みイベントJSON',ev.label,[['検証済みイベント',ev.records===null?'検証不能・件数未確定':ev.records+'件'],['収録済みカード',ev.cards===null?'検証不能・件数未確定':ev.cards+'枚'],['モデルに反映したイベント',ev.attachedRecords+'件'],['公開元',ev.sourceUrl||'不明']])+
 '<p class="help">この画面は現在のブラウザが利用するデータの状態です。更新ボタンではありません。通信障害時には検証済みキャッシュを再利用します。</p>';
 titleModal('データの収録・取得状況','現在のブラウザの利用データ',body);
}
function goalsModal(){const g=goalSet();let all=data.skills.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');const body=`<p class="help">目標セットはデッキとは独立して保存されます。サポカを入れ替えるとカバー判定が更新されます。</p><div class="select-row"><label for="goals-modal-select">編集中のセット：</label><select id="goals-modal-select" class="field grow" aria-label="編集する目標セット">${state.goalSets.map(x=>`<option value="${esc(x.id)}" ${x.id===state.currentGoalSet?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div><div class="select-row"><label>セット名：</label><input class="field" id="goal-set-name" value="${esc(g.name)}"><button class="btn tiny" data-action="rename-goal-set">名称を保存</button></div><div class="select-row"><button class="btn tiny" data-action="duplicate-goal-set" ${state.goalSets.length>=window.UmaSettings.MAX_GOAL_SETS?'disabled':''}>現在のセットを複製</button><button class="btn tiny" data-action="new-goal-set" ${state.goalSets.length>=window.UmaSettings.MAX_GOAL_SETS?'disabled':''}>空のセットを作成</button>${state.goalSets.length>1?'<button class="btn tiny danger" data-action="delete-goal-set">現在のセットを削除</button>':''}</div><hr class="sep">${g.goals.map((x,i)=>`<div class="goal-edit"><span class="goal-name">${esc(data.skillById[x.skillId].name)}</span><select class="field" data-goal-scope="${i}">${Object.entries(scopeLabel).filter(([k])=>['main','inherit','either','both'].includes(k)).map(([k,n])=>`<option value="${k}" ${k===x.scope?'selected':''}>${n}</option>`).join('')}</select><button class="btn tiny" data-action="delete-goal" data-index="${i}">削除</button></div>`).join('')||'<p class="help">登録済みの目標はありません。</p>'}<div class="select-row" style="margin-top:15px"><select id="new-goal-skill" class="field grow" aria-label="追加するスキル">${all}</select><select id="new-goal-scope" class="field" aria-label="目標の対象デッキ">${Object.entries(scopeLabel).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><button class="btn primary" data-action="add-goal">目標を追加</button></div>`;
 titleModal('目標スキルセットを編集',g.name,body);}
function importPreviewModal(){
 const v=ui.importCandidate,proposal=ui.importPreview;
 if(!v){titleModal('JSON読込','ファイルなし','<p class="help">ファイルを選び直してください。</p>');return;}
 const incoming=v.decks.main.length+v.decks.inherit.length,existing=state.decks.main.length+state.decks.inherit.length;
 const help='<p class="help">「統合」は今の編成選択・目標セット選択・画面表示を保ち、読込デッキと目標セットを別IDで追加します。所持状態の衝突は現在の記録を優先し、まだ未登録のカードだけ補完します。「置き換え」は今の設定をすべて取り替えます。</p>';
 const summary=`<div class="info-item"><strong>読み込むファイル（検証済み）</strong><div class="sub">デッキ ${incoming}件（本育成 ${v.decks.main.length} / 継承育成 ${v.decks.inherit.length}）、目標セット ${v.goalSets.length}件、所持記録 ${Object.keys(v.ownedCards).length}件</div></div><div class="info-item"><strong>現在の設定</strong><div class="sub">デッキ ${existing}件、目標セット ${state.goalSets.length}件、所持記録 ${Object.keys(state.ownedCards).length}件</div></div>`;
 const explanation=proposal?.error?`<p class="help bad" role="alert">統合不可：${esc(proposal.error)}</p>`:`<p class="help">統合するとデッキ ${proposal.report.decksAdded}件、目標セット ${proposal.report.goalSetsAdded}件、所持記録 ${proposal.report.ownershipAdded}件を追加。現在の記録を優先する衝突：${proposal.report.ownershipConflictsKept}件。</p>`;
 const foot=`<button class="btn" data-action="import-cancel">キャンセル</button><button class="btn" data-action="import-merge" ${proposal?.error?'disabled':''}>現在の設定に統合</button><button class="btn danger" data-action="import-replace">全設定を置き換え</button>`;
 titleModal('JSON読込：方法を選択','決定するまで保存内容は変わりません',summary+help+explanation,foot);
}
function renderModal(preserveScroll){let scroll=preserveScroll?document.querySelector('.modal-body')?.scrollTop||0:0;if(!ui.modal){document.getElementById('modal-layer').innerHTML='';return}switch(ui.modal.kind){case 'pick':pickerModal();break;case 'edit':editCardModal();break;case 'deck-events':deckEventsModal();break;case 'skill':skillDetailModal();break;case 'assign':assignModal();break;case 'goals':goalsModal();break;case 'source-health':sourceHealthModal();break;case 'deck-manager':deckManagerModal();break;case 'owned-manager':ownedManagerModal();break;case 'import-preview':importPreviewModal();break;}const body=document.querySelector('.modal-body');if(body)body.scrollTop=scroll;}
function changeSelection(el){
 const k=el.dataset.deck,i=Number(el.dataset.index),eid=el.dataset.event,sl=activeDeck(k).slots[i];
 if(!sl?.cardId)return;
 const next=core.clearDependentState(data.cardById[sl.cardId],sl.choices,sl.outcomes||{},eid);
 if(el.value)next.choices[eid]=el.value;else delete next.choices[eid];
 sl.choices=next.choices;sl.outcomes=next.outcomes;
 const scroll=document.querySelector('.modal-body')?.scrollTop||0;store();render();
 const body=document.querySelector('.modal-body');if(body)body.scrollTop=scroll;
}
function changeOutcome(el){
 const k=el.dataset.deck,i=Number(el.dataset.index),eid=el.dataset.event,sl=activeDeck(k).slots[i];
 if(!sl?.cardId)return;
 const next=core.clearDependentState(data.cardById[sl.cardId],sl.choices,sl.outcomes||{},eid);
 if(el.value)next.outcomes[eid]=el.value;
 sl.choices=next.choices;sl.outcomes=next.outcomes;
 const scroll=document.querySelector('.modal-body')?.scrollTop||0;store();render();
 const body=document.querySelector('.modal-body');if(body)body.scrollTop=scroll;
}
function handleAction(el){const a=el.dataset.action,k=el.dataset.deck,i=Number(el.dataset.index);switch(a){
case 'owned-manage':ui.ownedQuery='';ui.ownedSkillQuery='';ui.ownedRoute='all';ui.ownedRarity='all';ui.ownedType='all';ui.ownedFilter='all';ui.ownedPage=0;ui.modal={kind:'owned-manager'};renderModal();break;
 case 'owned-status':window.UmaSettings.setOwnedCard(state,data,el.dataset.id,el.dataset.status,state.ownedCards[el.dataset.id]?.stage??0);store();refreshOwnedGrid();break;
 case 'owned-bulk':{const ids=filteredOwned().map(c=>c.id);const label={owned:'所持',unowned:'未所持',unregistered:'未登録'}[el.dataset.status];if(ids.length&&confirm('検索条件に一致する'+ids.length+'枚すべてを「'+label+'」に変更しますか？')){window.UmaSettings.setOwnedBulk(state,data,ids,el.dataset.status);store();refreshOwnedGrid();}break;}
 case 'picker-prev':ui.pickerPage=Math.max(0,ui.pickerPage-1);pickerRefresh();break;
 case 'picker-next':ui.pickerPage++;pickerRefresh();break;
 case 'owned-prev':ui.ownedPage=Math.max(0,ui.ownedPage-1);refreshOwnedGrid();break;
 case 'owned-next':ui.ownedPage++;refreshOwnedGrid();break;
 case 'close-overlay':ui.modal=null;renderModal();break;
case 'close':ui.modal=null;renderModal();break;
case 'pick':ui.pickerSearch='';ui.pickerSkillQuery='';ui.pickerRarity='all';ui.pickerType='all';ui.pickerRoute='all';ui.pickerPage=0;ui.modal={kind:'pick',deckKey:k,index:i};renderModal();break;
case 'edit-card':ui.modal={kind:'edit',deckKey:k,index:i};renderModal();break;
case 'deck-events':ui.eventFilter='all';ui.modal={kind:'deck-events',deckKey:k};renderModal();break;
 case 'deck-event-slot-reset':{const d=activeDeck(k),slot=d.slots[i],count=Object.keys(slot?.choices||{}).length+Object.keys(slot?.outcomes||{}).length;if(count&&confirm(scopeLabel[k]+'のスロット'+(i+1)+'のイベント選択'+count+'件を解除しますか？')){window.UmaDeckEvents.clearSlot(d,i);store();render();}break;}
 case 'deck-events-reset':{const d=activeDeck(k),count=d.slots.reduce((n,sl)=>n+Object.keys(sl.choices||{}).length+Object.keys(sl.outcomes||{}).length,0);if(count&&confirm(scopeLabel[k]+'の「'+d.name+'」にあるイベント選択'+count+'件をすべて解除しますか？他の保存デッキには影響しません。')){window.UmaDeckEvents.clearDeck(d);store();render();}break;}
 case 'deck-manage':ui.modal={kind:'deck-manager',deckKey:k};renderModal();break;
 case 'deck-new':
 case 'deck-copy':try{window.UmaSettings.addDeck(state,k,a==='deck-copy');saveRender();}catch(e){alert(e.message)}break;
 case 'deck-rename':try{window.UmaSettings.renameDeck(state,k,document.getElementById('deck-name').value);saveRender();}catch(e){alert(e.message)}break;
 case 'deck-delete':if(state.decks[k].length>1&&confirm('「'+activeDeck(k).name+'」を削除しますか？このデッキのスロットとイベント設定も消えます。')){window.UmaSettings.deleteDeck(state,k);saveRender();}break;
case 'set-card':{const sl=activeDeck(ui.modal.deckKey).slots[ui.modal.index];sl.cardId=el.dataset.id;sl.stage=4;sl.choices={};sl.outcomes={};ui.modal=null;saveRender();break;}
case 'remove-card':activeDeck(k).slots[i]=blank();ui.modal=null;saveRender();break;
case 'view':state.view=el.dataset.value;saveRender();break;
case 'density':state.density=el.dataset.value;saveRender();break;
case 'skill':ui.reverseOnlyOwned=false;ui.reverseRoute='all';ui.modal={kind:'skill',id:el.dataset.id};renderModal();break;
case 'assign':ui.modal={kind:'assign',cardId:el.dataset.id};renderModal();break;
case 'assign-slot':activeDeck(k).slots[i]={cardId:ui.modal.cardId,stage:4,choices:{}};ui.modal=null;saveRender();break;
case 'goals':ui.modal={kind:'goals'};renderModal();break;case 'source-health':ui.modal={kind:'source-health'};renderModal();break;
case 'rename-goal-set':try{window.UmaSettings.renameGoalSet(state,document.getElementById('goal-set-name').value);store();render();}catch(e){alert(e.message)}break;
case 'duplicate-goal-set':try{window.UmaSettings.addGoalSet(state,true);store();render();}catch(e){alert(e.message)}break;
case 'new-goal-set':try{window.UmaSettings.addGoalSet(state);store();render();}catch(e){alert(e.message)}break;
case 'delete-goal-set':if(state.goalSets.length>1&&confirm('目標セット「'+goalSet().name+'」を削除しますか？')){window.UmaSettings.deleteGoalSet(state);store();render();}break;
case 'delete-goal':goalSet().goals.splice(i,1);store();render();break;
case 'add-goal':{const skillId=document.getElementById('new-goal-skill').value,scope=document.getElementById('new-goal-scope').value;const exists=goalSet().goals.find(x=>x.skillId===skillId);if(exists)exists.scope=scope;else goalSet().goals.push({skillId,scope});store();render();break;}
case 'export':{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const href=URL.createObjectURL(blob);const link=document.createElement('a');link.href=href;link.download='uma-support-lab-poc-settings.json';link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);break;}
case 'import':document.getElementById('import-file').click();break;
case 'import-cancel':ui.importCandidate=null;ui.importPreview=null;ui.modal=null;renderModal();break;
case 'import-replace':if(ui.importCandidate&&confirm('現在の編成・所持・目標などの全設定を置き換えますか？')){state=ui.importCandidate;settingsLoadError=null;ui.importCandidate=null;ui.importPreview=null;ui.modal=null;saveRender();}break;
case 'import-merge':if(ui.importCandidate){try{const result=window.UmaSettings.merge(state,ui.importCandidate,data);state=result.settings;settingsLoadError=null;ui.importCandidate=null;ui.importPreview=null;ui.modal=null;saveRender();}catch(e){ui.importPreview={error:e.message};renderModal();}}break;
case 'reset':if(confirm('すべての設定を初期状態に戻しますか？')){state=DEFAULT();settingsLoadError=null;ui.modal=null;saveRender();}break;
}}
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el)return;if(el.dataset.action==='close-overlay'&&!e.target.classList.contains('overlay'))return;handleAction(el)});
document.addEventListener('input',e=>{if(e.target.id==='skill-search'){ui.search=e.target.value;refreshTable()}if(e.target.id==='picker-search'){ui.pickerSearch=e.target.value;ui.pickerPage=0;pickerRefresh();}if(e.target.id==='picker-skill-search'){ui.pickerSkillQuery=e.target.value;ui.pickerPage=0;pickerRefresh();}if(e.target.id==='owned-search'){ui.ownedQuery=e.target.value;ui.ownedPage=0;refreshOwnedGrid();}if(e.target.id==='owned-skill-search'){ui.ownedSkillQuery=e.target.value;ui.ownedPage=0;refreshOwnedGrid();}});
document.addEventListener('change',e=>{const el=e.target;if(el.hasAttribute('data-event-choice')){changeSelection(el);return}if(el.hasAttribute('data-event-outcome')){changeOutcome(el);return}if(el.hasAttribute('data-owned-stage')){window.UmaSettings.setOwnedCard(state,data,el.dataset.ownedStage,'owned',Number(el.value));store();return}if(el.id==='picker-only-owned'){ui.pickerOnlyOwned=el.checked;ui.pickerPage=0;pickerRefresh();return}if(['picker-rarity','picker-type','picker-route'].includes(el.id)){ui[{'picker-rarity':'pickerRarity','picker-type':'pickerType','picker-route':'pickerRoute'}[el.id]]=el.value;ui.pickerPage=0;pickerRefresh();return}if(['owned-rarity','owned-type','owned-filter','owned-route'].includes(el.id)){ui[{ 'owned-rarity':'ownedRarity','owned-type':'ownedType','owned-filter':'ownedFilter','owned-route':'ownedRoute'}[el.id]]=el.value;ui.ownedPage=0;refreshOwnedGrid();return}if(el.id==='only-goals'){ui.onlyGoals=el.checked;refreshTable();return}if(el.id==='only-duplicate'){ui.onlyDuplicate=el.checked;refreshTable();return}if(['skill-tier','skill-route','skill-coverage','skill-sort'].includes(el.id)){ui[{'skill-tier':'skillTier','skill-route':'skillRoute','skill-coverage':'skillCoverage','skill-sort':'skillSort'}[el.id]]=el.value;refreshTable();return}if(el.id==='event-status-filter'){ui.eventFilter=el.value;renderModal(true);return}if(el.id==='reverse-only-owned'){ui.reverseOnlyOwned=el.checked;renderModal(true);return}if(el.id==='reverse-route'){ui.reverseRoute=el.value;renderModal(true);return}if(el.id==='goals-modal-select'){if(state.goalSets.some(g=>g.id===el.value)){state.currentGoalSet=el.value;store();render();}return}if(el.id==='goal-set'){state.currentGoalSet=el.value;saveRender();return}if(el.id==='deck-select-main'||el.id==='deck-select-inherit'){const key=el.id==='deck-select-main'?'main':'inherit';window.UmaSettings.selectDeck(state,key,el.value);ui.modal=null;saveRender();return}if(el.hasAttribute('data-stage')){activeDeck(el.dataset.deck).slots[Number(el.dataset.index)].stage=Number(el.value);store();render();return}if(el.hasAttribute('data-goal-scope')){goalSet().goals[Number(el.dataset.goalScope)].scope=el.value;store();render();return}if(el.id==='import-file'){
 const f=el.files?.[0];if(!f)return;el.value='';f.text().then(t=>{let obj;try{obj=JSON.parse(t)}catch(e){alert('JSONを読み取れませんでした。');return}let parsed;try{parsed=window.UmaSettings.parse(obj,data)}catch(e){alert('設定JSONの構造を読み取れませんでした。'+String(e.message||e));return}ui.importCandidate=parsed;try{ui.importPreview={report:window.UmaSettings.merge(state,parsed,data).report}}catch(e){ui.importPreview={error:e.message}}ui.modal={kind:'import-preview'};renderModal();}).catch(()=>alert('ファイルの読み込みに失敗しました。'));
 }});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ui.modal){ui.modal=null;renderModal();}});
render();
})();