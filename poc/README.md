# PoC v8.1：ソース移管と動作手順

**現在の実装は単一HTML＋JavaScript＋Python変換スクリプトです。React/TypeScript移行前。**

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

したがって、**この公開レポジトリのままでは実データ版v8.1は完全再ビルドできない**。移管前のZIPは会話で配布した `uma_support_lab_v8_1_source.zip`。再配布条件を確認し、必要なら元ソースから合法的に再取得・生成するパイプラインへ移行する。

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
- 現段階ではイベント報酬や金白スキル関係の移植は未完了。初回利用にはネット接続が必要。
- テスト：`node --test poc/tests/runtime.test.cjs`。Pages上での通常起動・データ読込・表示は2026-10-16にユーザー確認済み。IndexedDBの内容とオフライン復旧は未検証。
- [設計と未解決課題](../docs/runtime-data-loading.md)。

## 直接取得版の保存設定（開発中）

- `src/settings.js` で現行の設定構造とカード・スキルIDのみを検証する。旧保存IDの移行や未知IDの保持は行わない。
- 不正なJSONまたは現行の参照データに存在しないIDを含む設定は読み込まず、エラー画面と確認付き初期化を表示する。
- 復旧用の自動バックアップは設けない。通常のJSONエクスポート／インポートは維持する。
- `tests/settings.test.cjs` では正常読込、形式不正、未知ID拒否を検証する。
- **UmaSimのIndexedDBキャッシュ／通信断フォールバックは別機能であり維持**。アプリ本体の完全オフライン再読込には別途アセットキャッシュが必要。

## イベント分岐のテスト

`src/event_schema.js` で明示的なカード／スキルID照合と、イベントの循環・未定義親・打ち切りを検証する。`src/core.js` では親イベントの連続到達、複数前提条件、結果別の条件付き報酬を扱う。`tests/events.test.cjs` のテストはすべて架空カード・架空スキルを使用している。**直接取得版の `live_loader.js` は引き続きイベント未収録（events: []）**。

## 実イベント候補の監査とレビュー付き変換

`node poc/tools/audit_events.cjs` は開発者向けコマンド。UmaSimと `umamusume-data` の3ファイルを公開元へ直接GETし、ID照合・レコード件数・隔離理由を表示する。元JSONをGitHubへ保存しない。`--local support_card.txt supports.json events.json` でローカル監査も可能。

`src/event_source_audit.js` はIDと名称を照合し、未確認の連続イベントは勝手に有効化しない。`src/event_review_compiler.js` はレビュー済みの打ち切り・依存条件とスキルID対応が揃ったレコードのみ内部形式へ変換する。人工データの検証は `tests/event_source_audit.test.cjs`、`tests/event_review_compiler.test.cjs`。公開版の `events: []` は変えていない。

[照合記録](../docs/event-source-audit.md)。

## 大規模イベントJSONの全件測定

`node poc/tools/audit_cruise_source.cjs`：元の公開JSONとUmaSimを直接GETし、カード名＋レアリティの一意一致数、イベント見出し、選択肢・効果行、異常構造を測定する。第三者データを保存・コミットしない。

ローカル検証では `node poc/tools/audit_cruise_source.cjs --local path/to/UmaMusumeLibrary.json path/to/support_card.txt`。単体テストは `poc/tests/cruise_source_audit.test.cjs`。GitHub Actionsの「Event Source Coverage Audit」は手動実行専用で、頻繁に公開元へGETしない。実カードのイベント報酬を公開版に追加する機能ではない。


開発者向け node poc/tools/compare_event_sources.cjs でUmaUmaCheckerとUmaUmaCruise系の公開JSONを直接取得し、SSR・SRのカード数、イベント件数、選択肢数、表記差候補、空イベントカードを比較できる。第三者データ自体は保存・同梱しない。GitHub Actionsの Event Source Coverage Audit を手動で実行することもできる。

## イベント名レベルの差分監査

`src/event_gap_audit.js` はSSR・SRのカード名を正規化し、二つのイベントJSON内のイベント見出しをカード単位で比較する純粋な関数。タイトルをログへ出さず、不一致の件数とカードIDのみ提示する。通常ヒントや実データは書き換えない。`tests/event_gap_audit.test.cjs` は架空イベントで名前衝突・異表記・不一致を検証。再実行：手動ワークフロー Event Source Coverage Audit（`tools/compare_event_sources.cjs`）。

