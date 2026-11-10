# 固定出典の監視・増分更新：現行手順

このページは**現在実行する運用**のみを扱います。2026年10月26～29日の元GameTora HTML直接取得や7日待機の旧方針・当時の測定値を含む全文は[固定した旧版](../evidence/sources/upstream-refresh-original-20261110.md)で参照してください。

## 目的と対象

| データ | 固定ピンの所在 | 監視対象 | 更新時の判断 |
|---|---|---|---|
| GameTora由来イベント | `poc/config/event-source-priority.v1.json`の`baselineRevision` | `systemless10/UmamusumePS/server/data/events/gametora/support_<ID>.json` | **カードID単位で追加・変更・削除を分類**し、全件分岐監査 |
| UmaSimサポカ | `poc/src/current_umasim_roster_delta.cjs`の`POLICY.afterCommit` | `mee1080/umasim/data/support_card.txt` | 段階別ヒント・カードID差分・通常ヒントの照合 |
| UmaSim数値スキル | `poc/src/current_new_card_skill_event_audit.cjs`の`SKILL_PIN.currentCommit` | `mee1080/umasim/data/skill_data.txt` | 数値ID・名称・稀少度・階層の照合 |
| 公開承認済みイベント | `poc/data/reviewed_events.v1.json`と承認台帳 | **上記出典とは別** | 権利・数値・後続分岐・公開ゲートを満たしたイベントだけ承認 |

**固定版は再現性確保のため引き続き必要**。実データの最新状態を調べる監視と、監査で採用した固定版は別概念とする。「GT元イベント2,488の変換率」と「最新UmaSim566カードのうちイベントが揃っている割合」を混同しない。

## 更新時の不変条件

既存データの一括差し替えは目的ではない。**UmaSimの旧・現行全カード名簿→追加カードIDの検出→第三者GitHubのGameTora派生JSONの対象新カードを取得・変換→既存独自DBへ追記**を自動化する。既存カードは編集せず、同一カードの二度目の追加を拒否し、新規取得が不完全な場合は元DBに何も書かない。

増分検出・GitHub派生JSONの検証・既存全イベント変換器への接続・日次の未掲載Issue引継ぎは[新カード取込記録](../evidence/sources/derived-github-daily-pending-ledger-20261029.md)と[既存変換器の再利用](../evidence/sources/derived-github-canonical-single-card-adapter-20261029.md)に整備済み。**実際の新3カードは派生JSON未掲載**のため、実イベントの公開審査と既存公開DBへの承認済み追記は未完了。GameTora本体HTMLの全パネルを直接取得・変換する旧経路は開発保留。

## 日次監視（実装済み）

[`Monitor pinned GT events and UmaSim sources`](../../.github/workflows/upstream-refresh-monitor.yml) は GitHub Actions の毎日 **03:27 UTC／12:27 JST** の予約実行、または手動 `workflow_dispatch` で起動（実行時刻はGitHubのスケジューラ都合で遅れる場合がある）。

1. [`upstream_refresh_watch.cjs`](../../poc/src/upstream_refresh_watch.cjs) はGithub REST APIのGitツリーメタデータを、固定GT／固定UmaSim／最新GT／最新UmaSimの計4版について取得する。対象はGameTora `support_<ID>.json` の**Git blob SHA** とUmaSimの2ファイルのGit blob SHAだけ。イベントJSON本文・画像・選択肢のコピーは行わない。
2. GTの**追加・変更・削除ID**、対象のUmaSim元ファイルの変更を分類する。最新の上流リポジトリが無関係なファイルだけを変更した場合、コミットが進んでも **差分なし** と判断する。
3. GitHub APIが `truncated:true` を返す・不正Git SHA・GT対象ファイル欠落・固定UmaSim blob不一致などは **判定不能として失敗**。欠落を「元イベント0件」「イベント削除」と取り違えない。
4. 差分がある場合のみ `Upstream source update: pinned GT events / UmaSim require review` という同一タイトルの**一つのOpen Issue**を起票する。同じデータblob差分の指紋なら毎日Issue更新・コメント通知を繰り返さない。追加のソース差分があった場合は既存Issue本文の差分だけを更新する。新データは **自動承認・自動マージ・自動配布しない**。
5. 監視結果は毎回Actionsの**Job summary**とログの `UPSTREAM_REFRESH_MONITOR=` にメタデータだけを残す。Issue作成がGitHubの権限設定で阻止された場合はジョブ失敗として確認できる。

