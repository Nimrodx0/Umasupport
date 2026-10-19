# Phase 2：結果依存分岐と563枚索引 (2026-10-19)

## 実装

`requires.all[]` に結果IDを追加し、結果の `terminal:true` で打ち切りを表す。結果未確定の経路は `conditional`、失敗等で不可能になった経路は `blocked`。画面で結果を変更すると下流の選択と結果を消去する。

独自の全カード監査索引 `poc/data/candidates/event_coverage_index.v1.json` を固定版UmaSim 563枚とChecker 2,109候補・独自草稿索引から作成。R146はChecker対象外。すべてのカードの独立期待イベント一覧は現時点で未検証であり、`expectedEventCount:null` はイベントなしを意味しない。キャラクター共通イベント分類も未検証。公開イベント数は変更しない。

## 再生成・合格境界

`node poc/tools/build_event_coverage_index.cjs local-data/support_card.txt local-data/event_coverage_index.v1.json`

A 機構: `node --test poc/tests/outcome_dependent_branches.test.cjs poc/tests/event_coverage_index.test.cjs`。

B データ: 固定版563（R146/SR101/SSR316）・Checker417枚2,109候補の突合と、母数外・重複の拒否。実ゲーム全イベントの存在・到達分岐は未確認。別資料を用いて期待イベントID一覧とカード固有／キャラクター共通の区別を追加することが次工程。

C UI/端末: 自動CIと実ブラウザの結果を区別し、物理端末操作は未検証のまま保留。
