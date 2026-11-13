# P2.15：元スキル辞書の実登録スキルを元のInvoke・AND/ORのままレースに装備する（2026-11-14）

## 目的

[前工程の元レース実測](skill-p2-15-original-race-tick-window-20261113.md)では、固定元UmaSimの`RaceCalculator`で予約ID`99000216`の合成スキルを実行し、3レース・1,917判定フレームについて、元の抽選区間・位置・モデルイベントを同じtickで照合した。

本工程は、**合成スキルから固定元UmaSimに実際に登録されているスキルへ切り替える**。固定元版 `mee1080/umasim@f6e4501ee6c6c2d4ac8698e7796e309d31575bde` にある`data/skill_data.txt`（Git blob `0c6ea6d72b037b24ee40860f73b0e86db47aab1d`）をテスト環境だけで読み込み、元`SkillData`を**`copy()`せず、そのまま`UmaStatus.hasSkills`へ設定**する。

## 対象の選び方

- 元の`Invoke.conditions`の**同じOR行内のAND**に`order_rate`と`phase_random == 2`の双方を持つスキルだけを候補とする。元の比較演算子・閾値・ANDの順序、他のOR行、別Invoke、`preConditions`を削除・結合・上書きしない。
- 同じスキル内で`phase_random==2`が複数重複する場合は、現在の窓フックでは元Invokeの特定が難しいため候補にしない。レース前に候補をパラメータが少ない順に整理し、最大12候補について元モデルで各3レース試行し、**元の`phase_random2`が実際に一度でも判定されたもの**を最初の代表例とする。未観測の候補をFALSEとは扱わない。
- 元スキル辞書・条件本文はJSON成果物へ出力しない。元ID、選んだInvokeの元番号・OR行位置、元ANDの述語数など**構造と観測だけ**を保存する。テストで元Kotlinソースを変更するのは前工程と同じ、元`checkInRandom`の真偽値を変えない**一時CI計測パッチ**だけである。

## テスト内容と根拠

- [元辞書を読み元`RaceCalculator`でレースを走らせるJVMテスト](../../../poc/source-probes/P215RegisteredSourceSkillRaceTest.kt)
- [元の真偽値を変えず元レースtickを取得するフック](../../../poc/source-probes/P215RaceWindowHook.kt)・[元アンカーを固定する一時パッチ](../../../poc/tools/install_p215_race_hook.cjs)を再利用
- [独立JS監査](../../../poc/src/skill_p2_15_registered_source_race_trace.cjs)と[合成反例テスト](../../../poc/tests/skill_p2_15_registered_source_race_trace.test.cjs)
- [固定元スキルJVM実測CI](../../../.github/workflows/p2-umasim-registered-source-skill.yml)で、元スキル辞書のGit blob SHAを確認してから一時上流をコンパイルし、結果を14日間保存する。出典の上流スキルデータをUmasupportレポジトリへ同梱・再配布しない。

元の`SkillChecker`は`order_rate`が未実装で、元`SkillData.kt`の`ignoreConditions`にも順位条件を無視すると明記されている。そこで**実登録スキルを元のまま装備して元`phase_random`判定を観測できたとしても、元の順位率ANDが成立した証拠にはならない**。実モデルスキルイベントも日本版ゲームのスキル発動とは区別する。元スキルの条件が一度も判定されなかった試行は真偽未観測として保留する。

## 実測結果

[**固定元UmaSimのJVM本体CI #43459950609（成功）**](https://github.com/Nimrodx0/Umasupport/actions/runs/43459950609/job/132003883334)で元登録辞書の読み込み・出典blob SHA照合・スキル装備・元`RaceCalculator`3レース・独立JSON監査まで成功した。

| 指標 | この固定元CIの観測値 |
| --- | ---: |
| 元の固定登録スキルID | **`105401211`** |
| 元Invoke件数／選択されたInvoke番号 | **1／1** |
| 元条件OR行数／元OR行インデックス | **1／0** |
| 元条件AND行の述語数／元事前条件OR行数 | **3／0** |
| 元UmaSimレース実行 | **3レース** |
| 元`phase_random2`の判定呼び出し | **1,893フレーム** |
| 元`phase_random2`が真／偽だった判定 | **3／1,890** |
| 元モデルの技能イベント | **3件** |
| 元`order_rate`条件が実際に評価された回数 | **0件（元実装で無視）** |
| 元スキル全条件の元実装での検証／実ゲーム発動確率／正式適性採点 | **0／0／0** |

レース別の元条件評価は**603（真1・偽602）／665（真1・偽664）／625（真1・偽624）回**。元スキル自身の`SkillData`・`Invoke.conditions`・`preConditions`を変更せず実行した。元のANDに3述語があることを確認したが、元ランク条件は元UmaSimが無視するため、**「元条件3個がすべて成立した」ではない**。このCIでのモデル技能イベント3件と、元ゲームのスキル発動確率を混同しない。

抽選窓とランクの対応に加え、**この元登録IDが前工程で抽出したアプリ照合済み85経路に含まれるかどうかは、今回の固定登録辞書ランタイム監査だけでは確定していない**。次にアプリ側の元経路IDと交差検査する。元`phase_random2`の抽選区間座標を含む観測JSONは、[当該GitHub Actions実行](https://github.com/Nimrodx0/Umasupport/actions/runs/43459950609)の14日保持研究成果物から参照できる。第三者の元条件辞書本文は再配布しない。

**1,893は独立した1,893回の技能試行ではなく元判定関数の呼び出し回数**である。TRUE時に発動した後はクールダウン等で同じスキルの継続判定が変わる。したがって3／1,893はスキル発動確率でも成立機会Wでもない。

## 次工程

同じ元Invoke・OR行の`order_rate`の元条件は保留し、実ゲーム順位率意味論と元レース順位相当の**独立・同一走者・同一tick観測**を整備する。元UmaSimが無視する条件を外部で補うときも、生の元条件値と元論理の適用を保ち、合成モデルとゲームの差を明記する。P2.33の距離・芝ダート非明示成立機会Wは本工程から切り離し、正式P3/P4適性採点は行わない。
