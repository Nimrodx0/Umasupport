# サポートカードのイベントを増分収録する：現行手順

本書は現行の主要なイベント取込経路だけを扱います。[GameWith-first方式の旧全文](../evidence/events/curated-event-intake-legacy-20261019.md)は2026-10-19当時の記録であり、今の全件取込指示ではありません。

## 適用範囲と入力

- **通常の入力**：固定コミットとカード別blobを照合したGameTora由来の第三者GitHub構造化JSON。通常ヒント・新カードIDはUmaSimの公開元と照合します。[現行の出典](../reference/data-sources.md)。
- **増分のみ**：UmaSim名簿の新規カードIDだけを対象にし、既存の承認済みイベントやユーザーの設定を一括更新しません。[W3の作業計画](../plans/product.md)。
- **例外の裁定**：特定カードの派生JSONに欠損・衝突・未掲載がある場合だけ、元GameToraやGameWithの掲載事実に基づき個別検証します。[例外の仕様](../reference/event-adjudication-enforcement.md)。

## 収録工程

1. [最新状況](../project/status.md)と[詳細計画](../plans/product.md)から未収録の数値カードIDと今回の対象を確定します。
2. 固定UmaSim名簿の差分で新規IDを抽出し、派生GitHub元のコミット、カードJSONパス、blob SHAを固定します。未掲載なら保留台帳へ持ち越します。[実装監査](../evidence/sources/derived-github-new-card-review-staging-20261029.md)。
3. 現行の変換・増分取込コード（[staging bridge](../../poc/src/derived_github_staging_bridge.cjs)・[new card increment](../../poc/src/new_card_event_incremental.cjs)）を確認し、分岐、結果ごとのスキルID・ヒントLv、継続・打ち切りが保持されるか検査します。
4. 不一致、重複、未知の条件、公開前の候補を**未確認のまま保持**します。未掲載を確定0件として数えず、結果の異なる選択肢を無条件の報酬へ変換しません。
5. [正式公開ゲート](checker-public-catalog.md)で採否と承認台帳の内容ハッシュを検証します。追加対象以外の既存DB・保存済み設定・キャッシュの回帰検査も行います。

## 実行確認

```sh
node poc/tools/verify_event_release.cjs
node poc/tools/check_project_tracking.cjs
```

これは公開JSONと承認台帳の**機械的整合性**の検証です。出典・権利の承認、現ゲーム網羅性、実ブラウザ動作は別です。A/B/Cの区分は[検証計画](../quality/verification-plan.md)に従います。
