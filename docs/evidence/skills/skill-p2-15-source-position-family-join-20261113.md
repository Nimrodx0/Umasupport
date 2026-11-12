# P2.15：元スキルの位置由来5条件を同じモデル判定時刻で照合（2026-11-13）

## 目的と研究の優先順位

前工程[元`phase_random`抽選値全域の幾何学研究](skill-p2-15-original-phase-draw-support-20261112.md)では、固定GlobalSimの32人工無スキルレース上で、元102スキル・371元経路中249経路に関する**窓と走行位置の交差可能性**を検証した。しかしこれは実抽選、ほかのAND条件やpreConditionsの同時成立を示していない。

今回のP2.15は、別の既存[元`distance_rate`253スキルの同一判定時刻研究](skill-p2-15-source-distance-rate-real-ticks-20261112.md)を拡張する。固定8人工レースにおける**無改造GlobalSimと位置計測GlobalSimの同一走者・同一スキル判定直前位置**を元に、元UmaSimの**動的5条件の式**を追加し、**元AND/OR・preConditions・複数Invokeを保つ三値論理判定**に渡す。

本研究は前工程の`phase_random`経路371件とは**異なる母集団**であり、未観測の元抽選窓を観測済みとして扱わない。また、元スキルを実際に装備していない。

## 固定原典と新たに測定する5条件

対象は元UmaSimの固定コミット`mee1080/umasim@f6e4501ee6c6c2d4ac8698e7796e309d31575bde`の`SkillChecker.kt`・`RaceState.kt`・`RaceCalculator.kt`と、元スキル辞書`skill_data.txt`（SHA-256 `4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5`）。計測モデルは`daftuyda/GlobalSim@80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1`。

| 元述語型 | 元UmaSimの条件値の定義 | 今回のモデル入力 |
| --- | --- | --- |
| `phase` | `simulation.startPosition`をコース長の1/6、2/3、5/6で4局面へ分類 | 判定直前のGlobalSim位置 |
| `phase_firsthalf` | 現在局面の前半ならその局面番号、そうでなければ-1 | 判定直前位置の局面前半 |
| `phase_laterhalf` | 現在局面の後半ならその局面番号、そうでなければ-1 | 判定直前位置の局面後半 |
| `remain_distance` | `(courseLength - simulation.startPosition).toInt()` | 判定直前のモデル位置からの残り距離を整数化 |
| `furlong` | `(simulation.startPosition/200.0).toInt()` | 判定直前のモデル位置を200m単位で整数化 |

**Source formula（元式）と Source runtime observation（元UmaSimでの実測）は別**。元UmaSimはフレーム開始時に`simulation.startPosition = simulation.position`と設定するが、今回代入するのは**別のシミュレータGlobalSimの位置**であり、元UmaSim内部の値を直接計測したものではない。この対応のゲーム上の正確性は証明していない。

境界付近でDoubleの計算・GlobalSimの位置精度の違いを断定できないときには`unknown`を返す。未測定の`order_rate`、`phase_random`、追い抜き、脚質人数、状態、発動済み制御を位置から推測しない。歴史的な`preConditions`を現在の値だけで「初めから偽」とはしない。

## 実装、照合方法と不変条件

- [元ソース式の出典固定と述語ごとの観測](../../../poc/src/skill_source_position_stage_facts.cjs)：5条件について実装文字列と局面境界・元フレーム開始位置の参照を検査。ソース述語の演算子・値・OR／Invoke内の位置を保ったまま事実を作る。
- [既存三値tick論理への追加](../../../poc/tools/globalsim_p2_15_source_distance_rate_ticks.cjs)：従来の`distance_rate`測定と**同じ走者・同じ判定直前モデルtick**へ追加。出典固定検査に合格した場合にのみオプトインで新しい観測値を渡す。従来の実測出力と状態は変更しない。
- [既存結果との独立比較](../../../poc/tools/globalsim_p2_15_source_position_families_ticks.cjs)：従来の253元スキル・固定8モデルレースを新旧モードで並べ、三値論理上の確定`true`・`false`が根拠の追加により逆転しないこと、脚質別・スキル別の母数が変わらないことを検査。
- [回帰テスト](../../../poc/tests/skill_source_position_stage_facts.test.cjs)：原典変更の拒否、半局面境界、整数化の境界保留、元条件識別子・演算子維持、preConditionsの履歴と未知条件の保留、観測プローブの物理・判定時刻一致。
- [専用GitHub Actions](../../../.github/workflows/p2-source-distance-rate-real-ticks.yml)：固定元データと元モデルソースを取得し、既存の位置研究CIと同じ8レース・2独立モデルエンジンで元成果の完全一致と追加事実の整合を検査する。第三者の元全文は公開レポジトリへ同梱しない。

## 判定対象と限界

原則として元辞書の`distance_rate`を含む**253スキルだけ**が新研究対象。元辞書の全2,162スキルやアプリの照合818スキルへ自動で拡張しない。元の5条件を含むスキルがそのうち何件あるか、判定が進んだ走者×レース・スキル×脚質がどれだけ増えたかは、**固定出典でのCI成功後の実測結果**を記録する。

条件式の`true`は「供給された元の式とモデルの数値の組合せでは条件を満たす」という**モデル観測上の論理成立**であり、元UmaSimの実走行・元スキル実発動や日本版ゲーム発動率を測定したものではない。脚質別の正式適性ラベル、P3カード採点、P4製品UIは未変更。

## 次の未完

既存`phase_random`元371経路と今回の5条件の両方を同一ランダム窓・同一モデル判定時刻で実測した工程ではない。残る元AND条件、抽選窓、preConditionsの正しい初期履歴、複数Invokeの発動済み状態、ゲーム仕様との対応は引き続き未完である。
