# P2.15：出典照合済みコーナー番号を同一GlobalSim判定時刻で統合（2026-11-13）

## 位置づけ

[既存の順位・位置複合条件の同tick研究](skill-p2-15-rank-position-full-join-20261113.md)では、元`distance_rate`253スキル・固定8無スキルGlobalSimモデルレースで、元`order_rate`・`order`・6種類の走行位置条件を元のAND/OR・preConditions・複数Invokeに与えた結果、**21,252スキル×走者×レース**のモデル条件成立3,589・未知10,450・観測全不成立7,213を確認した。残る代表UNKNOWN候補経路では、元`corner`条件が2,166試行に登場した。

今回、**元UmaSimが実装している`cornerNumber`式**と**元のコースジオメトリ**を出典から検査し、対応を確認できた固定2コースに限り、従来の順位・位置・距離条件と**同じモデルスキル判定直前位置**へ追加する。

## 原典と式

元`mee1080/umasim@f6e4501ee6c6c2d4ac8698e7796e309d31575bde`の固定`RaceState.kt`には、概念的に次の処理がある。

1. `setting.trackDetail.corners`を先頭から順に走査し、`simulation.position`が**両端を含む** `start..end` にある最初のコーナーを選ぶ。
2. コーナー外なら`cornerNumber=0`。
3. コーナー内では、元の`(16 + cornerIndex - corners.size) % 4 + 1`を使う。

したがって**コーナー番号は先頭からの単純な1,2,3…ではない**。実コースにコーナーが3区間だけある場合、先頭からの番号は**2, 3, 4**となる。コーナーの外は0。元`SkillChecker.kt`は`"corner" -> condition.checkInRace { cornerNumber }`を使用する。**`corner_random`とは別の条件**であり、今回の調査では両者を同一視しない。

元のコース定義`race/data/rawData.kt`に入った`rawCourseData`（コースごとの`corners[].start`と`length`）と、GlobalSim固定コミット`daftuyda/GlobalSim@80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1`の`data/course_data.json`を、**コースID・距離・芝ダート・距離区分・コーナー配列の個数、各startとlengthが完全一致する場合だけ**対応付ける。

固定8モデルレースの`10502`（京都芝1600m）と`10504`（京都芝2000m）は一致。**モデルデータ全体が同じとは主張しない**。元データと固定GlobalSimデータのコース定義を抽出して比較したところ、モデル138コースのうち129コースがコーナー配列一致、9コースには差異または対応不足があり、現時点で一般化しない。元データ全文や別プロジェクトのコース定義をGitHubレポジトリへ再配布せず、CIで固定リビジョンから一時取得する。

## 判定の保守的処理

- 同じ人工モデルレースを無改造版・位置計測版・順位計測版の3独立GlobalSimエンジンで再現し、位置・速度・体力・レーンが変わらないことを確認する。
- `cornerNumber`の元式は`simulation.position`を使用する。**今回使うのは別シミュレータGlobalSimのpre-skillモデル位置**であり、元UmaSimのsimulation.positionを実測したという意味ではない。これは一致する元コース区間とモデル測定値による式の投影。
- コーナー区間の開始・終了から1e-6m以内は、モデル位置精度と原典Double境界の差を無条件に判断せず`unknown`に保留する。初期フレーム・終了状態・コース外位置も測定済みにはしない。
- 元`corner`述語の比較演算子・期待値、Invoke番号・OR/AND位置は変更しない。`preConditions`履歴不明は現在`corner`の観測値が得られても不明のまま保存する。
- 同一tickの元`distance_rate`＋5位置条件＋`order_rate`＋`order`を維持し、今回だけ`corner`事実を追加した結果を**同じ元スキル×モデル走者×モデルレース母数**で比較する。三値結果の確定true／falseが新事実で逆転してはならない。

## 実装と固定CI

- [元コーナー式・元／モデルのコース検証・同tick述語](../../../poc/src/skill_source_corner_stage_facts.cjs)
- [既存元AST三値tick判定器へのオプトイン追加](../../../poc/tools/globalsim_p2_15_source_distance_rate_ticks.cjs)
- [既存順位＋位置統合解析に続く元corner前後比較](../../../poc/tools/globalsim_p2_15_source_rank_position_full_join.cjs)
- [境界・3コーナー番号・出典不整合拒否・複合AND・preConditions回帰テスト](../../../poc/tests/skill_source_corner_stage_facts.test.cjs)
- [3独立GlobalSimエンジン、固定原典を再取得するGitHub Actions](../../../.github/workflows/p2-source-rank-distance-real-ticks.yml)

## 固定CIでの実測値

この工程の結果は、GitHub Actionsの`P2_15_CORNER_SAME_TICK`と`joined-order-rate-order-position-source-model.json`を正本とする。**CI成功前は件数を実測として掲示しない。** 元253スキル・21,252スキル×走者×レースの母集団を維持し、`corner`追加前の既知基準3,589成立／10,450未知／7,213全偽が変わらないことも検査する。

今回の条件成立は元スキルのコーナー**部分条件**を人工モデルの走者位置に投影した結果にすぎない。実ゲームのコーナー判定・元UmaSim実走行・スキル装備時の実発動・発動率・P2脚質適性・P3カード採点・P4公開UIは未検証・未承認。

## 次の未完

コーナー条件の研究後、残る`preConditions`履歴ラッチや他スキル発動済み条件、追い抜き状態等を、実装可能な同tick観測・履歴再生と、元UmaSimで無視される順位など別出典が必要な条件とに分ける。
