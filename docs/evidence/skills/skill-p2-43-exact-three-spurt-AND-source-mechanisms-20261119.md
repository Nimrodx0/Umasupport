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
| 203431 | `phase_firsthalf_random` | **元の局面前半ランダム窓とスパートANDの構造を照合**。[P2.38](skill-p2-38-original-spurt-halfphase-same-and-20261118.md)の200511／200512と**演算子・数値まで完全一致している場合にのみ**、同じ元判定機構の根拠を再利用できる。それでもP2.39の固定賢さ9000・単独走者12レースを別スキルのゲーム発動率へ転用しない |
| 204661 | `infront_near_lane_time` | 元UmaSimの乱数近似状態なので、**この元モデルを発動頻度の証拠にする実験を保留**。現実に近傍を観測できる別のデータやモデルの根拠が必要 |
| 210081 | `phase_random` | **局面全体の元ランダム窓**であり、元局面前半ランダム窓と同一視しない。元のタイミング値・演算子、スパートと同じ元ANDであることを照合してから、必要なら同一tickの限定機構実験を設計する |

今回の実装は、実際の固定元辞書から**3スキルそれぞれの元AND述語、演算子、数値、元Invoke/OR/preConditions、明示的に矛盾しない脚質**を再構築する。元の値が何か、P2.38と完全一致かどうかは、元レジストリ照合CIの成功結果を確認したうえでこの表に反映する。

## 実装と検証の境界

[読み取り専用の元AND監査](../../../poc/src/skill_p2_43_original_spurt_candidate_review.cjs)を、既存の`poc/tools/audit_skill_conditions.cjs`が既に読み込む**固定元辞書と固定元Kotlinコード**へ追加する。同じ監査で使用している元P2.32・P2.37・P2.38の証拠と突合する。原典を再配布する新たなファイルは作らず、元ANDの3経路に限った研究出力`p2-43-exact-selected-spurt-AND-review.json`を固定CIだけの検証成果物として残す。

[回帰・反例テスト](../../../poc/tests/skill_p2_43_original_spurt_candidate_review.test.cjs)では、近傍レーン特殊状態の実装変更、元ANDの別値、元Invoke／OR／preConditionsのずれ、局面窓値の不成立、P2.38の二技能元ANDの一致関係、および本番カードスコアへの漏洩を拒否する。

[既存の固定720レースCI](../../../.github/workflows/p2-subphase10-77-skill-review.yml)のP2.42構造候補と、今回の元の**完全な演算子・数値つき3件**が同じ元ID・Invoke・ORかを照合。追加のGlobalSimレース、元JVMでのスキル実発動、実ゲームの検証、新規スコア導入は行わない。

**工程判定**：今回の3件は「次の高コストなモデル試験の必要性を判断する」ための小工程であり、G4親工程の全完了を意味しない。204661のランダム近似転用は不採用、残る2件は元値と既存研究の再利用範囲を確認して採用／条件付き／保留を確定する。未照合の他ANDや実ゲームとの不一致の可能性は継続して保留する。
