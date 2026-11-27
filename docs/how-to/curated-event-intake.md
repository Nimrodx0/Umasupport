# サポートカードのイベントを増分収録する：現行手順

本書は現行の主要なイベント取込経路だけを扱います。[GameWith-first方式の旧全文](../evidence/events/curated-event-intake-legacy-20261019.md)は2026-10-19当時の記録であり、今の全件取込指示ではありません。

## 適用範囲と入力

- **通常の入力（D-067）**：GameTora本体の個別カードページから限定直接取得した構造・数値事実。通常ヒント・新カードIDはUmaSimの固定公開元と照合します。従来の派生GitHubは既存固定版の履歴照合のみ。[現行の出典](../reference/data-sources.md)。
- **増分のみ**：UmaSim名簿の新規カードIDだけを対象にし、既存の承認済みイベントやユーザーの設定を一括更新しません。[W3の作業計画](../plans/product.md)。
- **例外の裁定**：GameTora本体の個別イベントに欠損・衝突・曖昧な進行条件がある場合、GameWithの掲載事実で個別裁定します。[例外の仕様](../reference/event-adjudication-enforcement.md)。

## 収録工程

1. [最新状況](../project/status.md)と[詳細計画](../plans/product.md)から未収録の数値カードIDと今回の対象を確定します。
2. 固定UmaSim名簿の差分で新規IDを抽出し、最新名簿と独立スキル辞書のコミット・blobを固定します。GameToraの一覧から個別URLを解決し、限定ブラウザ検証でイベント見出しと本文を照合します。未掲載・構造不明は保留台帳へ持ち越します。[直接取得検証](../../.github/workflows/direct-new-card-intake.yml)。
3. 現行の変換・増分取込コード（[現行抽出器](../../poc/src/official_gametora_route_dom_extractor.cjs)・[未承認スキーマ投影](../../poc/src/official_gametora_private_schema_projection.cjs)・[new card increment](../../poc/src/new_card_event_incremental.cjs)）を確認し、分岐、結果ごとのスキルID・ヒントLv、継続・打ち切りが保持されるか検査します。
4. 不一致、重複、未知の条件、公開前の候補を**未確認のまま保持**します。未掲載を確定0件として数えず、結果の異なる選択肢を無条件の報酬へ変換しません。
5. D-068の条件付き包括承認に従い、事実・取得条件・公開根拠を実際に確認した候補に限り、カード毎の利用者再承認なしで正式公開へ進めます。[正式公開ゲート](checker-public-catalog.md)で採否と承認台帳の内容ハッシュを検証します。追加対象以外の既存DB・保存済み設定・キャッシュの回帰検査も行います。

## D-067のローカルレビュー候補出力

直接取得の現行ブラウザ試験は初期5枚の限定試験後、明示的な手動実行に限定する。GitHub Actionsは件数・構造・候補ハッシュのみを出力する。独自数値構造の審査用候補を実際に保存する場合、Node 22/Playwright/Chromeと適切に取得した版固定のUmaSimファイルを用い、リポジトリ外にのみ出力できる。

```sh
node poc/tools/run_direct_new_card_intake.cjs <old-roster> <current-roster> <skill-data> <pinned-metadata> <offset> --private-draft /outside/repo/review.json
```

同一コミットの `commit`・`cardBlob`・`skillBlob` を持つメタデータが必要。1回最大2枚、offsetで保留列を移動。CIでの候補出力・既存ファイルの上書き・リポジトリ内出力は拒否する。候補の数値スキルID・結果位置・効果・分類は独自のレビュー入力であり、未承認のため公開カタログではない。内部到達条件と選択・結果の意味を個別審査後、既存の非破壊追加／公開ゲートを適用する。

## 個別の事実照合（D-067）

初回の20102/30322/30324は [照合指紋](../../poc/config/direct-event-fact-review.v1.json) にカード別URL、イベント見出しのハッシュ、選択式/自動・通常連続段、結果別の数値/スキルLvのハッシュのみを記録。名前・選択肢文面・候補DBは保存しない。`--review-known` は検証済み対象だけの内容照合・既存スキーマ検査・未承認ゲート拒否を行い、[実試験の候補SHA](../../poc/config/direct-event-fact-review-evidence.v1.json) とも一致する場合だけ件数と候補SHAを出力する。ローカル `--private-draft` の既知カードでは一致時のみ仮称の審査用候補と `unapprovedIntakeCandidate`（既存増分stagingの入力形式）を保存する。従来の仮称候補とは別に `prepareNamedCandidate` で見出しSHA一致時だけ正式イベント名を復元し、独立辞書の `verifiedSkillName` を付与。本番形状の新しい内容SHAで別審査する。`verify_direct_release_shape.cjs` は既存公開DBと3枚の候補を一時メモリで結合し、現行・旧固定辞書の実読込検査と未承認拒否を検証する。実ファイルは公開しない。ローカルの `--private-draft` 出力には `namedProductionCandidate` とその内容SHAを追加する（未承認、CI出力禁止）。これらは公開承認ではない。友人R/SSRのレア度差、特殊イベントの母数と凸依存効果は別に裁定し、SSRのスキルをRへ流用しない。

## D-068の初回公開増分

2026-11-27の利用者包括承認と実レビューに基づき、20102/30322/30324の12件のみ [正式形状SHA](../../poc/config/direct-named-release-d068-20261127.v1.json) に固定。run 45926697083で旧署名保持・12個別証跡・本番読込を検査し、承認された独自構造のみを公開JSONに追記する。通常の候補出力は引き続き非公開、追加対象の再取得は行わない。以降のバッチも実審査と内容ハッシュを固定し、旧履歴を変更せず追加する。

## D-070のカード別JSON公開増分

