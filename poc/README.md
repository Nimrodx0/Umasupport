# PoC v8.1：ソース移管と動作手順

**現行公開版はHTML/CSS/JavaScriptの直接取得型PoC。React/TypeScript/Viteは未導入。** 旧v8.1のPythonビルド・実データ同梱版は履歴として以下に残す。

> 最新の進捗・工程完了ゲート：[ロードマップ](../docs/roadmap.md)／[検証計画](../docs/verification-plan.md)。現行`poc/live.html`はサポカ通常ヒントと金白スキル辞書の取得に対応し、イベント公開DBの実イベントは**0件**。2026-10-16の実ソースNode結合試験は成功したが、最新の階層画面のPages／スマホ検証は未完。以降の旧記述はその機能を実装した当時の状態を説明する場合がある。

## 公開できる動作デモ

- [demo.html](demo.html)：架空サポカ6枚と架空イベント分岐を含む**スタンドアロンのHTML**。ダウンロードしてブラウザで開く。第三者由来のサポカ原データは含まない。
- [src/demo_data.js](src/demo_data.js)：デモに使う架空の対応データ。
- [src/core.js](src/core.js)：スキル獲得経路、重複、目標判定、上下位スキル表示の集計エンジン。
- [src/app.js](src/app.js)：v8.1系の元UIソース。**ゲーム内IDを初期値に持つ**。demo.htmlでは、デモのために初期デッキの設定だけを架空A〜Fへ置き換えてバンドルしている。
- [src/style.css](src/style.css)：見た目のCSS。

したがって、`src/app.js` を直接 `demo_data.js` に接続するだけでは、元ソースの初期デッキ設定が実データIDを要求する。現在の**動作デモは demo.html を正**とする。今後は初期デッキIDをデータ依存にせず設定ファイルから渡すよう改善する。

## 集計ロジックのテスト

リポジトリのルートから：

```sh
node --test poc/tests/core.test.js poc/tests/stage.test.cjs poc/tests/runtime.test.cjs poc/tests/settings.test.cjs
```

移管前のローカルソースで上記2ファイルのNode.jsテストは2件成功。GitHub Actions CIは設定済みで、2026-10-16のmainでテスト成功。

## v8.1の全実データ版を再ビルドするには

`tools/build_v8.py` と `tools/fetch_umasim.py` を保存した。ただし、以下は**Publicリポジトリに含めない**：

- `poc/inputs/full_support_hints.psv`：UmaSim由来の通常ヒント抽出データ
- `poc/inputs/v6_catalog_snapshot.json`：旧カード台帳由来のスナップショット
- `poc/inputs/reviewed_card_aliases.json`：レビュー済み表記対応表の原版（ゲームデータからの派生内容を含む）
- `poc/src/data.js`：6枚の実カード・イベント情報を含む過去の部分データ
- 実カード情報を同梱した`uma_support_lab_v8_1.html`：約925KBの完成データ版

したがって、**この公開レポジトリのままでは**旧同梱版**v8.1は完全再ビルドできない**。移管前のZIPは会話で配布した `uma_support_lab_v8_1_source.zip`。再配布条件を確認し、必要なら元ソースから合法的に再取得・生成するパイプラインへ移行する。

元データを用意できた場合の旧ビルドコマンド：

```sh
python poc/tools/build_v8.py --input poc/inputs/full_support_hints.psv --full --output poc/uma_support_lab_v8_1.html
```

`poc/tests/legacy/` のテストはこの非公開入力と実データ版HTMLに依存するため、**アーカイブであり現在のGitHubチェック項目には含めない**。

## 開発上の優先事項

1. 外部データの公開・再利用条件を確認。
2. ソースの入力依存を明示し、再現可能なビルドへ変更。
3. 全カードのイベント報酬・分岐のデータモデルを整備。
4. 新しい版ごとに集計テストとブラウザテストを実行。

[要件定義](../docs/requirements.md) ｜ [意思決定](../docs/decisions.md) ｜ [ロードマップ](../docs/roadmap.md)

## ブラウザから公開元を直接取得する新方式

