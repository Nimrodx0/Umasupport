#!/usr/bin/env python3
"""Build a self-contained HTML using the UmaSim support_card.txt skill-hint table.
No runtime requests. When full input is unavailable, use labeled 31-card excerpt.
"""
from __future__ import annotations
import json, re, hashlib, unicodedata, subprocess, sys, argparse, difflib
from pathlib import Path
from datetime import datetime, timezone
BASE=Path(__file__).resolve().parents[1]
COLORS={'スピード':'#bc6665','スタミナ':'#58959c','パワー':'#bb9148','根性':'#a66d9b','賢さ':'#758bc1','友人':'#6caa89','グループ':'#8b91af','不明':'#7686a2'}
TYPES=['スピード','スタミナ','パワー','根性','賢さ','友人','グループ','不明']
def norm(v):
    return re.sub(r'[、，!！･・.｡。\'‘’“”\s]','',unicodedata.normalize('NFKC',v)).lower()
def cardkey(name):return norm(name)
def name_id(s):return 'hint-'+hashlib.sha256(norm(s).encode('utf-8')).hexdigest()[:16]
def fnv(s):
    n=2166136261
    for c in s:
        b=c.encode('utf-16le')
        for pos in range(0,len(b),2):n=(n^int.from_bytes(b[pos:pos+2],'little'))*16777619&0xffffffff
    alphabet='0123456789abcdefghijklmnopqrstuvwxyz';v=''
    while n:v=alphabet[n%36]+v;n//=36
    return v or '0'

def read_support_cards(path:Path)->dict:
    """Card ID -> stage -> name/type/hints. Columns from UmaSim tab-delimited v1."""
    result={};errors=[]
    for line_no,line in enumerate(path.read_text(encoding='utf-8-sig').splitlines(),1):
        if not line.strip():continue
        if path.suffix=='.psv':
            f=line.split('|',5)
            if len(f)==5:
                cid,name,rar,t,skills=f;stage=4
            elif len(f)==6:
                cid,name,rar,t,stage,skills=f
            else:
                errors.append((line_no,'expected 5 or 6 fields'));continue
        else:
            f=line.split('\t')
            if len(f)<60 or not f[0].isdigit() or not f[4].isdigit():
                errors.append((line_no,'unexpected original row format'));continue
            cid,name,rar,stage,t,skills=f[0],f[1],f[3],int(f[4]),f[6],f[-3]
        if t not in COLORS:errors.append((line_no,'unknown type '+t));continue
        if str(rar) not in ('1','2','3'):errors.append((line_no,'unknown rarity'));continue
        if not 0<=int(stage)<=4:errors.append((line_no,'stage out of bounds'));continue
        hints=list(dict.fromkeys(s.strip() for s in skills.split(',') if s.strip()))
        item=result.setdefault(cid,{'id':cid,'name':name,'rarity':{'1':'R','2':'SR','3':'SSR'}[str(rar)],'type':t,'stageHints':{}})
        if item['name']!=name or item['type']!=t or item['rarity']!={'1':'R','2':'SR','3':'SSR'}[str(rar)]:
            errors.append((line_no,'inconsistent card metadata'));continue
        if str(stage) in item['stageHints'] and item['stageHints'][str(stage)]!=hints:
            errors.append((line_no,'conflicting stage hints'));continue
        item['stageHints'][str(stage)]=hints
    if errors:raise ValueError(f'Unable to parse {path}: {errors[:6]} and {len(errors)} errors')
    if not result:raise ValueError(f'No records read from {path}')
    return result