[監視ワークフロー](https://github.com/Nimrodx0/Umasupport/actions/workflows/upstream-refresh-monitor.yml) は手動でも起動できる。GitHubのScheduled Actionsはリポジトリが一定期間非アクティブだと停止される場合があるため、長期運用ではActions画面の稼働状態を定期的に点検する。

## 差分の確認・承認工程

1. **差分レビューIssueを確認**。元のバージョン、最新コミット、新カードID、修正・削除されたカードID、UmaSimマスター変更の有無を確認する。既存の固定GT559枚、旧固定GT2,488イベント、旧非公開スキル候補2,512件、10/26現在UmaSim566枚と最新ゲーム全数を同一視しない。
2. **一時環境で新固定候補を作る**。候補のGTコミットをCIの非公開テンポラリパスへ読み出し、従来の全件GTチェーン・結果分岐／非スキル効果の監査、元スキルIDの照合、必要に応じてGameToraカードページ→GameWith例外裁定を実行する。変化した母集団の差分を検証してから新しい基準件数にする。古い `559`／`2488`／`2512` を**新しい母集団へ無根拠に転載しない**。
3. **採用PRを作る**。新しいGT固定コミットとUmaSimのピンをコード・テスト・出典文書で更新する。完全に確認できないイベントはレビュー行列に `missing`、`unadjudicated`、`conflicting` 等を残し、通常スキルや「全カード対応」に見せかけない。
4. **3軸を独立検証**。A＝スキーマ・結果分岐・ID不変・数値リグレッション。B＝更新された全件データと旧固定データの完全な差分・型・件数一致。C＝公開Web画面のChromiumブラウザと必要に応じてWindows／Android実端末で検索・デッキ操作。ユーザーが認めた仕様・許可範囲を変えない。
5. **イベント配布・公開承認は別判断**。第三者のイベント文章・選択肢・JSON・画像を無断同梱しない。新しい固定ピンをコードに採用することと、正式公開カタログにイベントを追加することは独立して許可・検証する。最後に[公開ゲート](checker-public-catalog.md)を実行する。
6. **完了後のIssue整理**。新ピンの全件CIとデプロイを確認して、更新Issueを閉じる。**自動的にはクローズしない**（未判定の残件が存在するため）。

## 候補Draft PRの意味

日次の監視ジョブで対象データのblob差分を検知すると、**レビューIssueの作成・更新に続いて、Gitツリーメタデータだけを記録したDraft PR**を自動作成／更新する。変更がなければ両方とも作らない。

- ブランチ名は `automation/upstream-refresh-candidate` の**1本**。追加されるファイルは `poc/review/upstream-refresh-candidate.v1.json` の**1件だけ**で、ランタイムのGameTora／UmaSim固定ピン、イベントデータ、公開済みカタログ・ユーザー設定は書き換えない。
- [候補生成・厳格検証器](../../poc/src/upstream_refresh_candidate.cjs) は元イベントの選択肢文・報酬・原本JSONを含まない。監視済みの固定と候補のGit commit／tree SHA、UmaSimの2 Git blob SHA、GTの追加・変更・削除ID、既知新3カードの収録／未収録ID、差分ハッシュ、検証未実施の事実だけを収録する。
- 正式採用には、**対象候補の全件イベント数・結果分岐・終了制御・数値スキルID・独立GameTora→GameWith裁定・公開条件**を先に検証する必要がある。自動作成の候補マニフェストには `not-run-for-candidate`／`not-adjudicated`／`not-approved` を明記し、**Draftのマージを固定ピンの採用とみなさない**。正式採用は別の審査済みPRで行う。
- 後から同一元カードIDのGit blobが更新された場合も、元blobの指紋が変われば**同じDraft PR**と既存Issueを更新する。差分が同一なら余分なcommitや通知を作らない。既存Draftに人が他のファイルを加えた、またはReady for reviewに変更した場合は**自動書き換えを停止**する。
- Bot作成のブランチは通常のpush／PRイベントではCIが自動起動しないため、メタデータに変更が生じたときは明示的に `PoC Core Tests` の `workflow_dispatch` を実行する。候補JSONそのものを厳密検査し、元データの追加格納・承認済みの偽装を拒否する。**このread-only Core CIは、候補バージョンの全件イベントを実際に取り込むB検証の代用ではない**。
- GitHub Actionsの既定権限によりBotのPull Request作成が禁止されている環境では、Repository Settings → Actions → Generalで「Allow GitHub Actions to create and approve pull requests」を有効にする管理者の操作が必要になる場合がある。書き込み権限不足ならジョブは失敗し、既存Issueからレビューの続きを行う。

**現在の実装は「更新検知 → Issue → Git SHAと未実施ゲートだけの候補Draft → read-only Core CI＋候補の全件ソース構造preflight」まで**。別の[実データ全件preflightの検証範囲・保留条件](../evidence/sources/upstream-full-source-preflight-20261027.md)を参照。候補のGTイベント全件とUmaSim全カード・全数値スキルIDの取り込み**構造**を確認できても、イベント内部の意味・外部出典の裁定、第三者素材の配布権利、公開許諾、実ゲーム全体の網羅性を証明しない。新固定ピンの正式採用・未承認イベントの実公開は実装も許可もしていない。

## 現行運用の制約

- 監視対象は元Git blobや固定ピンの変更です。元サイトのあらゆる実ゲームイベントの存在を証明しません。
- 未掲載は欠損・保留として管理し、勝手に公開候補を承認済みへ昇格させません。
- [W3工程](../plans/product.md)、[取得元契約](../reference/data-sources.md)、[公開審査](checker-public-catalog.md)の条件に従います。候補PRの自動作成は正式公開の承認ではありません。
- 過去の直接HTML取得・GameWithの待機閾値・2026-10-26の測定結果は[以前の全文](../evidence/sources/upstream-refresh-original-20261110.md)にのみ保存しています。
