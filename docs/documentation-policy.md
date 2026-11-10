# 文書運用規約

人間と開発エージェントが共通で使用する、**文書の保存先・粒度・更新原則**です。最新のPR成果や固定実験結果をこのページへ追記しません。

## 原則

1. **一情報・一正本**：同じ現在値を複製せず、他文書からリンクする。
2. **状態の分離**：現行要件、確定判断、未採用案、研究仮説、実測、履歴を区別する。
3. **親子構造**：ロードマップは上位工程、[plans](plans/index.md)は実施可能な小工程、[evidence](evidence/README.md)は結果の原本とする。
4. **根拠の保存**：日時・版／SHA・母集団・方法・適用限界・未検証を示す。
5. **公開条件の保護**：第三者の原文・画像・無承認DB、秘密・個人情報・会話全文を無断で公開しない。

## どこに何を書くか

| 場所 | 正本にする情報 |
| --- | --- |
| [README](../README.md)・[AGENTS](../AGENTS.md)・[索引](index.md) | 概要、入口、恒久的な約束 |
| [requirements](requirements.md) | 有効な機能・対象外・受入条件 |
| [decisions](decisions.md) | ユーザーが確定した仕様と理由、後続置換 |
| [architecture](architecture.md)・[event-schema](event-schema.md)等 | 現行技術契約 |
| [roadmap](roadmap.md) | 優先順位と工程間の依存関係 |
| [plans](plans/index.md) | 小工程ID、作業、状態、結果、根拠、次の判定 |
| [status](status.md) | 最新の日時付き実測と未検証の範囲 |
| [verification-plan](verification-plan.md) | A（機構）、B（データ）、C（実環境）のゲート |
| [evidence](evidence/README.md)・[証拠索引](evidence-index.md) | 分野別の固定研究・監査と引用経路 |
| [archive](archive/)・[開発履歴](development-history.md)・[検証履歴](verification-history.md) | 旧状態の保存 |
| [PoC開発手順](../poc/README.md) | 起動・テストコマンド |

## 下位計画の書き方

- **P2.1・W1.2**等、親工程と番号で結び付いた小工程を作り、**作業内容・状態・結果・根拠・終了条件**を記載する。
- 研究の「計測済み」、内部「実装済み」、一般公開、A/B/Cの「合格」を混同しない。未実施をPassと書かない。
- 結果と課題は一工程ずつ短く記載し、反例・数値・出典版などの詳細は個別証拠へリンクする。**異なる作業を改行なしの長大な1文に連結しない**。
- 記録は日付付きの場合、原則として`docs/evidence/skills/`、`events/`、`sources/`、`quality/`へ分類し、`docs/`直下へ無秩序に増やさない。
- 大きな仕様変更は[decisions](decisions.md)と[requirements](requirements.md)に反映。古い決定は履歴に残し、置換関係を明確にする。

## 変更時の手順

関連する正本とコードを確認→変更した工程・証拠・現在値だけ改訂→関係する参照を同期→ローカルの相対リンク、スクリプトのファイル参照、テスト・CIの整合性を確認→PRと未実施の検証を報告します。旧記録の「現在」「次」を新しい優先順位へ繰り上げません。

[handoff_quality.test.cjs](../poc/tests/handoff_quality.test.cjs)は正本への到達経路を、[documentation_policy.test.cjs](../poc/tests/documentation_policy.test.cjs)は公開境界と履歴を、[check_project_tracking.cjs](../poc/tools/check_project_tracking.cjs)は現在値と公開JSONの整合性を検査します。機械検査だけで資料の意味や実ゲームの一致、第三者データの再配布権を保証できません。

権限や未承認のため反映できない変更は「反映済み」と記載しません。
