# ウマサルタント（Uma Support Lab）

ウマ娘 プリティーダービーの本育成／継承育成で使う2組のサポートカード編成を、**通常ヒント・イベント経路・上下位スキル・重複・目標カバー**の観点で比較する非公式Webアプリです。編成の判断は利用者が行い、自動で最適化するものではありません。

**状態：開発中のPoC。試験公開中であり完成版ではありません。** アプリ：[GitHub Pages](https://nimrodx0.github.io/Umasupport/)（入口 `index.html` → `poc/live.html`）。

## 文書の入口

| 読みたい内容 | 文書 |
|---|---|
| 最終仕様・対象外・受け入れテスト | [要件定義](docs/requirements.md) |
| 全6工程・現在位置・次の作業 | [ロードマップ](docs/roadmap.md) |
| フェーズごとの機構／網羅／実機の合格条件 | [検証計画・工程ゲート](docs/verification-plan.md) |
| 現行アーキテクチャとデータ境界 | [設計](docs/architecture.md)、[実行時取得](docs/runtime-data-loading.md) |
| 決定事項と変更理由 | [意思決定ログ](docs/decisions.md) |
| 実装・検証履歴 | [開発履歴](docs/development-history.md) |
| データの収録と不確実性 | [ソース](docs/data-sources.md)、[金白監査](docs/skill-hierarchy-coverage.md)、[独立照合](docs/independent-skill-json-audit.md)、[イベントソース調査](docs/event-source-selection.md) |
| 開発環境・テスト | [PoCの手順](poc/README.md)、[開発AI向け入口](AGENTS.md) |

## 現在の到達点（2026-10-17）

- **公開・基盤：** GitHub Pagesで実ブラウザ通常起動を確認。CI成功。UmaSim `support_card.txt` の起動時直接取得、構造検証、IndexedDBキャッシュ、元データ取得先だけを遮断した場合の復旧・再取得を2026-10-16に確認済み。アプリ本体の完全オフライン起動とは別。
- **通常ヒント：** UmaSimの実ソース結合検証でサポカ563件・通常ヒント4,015件。採用元に登録された件数であり、現行ゲームの全カード数を保証しない。
- **金白スキル：** `skill_data.txt` 2,139件中金325を分類し、322組に構造的対応候補、3組はソース上白なし。内部統合スキル辞書836件。実ソースNode統合検証は成功したが、322組の2026年9月版の別系統データで321組の双方向ID・昇格順を照合し、残り1組は攻略資料で名称関係を確認。全数値IDの同時点独立照合とPages・スマホ操作は未完。
- **イベント：** UmaUmaCheckerのSSR・SR417枚に名前対応（393厳密＋24明示エイリアス）。イベント候補2,099件、うち5枚はイベント記録0件。**公開DBの実ゲームイベントは0件**。分岐・報酬・利用条件をレビューしてから追加する。
- **UI：** 比較用のPoCは使用可能。名前付き複数デッキ、所持一括登録、イベント一括操作などの完成要件は未達。

[実ソース統合検証](https://github.com/Nimrodx0/Umasupport/actions/runs/38927481224) / [最新コミット時のCI](https://github.com/Nimrodx0/Umasupport/actions/runs/38927817921)。数値・可否は対象ソースと観測日を伴うスナップショットであり、正式版の完全性を示すものではありません。

## データと公開方針

- 通常ヒント・スキル辞書は**利用者のブラウザで公開元を起動時に直接取得**し、検証したデータだけIndexedDBへ保存します。利用者向け更新ボタンは設けません。
- 実イベントはブラウザ直取得でなく、レビュー済み事実データをウマサルタント独自の [公開JSON](poc/data/reviewed_events.v1.json) としてGitHub Pagesで配信する方式です。現在は空。候補取り込み：[レビュー手順](docs/checker-public-catalog.md)。
- 公開ファイルだから自由な転載が可能とは限りません。第三者のイベント文章・画像・元ゲームデータを権利確認なく同梱しません。
- 現状の動作主体はHTML/CSS/JavaScriptとNode.jsの監査・テストツールです。**React/TypeScript/Viteは未導入**で、採用は後続判断です。

## 開発者向け

~~~sh
# Node.js 22以上を用意し、リポジトリのルートで実行
node --test poc/tests/*.test.js poc/tests/*.test.cjs
~~~

上記はデータ独立のテストです。実公開元を読み込む監査・統合試験は**開発者の明示実行時のみ**とし、通常CIで頻繁に外部GETしません。正確な個別コマンドと必要条件は [PoC README](poc/README.md) と [CI](.github/workflows/ci.yml) を参照してください。

## 注意

- 正式なゲーム内獲得可否・イベント発生・取得確率を保証しません。欠損データは「取得不可」と断定せず、収録状態として区別します。
- 完全な実データ同梱版v8.1は歴史的PoCであり、現在のPages公開版とは別です。第三者データを含む旧HTMLをPublicレポジトリへ登録していません。
- このツールは非公式のファン制作であり、Cygamesの公式サービスではありません。
