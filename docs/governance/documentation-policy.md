# 文書運用規約

人間と開発エージェントが共通で使用する、**文書の保存先・粒度・更新原則**です。最新のPR成果や固定実験結果をこのページへ追記しません。

[文書体系の方法論](documentation-methodology.md) ／ [成果物と受入条件](../plans/wbs-dictionary.md) ／ [ADRの管理](../adr/README.md) ／ [情報保全の監査](../evidence/quality/documentation-integrity-review-20261110.md)

## AIエージェントへの情報の渡し方

1. **小さな常時入口**：リポジトリの[AGENTS.md](../../AGENTS.md)には変わりにくい制約と必要文書の所在だけを残す。文書本文を重複させない。
2. **必要時に段階的取得**：変更範囲に合う現行仕様・コード・テストを先に確認し、研究と履歴は関連する証拠のみ参照する。
3. **実体と矛盾しないこと**：文書の「実装済み」は実コード・公開JSON・検証で確認し、古い結果を現行事実へ昇格させない。
4. **機械検査は実用的な不変条件に限定**：リンク切れ、正本への到達、合格基準の参照を検査する。特定のフォルダ数や`docs/`直下のファイル数は制限しない。
5. **更新可能な計画と証拠**：小工程の状態・次の作業・保留理由を[plans](../plans/index.md)で更新し、時点依存の詳細は[evidence](../evidence/README.md)へ残す。

## 原則

1. **一情報・一正本**：同じ現在値を複製せず、他文書からリンクする。
2. **状態の分離**：現行要件、確定判断、未採用案、研究仮説、実測、履歴を区別する。
3. **親子構造**：ロードマップは上位工程、[plans](../plans/index.md)は実施可能な小工程、[evidence](../evidence/README.md)は結果の原本とする。
4. **根拠の保存**：日時・版／SHA・母集団・方法・適用限界・未検証を示す。
5. **公開条件の保護**：第三者の原文・画像・無承認DB、秘密・個人情報・会話全文を無断で公開しない。

## 文書の配置規則

**フォルダの完全性や空のルートを義務化しません。** 現時点では`docs/index.md`が中心的な入口ですが、これは便宜的な配置であり規格上の要件ではありません。新規文書は、変更対象のコード・データ、正本、参照者の目的を考えて配置します。独立した責任を持ち、検索・参照の導線が確保できるなら、`docs/`直下やコード近傍にも配置できます。

- 現行の進捗・上位方針は`project/`、詳細工程は`plans/`。
- 現行の定義は`reference/`、具体的手順は`how-to/`、設計理由は`explanation/`、学習用演習は`tutorials/`。
- 利用者判断は`decisions/`、設計判断記録は`adr/`、受入基準は`quality/`、文書のルールは`governance/`。
- 固定研究は`evidence/`、更新する過去の記録は`history/`、凍結版は`archive/`。

一つの文書が複数の性質を持つ場合、**作業目的・責任範囲・更新主体**を基準に一か所を正本とし、他の入口からリンクします。既存ファイルを新しいフォルダへ移す前に、AIエージェントの発見性と参照変更コストを比較してください。新しいカテゴリのフォルダを作ることや、過去の資料を移動することは原則として最終手段です。歴史記録の削除や仮説の現行仕様への昇格はしません。

## どこに何を書くか

| 場所 | 正本にする情報 |
| --- | --- |
| [README](../../README.md)・[AGENTS](../../AGENTS.md)・[索引](../index.md) | 概要、入口、恒久的な約束 |
| [requirements](../reference/requirements.md) | 有効な機能・対象外・受入条件 |
| [decisions](../decisions/log.md) | ユーザーが確定した仕様と理由、後続置換 |
| [architecture](../reference/architecture.md)・[event-schema](../reference/event-schema.md)等 | 現行技術契約 |
| [roadmap](../project/roadmap.md) | 優先順位と工程間の依存関係 |
| [plans](../plans/index.md) | 小工程ID、作業、状態、結果、根拠、次の判定 |
| [status](../project/status.md) | 最新の日時付き実測と未検証の範囲 |
| [verification-plan](../quality/verification-plan.md) | A（機構）、B（データ）、C（実環境）のゲート |
| [evidence](../evidence/README.md)・[証拠索引](../evidence/catalog.md) | 分野別の固定研究・監査と引用経路 |
| [archive](../archive/)・[開発履歴](../history/development-history.md)・[検証履歴](../history/verification-history.md) | 旧状態の保存 |
| [PoC開発手順](../../poc/README.md) | 起動・テストコマンド |

## 下位計画の書き方

- **P2.1・W1.2**等、親工程と番号で結び付いた小工程を作り、**作業内容・状態・結果・根拠・終了条件**を記載する。
- 研究の「計測済み」、内部「実装済み」、一般公開、A/B/Cの「合格」を混同しない。未実施をPassと書かない。
- 結果と課題は一工程ずつ短く記載し、反例・数値・出典版などの詳細は個別証拠へリンクする。**異なる作業を改行なしの長大な1文に連結しない**。
- 日付付きの文書レビューと全件点検台帳は`evidence/quality/`の**固定記録**として扱います。現在の検証基準は`quality/`です。日付付きの研究記録は既存の`docs/evidence/skills/`、`events/`、`sources/`、`quality/`から適切な場所を選ぶ。例外ではファイルの意味・参照先と管理責任を明記し、既存の証拠体系を不必要に変更しない。
- 大きな仕様変更は[decisions](../decisions/log.md)と[requirements](../reference/requirements.md)に反映。古い決定は履歴に残し、置換関係を明確にする。

## 変更時の手順

関連する正本とコードを確認→変更した工程・証拠・現在値だけ改訂→関係する参照を同期→ローカルの相対リンク、スクリプトのファイル参照、テスト・CIの整合性を確認→PRと未実施の検証を報告します。旧記録の「現在」「次」を新しい優先順位へ繰り上げません。

[handoff_quality.test.cjs](../../poc/tests/handoff_quality.test.cjs)は正本への到達経路を、[documentation_policy.test.cjs](../../poc/tests/documentation_policy.test.cjs)は公開境界と履歴を、[check_project_tracking.cjs](../../poc/tools/check_project_tracking.cjs)は現在値と公開JSONの整合性を検査します。機械検査だけで資料の意味や実ゲームの一致、第三者データの再配布権を保証できません。

権限や未承認のため反映できない変更は「反映済み」と記載しません。
