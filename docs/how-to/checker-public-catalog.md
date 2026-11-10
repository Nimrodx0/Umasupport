# イベント公開の承認・検証ゲート（現行）

本書はイベント候補を**正式配信する前**のチェック手順です。旧Checker中心の手順と2026-10-16～11-02の実装経緯は[当時の全文](../evidence/events/checker-public-catalog-history-20261016-20261102.md)に残しています。以前の記述にある「公開イベント0件」は現行の配信件数ではありません。

## 承認対象を固定する

- 配信本体：[reviewed_events.v1.json](../../poc/data/reviewed_events.v1.json)。
- 承認台帳：実際に配信されるカタログにイベントがある場合、[現行台帳選択ロジック](../../poc/src/current_public_event_approvals.cjs)に従ってGT由来の承認台帳 `poc/config/event-release-approvals.gt2487.v2.json` を使います。旧空データ用v1台帳と混同しません。
- 入力候補と公開承認済みのイベントは別です。[出典優先順位](../reference/data-sources.md)と[個別裁定](../reference/event-adjudication-enforcement.md)を優先します。

## 公開前チェック

1. カードID、イベントID、選択肢と結果ごとのスキルID・ヒントLv、連続継続／打ち切りを、固定元出典と照合する。未確認結果は無条件報酬へ昇格しない。
2. 公開データは独立した数値事実と構造に限り、第三者の原文・画像・創作的構成を無断で転載しない。事実利用、アクセス条件、再配布・権利、データの正確性を分けて評価する。
3. 公開対象イベントすべてについて、申請対象の**内容ハッシュと承認台帳の対応**が欠落・重複・対象外なしで一致することを確認する。
4. 既存の承認済みカタログと設定・キャッシュを保護し、回帰試験を行う。新カードは既存イベントの全件置換ではなく増分追加する。

## 機械検証

```sh
node poc/tools/verify_event_release.cjs
node poc/tools/check_project_tracking.cjs
```

これらの成功は**コード・JSON・台帳間の整合性**の確認であり、実ゲームの全数一致、第三者権利、実ブラウザでの動作を自動証明しません。A/B/Cは[検証計画](../quality/verification-plan.md)で別々に記録します。

[現行の増分取込手順](curated-event-intake.md) ／ [履歴の原本](../evidence/events/checker-public-catalog-history-20261016-20261102.md)
