# 開発・実行・検証の入口（PoC）

現行アプリは **HTML / CSS / JavaScript の静的サイト**です。通常の実行画面は [live.html](live.html)、主なUIは [src/live_app.js](src/live_app.js)、集計の純粋ロジックは [src/core.js](src/core.js)。Node.js 22以降は試験・データ処理に使います。現時点の実装範囲・検証状況は [status](../docs/status.md) に集約しています。

## 作業を始める前に

[文書の入口](../docs/index.md) → [ロードマップ](../docs/roadmap.md) → [有効な要件](../docs/requirements.md) → [アーキテクチャ](../docs/architecture.md) を対象に応じて確認します。イベントの公開条件とデータ出典は [公開ゲート](../docs/checker-public-catalog.md)・[データソース](../docs/data-sources.md) に従います。未承認のイベント候補は本番カタログに混ぜません。

## ローカル起動

リポジトリの**ルート**から静的HTTPサーバーを起動し、ブラウザで `http://localhost:8000/poc/live.html` を開きます。外部データのランタイム取得を使うため、ファイルを直接ダブルクリックする方法は標準の確認手順にしません。

```sh
python -m http.server 8000
```

ネットワーク／取得元／利用条件によってローカル起動時のデータ取得が失敗する場合があります。成功を推測せず、ブラウザ表示・開発者ツールとデータ状態を確認してください。実際の利用者配信は [GitHub Pages](https://nimrodx0.github.io/Umasupport/poc/live.html) です。

## 主要なローカル検証

リポジトリのルートから：

```sh
node --test poc/tests/core.test.js poc/tests/events.test.cjs
node --test poc/tests/settings.test.cjs poc/tests/documentation_policy.test.cjs
node poc/tools/verify_event_release.cjs
node poc/tools/check_project_tracking.cjs
```

これは**代表的なチェック**であり全CIと同等ではありません。その他のモジュール・ブラウザ・固定データ監査は [通常CI](../.github/workflows/ci.yml) と [検証計画](../docs/verification-plan.md) に従い、対象変更に合わせて実行します。A（機構）／B（データ）／C（実環境）の合格は個別に記録してください。

## 主要ファイル

| 対象 | 入口 |
| --- | --- |
| 公開UI | [live.html](live.html)、[live_app.js](src/live_app.js) |
| スキル・デッキの集計 | [core.js](src/core.js) |
| 保存と移行 | [settings.js](src/settings.js) |
| 公開イベントDB | [reviewed_events.v1.json](data/reviewed_events.v1.json)、[公開ゲート](../docs/checker-public-catalog.md) |
| 構造・状態・外部取得 | [アーキテクチャ](../docs/architecture.md)、[ランタイム読込](../docs/runtime-data-loading.md) |
| 旧v8.1のビルド・試験手順 | [旧開発手順](legacy-runbook.md)（履歴であり現行手順ではない） |

コードを修正しても、公開カタログの更新やゲームデータの正確性・権利確認が自動で完了するわけではありません。
