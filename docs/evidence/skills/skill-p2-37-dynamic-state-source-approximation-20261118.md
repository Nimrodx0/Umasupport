# P2.37：順位変化・追い抜き・スパート条件の根拠の採否（2026-11-18）

**判断対象**：G4で脚質間の優劣を左右し得る動的条件 `change_order_onetime`、`is_overtake`、`is_lastspurt` を、既存P2.32の元Invoke／元OR／元ANDと、**固定UmaSimソース `f6e4501ee6c6c2d4ac8698e7796e309d31575bde` の実装**で照合する。目的は新しい発動確率を作ることではなく、**どの研究結果ならP2の4脚質適性判断に使ってよいか**を決めること。

## 元ゲームモデルの実装で判明した違い

以下は**UmaSimのレースエンジン実装の事実**であり、商用ウマ娘の内部処理・発生頻度を実測したものではない。

| 元条件型 | 固定UmaSimソースでの判定機構 | P2の採否判断 |
| --- | --- | --- |
| `change_order_onetime` | `SkillChecker.kt` の `checkSpecialState()` が `specialState["change_order_onetime"]` を参照。`SkillData.kt` の `ApproximateRandomRates` は約1秒の更新ごとに **−1を20%、＋1を20%、残り0** とする**近似値生成** | **その近似値から順位変動の実戦頻度・脚質差を推定することは不採用**。元スキル条件の符号付き演算子・値は保存し、本物の順位変化イベントの成立機会は保留 |
| `is_overtake` | `SkillChecker.kt` は `specialState["overtake"]` を参照。元の `ApproximateMultiCondition` は「逃げ」「先行」「その他」の**開始・継続確率を初めから別々に設定**。設定はそれぞれ開始5/15/20%、継続50/55/60% | **近似値を使って4脚質の発動優劣やWを確定することは不採用**。分布を予め与えたモデルで、それを脚質差の独立した根拠とはできない |
| `is_lastspurt` | `SkillChecker.kt` は `isInSpurt()` を直接評価。スパート計算結果 `spurtParameters` が存在し、`spurtParameters.distance + simulation.position >= courseLength` の場合に真。上記の乱数近似状態とは異なる | **元モデル上の機構・同一走者・同一tickのスパート状態という研究対象を条件付き採用**。ただしスパート開始位置、持久力、他の同時ANDを持たずに発動しやすさを推定しない。全スキルのW/Dは未確定 |

確率近似の更新は `RaceCalculator.kt` の「`// スキル条件近似`」で `changeSecond` のときに走り、`SkillChecker.kt` の `checkSpecialState()` はその値を元演算子へ渡す。よって「シミュレーターで条件が真だった」だけでは、**実際の順位変化／追い抜き機会を観測したことにはならない**。特に `is_overtake` については、予めモデルに投入した脚質別の確率を「ゲーム内の脚質優位」と誤読してはならない。

**固定ソース参照箇所**：
- [SkillChecker.kt：`is_lastspurt`・`change_order_onetime`・`is_overtake`](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L208-L249)、[同ファイル：`checkSpecialState`](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L358-L361)、[同ファイル：`isInSpurt`](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L523-L526)
- [SkillData.kt：近似条件の確率パラメータ](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/data2/SkillData.kt#L151-L177)、[同ファイル：元条件と近似状態キーの対応](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/data2/SkillData.kt#L294-L313)
- [RaceCalculator.kt：条件近似を各秒に更新](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/RaceCalculator.kt#L412-L420)

## 固定818元スキルの該当範囲

[元P2.32の970条件経路](skill-p2-32-source-route-priority-20261113.md)から、**同一条件経路中にその型がある場合のみ**分類する。元スキル数値IDとアプリID、Invokeの**番号と配列位置の違い**、conditions OR、preConditions OR、元演算子・元値、同じAND内の他の未観測条件を保持する。

| 元条件 | 元スキル | 元条件経路 | 既存P2.32の `event-state-pilot-next` 経路 |
| --- | ---: | ---: | ---: |
| `change_order_onetime` | 30 | 30 | 14 |
| `is_overtake` | 21 | 27 | 8 |
| `is_lastspurt` | 55 | 61 | 32 |

**注意**：これらはスキルや経路の部分的に重複する集計。P2.32の「イベント状態の研究候補68経路」と別の分母であり、上3行を単純に合算しない。特定の条件を持つことは、元スキルの全AND／OR／事前条件を満たしたことではない。

[固定源の読取専用監査器](../../../poc/src/skill_p2_37_dynamic_state_evidence.cjs)は、出典実装に上記の近似／スパート定義が実在することを固定版で直接検査し、該当元スキルの各経路に以下を紐付ける。

- **近似由来の2条件**：脚質差やWの根拠として不採用。元条件は削らず保留し、実順位系列・レーン・イベント定義など独立した根拠が確認できたときだけ限定再開。
- **計算状態の `is_lastspurt`**：条件の意味の研究に条件付きで採用。発動評価へ反映するには、同じ走者・同じ判定時刻のスパート状態、発動区間、持久力と他ANDを照合する。未観測だから常に0／真とはしない。
- **どちらも**：元`preConditions`や複数Invoke・ORの別経路と混ぜず、元述語の演算子・数値を保持する。第三者が決めたモデルの確率をゲームの発動確率と表示しない。

## 今回の終了判断と次の研究

**「シミュレーターの近似確率を4脚質の適性差へ変換する」方針は根拠がなく不採用として終了**。近似をどれだけ大量に再生しても、その確率はゲーム実測へ昇格しない。代わりに順位・追い抜き機構自体は**未判定として重要性を維持**し、独立した位置・追抜き証拠がある少数の代表経路だけを今後の検証候補とする。これは「脚質差が小さい」と断定したための打切りではない。

次のG4代表検証は、**元の`is_lastspurt`と短窓／順位等が同一ANDにある条件**（例えばP2.32代表の末脚＝元200512）を候補とし、まず固定元の実際のspurtParametersが検証できるモデルで**スパート状態の時間・位置窓**を確認する。新しい全スキル実験や人工的な確率補正は行わず、どこまでのW/Dが改善するかを見て、同型条件への再利用と追加研究の要否を判断する。

**P2全体のG1〜G6は未完**。本研究は動的機構の採否を決める一つのG4判断であり、P3サポカの公式スコア・公開UIの更新ではない。
