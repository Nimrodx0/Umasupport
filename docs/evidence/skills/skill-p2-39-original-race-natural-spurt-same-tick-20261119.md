# P2.39：元RaceCalculator由来の自然スパートと「末脚」のANDを同じ判定tickで観測（2026-11-19）

## 解決するG4の問いと最小限の手段

[P2.38](skill-p2-38-original-spurt-halfphase-same-and-20261118.md)は固定UmaSimの**元登録スキル200511全身全霊／200512末脚**の現在条件ANDが、`is_lastspurt==1` AND `phase_firsthalf_random==3`（終盤後半の前半）で完全一致することを確認し、**人工的に与えた**スパートパラメータと抽選窓で元Kotlinチェッカーの真理値を60回テストした。しかし「元RaceCalculatorが本当にスパート状態を計算し、その同じ判定tickで元ANDが成立するか」は観測していなかった。

今回は既存[元登録JVMレーステスト](../../../.github/workflows/p2-umasim-registered-source-skill.yml)を最小限拡張する。固定元 `mee1080/umasim@f6e4501ee6c6c2d4ac8698e7796e309d31575bde` の**元RaceCalculatorを無改変で実行**する。元200512の`SkillData`を元辞書から無改変で装備し、**4脚質それぞれ3つの単一走者モデルレース**を走らせる。

- 元RaceCalculatorのフレームには `RaceFrame.spurting` が記録されている。[元実装](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/RaceCalculator.kt#L399-L441)では、終盤入りのスパート計算結果をもとに**元技能判定の後で同じ走者の現在位置と計算距離から判定してフレームへ保存**する。
- 既存[P2.15の一時Kotlin窓フック](../../../poc/source-probes/P215RaceWindowHook.kt)の監視対象キーを、必要時だけ元の`phase_firsthalf_random3`に切り替える。これは**元`checkInRandom`が呼ばれたときのframe番号・現在位置・抽選窓・元の真偽だけを観測**する。元チェッカーの返却値を変更しない。既存P2.15の標準監視キー`phase_random2`は維持する。
- 各フックの元frame番号の`RaceFrame`を参照し、走者位置の一致、`spurting===true`、元の窓内外真偽、元の登録スキル200512の技能イベントが**同じframeに存在する条件**を検査する。元の4脚質と3レースを個別に保持する。
- 元ANDで`is_lastspurt`がFALSEなら、元の短絡評価により**窓条件チェッカー自体が呼ばれないことがある**。元の技能発動後も再チェックされない。したがって**窓フックの呼出回数は全レースの発動機会の分母ではない**。フレームの`spurting`から得る「自然スパートの実観測」と、`checkInRandom`呼出しの部分集合を明確に区別する。

## 適性への反映判断

| 項目 | この実験で認めること | 認めないこと |
| --- | --- | --- |
| スパート状態 | 固定元RaceCalculatorの自然計算結果が元フレームに実際に現れ、元同一tickのチェック結果と照合できるか | 人工注入された`spurtParameters`を実レース頻度と呼ぶこと |
| 元登録スキル | 200512の元ANDと元モデルの技能イベントが同じ元RaceCalculatorの判定tickで対応するか | ゲーム本体の技能発動率、元モデルの技能イベントを公式実測と呼ぶこと |
| 4脚質の比較 | 4つの指定脚質で観測が可能か、どの文脈・入力・対象走者に限るかを明確化 | **各3レースを4脚質の優劣・確定W/D・P3スコアへ変換**すること |
| GlobalSim | 別件の多走者順位・位置研究として活用する選択肢を残す | 対応のないGlobalSimレース・tickを今回のUmaSim元技能の成立時刻に合成すること |

**終了・継続条件**：元レース由来の`spurting`と元技能のAND判定が同一tickで確認できれば、**「元スパート状態と窓ANDを実レース内で観測できるか」という技術的研究課題は完了**とする。重要な4脚質の定量判断が必要なら、元RaceCalculatorのレース条件・スタミナ等の代表性、発動窓の抽選範囲、モデルの独立性を整理したうえで別工程の小規模感度分析を検討する。3レース×4脚質を独立なゲーム発動試行と数えない。

実測ログは固定CI成果物で14日保持し、研究レポジトリへは**集計と検証コードだけ**を残す。上流の登録スキル辞書全体やRaceCalculatorの改造版を本番アプリへ組み込まない。P2 G3/G4は引き続き未完。
