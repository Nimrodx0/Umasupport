<!-- Preservation snapshot: original docs/index.md as of 1e366e2e5513d19171606b77b16a59a06c1f2e3a, with local links rebased. Do not treat historical "current" claims as current. -->
# 文書の入口

[README](../../../README.md) がプロジェクトの概要、[AGENTS.md](../../../AGENTS.md) がエージェントの作業入口です。**このページは索引であり、仕様や現在値の正本ではありません。**

## 開発を引き継ぐとき

1. **現行の作業**：[ロードマップ](../../project/roadmap.md) の未完工程を確認し、[開発状況](../../project/status.md) の実測・未検証項目、関連するOpen Issueを照合する。
2. **何を・なぜ**：[要件](../../reference/requirements.md) を現在有効な仕様として読み、理由や撤回関係が必要なとき [意思決定ログ](../../decisions/log.md) を参照する。
3. **どう実現・どう検証**：[アーキテクチャ](../../reference/architecture.md)、[イベントスキーマ](../../reference/event-schema.md)、[検証計画](../../quality/verification-plan.md)、対象コード／テストを参照する。
4. **研究の再開**：対象の[設計](../../explanation/skill-activation-tendencies-design.md)と[調査・監査資料の索引](../../evidence/catalog.md)から出典・モデル・限界を確かめ、未確定事項を決定済みと扱わない。

## 文書の役割

| 情報 | 正本 |
| --- | --- |
| 開発者・AIの作業規則 | [AGENTS.md](../../../AGENTS.md)、[文書運用規約](../../governance/documentation-policy.md) |
| 機能要件・対象外・受入条件 | [requirements.md](../../reference/requirements.md) |
| 確定した仕様判断とその変更理由 | [decisions.md](../../decisions/log.md)（履歴）、有効仕様は requirements |
| 現行のソース・モジュール・データ契約 | [architecture.md](../../reference/architecture.md)、[event-schema.md](../../reference/event-schema.md)、[data-sources.md](../../reference/data-sources.md) |
| 未来の優先順位・依存関係 | [roadmap.md](../../project/roadmap.md)、具体的な残課題は [GitHub Issues](https://github.com/Nimrodx0/Umasupport/issues) |
| 実装・公開・試験の最新到達点 | [status.md](../../project/status.md) |
| 検証の合格条件 | [verification-plan.md](../../quality/verification-plan.md) |
| 日付付き監査・研究成果 | [evidence-index.md](../../evidence/catalog.md) と各監査ファイル |
| 作業・検証の旧記録 | [verification-history.md](../../history/verification-history.md)、[development-history.md](../../history/development-history.md)、[archive/](..) |
| 実装・試験コマンド | [poc/README.md](../../../poc/README.md) |

## 情報が食い違うとき

**現在有効な要求は requirements、実装の観測事実はコード／配信データと検証結果、未完の優先順位は roadmap** で確認します。意思決定ログと研究資料は背景を追うための記録であり、旧実測を現在値としてコピーしません。判断を更新する場合は [文書運用規約](../../governance/documentation-policy.md) に従い、関係する正本を必要最小限更新します。
