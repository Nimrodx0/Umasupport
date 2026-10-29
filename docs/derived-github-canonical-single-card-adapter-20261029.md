# 2026-10-29：既存のGameTora全件変換器を新サポカ1枚の増分取り込みに再利用

## 目的と訂正

以前の `gametora_whole_event_normalize.cjs` → `gametora_event_skill_crosswalk.cjs` → `gametora_app_schema_dry_run.cjs` は、固定GameTora由来JSON全2,488イベントをウマサルタント形式へ投影し、`phase2_integrated_private_catalog.cjs` 等でGameWithの個別補完を加えた非公開2,496イベントを統合・読込試験した**既存の変換器**である。これに対し2026-10-29の `derived_github_runtime_draft.cjs` はより狭い対応範囲を別実装していたため、**新カード増分取り込みの主経路から外す**。旧モジュールと過去の全件監査は記録・回帰用に残し、既存DBの再生成・上書きはしない。

今回の主経路：

`derived_github_new_card_source_plan` → `derived_github_card_event_preflight`（Git commit / tree / blob照合）→ **`derived_github_existing_converter_adapter`**（1枚に限定した既存正規化・スキルID照合・独自スキーマ投影）→ `derived_github_staging_bridge` → `new_card_event_incremental.stageNewCardEvents`（レビュー待ち／持越）。

### 旧全件版の再利用と変更点

- 既存の `crosswalk` と `project` に `sourceRevision` オプションを追加。省略時は従来の固定ベースライン版を検証し、既存の全件監査はそのまま保持。増分時は**Git blob検証済み**の対象JSONと、その固定Git commitを明示して1カードだけ投入する。
- スキル辞書は独立UmaSim数値ID・名称を使用し、`skillRevision` も明記する。固定コミットを表す引数と、実バイト内容の照合を混同しない。アダプタは既存スキル照合コードを流用し、カードが本番モデルに未掲載でも単一の使い捨てモデル内で独自スキーマを検証する。
- 元のイベント・選択肢・結果・ヒントLv・排他的ヒント・連続後続・通常／特殊／お出かけ経路などの判断は**既存の変換器**が担当し、単一カードアダプタは再実装しない。
- `reviewItems` は**変換で保留されたイベント**（`schema-projection`）と、**変換に成功しても元出典に疑義がある記録**（`source-normalization`、`source-chain-order`）を分離して保持する。差異を既存DBに一致させることは目的ではない。疑義はGameWithによる個別裁定対象となり得るが、元資料の明確な内容を黙って書き換えない。
- 既存の非スキル効果監査の `isKnownSourceEffectType` を共用し、**新しい未知の効果種別を空の報酬として通す危険**を検出する。未知コードを含むイベントと、その前段に依存するイベントは保留、独立した他イベントは維持する。既知の非スキル効果はスキル中心の投影で省略される場合があり、その言及件数を `nonSkillEffectMentionsNotInSkillProjection` として明示する。
- `sourceKind:derived-github-unreviewed` を出力に強制付与し、**正式公開ゲートには自動通過できない**。新カードは正式追記されるまで保留IDに残し、既存DB・承認台帳・利用者設定は変更しない。

## 対象と検証の意味

- **A 機構**：人工1枚／複数枚で通常スキル、範囲・排他的結果、特殊イベント、通常お出かけの内部依存、保留原因、未知効果、安全なGit blob同一性、旧変換器の固定版テストを検査。
- **B 実データ**：`systemless10/UmamusumePS@62ec54e754f903e347da807d30aad40e53d794d2` の歴史的なR10016／SR20075／SSR30010／SSR30030を、新カードとして扱う**監査用人工差分**で一時処理。元サイトや補完済み既存DBとの完全一致は要求しない。新カードの本番利用と最新全ゲームイベント網羅性は別。
- **C**：Actions Nodeと既存Chromium回帰。Windows／Android物理端末での、追加済みイベントを使った試験は未完了。

## 残る実装

既存の全件変換コードは固定版向けに成長してきたため、単一カードの機械的変換だけで**自動的に正式公開できる**わけではない。GameWithによる必要な補完、レビュー記録の運用、最新のUmaSim名簿差分とGitHubの未掲載カードの持越、承認後の実際の増分追記、公開アプリでの受け入れ試験が残る。旧既存DBのイベントを作り直す必要はない。