def make_payload(source:Path, require_full:bool=False):
    old=json.loads((BASE/'inputs/v6_catalog_snapshot.json').read_text(encoding='utf-8'))
    partial=json.loads(subprocess.check_output(['node','-e',f'console.log(JSON.stringify(require({str(BASE/"src/data.js")!r})))'],text=True))
    incoming=read_support_cards(source)
    if require_full and len(incoming)<450:raise ValueError(f'Full build requires >=450 unique support cards, got {len(incoming)}')
    # Old index entries have unstable generated IDs; generate a compatibility alias map.
    byname={cardkey(c['name']):dict(c) for c in old['cards']}
    byid={c['id']:c for c in byname.values()}
    names={norm(s['name']):s for s in partial['skills'] if not s.get('unknown') and not s.get('referenceOnly')}
    skills={s['id']:dict(s) for s in partial['skills']}
    alias={}
    hint_count=0; new_cards=0; matched=0; stage_varies=0; nohint=[]
    for c in incoming.values():
        k=cardkey(c['name']);target=byname.get(k)
        if target is None:
            target={'id':c['id'],'name':c['name'],'character':c['name'].split(']',1)[-1],
                    'rarity':c['rarity'],'type':c['type'],'accent':COLORS[c['type']],
                    'hints':[],'events':[],'effects':['性能詳細は未検証'],
                    'sourceStatus':'catalog_only','dataStatus':'スキル・イベント未収録'}
            byname[k]=target;new_cards+=1
        else:
            matched+=1
            if target['id']!=c['id']:
                alias[target['id']]=c['id'];target['id']=c['id']
        # Assign a common stable skill identity across all cards, using existing
        # real skill IDs when their exact Japanese names are already known.
        def skillid(name):
            n=norm(name)
            if n in names:return names[n]['id']
            sid=name_id(name)
            if sid not in skills:skills[sid]={'id':sid,'name':name,'tier':'unknown','lowerId':None,'unknown':False,'verifiedHintName':True}
            return sid
        sh={st:[skillid(name) for name in hints] for st,hints in c['stageHints'].items()}
        chosen=sh.get('4') or next((sh[str(i)] for i in range(3,-1,-1) if str(i) in sh),[])
        if len(set(tuple(v) for v in sh.values()))>1:stage_varies+=1
        # Do not keep earlier unverified numeric hint IDs when exact names are now available.
        target.update(id=c['id'],rarity=c['rarity'],type=c['type'],accent=COLORS[c['type']],
                      hints=chosen,hintsByStage=sh,sourceStatus='verified_hints',
                      dataStatus='通常ヒント名とカードIDを収録。イベント経路は未検証。',
                      effects=['性能解放段階による性能値は未検証'])
        if not chosen:nohint.append(c['id'])
        hint_count+=len(chosen)
        if target.get('events'):
            target['sourceStatus']='verified_hints_partial_events'
            target['dataStatus']='通常ヒント名を収録。一部イベント報酬候補の到達条件は未検証。'
    # Resolve actual gold->lower skill families when reference-only placeholders can be matched by their Japanese names.
    # Keep the old placeholder skill objects for saved target preset backward compatibility.
    real_names={norm(v['name']):k for k,v in skills.items() if not v.get('unknown') and not v.get('referenceOnly')}
    for item in skills.values():
        lower=skills.get(item.get('lowerId'))
        if lower and lower.get('referenceOnly'):
            resolved=real_names.get(norm(lower['name']))
            if resolved:item['lowerId']=resolved
    # v8: The old catalog included the same card under variant text spellings.
    # Merge ONLY explicitly reviewed aliases, never all same-character cards.
    # Distinct rarities/cards must remain separate, and aliases preserve old saves.
    reviewed=json.loads((BASE/'inputs/reviewed_card_aliases.json').read_text(encoding='utf-8'))['mapping']
    by_real_id={c['id']:c for c in byname.values()}
    pending={c['id']:k for k,c in byname.items() if c.get('sourceStatus')=='catalog_only'}
    duplicate_merges=[]
    for legacy_id,real_id in reviewed.items():
        k=pending.get(legacy_id)
        oldc=byname.get(k) if k is not None else None
        canonical=by_real_id.get(real_id)
        # Preview excerpts may not contain the target card yet. Do not hide
        # a catalog candidate until its canonical ID is actually imported.
        if not canonical or not canonical.get('sourceStatus','').startswith('verified_hints'):
            if require_full:
                raise ValueError(f'Canonical card unavailable: {legacy_id} -> {real_id}')
            continue
        if not oldc:
            raise ValueError(f'Invalid reviewed alias: {legacy_id} -> {real_id}')
        if oldc['rarity']!=canonical['rarity']:
            raise ValueError(f'Mismatched rarity in reviewed alias: {legacy_id} -> {real_id}')
        if legacy_id in alias and alias[legacy_id]!=real_id:
            raise ValueError(f'Ambiguous old-ID mapping: {legacy_id}')
        alias[legacy_id]=real_id
        # Preserve alternate spellings as search terms without showing a duplicate card.
        canonical.setdefault('searchAliases',[])
        if oldc['name'] not in canonical['searchAliases']:
            canonical['searchAliases'].append(oldc['name'])
        duplicate_merges.append({'oldId':legacy_id,'realId':real_id,'oldName':oldc['name'],'realName':canonical['name']})
        del byname[k]
    cards=list(byname.values())
    # Audit: do not ship newly ambiguous catalog records silently. The title
    # similarity check is only a release gate; it never merges distinct cards.
    def split_name(value):
        if ']' in value:
            title,character=value.split(']',1)
            return title.lstrip('['),character
        return value,''
    pending_review=[]
    for possible in [x for x in cards if x.get('sourceStatus')=='catalog_only']:
        t,character=split_name(possible['name'])
        for known in [x for x in cards if x.get('sourceStatus','').startswith('verified_hints') and x['rarity']==possible['rarity']]:
            kt,kc=split_name(known['name'])
            if norm(character)==norm(kc) and difflib.SequenceMatcher(None,norm(t),norm(kt)).ratio()>=0.86:
                pending_review.append((possible['name'],known['name'],known['id']))
    if require_full and pending_review:
        raise ValueError(f'Possible duplicate catalog records need explicit review: {pending_review[:5]}')
    statuses={}
    for c in cards:statuses[c.get('sourceStatus','catalog_only')]=statuses.get(c.get('sourceStatus','catalog_only'),0)+1
    # Remove superseded numeric hint placeholders from display when unused; keep
    # them in the skill registry to avoid corrupting old saved target presets.
    payload={'version':'catalog-v8.1-umasim-'+('full' if require_full else 'preview'),
      'cards':cards,'skills':list(skills.values()),'meta':{
         'catalogCount':len(cards),'idMappedCards':len(incoming),'verifiedIdCards':len(incoming),
         'sampleEventCount':sum(len(c.get('events',[])) for c in cards),
         'unknownHintIds':sum(1 for s in skills.values() if s.get('unknown')),
         'source':'UmaSim data/support_card.txt (2026-09-30 normal hints snapshot); v6 candidate catalog; partial event sample',
         'sourceFile':source.name,'snapshotDate':'2026-09-30',
         'compiledAt':datetime.now(timezone.utc).isoformat(),
         'sourceStatuses':statuses,'sourceRows':len(incoming),'hintsTotal':hint_count,
         'matchedCandidateCards':matched,'newCards':new_cards,'stageHintsVarying':stage_varies,
         'noNormalHintCards':len(nohint),'eventReachabilityVerified':False,'coverageComplete':False,
         'aliasCardIds':alias,'deduplicatedCandidates':len(duplicate_merges),'pendingDuplicateReviews':pending_review,'reviewedAliasPairs':duplicate_merges,'sourceIsExcerpt':len(incoming)<450}}
    return payload