- [`live.html`](live.html) はUmaSimの通常ヒントを外部公開元から取得する移行PoC。ゲームデータ自体をこのレポジトリに含めない。
- 起動時取得→検証→IndexedDBキャッシュ。失敗したときは検証済みの前回データを使用。利用者向け更新ボタンはない。
- 金白スキル階層は実装・Node実ソース検証済みで最新ブラウザ確認待ち。実イベント報酬は未収録（0件）。初回利用にはネット接続が必要。
- テスト：`node --test poc/tests/runtime.test.cjs`。Pages上での通常起動・データ読込・表示は2026-10-16にユーザー確認済み。IndexedDB保存・サポカデータ取得先遮断時復旧・再取得は2026-10-16のPages実ブラウザで確認済み。スキル辞書側の実機検証は未完。
- [設計と未解決課題](../docs/runtime-data-loading.md)。

## 直接取得版の保存設定（開発中）

- `src/settings.js` で現行の設定構造とカード・スキルIDのみを検証する。旧保存IDの移行や未知IDの保持は行わない。
- 不正なJSONまたは現行の参照データに存在しないIDを含む設定は読み込まず、エラー画面と確認付き初期化を表示する。
- 復旧用の自動バックアップは設けない。通常のJSONエクスポート／インポートは維持する。
- `tests/settings.test.cjs` では正常読込、形式不正、未知ID拒否を検証する。
- **UmaSimのIndexedDBキャッシュ／通信断フォールバックは別機能であり維持**。アプリ本体の完全オフライン再読込には別途アセットキャッシュが必要。

## イベント分岐のテスト

`src/event_schema.js` で明示的なカード／スキルID照合と、イベントの循環・未定義親・打ち切りを検証する。`src/core.js` では親イベントの連続到達、複数前提条件、結果別の条件付き報酬を扱う。`tests/events.test.cjs` のテストはすべて架空カード・架空スキルを使用している。**`live_loader.js` が作る初期モデルにはイベントを含めず（events: []）、後段の `public_event_catalog.js` が公開レビュー済みイベントJSONを検証後に結合する。現行公開JSONの実イベントは0件。**

## 実イベント候補の監査とレビュー付き変換

`node poc/tools/audit_events.cjs` は開発者向けコマンド。UmaSimと `umamusume-data` の3ファイルを公開元へ直接GETし、ID照合・レコード件数・隔離理由を表示する。元JSONをGitHubへ保存しない。`--local support_card.txt supports.json events.json` でローカル監査も可能。

`src/event_source_audit.js` はIDと名称を照合し、未確認の連続イベントは勝手に有効化しない。`src/event_review_compiler.js` はレビュー済みの打ち切り・依存条件とスキルID対応が揃ったレコードのみ内部形式へ変換する。人工データの検証は `tests/event_source_audit.test.cjs`、`tests/event_review_compiler.test.cjs`。公開版の承認済み実イベントは0件のまま。

[照合記録](../docs/event-source-audit.md)。

## 大規模イベントJSONの全件測定

`node poc/tools/audit_cruise_source.cjs`：元の公開JSONとUmaSimを直接GETし、カード名＋レアリティの一意一致数、イベント見出し、選択肢・効果行、異常構造を測定する。第三者データを保存・コミットしない。

ローカル検証では `node poc/tools/audit_cruise_source.cjs --local path/to/UmaMusumeLibrary.json path/to/support_card.txt`。単体テストは `poc/tests/cruise_source_audit.test.cjs`。GitHub Actionsの「Event Source Coverage Audit」は手動実行専用で、頻繁に公開元へGETしない。実カードのイベント報酬を公開版に追加する機能ではない。


開発者向け node poc/tools/compare_event_sources.cjs でUmaUmaCheckerとUmaUmaCruise系の公開JSONを直接取得し、SSR・SRのカード数、イベント件数、選択肢数、表記差候補、空イベントカードを比較できる。第三者データ自体は保存・同梱しない。GitHub Actionsの Event Source Coverage Audit を手動で実行することもできる。

