# ウマサルタント（Uma Support Lab）

ウマ娘 プリティーダービーの「本育成」と「継承育成」のサポートカード編成を、**通常ヒント・イベント別スキル候補・上位／下位スキル・重複・目標カバー**から比較する非公式Webアプリです。編成は利用者が決めます。**開発中のPoCであり、完成版ではありません。**

**[公開アプリ（GitHub Pages）](https://nimrodx0.github.io/Umasupport/)**：`index.html` から `poc/live.html` を開きます。主な実装はHTML/CSS/JavaScript。Node.jsは検証・データ処理に使用しています。

## 現行のデータの扱い

- **通常ヒントとスキル辞書**：UmaSimの公開元を起動時に取得し、形式検査とIndexedDBキャッシュを使います。
- **イベント候補**：GameTora由来データを基準に数値・結果分岐を内部で整理し、GameWithは矛盾・欠損などの個別裁定に用います。旧GameWith-first全面収集方針は撤回済みです。
- **正式公開イベント**：内部の技術変換・プレビューとは独立し、イベント公開審査と権利・正確性の確認が必要です。試験変換件数がそのままゲーム内の正確性・網羅性を表すことはありません。
- **本文・画像の取扱い**：第三者のイベント原文、選択肢文章、画像、無承認のマスターDBはそのまま再配布しません。

固定データの集計値や検証したコミットなど、**日付と出典に依存する内容は [開発状況](docs/status.md) に集約**しています。

## 開発版の試用

- [通常アプリ](https://nimrodx0.github.io/Umasupport/poc/live.html)
- [結果別イベントの試用モード](https://nimrodx0.github.io/Umasupport/poc/live.html?eventPreview=results)：未承認の数値候補。通常の公開イベントデータとは別です。
- [選択肢別の数値候補プレビュー](https://nimrodx0.github.io/Umasupport/poc/live.html?eventPreview=facts)：一部の結果・連続分岐は未確認。通常データとは分離。
- [SSRエフフォーリアの限定試用](https://nimrodx0.github.io/Umasupport/poc/live.html?eventPreview=30311)：独立した監査用サンプルで、正式収録ではありません。

## 文書の入口

**[文書索引](docs/index.md)** ／ **[文書運用規約](docs/documentation-policy.md)**

| 知りたいこと | 文書 |
| --- | --- |
| 要求・対象外・利用者の受け入れ条件 | [要件](docs/requirements.md) |
| 最新の確定判断と過去の判断理由 | [意思決定](docs/decisions.md) |
| 今後の工程・優先度 | [ロードマップ](docs/roadmap.md) |
| 最新の実測・残件・CI根拠 | [開発状況](docs/status.md) |
| 機構／データ／実環境の合格条件 | [検証計画](docs/verification-plan.md) |
| アプリ構成・イベントデータ契約 | [設計](docs/architecture.md) / [イベントスキーマ](docs/event-schema.md) |
| イベント取得元の採用方針 | [GameToraを基準としたデータ方針](docs/gametora-baseline-event-policy-20261021.md) |
| 過去の実装・調査 | [開発履歴](docs/development-history.md) / [文書アーカイブ](docs/archive/) |
| AI開発時の作業ルール | [AGENTS.md](AGENTS.md) |

## 開発と検証

Node.js 22以降を使用してください。主要なテストやツールの使い方は [PoC開発手順](poc/README.md) を参照してください。

```sh
node poc/tools/verify_event_release.cjs
node --test poc/tests/core.test.js poc/tests/events.test.cjs
node --test poc/tests/documentation_policy.test.cjs
```

通常CIは [PoC Core Tests](.github/workflows/ci.yml)。固定GameTora全件の検証は [専用ワークフロー](.github/workflows/whole-event-inventory.yml)。ブラウザ・物理端末での確認は[検証計画](docs/verification-plan.md)の別ゲートです。