def build(source:Path,output:Path,require_full:bool=False):
    payload=make_payload(source,require_full)
    (BASE/'inputs/v8_catalog_snapshot.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    encoded=json.dumps(payload,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
    loader='(function(g){const d='+encoded+';d.cardById=Object.fromEntries(d.cards.map(c=>[c.id,c]));for(const [old,newId] of Object.entries(d.meta.aliasCardIds||{})){if(d.cardById[newId])d.cardById[old]=d.cardById[newId]}d.skillById=Object.fromEntries(d.skills.map(s=>[s.id,s]));g.UmaDemoData=d;})(window);'
    src=BASE/'src';style=(src/'style.css').read_text(encoding='utf-8');core=(src/'core.js').read_text(encoding='utf-8');app=(src/'app.js').read_text(encoding='utf-8')
    app=app.replace('STATIC DATA v5','SKILL DATABASE v8.1')
    app=app.replace('実データの部分検証版です。','通常ヒントデータを統合した検証版です。')
    app=app.replace('検証用PoC · ゲームデータは配信時に組込み · 通常操作で外部通信なし',
                    'カード名・通常ヒントを同梱 · イベント分岐は一部未検証 · 通常操作で外部通信なし')
    app=app.replace('性能値は未収録のためスキル集計には影響しません','対応段階別の通常ヒントを表示。性能値は未検証です')
    app=app.replace('照合済みヒント${c.hints.length}件', '通常ヒント${c.hints.length}件')
    app=app.replace('未照合スキル ${data.meta?.unknownHintIds??data.meta?.unresolvedHintCount??"?"}件。',
                    '通常ヒント収録済みカード ${data.meta?.idMappedCards??"?"}件。未照合候補カード ${data.meta?.sourceStatuses?.catalog_only??"?"}件。')
    # To avoid inaccurate blank/no-hint claims on candidate-only cards.
    app=app.replace("c.hints.length+'件'", "c.hints.length+'件'")
    html='<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Uma Support Lab v8.1 | 重複修正版</title><style>'+style+'</style></head><body><div id="app"></div>'
    for js in (loader,core,app):html+='<script>'+js.replace('</script','<\\/script')+'</script>'
    html+='</body></html>'
    output.parent.mkdir(parents=True,exist_ok=True);output.write_text(html,encoding='utf-8')
    print(json.dumps({'output':str(output),'bytes':len(html.encode('utf-8')),'cards':len(payload['cards']),**{k:payload['meta'][k] for k in ['idMappedCards','hintsTotal','newCards','matchedCandidateCards','deduplicatedCandidates','stageHintsVarying','sampleEventCount','sourceStatuses','sourceIsExcerpt']}},ensure_ascii=False,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,default=BASE/'inputs/full_support_hints.psv');p.add_argument('--output',type=Path,default=BASE/'dist/index.html');p.add_argument('--full',action='store_true');x=p.parse_args()
    build(x.input,x.output,x.full)