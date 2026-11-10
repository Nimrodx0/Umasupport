# AIエージェント用：現在の契約へのショートカット

このページは**別の仕様正本ではありません**。長い仕様書や経緯を全部読まずに、タスクの契約・現在のコード・検証を発見するための最小限のルーティング表です。数値・仕様変更・公開可否の真偽は必ずリンク先の現行コード・承認済みJSONで照合します。

| 変更・調査対象 | 先に読む正本 | 実際の実装・検証 |
| --- | --- | --- |
| デッキ・スキル集計 | [機能要件](requirements.md)、[アーキテクチャ](architecture.md) | [core.js](../../poc/src/core.js)、[core.test.js](../../poc/tests/core.test.js) |
| UI、カードの識別・保存 | [要件](requirements.md)、[ランタイム読込](runtime-data-loading.md) | [live_app.js](../../poc/src/live_app.js)、[settings.js](../../poc/src/settings.js) |
| 公開イベントの分岐・候補 | [イベントスキーマ](event-schema.md)、[公開承認の手順](../how-to/checker-public-catalog.md) | [公開カタログ](../../poc/src/public_event_catalog.js)、[公開JSON](../../poc/data/reviewed_events.v1.json) |
| 新しいカードの増分取込 | [出典契約](data-sources.md)、[現行イベント取込手順](../how-to/curated-event-intake.md) | [stage bridge](../../poc/src/derived_github_staging_bridge.cjs)、[増分追加](../../poc/src/new_card_event_incremental.cjs) |
| 公開承認・内容ハッシュ | [公開条件と例外](../how-to/checker-public-catalog.md)、[出典裁定](event-adjudication-enforcement.md) | [承認台帳の選択](../../poc/src/current_public_event_approvals.cjs)、[verify_event_release.cjs](../../poc/tools/verify_event_release.cjs) |
| スキルの上位・下位対応 | [確定要件](requirements.md)、[階層レビュー](reviewed-skill-hierarchy.md) | [skill_hierarchy.js](../../poc/src/skill_hierarchy.js) |
| P2の脚質研究 | [現在の決定](../decisions/index.md)、[研究設計](../explanation/skill-activation-tendencies-design.md) | [P2の小工程](../plans/skill-conditions/p2.md)、[研究証拠](../evidence/skills/README.md) |
| 受入・品質判定 | [検証計画](../quality/verification-plan.md)、[現在の実測](../project/status.md) | [実行手順](../../poc/README.md)、[CI](../../.github/workflows/ci.yml) |

## 使い方

1. 担当変更箇所のコードを確認してから、該当する仕様書・判断・証拠を**必要な分だけ**開きます。
2. 現行仕様は`reference/`、過去の監査は`evidence/`、旧方針は`history/`や`archive/`で位置づけを確認します。時間順で後にあることだけで有効仕様とは判断しません。
3. 情報が食い違う場合は現行の[決定状態台帳](../decisions/index.md)、[要件](requirements.md)、実コード、テストの順に照合し、根拠不足なら推測で確定せず保留にします。

参考：[文書運用規約](../governance/documentation-policy.md)、[文書方法論](../governance/documentation-methodology.md)。
