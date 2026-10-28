# 既存SSR30001：スキルと非スキルの単一イベントJSON結合を直接照合（2026-10-28）

## 目的

PR #249では、既存SSR30001を`transformDocument`→`crosswalk`→`gametora_app_schema_dry_run.project`に通した**実アプリ用スキル投影**が、[GameTora本体](https://gametora.com/ja/umamusume/supports/30001-special-week)の5イベント・9結果経路・数値スキルIDとヒントLv5件に一致した。

PR #250では、同カードを`phase2_gt_whole_nonskill_effect_inventory.analyze`に通した**実アプリ用の非スキル効果候補**と、元サイトの5イベント9結果経路・31件の数値変化（絆8件）が一致した。

今回のPR #251は、**本番で使用する既存の統合関数**`phase2_2512_private_effect_join.mergeEvent`を、上記二系統の実投影に直接適用する。同じ結果葉に`rewards[]`と`effects[]`が置かれた**単一アプリ用イベントJSON**について、GameTora本体が実際に表示した経路ごとの報酬を改めて検証する。

## A/B/Cの方法

- **A: 機構**。既存のスキル用5イベントと非スキル用5イベントを、それぞれ`buildPinnedCardDraft`と`buildPinnedEffectDraft`で作成する。**再実装した近似統合器は使わず**、既存`mergeEvent()`を実際に呼び出す。結果は実行時の`event_schema.validateCatalog`へ通す。元の`requires`／`terminal`／分岐を保持し、別々の結果の報酬を混ぜない。
- **B: 固定参照**。元JSONは`systemless10/UmamusumePS@6e38b54af4fad397ff4491e63007a90705a4fe67`のSSR30001（Git blob `6aca60590854f402a67da82c2ffa7295e564b40f`）。スキルIDは固定UmaSimスキル辞書（Git blob `0c6ea6d72b037b24ee40860f73b0e86db47aab1d`）で処理する。
- **C: 実ブラウザ**。固定元と**独立に**、GameTora本体のChrome DOMでイベント名と表示経路を結び、各経路の数値スキルID＋ヒントLvと、非スキル効果の種類＋符号付き増減値を読み取る。元サイトの経路対応が重複・不明なら拒否。これらと**結合後の同一結果葉の両配列**を比較する。
- **D: 配信**。未承認の結合JSON、元イベント文章、選択肢名、HTML、画像はGitHub/Public/CIログに出さない。公開イベント0件のまま。

対象コード：[実統合＋元サイト比較](../poc/src/official_gametora_combined_app_parity.cjs)／[合成の異常系検査](../poc/tests/official_gametora_combined_app_parity.test.cjs)／[Chrome直接比較](../poc/tools/probe_official_gametora_browser.cjs)。

## 合格の境界

5イベント、9結果経路について、**同じ結果の同じ枝にスキル報酬5件＋非スキル数値効果31件が結合されているか**を確認する。うち8件はサイトが「友情ゲージ」と表示する絆の数値変化。以前の別々の比較結果を並べるだけではなく、統合後に同じ経路に保持されることを再確認する。

明示的な打ち切り1経路の位置も元サイト表示と照合する。一方、`requires`で接続した前段2イベントについて、**元サイトの表示順だけから正確なゲーム内の内部到達条件が確定するわけではない**。絆の`recipientCharId`も、元サイトの描画に数値IDがない場合は独立に確認できない。

このため成功判定は`sameRouteSkillAndEffectParity=true`、`validRuntimeSchema=true`とするが、`fullApplicationJSONEquivalent=false`、`siteHasProvenBondRecipientIds=false`、`siteHasProvenFullChainReachability=false`を維持。後者の未確認項目を前者の合格へ混ぜない。

## 次の対象（固定旧カードから抽出）

次は**この1カードの9経路という小さな母集団から離れ、旧GameTora固定データに存在する構造別カードを検証**する。以下は既存コードの監査プロファイルで各種現象があると確認できる候補。指定元データの**内容と該当イベント位置を再確認してから**、同じ元サイトDOM→アプリ用JSON直接照合に追加する。どの候補も新カードではない。

| 候補 | 論点 | 現在の根拠 |
| --- | --- | --- |
| SSR30030 | `+n/+m` の連動数値範囲と通常分岐 | `phase2_gt_nonskill_only_range_overlay.cjs`の`sourceOrdinal:3` |
| SSR30041 | スキルPt範囲と別選択肢の独立性 | 同コードの`sourceOrdinal:3` |
| SSR30080 | 元サイトの選択と元スクリプトの自動結果を取り違えない | `phase2_30080_runtime_overlay.cjs`の既存レビュー |
| SSR30102／30103 | 連続の選択・結果依存、スキルの重複・打ち切り | `gametora_reviewed_skill_cases.cjs`の既存監査 |

この順に、**元の既存独自DBへの再現性を確認してから、新たなカードへの適用を検討**する。すべてのイベント構造を最初からSSR30001専用の例外と同じに扱わない。

## 残る独立ゲート

1. 既存固定ソースのカード別の構造多様性を確かめ、**元サイト直接取得から汎用的に得られるフィールド**と得られないフィールドを整理する。
2. 複数の旧カードで適用できるDOM分類・結果の解釈・連続イベントの到達条件・打ち切り・受け手IDの採否を検証する。
3. 元サイト取得・利用条件と独自公開イベントの権利ゲートを別に確認する。未承認の出典文章／マスターデータのPublic同梱は行わない。
