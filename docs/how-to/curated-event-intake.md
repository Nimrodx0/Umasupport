# サポートカードのイベントを増分収録する：現行手順

本書は現行の取込経路を扱う。[GameWith-first方式の旧全文](../evidence/events/curated-event-intake-legacy-20261019.md)は2026-10-19当時の記録であり、今の全件取込指示ではありません。

## 適用範囲と入力

- **通常の入力（D-067）**：GameTora本体の個別カードページから限定直接取得した構造・数値事実。通常ヒント・新カードIDはUmaSimの固定公開元と照合します。従来の派生GitHubは既存固定版の履歴照合のみ。[現行の出典](../reference/data-sources.md)。
- **増分のみ**：UmaSim名簿の新規カードIDだけを対象にし、既存の承認済みイベントやユーザーの設定を一括更新しません。[W3の作業計画](../plans/product.md)。
- **例外の裁定**：GameTora本体の個別イベントに欠損・衝突・曖昧な進行条件がある場合、GameWithの掲載事実で個別裁定します。[例外の仕様](../reference/event-adjudication-enforcement.md)。

## 収録工程

1. [最新状況](../project/status.md)と[詳細計画](../plans/product.md)から未収録の数値カードIDと今回の対象を確定します。
2. 固定UmaSim名簿の差分で新規IDを抽出し、最新名簿と独立スキル辞書のコミット・blobを固定します。GameToraの一覧から個別URLを解決し、限定ブラウザ検証でイベント見出しと本文を照合します。未掲載・構造不明は保留台帳へ持ち越します。[直接取得検証](../../.github/workflows/direct-new-card-intake.yml)。
3. 現行の変換・増分取込コード（[現行抽出器](../../poc/src/official_gametora_route_dom_extractor.cjs)・[未承認スキーマ投影](../../poc/src/official_gametora_private_schema_projection.cjs)・[new card increment](../../poc/src/new_card_event_incremental.cjs)）を確認し、分岐、結果ごとのスキルID・ヒントLv、継続・打ち切りが保持されるか検査します。
4. 不一致、重複、未知の条件、公開前の候補を**未確認のまま保持**します。未掲載を確定0件として数えず、結果の異なる選択肢を無条件の報酬へ変換しません。
5. D-068の条件付き包括承認に従い、事実・取得条件・公開根拠を確認した候補に限り、利用者再承認なしで公開へ進めます。[正式公開ゲート](checker-public-catalog.md)で採否と承認台帳の内容ハッシュを検証します。追加対象以外の既存DB・保存済み設定・キャッシュの回帰検査も行います。

## D-067のローカルレビュー候補出力

直接取得の現行ブラウザ試験は初期5枚の限定試験後、明示的な手動実行に限定する。GitHub Actionsは件数・構造・候補ハッシュのみを出力する。独自数値構造の審査用候補を実際に保存する場合、Node 22/Playwright/Chromeと適切に取得した版固定のUmaSimファイルを用い、リポジトリ外にのみ出力できる。

```sh
node poc/tools/run_direct_new_card_intake.cjs <old-roster> <current-roster> <skill-data> <pinned-metadata> <offset> --private-draft /outside/repo/review.json
```

同一commit/cardBlob/skillBlobが必須。1回最大2枚、offsetで保留列を移動。CIでの候補出力・既存ファイルの上書き・リポジトリ内出力は拒否する。候補は独自構造の審査入力で未承認。内部到達条件と選択・結果の意味を個別審査後、既存の非破壊追加／公開ゲートを適用する。

## 個別の事実照合（D-067）