吾妻10149／30323のみ [正式形状SHA](../../poc/config/d070-azuma-json-release.v1.json) に固定。run [45989546830](https://github.com/Nimrodx0/Umasupport/actions/runs/45989546830) にて、D-068個別承認22件、旧DBと旧承認の非破壊追加、現行・固定辞書による本番preflightを検査。スキル経路だけの部分収録で、未解釈非スキル効果は収録せず、実ゲーム全件性を主張しない。一般カードの無人取得・自動審査は未実装。

## D-072の保存済みパケットからの審査・増分準備

[独立事実照合](../../poc/src/d072_independent_review.cjs) の `compareIndependentReview` は保存済みパケットと台帳に、別途実際に確認した `evidence`（schemaVersion、cardId、packetSha256、reviewer、reviewedAt、evidenceUrls、nonSkillPolicy、events）を照合する。各イベントは sourceEventId、正式title、category、categoryOrdinal、selection、previousSourceEventId、groups（ordinal、labelPresent、routes: ordinal、hints: skillId/level、terminal、nonSkillCount）を独立確認する。タイトルSHA・選択と結果位置・報酬と終了・前段・省略方針が全て合致した場合だけ、既存審査契約と証跡SHAを返す。`prepareIndependentCandidate` は未承認候補とイベント内容SHAを返す。パケットから独立証拠を自動生成してはならない。

`stageIndependentEvidenceAcrossVersions` は1〜2枚のパケット・独立証拠・取得時の固定UmaSim名簿／辞書、基準名簿、公開時の固定名簿／辞書、現行カタログ・承認台帳、新規個別承認を入力とする。[異版増分](../../poc/src/d072_cross_version_reviewed_append.cjs) では各blobの内容一致、基準からの新規ID、観測時の名簿IDの消失なし、対象カードの解析済み属性・通常ヒント・性能解放情報、報酬スキルのID・名称・レアリティ・groupの一致を検査する。別版でのイベント事実の不変や法的許諾を証明するものではない。呼出し側で公式UmaSimのcommitとblobの対応・基準固定版・旧固定辞書の検証を行う。既存DBの追記だけを許し、旧内容や承認を変更せず、内容SHA承認と本番preflightを実行する。これらの中核関数は通信・ファイル書込みをしない。実行時の接続は [公式固定版ソース読取](../../poc/src/d072_verified_umasim_source.cjs) と [GitHub審査アダプタ](../../poc/src/d072_github_reviewed_intake.cjs) の `createReviewedIntake({github,owner,repo})` を用いる。`prepare({evidence,existingCatalog})` は専用台帳・パケット・取得時辞書から未承認候補SHAを返す。`stage({evidence,existingCatalog,existingApprovals,newApprovals})` は公式固定基準・取得時各版・最新版・旧固定辞書を照合し、承認済み増分と証跡をメモリ上に返す。呼出し側で現行mainからカタログと承認台帳を同時に固定すること。GitHub Actionsの[固定入力検証](../../.github/workflows/d072-verified-release-inputs.yml) は実出典・既存DBのみで動作を検査する。元データ・未承認候補をログ出力／公開しない。実際の独立審査入力取得、自動公開PR、実カード試験は残る。

## D-072 初回HTMLの表示照合

自動取得はカードごとのbootstrap HTMLを活用するため1枚ずつ処理する。掲載カードはrobots・一覧・カードHTML・カードJSONの4 GETで、既定の最大2枚／5 GET上限と6秒間隔を緩めない。取得済みHTMLを外部通信遮断・JS無効のChromiumで解析し、表示の見出しSHA・分類・位置・ヒントID/Lv・終了表示・非スキル数値件数をJSONと照合する。表示照合の状態・件数・SHAのみパケットの `domEvidence` に保存し、原文・HTML・正式名は保存しない。表示不足・不一致を自動承認にしない。旧パケットには同項目がなくてもよい。内部到達条件・正式タイトル・公開根拠の独立審査は引き続き必要。

## D-072 承認済み公開提案の生成

[公開提案ワークフロー](../../.github/workflows/d072-reviewed-release-proposal.yml) をmainから手動実行する。`bundle` は `evidence`（独立事実照合の配列1〜2枚）と `newApprovals`（個別承認v1）だけのJSON。事実審査と公開可否を実際に確認した入力のみ、正式名称・独自数値構造・根拠URLを含める。公開Actionsの入力・ログに秘密や元JSON・原文・未承認候補を渡さない。既定 `plan` は検証・件数・提案SHAのみで書込なし。`branch` は現行mainのGit blobを再照合し、承認済みカタログ、承認台帳、件数記録、入口／全資産の版識別子、固定審査証跡を同一コミットにまとめて専用 `automation/d072-release-<SHA>` refを新規作成する。mainへの書込・強制更新・自動merge・自動公開は行わない。既存refは同一treeと親コミットの場合のみ再利用。mainが移動した場合は最新のmainから再実行する。

出力のbranchを通常のPRとしてmainへ提出し、全CIと変更対象を検証し、統合後Pages・通常入口の公開受入を行う。GitHub標準トークンによるPR作成にはCI実行承認が必要になる場合があり、同トークンからのpushではPagesビルドも起動しないため、現段階では通常PRの作成と統合を別にする。追加の個人トークンや秘密鍵は必須化しない。取得側の自動承認・事実の推測・第三者許諾の擬制はしない。

## 実行確認

```sh
node poc/tools/verify_event_release.cjs
node poc/tools/check_project_tracking.cjs
```

これは公開JSONと承認台帳の**機械的整合性**の検証です。出典・権利の承認、現ゲーム網羅性、実ブラウザ動作は別です。A/B/Cの区分は[検証計画](../quality/verification-plan.md)に従います。