## イベント名レベルの差分監査

`src/event_gap_audit.js` はSSR・SRのカード名を正規化し、二つのイベントJSON内のイベント見出しをカード単位で比較する純粋な関数。タイトルをログへ出さず、不一致の件数とカードIDのみ提示する。通常ヒントや実データは書き換えない。`tests/event_gap_audit.test.cjs` は架空イベントで名前衝突・異表記・不一致を検証。再実行：手動ワークフロー Event Source Coverage Audit（`tools/compare_event_sources.cjs`）。


## U-tools取得試験

`tools/probe_utools.cjs` は2026-10-16の**少数回の試験用**。手動実行した際、GitHub ActionsのイベントページGETはCloudflare challenge付き403で停止。通常CIでは**このツールを実行しない**。承認のない再試行や保護回避、大量アクセスは行わず、結果は [U-tools評価](../docs/utools-source-evaluation.md) に記録。 

## SSR・SRイベントを候補から公開DBへ

詳しくは [公開イベントDB手順](../docs/checker-public-catalog.md)。CLI：node poc/tools/build_checker_catalog.cjs（読み取り専用、SSR・SRの元ファイルから実カード名厳密照合とイベント候補件数）。ローカル入力：--local local-data/support_card.txt local-data/Events.json --candidates local-data/candidates.json。エイリアスは --aliases、レビュー済みイベントは --review と --output のセットで独立JSONへ出力。

poc/data/reviewed_events.v1.json が公開DB。src/public_event_catalog.jsは全件検証してからカードへイベントを装着。現時点で承認済みの実イベントは0件。src/checker_candidate_pipeline.cjsでは自然文の報酬を自動的に確定スキル扱いしない。testは checker_candidate_pipeline.test.cjs と public_event_catalog.test.cjs。

表記差24件の明示対応は `config/checker-name-aliases.json`。`tools/build_checker_catalog.cjs` は標準でこれを使い、417枚を照合します。`--no-aliases` で厳密一致393枚だけを検証、`--aliases` でローカル対応表を指定できます。欠損SSR5枚のGameWith個別記事の詳細掲載状態は `config/gamewith-ssr-review-status.json`、新規カードやイベント0件の検出は `src/checker_gap_tracker.cjs`。

## Game8からの欠損SSR事実候補

`config/missing-ssr-event-facts.v1.json` はSSR4枚の連続3＋ランダム2、選択位置別のスキルヒント・Lvを人手で整理した未承認の構造化候補。SSR30240はイベント報酬不明として保持。選択肢原文は含めず、公開データ `data/reviewed_events.v1.json` に結合しない。`src/missing_ssr_fact_review.cjs` がイベント型・スキルLv・候補ID・許可URL等を検証。`tests/missing_ssr_fact_review.test.cjs` は不正データを拒否するテスト。[詳細](../docs/game8-missing-ssr-review.md)。


## イベント候補の技能数値ID照合

`tools/audit_skill_candidate_ids.cjs` はUmaSimの `data/skill_data.txt` を直接読み、`src/skill_candidate_id_audit.cjs` で欠損SSR候補14スキルのID・レアリティ・グループを厳密照合。オフライン版：`node poc/tools/audit_skill_candidate_ids.cjs --local local-data/skill_data.txt`。`config/missing-ssr-skill-id-candidates.v1.json` は13件のUmaSim一致＋1件の外部暫定IDを区別して保持する。今後の公式・ソース更新でIDが変化すれば監査失敗にする。`config/missing-ssr-event-facts.v1.json` 内のジャングルポケット30240のスキル名2件はカード単位の取得候補で、イベント段階・選択肢は一切未特定。詳細：[技能ID監査](../docs/skill-id-candidate-audit.md)。

## 全件スキル階層のランタイム導入（2026-10-16）

