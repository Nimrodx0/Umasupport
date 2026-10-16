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
node --test poc/tests/core.test.js poc/tests/stage.test.cjs
```

移管前のローカルソースで上記2ファイルのNode.jsテストは2件成功。GitHub上でのCIは未設定。

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
- テスト：`node --test poc/tests/runtime.test.cjs`。実ブラウザでのCORS・GitHub Pages動作は未検証。
- [設計と未解決課題](../docs/runtime-data-loading.md)。