初回の20102/30322/30324は [照合指紋](../../poc/config/direct-event-fact-review.v1.json) にカード別URL、イベント見出しのハッシュ、選択式/自動・通常連続段、結果別の数値/スキルLvのハッシュのみを記録。名前・選択肢文面・候補DBは保存しない。`--review-known` は検証済み対象だけの内容照合・既存スキーマ検査・未承認ゲート拒否を行い、[実試験の候補SHA](../../poc/config/direct-event-fact-review-evidence.v1.json) とも一致する場合だけ件数と候補SHAを出力する。ローカル `--private-draft` の既知カードでは一致時のみ仮称の審査用候補と `unapprovedIntakeCandidate`（既存増分stagingの入力形式）を保存する。従来の仮称候補とは別に `prepareNamedCandidate` で見出しSHA一致時だけ正式イベント名を復元し、独立辞書の `verifiedSkillName` を付与。本番形状の新しい内容SHAで別審査する。`verify_direct_release_shape.cjs` は既存公開DBと3枚の候補を一時メモリで結合し、現行・旧固定辞書の実読込検査と未承認拒否を検証する。実ファイルは公開しない。ローカルの `--private-draft` 出力には `namedProductionCandidate` とその内容SHAを追加する（未承認、CI出力禁止）。これらは公開承認ではない。友人R/SSRのレア度差、特殊イベントの母数と凸依存効果は別に裁定し、SSRのスキルをRへ流用しない。

## D-068の初回公開増分

2026-11-27の利用者包括承認と実レビューに基づき、20102/30322/30324の12件のみ [正式形状SHA](../../poc/config/direct-named-release-d068-20261127.v1.json) に固定。run 45926697083で旧署名保持・12個別証跡・本番読込を検査し、承認された独自構造のみを公開JSONに追記する。候補非公開、追加対象の再取得なし。以降のバッチも実審査と内容ハッシュを固定し、旧履歴を変更せず追加する。

## D-070のカード別JSON公開増分

