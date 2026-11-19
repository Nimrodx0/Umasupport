# P2.43：スパートANDの元条件3候補を原数値まで照合する（2026-11-19）

## 目的と位置づけ

[P2.42のG4経路別検討](skill-p2-42-dynamic-AND-impact-gates-20261119.md)で元`is_lastspurt`と別条件が同じ元ANDにある経路から、**203431、204661、210081**を元InvokeとORを保持して構造レビューの対象にした。しかしP2.42は条件の**種類**までの研究選別であり、元の演算子・数値や、元UmaSimの特殊状態の**生成方法**まで全てを見たものではない。

今回、固定UmaSimリビジョン`f6e4501ee6c6c2d4ac8698e7796e309d31575bde`の元スキルレジストリ・`SkillChecker.kt`・`SkillData.kt`を再確認する。正確なレース別発動率・4脚質の正式W/Dやスコアを求める工程ではない。

## 固定出典から直接確認できる機構

原実装の照合箇所：

- [SkillChecker.kt（固定元）](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt)：`is_lastspurt`は元`isInSpurt()`、`phase_firsthalf_random`は元`initPhaseRandom(value, 0.0 to 0.5)`、`phase_random`は元`initPhaseRandom(value)`。**同じ「ランダム」でも抽選する局面内の範囲が異なる**。元`infront_near_lane_time`は`checkSpecialState(-1)`で、他走者の実座標を直接判定しているわけではない。
- [SkillData.kt（固定元）](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/data2/SkillData.kt)：`infront_near_lane_time`を`infront_near_lane`に対応付け、`ApproximateMultiCondition`と`ApproximateStartContinue`が確率的にその継続状態を生成する。

従って**204661の「前に他のウマ娘が近傍レーンにいる」成立頻度を元UmaSimから測る研究は採用しない**。元モデルの確率的特殊状態は、実ゲームの近傍走者の位置関係を観測した事実ではない。一方、**実ゲームで物理的な近傍レーン条件が無効だと結論するものでもない**。本当に4脚質の判断を変える必要がある場合は、別途、同じ時刻・同じ走者の他走者位置・レーン条件を独立に観測する方法を確保する。

## 元スキル3件の適用判断

| 元数値ID | 元ANDの追加述語 | 元実装からの判断 |
| --- | --- | --- |
| **203431 才気煥発** | `distance_type==3` AND `is_lastspurt==1` AND `phase_firsthalf_random==3` | **中距離限定**。P2.38の「全身全霊／末脚」の二述語と同じ元`is_lastspurt==1`＋`phase_firsthalf_random==3`の判定機構を**部分再利用**できるが、元AND全体は異なる。P2.39の単独走者1200m・賢さ9000の実測を中距離スキルの成立率へ転用不可 |
| **204661 開けろ風穴!** | `ground_type==2` AND `infront_near_lane_time>=1` AND `is_lastspurt==1` | **ダート限定**で、しかも元UmaSimの近傍状態が乱数近似。この元モデルを発動頻度の証拠とする実験を保留。芝720レースの順位Wはダートへ転用不可 |
| **210081 限界の先へ** | `is_lastspurt==1` AND `phase_random==3` | 局面3（終盤後半）の**全体ランダム窓**を使う。P2.38の`phase_firsthalf_random==3`（局面前半のみ）と同じにできない。元ランダム窓の生成は機構として照合できるが、同一tick全条件の成立機会は未測定 |

**元数値の照合結果**：[固定元辞書のCI #44446880250](https://github.com/Nimrodx0/Umasupport/actions/runs/44446880250)の`P2_43_EXACT_SOURCE_SPURT_AND`で上記3技能の元演算子・値・ANDと名前を実測確認。**P2.38の2述語AND全体に一致するスキルは3件中0件**、203431は追加の中距離条件だけが相違。3件とも元Invoke index=1、conditions OR=0、preConditionsなし、元の4脚質はいずれも有限ドメイン矛盾なし。**これは元の脚質別同時tickの成立観測を意味しない**。この監査後、元演算子・値の変更を検出する固定3スキルの完全AND一致テストも追加した。

## 実装と検証の境界

[読み取り専用の元AND監査](../../../poc/src/skill_p2_43_original_spurt_candidate_review.cjs)を、既存の`poc/tools/audit_skill_conditions.cjs`が既に読み込む**固定元辞書と固定元Kotlinコード**へ追加する。同じ監査で使用している元P2.32・P2.37・P2.38の証拠と突合する。原典を再配布する新たなファイルは作らず、元ANDの3経路に限った研究出力`p2-43-exact-selected-spurt-AND-review.json`を固定CIだけの検証成果物として残す。

[回帰・反例テスト](../../../poc/tests/skill_p2_43_original_spurt_candidate_review.test.cjs)では、近傍レーン特殊状態の実装変更、元ANDの別値、元Invoke／OR／preConditionsのずれ、局面窓値の不成立、P2.38の二技能元ANDの一致関係、および本番カードスコアへの漏洩を拒否する。

[既存の固定720レースCI](../../../.github/workflows/p2-subphase10-77-skill-review.yml)のP2.42構造候補と、今回の元の**完全な演算子・数値つき3件**が同じ元ID・Invoke・ORかを照合。追加のGlobalSimレース、元JVMでのスキル実発動、実ゲームの検証、新規スコア導入は行わない。

**工程判定**：今回の3件は「高コストな次のモデル試験の必要性を判断する」ための小工程であり、G4親工程の全完了ではない。**204661の元UmaSim乱数近似をゲーム実適性へ転用する案は不採用、203431は既存のスパート＋前半窓の二述語機構のみ条件付き再利用、210081は終盤後半の全体窓として別の元ANDを保留**。この3件に対して同じ12単走レースを繰り返しても4脚質のゲーム発動率の根拠にはならないため、元発動率の大量再計算を標準工程に加えない。元の動的条件が無影響と確認したわけではない。
