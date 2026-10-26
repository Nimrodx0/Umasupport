# Phase 2：タッカー翌ターン得意率・保科温泉入浴券と次回超回復の一括変換（2026-10-26）

## 実装方針と元出典

前PRまでの固定GameTora元2,488イベント／一般構造化2,427イベント／保留61イベントのうち、2組のイベント内部特殊報酬を**全カード共通の効果型**で扱う。個別カード専用overlayは追加しない。

固定元 `systemless10/UmamusumePS@6e38b54af4fad397ff4491e63007a90705a4fe67` の `server/data/events/gametora/support_10128.json`、`support_30257.json`、`support_10138.json`、`support_30276.json` の数値ID・出典効果位置だけを非公開全件監査で扱う。

- **`ntsr`**：タッカーブライン R/SSRの**12イベント／14記載**。元の値は +20、+30、+120（SSR/Rの対）。次ターンの**他の編成サポートカードの得意率補正**を意味する。ヒントLv、能力値、確率20%などには変換しない。[GameWith タッカーR](https://gamewith.jp/uma-musume/article/show/505047)と[Game8 タッカーSSR](https://game8.jp/umamusume/700422)は翌ターンの得意率補正として明記。対象は元イベント内の選択肢ごとに保持。
- **`yhs_tix` ＋ `yhs_sr`**：保科健子 R/SSRの**10イベント／各12記載**。前者は[ごくらく♪ゆこま温泉郷](https://gamewith.jp/uma-musume/article/show/521054)の**入浴券+1／+2**、後者は**次回の入浴時に超回復が確定する無数値のフラグ**。元カードの1選択に共存するが別操作。入浴時の体力や能力値報酬を先取りしない。[GAME Watchの先行体験記事](https://game.watch.impress.co.jp/docs/preview/2058289.html)でも次回入浴の確定効果を確認できる。

## 共通変換機構

[出典監査・共通変換](../poc/src/phase2_gt_whole_nonskill_effect_inventory.cjs)に `CONTEXT_OPERATIONS` を追加し、下記3種類を `dynamicEffects[]` に出力。通常の確定能力値やスキル報酬には混ぜない。

| 固定元コード | 正規化された `kind` | 保存する主要条件 |
| --- | --- | --- |
| `ntsr` | `next-turn-other-support-specialty-rate` | 符号付き`delta`、`duration:'next-turn'`、`targetSelection:'other-supports-next-turn'` |
| `yhs_tix` | `onsen-bathing-tickets` | `delta`、`scenario:'yukoma-onsen'`、`targetSelection:'bath-ticket-count'` |
| `yhs_sr` | `onsen-next-bath-super-recovery` | `scenario:'yukoma-onsen'`、`activation:'next-bath'`、`targetSelection:'next-bath-super-recovery'`、**delta無し** |

全種類 `possible:true`、コア出力 `conditional:true`・`unresolvedTargets:true` とする。これは条件付き効果経路の記録で、現行ゲームに対して発生・取得を実測したことを意味しない。`ntsr`・`yhs_tix` は `type,value` のみ、`yhs_sr` は `type` のみを元データから許容。幅値、未知の追加プロパティ、同じ結果内の同一kind重複、誤ったシナリオ／次回発生条件は拒否。[合成Node試験](../poc/tests/phase2_gt_contextual_effect_batch.test.cjs)で2カード横断、選択肢独立、無選択の報酬非表示、符号と正規化結果を確認。

## 固定元全件の実測

| 指標 | 変更前 | 変更後 |
| --- | ---: | ---: |
| 全GT元イベント | 2,488 | 2,488 |
| 一般構造化可能 | 2,427 | **2,449** |
| 一般構造化保留 | 61 | **39** |
| 主因が特殊効果型で保留 | 34 | **12** |
| 本番同型2,512スキル候補への通常結合 | 2,426 | **2,448** |
| 既存の専用5overlay込みの非公開効果付きイベント | 2,431 | **2,453** |
| 正式公開イベント | 0 | **0** |

保留39イベントは29カードに分布。残る主原因は連続結果・打ち切り15、未対応特殊効果12、数値幅・入力形状9、条件付きセグメント3。出典の元イベントを名寄せせず、既存SSR30080元auto／GameWith裁定3択の1件差異を保留。全563カードの既存スキル経路SHA比較とスキル総数2,512候補は不変。

## A／B／Cの検証と公開境界

- **A**：数値幅／フラグ無値／重複／元選択肢／型厳密検証などのNode専用試験＋既存の機構回帰。
- **B**：固定GT559カード、2,488イベント、4,376経路の全件出典監査、非公開2,512イベントを使い捨て本番形式preflight/attachに接続、全563カードの元スキル経路保持。
- **C**：通常公開Web画面のChromium回帰のみ。未承認イベントをブラウザで表示させた実験、元ゲーム内の再実測、Windows／Android物理端末での検証は未実施。

権利未確認のイベント本文、元の選択肢文章、第三者JSONをPublicへ同梱しない。公開イベントは **0件** のまま、出典からの技術的変換率だけを上げている。

## 次の一括対象

未対応特殊効果12イベントは `ttl_gauge_all`／`ttl_gauge`（ある1グループカードの全員／個別ゲージ）、`sga`（2カードの同型特殊報酬）、`se_has`、`brg` など。数値幅・内部終了制御とは別に分類し、元効果の対象や適用時点が裏付けられたものから共通処理する。特定シナリオの説明が不明なままスキル／能力値確定取得へ昇格しない。