吾妻10149／30323のみ [正式形状SHA](../../poc/config/d070-azuma-json-release.v1.json) に固定。run [45989546830](https://github.com/Nimrodx0/Umasupport/actions/runs/45989546830) にて、D-068個別承認22件、旧DBと旧承認の非破壊追加、現行・固定辞書による本番preflightを検査。スキル経路だけの部分収録で、未解釈非スキル効果は収録せず、実ゲーム全件性を主張しない。一般カードの無人取得・自動審査は未実装。

## D-072の保存済みパケットからの審査・増分準備

[独立事実照合](../../poc/src/d072_independent_review.cjs) の `compareIndependentReview` は保存済みパケットと台帳に、別途実際に確認した `evidence`（schemaVersion、cardId、packetSha256、reviewer、reviewedAt、evidenceUrls、nonSkillPolicy、events）を照合する。各イベントは sourceEventId、正式title、category、categoryOrdinal、selection、previousSourceEventId、groups（ordinal、labelPresent、routes: ordinal、hints: skillId/level、terminal、nonSkillCount）を独立確認する。タイトルSHA・選択と結果位置・報酬と終了・前段・省略方針が全て合致した場合だけ、既存審査契約と証跡SHAを返す。`prepareIndependentCandidate` は未承認候補とイベント内容SHAを返す。パケットから独立証拠を自動生成してはならない。

`stageIndependentEvidenceAcrossVersions` は1〜2枚のパケット・独立証拠・取得時の固定UmaSim名簿／辞書、基準名簿、公開時の固定名簿／辞書、現行カタログ・承認台帳、新規個別承認を入力とする。[異版増分](../../poc/src/d072_cross_version_reviewed_append.cjs) では各blobの内容一致、基準からの新規ID、観測時の名簿IDの消失なし、対象カードの解析済み属性・通常ヒント・性能解放情報、報酬スキルのID・名称・レアリティ・groupの一致を検査する。別版でのイベント事実の不変や法的許諾を証明するものではない。呼出し側で公式UmaSimのcommitとblobの対応・基準固定版・旧固定辞書の検証を行う。既存DBの追記だけを許し、旧内容や承認を変更せず、内容SHA承認と本番preflightを実行する。中核関数は通信・書込みなし。接続は [公式固定版ソース読取](../../poc/src/d072_verified_umasim_source.cjs) と [GitHub審査アダプタ](../../poc/src/d072_github_reviewed_intake.cjs) の `createReviewedIntake({github,owner,repo})` を用いる。`prepare({evidence,existingCatalog})` は専用台帳・パケット・取得時辞書から未承認候補SHAを返す。`stage({evidence,existingCatalog,existingApprovals,newApprovals})` は公式固定基準・取得時各版・最新版・旧固定辞書を照合し、承認済み増分と証跡をメモリ上に返す。呼出し側で現行mainのカタログ・台帳を固定。[固定入力検証](../../.github/workflows/d072-verified-release-inputs.yml) は実出典・既存DBのみで動作を検査する。元データ・未承認候補は公開不可。実カード試験は残る。

## D-072 JSON優先の通常取得と例外診断

D-073は[正常候補入力](../../poc/src/d073_json_adoption.cjs)で取得時の短い識別名（専用state、ログ除外）は `titles:null` で再利用。連続到達のみ追加確認。正常randomは日次で `routine.input` と内容SHAを準備。通常取得は最大2枚／5 GET、6秒間隔。HTMLは掲載URL・Next build ID確認のみ。JSON構造・効果・位置の期待値検査、未知構造の保留、例外審査・個別承認を維持。旧表示証跡は互換読取のみ。任意の合成HTML診断は `node poc/tests/browser_d072_display_corroboration.cjs`（Playwright導入済み環境）。通常CI・公開条件外。

## D-072 承認対象の準備と公開提案の生成

[審査準備workflow](../../.github/workflows/d072-independent-review-preparation.yml) をmainで手動実行し `evidence` 配列を渡す。読取専用権限で固定mainのカタログblob・永続パケット・固定辞書・審査を照合し、カードID・イベントID・内容SHA・非スキル省略件数・審査証跡SHAだけを出力する。正常候補は公開根拠を実審査。準備は承認・追加取得なし。

[公開提案ワークフロー](../../.github/workflows/d072-reviewed-release-proposal.yml) をmainから手動実行する。`bundle` は `evidence`（独立事実照合1〜2枚）と `newApprovals`（個別承認v1）または `attestations`（[カード一括証跡](../../poc/src/d072_card_review_attestation.cjs)）のJSON。後者は全イベントSHA・証拠SHA・6確認・公開根拠を個別台帳へ展開。D-073の `publicationDecisions` はパケット・証跡・イベント一覧SHAと明示取得条件・公開判断を固定し、[個別承認](../../poc/src/d073_publication_decision.cjs)を生成。[共通方針](checker-public-catalog.md) は `routinePublicationPolicy` で指定（未設定）。秘密・原文・元JSON不可。既定 `plan` は読取専用。`branch` は現行mainのGit blobを再照合し、承認済みカタログ、承認台帳、件数記録、入口／全資産の版識別子、固定審査証跡を同一コミットにまとめて専用 `automation/d072-release-<SHA>` refを新規作成する。main書込・強制更新・自動mergeは禁止。同一tree・親のrefのみ再利用。main移動時は最新版で再実行。

`pr` は検証済みbranchからmain向けPRを作成。同一open PRのみ再利用、競合・権限拒否・ref変更時停止。PR作成・CI起動はGitHub設定に依存するため、拒否時はbranchから手動PR、必要なら管理者がCI実行承認。[CI引渡し](../../.github/workflows/d072-release-ci-handoff.yml) をmainでPR番号指定し、固定6ファイル・証跡・最新必須CIを読取専用検証する。成功時のみ通常権限で統合し、[Pages受入](../../.github/workflows/pages-real-browser-acceptance.yml) の全資産・イベントID照合を確認。標準トークンの自動merge、権限設定変更、自動事実承認はしない。

## 実行確認

```sh
node poc/tools/verify_event_release.cjs
node poc/tools/check_project_tracking.cjs
```

公開JSON・承認台帳の**機械的整合性**を検証する。出典・権利の承認、現ゲーム網羅性、実ブラウザ動作は別です。A/B/Cの区分は[検証計画](../quality/verification-plan.md)に従います。
