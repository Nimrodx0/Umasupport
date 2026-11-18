# P2.38：ラストスパート状態と前半ランダム窓の元ANDを限定検証（2026-11-18）

## 目的・採否の基準

[P2.37](skill-p2-37-dynamic-state-source-approximation-20261118.md)で、固定UmaSimの `is_lastspurt` は `change_order_onetime`／`is_overtake` と違い、設定済み `spurtParameters.distance + simulation.position >= setting.courseLength` という**現在レース状態の判定**であることを確認した。ただしこの意味の確認は、元スキルの全ANDがレースで成立することでも、4脚質のW・Dを測ったことでもない。

ここでは、元アプリ照合済みスキル **200511／200512（末脚）**が、実際に**同一Invoke・同一conditions AND**で `is_lastspurt == 1` と `phase_firsthalf_random` を組み合わせているかを元の値・演算子・OR・事前条件も含めて照合し、その上で**元のKotlin条件チェッカーが両条件をどう評価するか**を確かめる。

**新しい多走者レース、モデルの適性閾値、スパート出現確率、P3正式スコアは作らない**。GlobalSimの別レースの順位・スパートをUmaSimの元同一tickへ勝手に割り当てることもしない。

## 研究対象と出典

- 固定元UmaSimコミット `f6e4501ee6c6c2d4ac8698e7796e309d31575bde` の `data/skill_data.txt` に登録された元ID **200511・200512**。P2.32の元Invoke番号と配列位置、conditions OR、preConditions OR、`is_lastspurt` の元演算子と値を[P2.37の実出典監査](../../../poc/src/skill_p2_37_dynamic_state_evidence.cjs)から引き継ぐ。
- [元スキル構造と時期窓の独立照合](../../../poc/src/skill_p2_38_original_spurt_phase_same_and.cjs)は、両元IDが単一Invoke・単一条件AND・事前ORなし、ANDが**`is_lastspurt==1` と `phase_firsthalf_random==同値`の2述語**であることを照合する。構造／演算子／値が変われば**保留として停止**し、他のスキルの値に合わせない。
- [元Kotlin `SkillChecker`／`isInSpurt()`](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L208-L211)・[スパート判定](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L523-L526)、[元Kotlinの前半窓](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L122-L145)を同じ固定版から確認する。

## 計測方法の境界

既存[P2.32の元Kotlin窓検証CI](../../../.github/workflows/p2-umasim-source-window-runtime.yml)に、[**元登録スキル2件を無改変で読み込む制御状態テスト**](../../../poc/source-probes/P238OriginalRegisteredSpurtPhaseAndTest.kt)を追加する。

同じ元AND、同じ引数で評価し、元Kotlinが抽選した前半10m以内の窓に対して、以下の5通りを各6回×2スキル確認する。

| 人工的に設定する判定状態 | 同一ANDに期待する結果 | 意味 |
| --- | --- | --- |
| 窓内、`spurtParameters` なし | FALSE | スパート状態は必須 |
| 窓内、スパート計算距離がゴールに届かない | FALSE | スパート状態を現在位置との距離で判定 |
| 窓内、スパート計算距離がゴールに届く | TRUE | **元登録スキルの2条件の現在ANDが制御状態で成立** |
| 窓の直前、スパート状態TRUE | FALSE | 抽選された時期窓も必須 |
| 窓の直後、スパート状態TRUE | FALSE | 同上 |

同じ元`CalculatedConditions`の抽選窓キャッシュ再利用と、元時期半区間の範囲制約もチェックする。**60件は制御状態での元チェッカー呼出し**であり、60回の独立レースや実際のスパート条件成立率ではない。

`spurtParameters`と判定時刻・現在位置はテストが意図的に設定する。**元RaceCalculatorは走行しておらず、実際の競走でそのスパート距離が生じる可能性、4脚質の発動率・発動後の価値は今回測定しない**。スパート計算の入力にはスタミナや速度等も関係し、簡単な固定値で「常にスパート状態」と仮定するのは誤り。

## 評価への反映と、追加研究をする条件

1. **条件の意味と元AND構造だけを条件付き採用**する。元の2スキルを異なる独立なモデル標本と見なさず、共通の判定機構として扱う。
2. 既存の前半窓のみのWを、元スキル全条件のWへ流用することは**不採用**。スパート成立状況と同時tickでANDになることが必要で、`W(窓)\times W(スパート)`という独立仮定も根拠がない。
3. **次に実測が必要になる条件**：元RaceCalculatorが計算したスパート距離・現在位置・時期窓・判定時刻を**同一走者・同一レース**で記録でき、脚質ごとにその重複が適性評価を変え得ること。GlobalSim側の独自スパートは別モデルのため、元UmaSimの観測と混ぜずに独立感度分析として利用する。
4. この2スキルの**4脚質別の定量適性判断は保留**。同じ元Kotlin条件をさらに大量に人工設定する研究はしない。実際のレース由来スパート状態が取得できる場合に限り、次の小規模実験を検討する。

**P2 G3／G4は未完**。今回の「元ANDの真理値テスト成功」は「ゲーム内の技能発動確率が検証済み」ではない。
