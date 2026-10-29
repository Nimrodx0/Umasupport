# 2026-10-29：GitHub派生JSONから既存の新カード増分審査ステージまで接続

## 完成に向けて接続した境界

`poc/src/derived_github_staging_bridge.cjs` は、以下を**メモリ上だけ**でつなぐ。

1. UmaSim完全名簿の新カードID差分＋前日から持ち越した未収録ID
2. `derived_github_new_card_source_plan.cjs` が固定した第三者GitHubのコミット、完全Git tree、カードJSONのblob SHA
3. 対象カードのJSONと、UmaSimの独立数値スキル辞書を `derived_github_runtime_draft.cjs` で非公開アプリ形へ変換
4. `new_card_event_incremental.stageNewCardEvents` で既存DBを書き換えずにカードごとのレビュー待ち／保留を判定

既存の元GameTora直接取得由来候補は互換として保持するが、**現行主経路は `GameTora-derived-GitHub`**。派生GitHub候補には出典の固定コミット／カード別Git blob SHA／正確なパスが一致しなければ受け付けない。元サイト表示パネル数ではなく派生JSONのイベント数を使い、出典不一致や一部だけ変換されたカードを登録待ち完成扱いにしない。

- JSON未掲載：`derived-github-json-not-yet-published`
- JSONは存在するが本文未取得：`derived-github-source-not-fetched`
- JSONのGit SHA不一致やカードごとの変換失敗：`derived-github-card-validation-failed`
- 元JSONに未解決イベントがある：`derived-github-source-unresolved`
- 非公開モデルへの全イベント投影が成功：**編集・公開審査待ち**。この段階ではDBへ追記しない

**安全条件**：別カードに欠損や不整合があっても、独立して検査可能なカードだけはレビュー待ちへ進める。どのカードも正式な公開審査済みの原子的追記が完了するまでは、`carryForwardPendingIds` に保持する。仮データの `sourceKind:derived-github-unreviewed` を保持するため、既存 `event_release_gate.verifyRelease` を通ることはない。第三者のイベント原文／選択肢文章は記録・公開しない。

## A/B/C検証

- **A 機構**：合成の新カード3枚で、完全な1枚は技術的レビュー待ち、JSON未掲載1枚と未解決1枚は保留。Git blob改ざん1枚のみ失敗、別カードの正常候補は維持。出典計画と名簿の不一致、対象外カード挿入、候補が未承認のまま公開ゲートへ流れないことを回帰確認。
- **B 固定実データ**：[GitHub Actionsでの歴史的4枚の実データ接続](https://github.com/Nimrodx0/Umasupport/actions/runs/40831144642)。R10016・SR20075を技術的レビュー候補、SSR30010・SSR30030をイベント未解決の保留として分類し、**4枚とも正式収録まで次回持越**を検査。これは歴史的カードを監査用に「新規」と扱う**人工的な名簿差分**であり、2026年10月の新カード更新・実ゲーム全収録を実証したものではない。
- **C 実環境**：Node ActionsとCIのChromiumブラウザ回帰。公開Pages上の本番イベントデータ・Windows/Android物理端末の実操作は未検証。

## これから残る仕事

このPRは **取得済みJSON → 非公開イベントv1変換 → 既存の新カード審査ステージ** をつないだ。実際の自動日次運用には完全名簿の差分・保留台帳の永続読み書き・GitHub元ソースの一時取得・イベント審査／追記コミットの接続が別途必要。公開された独自イベントDBは**0件**であり、未承認イベントの隔離印を取り外して自動公開する実装はしない。今後は**編集審査の画面／証跡と出典利用条件の確認、初回の実イベント登録・Pages操作検証**を優先する。GameTora本体の汎用HTML抽出には戻らない。
