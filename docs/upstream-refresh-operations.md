# 固定GameTora／UmaSim出典の継続更新手順

この文書は**新サポートカードやイベント追加を検知しても、現行ゲーム・イベントの正確性や公開承認を自動認定しない**運用の設計と実行手順です。イベントの正本方針は[GameTora基準／GameWith裁定](gametora-baseline-event-policy-20261021.md)、具体的な採用判断は[出典優先順位の契約](event-adjudication-enforcement.md)に従います。

## 目的と対象

| データ | 固定ピンの所在 | 監視対象 | 更新時の判断 |
|---|---|---|---|
| GameTora由来イベント | `poc/config/event-source-priority.v1.json`の`baselineRevision` | `systemless10/UmamusumePS/server/data/events/gametora/support_<ID>.json` | **カードID単位で追加・変更・削除を分類**し、全件分岐監査 |
| UmaSimサポカ | `poc/src/current_umasim_roster_delta.cjs`の`POLICY.afterCommit` | `mee1080/umasim/data/support_card.txt` | 段階別ヒント・カードID差分・通常ヒントの照合 |
| UmaSim数値スキル | `poc/src/current_new_card_skill_event_audit.cjs`の`SKILL_PIN.currentCommit` | `mee1080/umasim/data/skill_data.txt` | 数値ID・名称・稀少度・階層の照合 |
| 公開承認済みイベント | `poc/data/reviewed_events.v1.json`と承認台帳 | **上記出典とは別** | 権利・数値・後続分岐・公開ゲートを満たしたイベントだけ承認 |

**固定版は再現性確保のため引き続き必要**。実データの最新状態を調べる監視と、監査で採用した固定版は別概念とする。「GT元イベント2,488の変換率」と「最新UmaSim566カードのうちイベントが揃っている割合」を混同しない。

## 日次監視（実装済み）

[`Monitor pinned GT events and UmaSim sources`](../.github/workflows/upstream-refresh-monitor.yml) は GitHub Actions の毎日 **03:27 UTC／12:27 JST** の予約実行、または手動 `workflow_dispatch` で起動（実行時刻はGitHubのスケジューラ都合で遅れる場合がある）。

1. [`upstream_refresh_watch.cjs`](../poc/src/upstream_refresh_watch.cjs) はGithub REST APIのGitツリーメタデータを、固定GT／固定UmaSim／最新GT／最新UmaSimの計4版について取得する。対象はGameTora `support_<ID>.json` の**Git blob SHA** とUmaSimの2ファイルのGit blob SHAだけ。イベントJSON本文・画像・選択肢のコピーは行わない。
2. GTの**追加・変更・削除ID**、対象のUmaSim元ファイルの変更を分類する。最新の上流リポジトリが無関係なファイルだけを変更した場合、コミットが進んでも **差分なし** と判断する。
3. GitHub APIが `truncated:true` を返す・不正Git SHA・GT対象ファイル欠落・固定UmaSim blob不一致などは **判定不能として失敗**。欠落を「元イベント0件」「イベント削除」と取り違えない。
4. 差分がある場合のみ `Upstream source update: pinned GT events / UmaSim require review` という同一タイトルの**一つのOpen Issue**を起票する。同じデータblob差分の指紋なら毎日Issue更新・コメント通知を繰り返さない。追加のソース差分があった場合は既存Issue本文の差分だけを更新する。新データは **自動承認・自動マージ・自動配布しない**。
5. 監視結果は毎回Actionsの**Job summary**とログの `UPSTREAM_REFRESH_MONITOR=` にメタデータだけを残す。Issue作成がGitHubの権限設定で阻止された場合はジョブ失敗として確認できる。

