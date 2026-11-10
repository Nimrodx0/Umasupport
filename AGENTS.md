# 開発エージェントへの指示

このファイルは**担当者が変わっても維持する作業原則と必須の境界**を示します。時点依存の工程・件数・研究結果はここへ重複記載しません。詳細な保存先は [文書運用規約](docs/governance/documentation-policy.md) を参照してください。

文書の配置と開発エージェント向けの導線は[文書設計方法論](docs/governance/documentation-methodology.md)と[更新手順](docs/how-to/update-docs.md)を参照してください。

## タスクに必要な文書を段階的に取得する

`AGENTS.md`は自動読込される**少量の必須指示と情報の地図**です。[文書索引](docs/index.md)から正本を探し、**文書全件を開始時に一括読み込みしない**。先に依頼内容と編集対象を絞り、必要な契約・コード・証拠だけを読む。文書の階層やファイル数自体を開発成果とみなさない。

| 作業の種類 | 最初に確認する正本 | 次に必要となる情報 |
| --- | --- | --- |
| 機能追加・UI修正 | [要件](docs/reference/requirements.md)、[アーキテクチャ](docs/reference/architecture.md)、変更対象コード | [PoC実行とテスト](poc/README.md)、関連する判断・受入条件 |
| イベント・出典データ | [データソース](docs/reference/data-sources.md)、[イベントスキーマ](docs/reference/event-schema.md) | [公開審査](docs/how-to/checker-public-catalog.md)、固定出典の個別監査 |
| スキル条件・適性研究 | [研究計画](docs/plans/skill-conditions/index.md)、[研究設計](docs/explanation/skill-activation-tendencies-design.md) | 対象P番号の詳細・対応する固定証拠 |
| 次工程の着手・引き継ぎ | [ロードマップ](docs/project/roadmap.md)、[現在の状態](docs/project/status.md)、[小工程](docs/plans/index.md) | [決定履歴](docs/decisions/log.md)、該当Issue／PR |
| 検証・公開 | [検証計画](docs/quality/verification-plan.md)、対象コード・データ | 対象のCI、公開判定、日時・固定版付きの証拠 |

実装前に**実ファイルと現在のテスト**も確認し、文書とコードが食い違う場合は根拠を調査する。古いPR・研究監査・[履歴](docs/archive/)を自動的に現行指示へ昇格させない。どの文書もリンクなしに存在し得るため、ファイル検索とGit履歴も利用する。

## 引き継ぎと変更

- 別スレッド・エージェント・開発者でも続行できるよう、**確定した要件と理由、設計、検証済みの事実、未完と次の作業**をレポジトリの適切な正本に残す。利用者が会話中に開発上の判断を確定・変更したときは、明示的な「文書更新」依頼がなくても同じ作業内で必要な正本を同期する。
- 未採用案・未検証仮説・出典未確認の事実は確定事項にしない。進捗の報告には更新先とPR／コミット、実施／未実施の検証を明記し、未マージや書込不能を「反映済み」と呼ばない。
- 外部データ、秘密情報、個人情報、第三者の著作物は取得条件・公開可能性を区別する。公開レポジトリに無断で格納しない。

## 製品とデータの不変条件

- デッキの獲得**候補**と実ゲームでの獲得確定、固定ソース内の変換とゲーム全体の網羅、数値事実の採用と正式公開の承認を混同しない。未確認・未収録・存在しない根拠付きを分ける。
- サポカ・イベント・スキルは根拠付きの数値IDと構造で照合する。同名の異ID、金／白／○／◎、通常ヒントとイベント結果を無断で統合しない。イベントの選択・排他的結果・内部の分岐／継続・打ち切りを保持し、外部発生確率は推測しない。詳細は [要件](docs/reference/requirements.md) と [イベントスキーマ](docs/reference/event-schema.md)。
- **現行のイベント収録主経路は構造化されたGameTora由来GitHub JSON**。疑義・欠損の具体的な数値裁定にはGameWithを用い、元GameTora HTMLの全面直接取得を前提にしない。既存DBの一括利用と例外管理が主工程で、既存データを無断で全件再生成・上書きしない。細かい出典優先順位・機械的採用条件は [データソース](docs/reference/data-sources.md)・[イベント裁定契約](docs/reference/event-adjudication-enforcement.md)・[ロードマップ](docs/project/roadmap.md)を参照する。
- 承認のないイベント候補・第三者原文・画像は公開データに混ぜない。公開境界は [公開ゲート](docs/how-to/checker-public-catalog.md) と [権利・取得条件](docs/decisions/event-data-acquisition-rights-20261019.md) を参照する。外部取得が不正・欠損した場合、検証済みキャッシュと保存設定を安全に扱う。

## 検証と完了の表現

- 変更の対象・母集団・例外・合格条件を事前に定め、[検証計画](docs/quality/verification-plan.md) の **A 機構／B データ／C 実環境**を独立に評価する。単体・CI成功、固定データ監査、Pagesのブラウザ確認、物理端末の検証は相互に代替しない。
- 原則として Node.js 22以上と既存CIを利用する。必要な監査、権利・公開ゲートは対象作業に応じて実行し、未実施をPassとしない。開発の実施手順は [poc/README.md](poc/README.md) を参照する。
- 変更によって仕様・現状・作業順・小工程・Issueが変わる場合は、[文書運用規約](docs/governance/documentation-policy.md)に従い必要な記録を同期する。PRで検証した事実と、利用者の明示確認が必要な判断を区別する。
