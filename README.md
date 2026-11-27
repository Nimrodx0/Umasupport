# ウマサルタント（Uma Support Lab）

ウマ娘 プリティーダービーの「本育成」と「継承育成」のサポートカード編成を、**通常ヒント・イベント別スキル候補・上位／下位スキル・重複・目標カバー**から比較する非公式Webアプリです。編成は利用者が決めます。**開発中のPoCであり、完成版ではありません。**

**[公開アプリ（GitHub Pages）](https://nimrodx0.github.io/Umasupport/)**：`index.html` から `poc/live.html` を開きます。主な実装はHTML/CSS/JavaScript。Node.jsは検証・データ処理に使用しています。

## 現行のデータの扱い

- **通常ヒントとスキル辞書**：UmaSimの公開元を起動時に取得し、形式検査とIndexedDBキャッシュを使います。
- **イベント候補**：[D-067](docs/decisions/log.md#decision-d-067) により、新規カードはUmaSimの名簿差分で検出し、GameTora本体から対象カードだけを限定直接取得・独自変換します。従来の第三者GitHub `systemless10/UmamusumePS` は既存固定版・履歴照合に限定します。GameWithは具体的な疑義・欠損の個別裁定に用います。全件の再取得・既存DBの上書き・定期自動アクセスはこの判断の対象外です。
- **正式公開イベント**：内部の技術変換・プレビューとは独立し、イベント公開審査と権利・正確性の確認が必要です。試験変換件数がそのままゲーム内の正確性・網羅性を表すことはありません。
- **本文・画像の取扱い**：第三者のイベント原文、選択肢文章、画像、無承認のマスターDBはそのまま再配布しません。

固定データの集計値や検証したコミットなど、**日付と出典に依存する内容は [開発状況](docs/project/status.md) に集約**しています。

## 開発版の試用

- [通常アプリ](https://nimrodx0.github.io/Umasupport/poc/live.html)
- [結果別イベントの試用モード](https://nimrodx0.github.io/Umasupport/poc/live.html?eventPreview=results)：未承認の数値候補。通常の公開イベントデータとは別です。
- [選択肢別の数値候補プレビュー](https://nimrodx0.github.io/Umasupport/poc/live.html?eventPreview=facts)：一部の結果・連続分岐は未確認。通常データとは分離。
- [SSRエフフォーリアの限定試用](https://nimrodx0.github.io/Umasupport/poc/live.html?eventPreview=30311)：独立した監査用サンプルで、正式収録ではありません。

## 全スキル一覧の使い方

通常アプリのヘッダーから「全スキル一覧」を開くと、編成に関係なく収録スキルを検索できます。明示適用範囲と脚質適性は別の絞り込みです。適性データなしでも明示条件で検索できます。

適性データは起動時に公開済みの独自判定を自動で読み込み、現在の元辞書と固定元辞書とのID・条件構造の一致を検証します。元辞書は公開元から直接取得します。取得失敗や変更・未照合スキルは未判定とし、明示条件の検索・編成は利用できます。手動の検証済みJSON読込は予備機能として残します。限定ラベルは研究条件内の参考であり実ゲームの発動率ではありません。[D-060の公開方針](docs/decisions/log.md#decision-d-060)。公開用データの自動読込はPagesの自動受入で確認済みです。明示的な単一脚質限定も適性ありとして扱い（D-062）、比較研究の判定とは区別します。最新の検証結果・件数・未実施の範囲は[開発状況](docs/project/status.md)を参照してください。

## 文書の入口

**[文書索引](docs/index.md)** から、[工程別の詳細計画](docs/plans/index.md)と[分野別の研究・監査記録](docs/evidence/README.md)を辿れます。要件・決定・設計・進捗の正本もこちらから確認できます。開発を再開するときは [AGENTS.md](AGENTS.md)、[ロードマップ](docs/project/roadmap.md)、[開発状況](docs/project/status.md)、対象の[研究・監査記録](docs/evidence/catalog.md)を確認してください。詳細なルールは [文書運用規約](docs/governance/documentation-policy.md) にあります。

## 開発と検証

Node.js 22以降を使用してください。主要なテストやツールの使い方は [PoC開発手順](poc/README.md) を参照してください。

```sh
node poc/tools/verify_event_release.cjs
node --test poc/tests/core.test.js poc/tests/events.test.cjs
node --test poc/tests/documentation_policy.test.cjs
```

通常CIは [PoC Core Tests](.github/workflows/ci.yml)。旧固定GameTora全件の履歴検証は [専用ワークフロー](.github/workflows/whole-event-inventory.yml)（旧配信元の可用性に依存）。新規カードの直接取得は [運用手順](docs/how-to/upstream-refresh-operations.md) を参照してください。ブラウザ・物理端末での確認は[検証計画](docs/quality/verification-plan.md)の別ゲートです。