[監視ワークフロー](https://github.com/Nimrodx0/Umasupport/actions/workflows/upstream-refresh-monitor.yml) は手動でも起動できる。GitHubのScheduled Actionsはリポジトリが一定期間非アクティブだと停止される場合があるため、長期運用ではActions画面の稼働状態を定期的に点検する。

## 差分発見から固定版更新まで（今後の人間による検証工程）

1. **差分レビューIssueを確認**。元のバージョン、最新コミット、新カードID、修正・削除されたカードID、UmaSimマスター変更の有無を確認する。既存の固定GT559枚、旧固定GT2,488イベント、旧非公開スキル候補2,512件、10/26現在UmaSim566枚と最新ゲーム全数を同一視しない。
2. **一時環境で新固定候補を作る**。候補のGTコミットをCIの非公開テンポラリパスへ読み出し、従来の全件GTチェーン・結果分岐／非スキル効果の監査、元スキルIDの照合、必要に応じてGameToraカードページ→GameWith例外裁定を実行する。変化した母集団の差分を検証してから新しい基準件数にする。古い `559`／`2488`／`2512` を**新しい母集団へ無根拠に転載しない**。
3. **採用PRを作る**。新しいGT固定コミットとUmaSimのピンをコード・テスト・出典文書で更新する。完全に確認できないイベントはレビュー行列に `missing`、`unadjudicated`、`conflicting` 等を残し、通常スキルや「全カード対応」に見せかけない。
4. **3軸を独立検証**。A＝スキーマ・結果分岐・ID不変・数値リグレッション。B＝更新された全件データと旧固定データの完全な差分・型・件数一致。C＝公開Web画面のChromiumブラウザと必要に応じてWindows／Android実端末で検索・デッキ操作。ユーザーが認めた仕様・許可範囲を変えない。
5. **イベント配布・公開承認は別判断**。第三者のイベント文章・選択肢・JSON・画像を無断同梱しない。新しい固定ピンをコードに採用することと、正式公開カタログにイベントを追加することは独立して許可・検証する。最後に[公開ゲート](checker-public-catalog.md)を実行する。
6. **完了後のIssue整理**。新ピンの全件CIとデプロイを確認して、更新Issueを閉じる。**自動的にはクローズしない**（未判定の残件が存在するため）。

将来、新しい元コミットに対する**全件preflightが自動化・グリーン化したら、固定ピン更新候補のDraft PRを自動生成する**ことは検討できる。ただしDraft PRと正式公開承認は別。現在の実装は「自動検知・差分分類・Issue通知」までであり、**人手による差分事実裁定と新ピン採用は未自動化**。

## 新3サポカのGameTora元データ収録の監視ゲート（2026-10-26）

2026年10月26日追加の独立確認済みサポカ、**R10149・SSR30322・SSR30323**について、最新GTの各`support_<ID>.json`の**存在**と**欠損**を毎回分離して報告する。`eventData.knownLatestUmaSimCardIdsWithGtJson`／`knownLatestUmaSimCardIdsWithoutGtJson`、その合計が3の`knownLatestUmaSimCardCoverage`を監視結果・Job summary・差分レビューIssueに記録する。

GTの新JSONが1件追加されれば従来の`addedCardIds`の厳密なGit blob差分で既存の単一レビューIssueを起票・更新する。3枚全部の元JSONが存在しても**イベントの選択肢、結果、後続連続、スキル数値IDの内容はまだ照合されていない**ため、`eventTopologyVerified:false`・`publicationApproved:false`を維持する。欠損3件が安定していてGT等のGit blobに差分がない場合は毎日の重複Issueを作らず、既存のログに欠損3を残す。元のイベント本文や画像、JSON内容は読み込まない。

固定GT初期スナップショットにこれらの3 IDが収録されていた場合、以前確認した母集団の前提と矛盾するため**監視を失敗**させる。母集団・出典の再裁定なしに「新規欠損カード」の報告を上書きしない。A＝0/3、1/3、3/3の合成Gitツリーを使う回帰、B＝元の4 Gitツリーのメタデータ比較、C＝イベント実表示・物理端末は本工程の対象外。

## 現在の実測（2026-10-26の初回ワークフロー）

[最初の実Gitツリー監視CI](https://github.com/Nimrodx0/Umasupport/actions/runs/40315080036)の結果：

- GameTora固定 `6e38b54af4fad397ff4491e63007a90705a4fe67` と最新mainが一致。対象イベントJSON **559ファイル**。追加・変更・削除は **0**。
- UmaSimのコミットは、固定 `910dd79f046710245e0cc88a09c5c92b1044897e` から最新 `66a2dc596fee0a8acec1fea19029a7e3a0d72941` へ進んでいるが、対象の `support_card.txt` と `skill_data.txt` の **両Git blobは不変**。監視は正しくレビュー不要と判定。
- 固定GTにまだ存在しない、UmaSim最新から新規追加済みのR10149・SSR30322・SSR30323は**出典監査上の既知ギャップ**として出力する。新しいGT差分がないからといって、これらのイベントが揃ったとは扱わない。
- この結果はイベント数値・ゲーム内発生の正しさを証明するものではなく、**ソース更新の検出器が運用できること**の実データ試験である。
