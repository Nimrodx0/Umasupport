# P2.32：局面前半・後半ランダム区間の共通判定機構を元JVMで確認（2026-11-16）

## 既存研究から再利用できる部分

固定 `mee1080/umasim@f6e4501ee6c6c2d4ac8698e7796e309d31575bde` の [SkillChecker.kt](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L122-L145) では、次の3条件がいずれも **同じ `checkInRandom(calculatedAreas, condition.type + condition.value)`** を使用する。

| 元条件型 | `initPhaseRandom` の抽選対象 | 元ソースでの引数 |
| --- | --- | --- |
| `phase_random` | 局面全域 | 既定 `0.0 to 1.0` |
| `phase_firsthalf_random` | 局面の前半 | `0.0 to 0.5` |
| `phase_laterhalf_random` | 局面の後半 | `0.5 to 1.0` |

元ソースの [`initPhaseRandom`／`chooseRandom`](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L377-L393) は、局面の開始・終了位置から指定割合の抽選区間を計算し、その範囲でランダムな10m以下の閉区間を作る。**共通化できるのは抽選・キャッシュ・境界判定の機構**であり、前半・後半の抽選領域まで同一とみなさない。

## 検証内容

[先行の元JVM抽選窓テスト](../../../poc/source-probes/P215SourcePhaseWindowRuntimeTest.kt)に、2条件型の**合成スキル・phase=2・各6回の元Kotlin実抽選**を追加。元の `SkillChecker` は変更せず、元 `RaceCalculator` も実行しない。各回で以下を元Kotlinの実行結果に対してチェックする。

1. 実際に生成された `RandomEntry` の開始・終了が**条件ごとに異なる局面半区間**に収まる。
2. 同じ条件キーを再計算しても、`calculatedAreas` が**同じ元オブジェクトを再利用**する。
3. 始点直前・始点・終点・終点直後を元の判定関数に入力して、**FALSE／TRUE／TRUE／FALSE**となる。
4. 既存のCIで上流固定SHAと条件型ごとの元Kotlin分岐を照合し、計測JSONの幾何・キャッシュ回数・研究境界を再確認する。

[元JVMの既存CI](../../../.github/workflows/p2-umasim-source-window-runtime.yml)を拡張し、**新しいシミュレータ、CIジョブ、依存ライブラリは追加しない**。第三者スキル辞書は再配布せず、合成スキルの元抽選座標だけをActionsへ14日保持する。

## 到達点と未検証

**元JVM CIが成功するまで、実測済みとは記載しない。** 成功した場合に確かめられるのは、上記2種類それぞれの元抽選窓・キャッシュ・人工位置境界が既存の `phase_random` と**同じ判定手続きを共有する**ことに限る。

実スキルの元Invoke全AND/OR、同一レースでの順位、`order_rate`、実ゲームの発動率、脚質・距離・芝ダート別W、P3/P4正式スコアは**未評価**。研究済み判定方法を他スキルに再利用する際も、**元の条件型、phase値、比較演算子、数値閾値、OR／preConditionsを各スキルの元データから再評価**する。ほかの抽選系条件（`corner_random`、`phase_straight_random`など）は本工程の検証対象外。