`src/skill_hierarchy.js` がUmaSim金325件のグループを全件検査し、白あり322組（284単純一対一、7例外、31の○◎2段階）を構造的に結び、白なし3組を別扱いにする。 `live.html` はレビュー済みイベント0件でも金白辞書を起動時直接GETしてIndexedDBにキャッシュする。データの表示・間接カバーは `tests/full_skill_hierarchy.test.cjs` の架空スキルテストで検証。未確認のソース構造を自動で確定扱いしない。独立検証と実ブラウザ検証は引き続き必要。[全件結果](../docs/skill-hierarchy-coverage.md)。

## Chromiumの自動ブラウザ回帰（2026-10-17）

§poc/tests/browser_skill_smoke.cjs§ を実行すると、PlaywrightのChromiumで現行§live.html§をHTTP配信・操作します。§node poc/tests/browser_skill_smoke.cjs§ は§playwright@1.55.1§とChromiumが別途必要です。CIの§browser-smoke§ジョブはセットアップから行います。

第三者元データはダウンロードせず、563枚×5段階の架空カードと126個の架空スキルをネットワーク代用応答として返します。階層の実表示と金白辞書のIndexedDB復旧、イベントJSON失敗時の階層維持をテストします。**本テスト合格は実ゲーム金白322組の独立裏付けやPages／スマホ実機の合格ではありません。** [検証ゲート](../docs/verification-plan.md)で区別します。

## マスター由来データによる金白関係の独立監査

§poc/tools/verify_skill_master.py§ は、UmaSim §skill_data.txt§ と別のゲームマスターSQLite §master.mdb§ をローカルで読み取り、全金スキルのID・group_id・group_rateを突合します。Python標準ライブラリのみで動作します。外部ファイルをダウンロードしたり、データ本体を公開リポジトリへ保存したりしません。

~~~sh
python3 poc/tools/verify_skill_master.py --umasim local-data/skill_data.txt \
  --master local-data/master.mdb --source-revision "<コミットID>" \
  --master-revision "<版／日付>" --strict
~~~

§--strict§ では全件の独立照合が通過しなければ非0終了になります。版が一致しないと欠損が出る可能性があり、収録率・現行ゲーム仕様の保証とは区別します。通常CIでのテストは人工SQLiteのみです。§python3 -m unittest discover -s poc/tests -p 'test_verify_skill_master.py' -v§。

## 固定版旧マスターとのクロスチェック

[履歴照合](../docs/historical-master-audit.md)と[限定的Actions](../.github/workflows/historical-skill-master-audit.yml)を参照。2025年で更新が停止したSQLiteなので、2026年の全322組の独立確認とは区別する。通常CIとブラウザでの外部通信は増やさない。

## 公開Pagesの実データChromium受け入れ（2026-10-17）

[実測記録](../docs/pages-browser-acceptance-20261017.md)、[スクリプト](tests/pages_live_browser.cjs)、[限定的Actions](../.github/workflows/pages-real-browser-acceptance.yml)を参照。公開中の配信物5ファイルのバイト一致、UmaSim2ファイルを各1回の実GET、ブラウザ描画/編成/目標/IndexedDB、データ取得先のみ遮断した復旧を自動検証。実測はLinux HeadlessChrome/140・390px幅の操作であり、Android実機でも全イベント/全ゲームデータの保証でもない。通常CIでは外部GETを追加せず、明示実行のみ。

### 2026-10-17：旧マスターのイベントタイトル指紋照合

[イベント名の監査結果](../docs/event-title-fingerprint-audit.md)。候補専用JSONに `titleFingerprint`（NFKC＋空白統一したイベント見出しのSHA-256）を追加。旧masterの `single_mode_story_data.story_id` と `text_data.category=181` から得られたタイトルのハッシュと、**タイトル名の暫定一致**のみ比較する。固定版旧マスターのカード直結1,028件はタイトル全件取得、SSR/SR1,017件のうちChecker候補との暫定一致956件。30241は旧18、Checker17、同名15、旧だけ3、Checkerだけ2。元イベント名・本文をPublicへ保存せず、正式ゲームID・報酬・分岐の確認として扱わない。監査は通常CIの人工SQLite回帰と、明示／PR限定の[ワークフロー](../.github/workflows/historical-event-master-audit.yml)で実行。
