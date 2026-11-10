# Phase 2：GameTora `random_stats` のランダム対象保持と非公開統合（2026-10-25）

## 目的、採用元、再現する範囲

前工程の[状態付与・回復121記載の構造化](phase2-gt-status-operation-adoption-20261025.md)で、固定GameToraの2,488イベントのうち2,288件について非スキル効果を孤立プレビューへ構造化し、残り200件を保留していた。今回は未対応`random_stats`18記載を調査する。

元データは`systemless10/UmamusumePS@6e38b54af4fad397ff4491e63007a90705a4fe67`の`server/data/events/gametora/support_*.json`に固定。同じリビジョンの[イベント実行器](https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/app/event_engine.py#L1616-L1644)では、`random_stats`は**5能力から重複なくN種類をランダムに抽出**し、選ばれた各能力へ`value`（正負）を適用する。`stat_count`を`min(max(1,N),5)`に正規化し、省略・`null`は1として扱う。元JSONへの`stat_count`の割り当ては[固定元のGTパーサ](https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/app/gametora.py#L290-L303)による。出典実例として[固定サポカ10074](https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/data/events/gametora/support_10074.json)にN=1/2の各数値効果がある。

これは5能力の**すべて**を増減する`all_stats`とは異なり、例えば「2種類に+10」だからといって**スピード+10、パワー+10と確定**してはならない。また、どの能力も選ばれないという意味ではない。選択・結果・到達条件が揃った場合は**指定数のランダム能力増減という意味**を保持する。

## スキーマ・ランタイム実装

- `poc/src/event_schema.js`に、数値`effects[]`／状態操作`statusEffects[]`とは独立した`dynamicEffects[]`をイベント・選択肢・排他的な結果の**末端**に追加する。構造は`{kind:'random-stats',delta:+10,statCount:2,targetSelection:'random-distinct'}`。値は非ゼロ安全整数、対象数は1–5、方式は`random-distinct`のみ。未知キーや同じ結果に二つの別ランダム抽選がある場合は機械的な結合を拒否する。
- `poc/src/core.js`の新`UmaCore.directDynamicEffectRoutes`で、前段到達・選択・排他的な結果IDを既存エンジンと同じ形で判定し、`unresolvedTargets:true`／`conditional:true`とともに元の対象数・符号付き数値を返す。**既存の`directEffectRoutes`へ特定能力値として合算しない。** `directRoutes`や`aggregate`のスキル保有枚数を変えない。
- `poc/src/phase2_gt_whole_nonskill_effect_inventory.cjs`で全効果の母数保存則とランダム能力値の単独型分類を維持。元の対象能力が確定不能なまま、イベント内の選択肢・結果位置で孤立した動的効果形状を保持する。
- `poc/src/phase2_2512_private_effect_join.cjs`は同じ元カードID／元イベント順位／選択肢・結果順位と合致した場合だけ`dynamicEffects`を**非公開スキル用2,512件**へ結合。既存スキル報酬・前段フラグ・結果条件を変えず、動的効果だけを除いたハッシュが完全一致することを確認する。本番と同じpreflight／使い捨てattachまで実行する。
- `poc/tests/phase2_gt_random_stats_targets.test.cjs`で+20を1種類、-5を2種類、0／null／省略・6以上の対象数の実行器式による丸め、数値の幅表記の拒否、結果未選択の非取得、ORスキル候補への元結果番号継承を合成テスト。

## B：固定全件の実測と例外

[固定GT全件監査 #40193486734](https://github.com/Nimrodx0/Umasupport/actions/runs/40193486734) **PASS**。固定元全559カード、2,488イベント、4,129選択肢、4,376結果経路、13,263効果記載は不変。

| 指標 | 前回 | 今回 |
| --- | ---: | ---: |
| 元`random_stats`18記載の安全な型変換 | 0 | **18/18**（異常0） |
| GT効果構造の孤立プレビュー対象イベント | 2,288 | **2,306** |
| 保留元イベント | 200 | **182** |
| 安全な結果経路 | 4,141 | **4,159** |
| 保留結果経路 | 235 | **217** |
| 未対応効果コードの元記載 | 113 | **95** |
| 元ランダム対象効果の孤立プレビュー | 0 | **18** |
| 孤立プレビュー内の確定数値能力値等の成分 | 10,298 | **10,346** |
| 孤立プレビュー内の状態操作成分 | 86 | **88** |

### スキル2,512件との結合に残る1件

[本番同形式の非公開統合を含む同Actionのログ](https://github.com/Nimrodx0/Umasupport/actions/runs/40193486734)では、**2,306元GT位置すべてを同定**したうえで、**2,305元イベントを結合**。数値10,384成分、状態88成分、動的ランダム対象17成分を同一の結果へ結合し、**207イベントは内容不変**。すべてのスキル計算は563カードでSHA一致、本番preflight／使い捨てattachも2,512件を維持。

残る**1件はSSR30080の固定GT元イベント6番**。固定GTは「特殊・選択肢なし（auto）」として`random_stats:+10`、対象2種類を収録している。一方、既に[GameWithによる個別裁定](../poc/src/phase2_30080_runtime_overlay.cjs)で、同じ元イベント6番を**実際の3択（choice）**へ補正している。したがって元GTの一つの無選択報酬を、ゲームの3択へ無条件に配ることはできない。元の条件付き3択データ・スキル経路を保持し、ランダム対象効果だけをこの**1イベントで保留**。これはランダム値に関する新たな不一致ではなく、既知の出典イベント形状の差異である。追加18記載のうち本番同形式の非公開結果へ入ったのは17記載。

[Node＋Chromium回帰 #40193486728](https://github.com/Nimrodx0/Umasupport/actions/runs/40193486728) **PASS**。ランダム対象のための別API、対象を勝手に確定能力へ入れないこと、結果・選択肢による条件の維持を検証。

## A／B／C・残課題

- A：合成値と出典パース形状、成功・失敗の排他的結果、元スキルOR候補へのランダム効果継承のテスト。
- B：GT固定母集団の全件監査、分岐別ランダム値の件数保存則、非公開のスキル2,512件へ2,305件結合の本番形式受入、SSR30080例外1位置の固定と既存スキル出力の不変確認。
- C：公開用`reviewed_events.v1.json`への転記0件。既存Chromiumは公開アプリの保護確認で、非公開ランダム効果のUI表示／現行ゲームの乱数を直接検証していない。

**今後の対象**：残る182イベントの未対応コード95記載（シナリオ固有効果など）、前段条件・連続停止マーカー・重複など構造上の保留、SSR30080の3択に対応する個別の非スキル数値の裁定、その他GT欠損カードとGameWith追加24件の効果、正式配信データと権利のゲート。**技術変換を完了しても正式公開は0件**である。
