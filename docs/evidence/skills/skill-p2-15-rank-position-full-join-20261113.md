# P2.15：研究済み順位条件と位置条件の同一tick統合（2026-11-13）

## なぜこの工程が必要か

[既存の元`order_rate`＋`distance_rate`研究](skill-p2-15-source-rank-plus-distance-20261112.md)は、253元スキルの固定8無スキルGlobalSimモデルレースで**21,252スキル×走者×レース**を評価。元式への順位率の条件解釈を追加した結果、一度以上の成立確認734→3,085、未判定16,579→12,278、観測全不成立3,939→5,889。独立の3エンジンで**同じ判定直前のモデル順位**と**元モデル位置**を確認していた。

しかし、後工程[5種類の位置由来条件の同一tick研究](skill-p2-15-source-position-family-join-20261113.md)および[未判定経路の候補診断](skill-p2-15-observed-unknown-route-witness-20261113.md)は、**既存の順位条件の実測を接続せず**、別の「`distance_rate`＋5位置条件」のみで研究した。未判定16,535件は、元プロジェクトに存在する利用可能な部分実測をすべて使った結果ではなかった。この工程はユーザー指摘を受けた**既存研究の再結合**であり、未検証の実ゲーム仕様を新たに断定するものではない。

また、原典順位`order`（1始まりの絶対順位）は[既存の別研究](p2-absolute-corner-source-model-20261110.md)で部分的に扱っていたが、`order_rate`用のモデル同時刻ブリッジは`order`を返していなかったため、この工程で元演算子・元AND内の元述語IDを保持して追加する。

## 統合した条件と同一時刻の実測根拠

| 元の条件 | 研究入力 | 方法・留保 |
| --- | --- | --- |
| `distance_rate` | 独立位置計測版のGlobalSimモデル判定直前位置 | 元UmaSim固定算式を適用、整数境界不確実はunknown |
| `phase`・`phase_firsthalf`・`phase_laterhalf`・`remain_distance`・`furlong` | 同一モデル位置 | 固定元UmaSimの`SkillChecker.kt`・`RaceState.kt`の出典を固定し、境界不明は保留 |
| `order_rate` | 独立順位計測版の同一GlobalSimモデル判定直前順位キャッシュ | [出典付き9／12頭の人数別換算](skill-order-rate-integer-mapping-20261106.md)・元の演算子、境界0は保留 |
| **`order`** | **同じモデル判定直前の1始まり絶対順位** | 元の数値・演算子のまま評価。0位や対象頭数外などの未検証境界は保留 |

固定元スキル辞書`mee1080/umasim@f6e4501ee6c6c2d4ac8698e7796e309d31575bde`（SHA-256 `4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5`）、固定GlobalSim `daftuyda/GlobalSim@80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1`を使用。固定8レース（9/12頭、合計84モデル走者）で3エンジンの物理値・観測時刻・順位更新一致を確認する。**元スキルは装備していない。**

元`SkillData.kt`の`ignoreConditions`では`order`と`order_rate`の双方を「順位条件は無視」と記載する。従って、順位評価は**ゲーム側の意味と一致すると保証した元UmaSim実測ではなく、モデル観測と外部の順位説明を組み合わせた条件解釈**。元ゲームの正しい条件評価・スキル発動抽選・効果を測定していない。

## コード・比較ゲート

- [順位ブリッジ](../../../poc/src/skill_source_rank_tick_bridge.cjs)：既存`observedOrderRateFacts`を維持し、`observedAbsoluteOrderFacts`を独立追加。同じ元`compiled.lookup`のpredicate identity、元演算子を維持する。9/12頭・1始まり順位の範囲外は保留。
- [三値AND/OR・前提履歴付き元条件結合器](../../../poc/tools/globalsim_p2_15_source_distance_rate_ticks.cjs)：従来の実験は変更せず、`rankEvidence`・`positionSourceEvidence`・`includeAbsoluteOrder`の組合せを明示指定。絶対順位も同じ走者・同じtickにだけ注入する。`preConditions`の未知履歴を既知falseへ変えない。
- [統合実験](../../../poc/tools/globalsim_p2_15_source_rank_position_full_join.cjs)：固定8レースを1回ずつ3エンジンで再生し、同一元条件に「距離進行率＋5位置条件＋順位率」→「さらに絶対順位」を適用。253件・モデル走者×レースの母数、三値判定の単調性、各脚質と原スキル単位の分母不変を検査。追加の`order`で解消する試行を独立記録。
- [単体試験](../../../poc/tests/skill_source_rank_position_full_join.test.cjs)：元のAND同時成立・OR/Invoke保持、人数別換算と絶対順位の区別、未観測条件・前提履歴、順位・位置の出典パリティ、元比較値の整合性。
- [固定CI](../../../.github/workflows/p2-source-rank-distance-real-ticks.yml)：従来の順位単独結合の回帰と、新しい3エンジン統合研究を**同じエンジンビルド上**で実行。元データ本文をGitHubに同梱しない。

比較対象は、元の253スキルのうち`distance_rate`を持つ固定コホートである。元全2,162スキルやアプリ収録データへ自動一般化しない。**既存`order_rate`のみを加えた研究より三値判定が悪化しないことも検査する。**

## 固定CIで判明した結果

**CI実測の数値は成功ログから検証後に追記する。** 新統合研究の「未判定残件数」「`order`単独追加による改善」「元スキル×脚質セル内訳」はCIの統合JSONを正本とし、前回の16,535件を今回の残件数と誤記しない。

モデルのスキル判定機会は、同じ8人工レース上で条件式を評価した**反実仮想の論理成立**に限る。実際の元スキル発動・実ゲーム発動率・4脚質の正式適性・P3カード評価・P4 UIは未承認。

## 次の未完

今回の再統合後のUNKNOWN候補を同じ元ASTで再診断し、固定UmaSimで実装されている`corner`、歴史的`preConditions`、実装が無視する順位条件、その他の動的条件を「モデルで追加観測できる／別のゲーム仕様根拠が必要／現状観測不可」に分けて次工程を決める。
