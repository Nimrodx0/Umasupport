# P2.15：固定UmaSim本体での実抽選区間とキャッシュ判定（2026-11-13）

## 研究対象と出典

[直前の同じ元ANDへの順位率・ランダム区間接続](skill-p2-15-rank-random-same-and-handoff-20261113.md)では、**85元経路・85スキル・2つの共通カーネル**について、9頭／12頭の順位率条件を元値別に投影した。しかし、実際に抽選されたUmaSimの`phase_random`区間は未観測のままだった。

今回、固定元実装 `mee1080/umasim@f6e4501ee6c6c2d4ac8698e7796e309d31575bde` をCI実行時だけチェックアウトし、**元のKotlin SkillCheckerのまま**、`RandomPosition.RANDOM`によって生成された実際の`RandomEntry`の区間座標と、同じ`CalculatedConditions`のキャッシュを利用した判定結果を観測する。

対象の参照：元[SkillChecker.kt](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt)の`CalculatedConditions`、`phase_random`分岐、`checkInRandom`、`chooseRandom`／`initPhaseRandom`。実装の存在・区間上限・closed interval・乱数モードを既存[元コードアンカー検査](../../../poc/src/skill_phase_random_draw_support.cjs)で固定する。

**新しい本実験の限界を先に明記する**：元SkillCheckerを**JVM単体実行**するが、最初は**人工スキルID `99000215`** に `order_rate > 50` と `phase_random == 2` を設定する。元スキル`200592`等の実登録条件をコピーしていない。位置とtickは境界テストのため人工的に入力する。**RaceCalculatorを使う実レース、元スキルのリアルタイム発動、出走順位の実観測ではない。** つまり実際の元Kotlinコードから抽選区間を読めた場合でも、以前の85経路に元の抽選結果を「移植済み」とは見なさない。

## 実験手順

1. [専用GitHub Actions](../../../.github/workflows/p2-umasim-source-window-runtime.yml)で、元のソースを**固定コミットSHA**から一時取得。元ソース本体・元スキル辞書を当レポジトリに同梱しない。
2. [JVM元コード実行用テスト](../../../poc/source-probes/P215SourcePhaseWindowRuntimeTest.kt)だけを元Kotlinリポジトリのテストソース位置へ**一時コピー**する。元`SkillChecker.kt`を改変しない。Java 25、元のGradle 9.6.1の`:race:jvmTest`で動かす。
3. 12回、元の`CalculatedConditions`を個別に生成して、`RandomPosition.RANDOM`の`phase_random==2`条件を構築。生成された実際の`calculatedAreas["phase_random2"]`の区間開始・閉区間終端を読み取る。`checkCondition`をもう一度同じキャッシュで構築して、**区間が再抽選されず同じオブジェクトを参照する**ことを検証する。
4. 各抽選区間の開始直前・開始点・終端点・終端直後に`RaceSimulationState.position`を人工的に移動する。それぞれ元の条件ラムダで、偽・真・真・偽を検証する。**これは人工座標の4tickで、実レースの走行位置と頻度ではない。**
5. [独立JS検証器](../../../poc/src/skill_p2_15_umasim_phase_runtime_trace.cjs)に観測JSONと元Kotlinコードを与え、元ソースの式 `start=min(u * width + a, b-2)`、`end=min(start+10,b)` と整合する区間・キャッシュ再利用・closed interval判定を検証。生の乱数 `u` は取得していないため、**実抽選区間と生の抽選割合を混同しない**。研究専用の結果のみ14日間保持する。

## 何が分かり、何が分からないか

元のランダム区間の**実体**を測った場合、以前の「ソース式と仮想乱数・幾何学的可能性」に、実行された本体の`RandomEntry`の座標という証拠を追加できる。またキャッシュが条件生成単位で再利用されることを確認できる。

ただし、元UmaSimの固定`SkillChecker`は`order_rate`を実装していないため、人工スキルに順位条件を含めても、元実装で順位ANDが検証されたとは言えない。順位率は既存[P2.15の二次資料に基づく9/12頭解釈](skill-p2-15-rank-random-same-and-handoff-20261113.md)と独立に扱う。**このテストから実ゲームの脚質・距離・芝ダート適性、発動確率、元85スキルの条件全体の成立は計算しない**。P3/P4正式採点や公開UIにも変更を加えない。

## 実測の確定条件と次ゲート

本JVMワークフローが**実際に元Kotlinソースをコンパイル・実行して合格した場合に限り**、12区間／48人工位置判定などの結果を実測として追記する。ワークフロー実装だけをもって元UmaSimの実抽選が検証済みとは記録しない。Java／Gradle／固定依存関係のビルド失敗は機構の否定にはならず、環境の不成立として区別する。

次にRaceCalculatorの**実走行tickの位置と同じ条件の区間**を紐付ける計測を設計する。対象は元の辞書IDを実際に装備し、同一走者・同一レース・同一技能判定tickで`RandomEntry`と判定を取得できる最小構成。さらに元UmaSimが対応しない順位率は、モデル上の順位推定と**実ゲーム仕様の根拠**を独立に扱い、観測不能を真としない。元85スキルを一つずつ個別にシミュレーションする計画には戻らない。
