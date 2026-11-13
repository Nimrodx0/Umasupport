# P2.15：元UmaSimのcorner条件をコース実データ照合後に同tick統合（2026-11-13）

## 目的と前工程

[前工程の順位・局面・残距離の元条件同時刻統合](skill-p2-15-rank-position-full-join-20261113.md)では、固定8人工無スキルGlobalSimモデルレースで元`distance_rate`対象253スキルの元AND/ORをモデル上で評価し、**21,252技能×走者×レースのうち成立確認3,589／未判定10,450／全偽7,213**を記録した。

[未判定の元Invoke／OR代表候補経路の診断](skill-p2-15-observed-unknown-route-witness-20261113.md)を既存順位研究と再結合すると、残存UNKNOWNの代表候補に`corner`が含まれたため、この元述語を元コースデータとモデルの位置観測へ接続した。**対象は元の`corner`（コーナー番号）であり、ランダム窓である`corner_random`・`all_corner_random`・`phase_corner_random`の抽選実測ではない。**

## 固定出典の具体的定義

- 元スキル判定：`mee1080/umasim@f6e4501ee6c6c2d4ac8698e7796e309d31575bde` の `race/.../calc2/SkillChecker.kt` 内の `"corner" -> condition.checkInRace { cornerNumber }`。
- 元コーナー番号：同版`RaceState.kt` の`cornerNumber`。`simulation.position`を、**元`trackDetail.corners`のstart..end（両端含む）に照合し、最初に一致するコーナーの配列番号`i`に対して`(16+i-コーナー総数)%4+1`**を返す。いずれにも一致しなければ**0**。
- 元コース形状：同版の`race/.../data/rawData.kt`に埋め込まれた`rawCourseData`の元トラックコースID`10502`、`10504`。同時に固定GlobalSim `daftuyda/GlobalSim@80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1` の`data/course_data.json`の**同IDのコーナー数・始点・長さ・コース長・距離区分・芝ダート・場IDが一致**することを必須としている。元コースデータの全文はUmasupportの公開GitHubレポジトリへ再配布しない。

固定`10502`（芝1600m）は**コーナー3個**、始点と長さが(50,450)、(700,350)、(1050,240)m。元式が返す番号は前から**2、3、4**であり、配列の先頭から1、2、3と機械的には数えない。`10504`（芝2000m）は**コーナー4個**で(375,250)、(625,250)、(1200,250)、(1450,240)m、元式番号は**1、2、3、4**。コーナー外は0。これらは元データとモデルコース定義の**数値的一致**であり、元UmaSimのレース時刻とGlobalSimのレース時刻・実ゲームが完全に等価であるとの証明ではない。

## 同一判定時刻での評価・保留

- 固定3独立エンジン（無改造／モデル位置計測／順位計測）のGlobalSim v77を再利用。元の全253スキルのAST、`distance_rate`、`phase`・半局面・残距離・`furlong`、`order_rate`・`order`を保持し、**同じモデル走者・同じモデル判定直前tick**で`corner`も評価する。
- 同じ元述語の`invokeOffset`・`side`（条件／事前条件）・`orIndex`・`predicateIndex`・`operator`・`value`を変更しない。元AND/OR／複数Invoke／`preConditions`の履歴ラッチを保持。
- コース境界の`start`と`start+length`付近のモデル位置は、Double境界と別シミュレータの誤差の影響を断定せず**unknown**。不明を勝手にfalseへ置かない。観測可能なコーナー外では元式どおり`cornerNumber=0`。
- 初めて計測した判定時刻以前の`preConditions`成立履歴は**unknown**から始め、計測後に一度`true`が観測された場合、その後の`false`でも履歴`true`を保持する。
- 原典`SkillData.kt`で無視される`order`・`order_rate`のゲーム意味論は別の根拠を要する。今回追加した`corner`と違い、元UmaSimチェッカーの順位条件の実評価が観測できたわけではない。

## 実装・回帰試験

- [出典とコース形状の検査](../../../poc/src/skill_source_corner_stage_facts.cjs)：固定元式と元データ・モデルデータの始点／長さ一致を検証し、元演算子を保持した観測事実のみ追加。
- [既存の同時刻条件判定器](../../../poc/tools/globalsim_p2_15_source_distance_rate_ticks.cjs)：`cornerSourceEvidence`を指定した場合にのみ新条件を採用し、従来の順位・位置実験の計算方法・結果は変更しない。
- [統合比較と未判定経路の再診断](../../../poc/tools/globalsim_p2_15_source_corner_full_join.cjs)：コーナー条件の有無だけを変え、三値の単調性、走者×レース／元スキル×脚質の同一母数、元順位・位置の一致、preConditionsの履歴保留を検証。
- [回帰テスト](../../../poc/tests/skill_source_corner_stage_facts.test.cjs)：3／4コーナーの元番号、コーナー外0、境界unknown、元述語IDとAND/preConditions、TRUE履歴ラッチ、残る未観測ANDの保留。
- [3独立エンジン固定GitHub Actions](../../../.github/workflows/p2-source-rank-distance-real-ticks.yml)：固定UmaSim生コースデータとGlobalSimコース定義をCI時に取得、検証後に8人工レース・全253元スキルの三値結果を比較してJSONで保存。元全文は公開レポジトリへ同梱しない。

## 実測結果と限界

実測の確定値は専用CIの`P2_15_SOURCE_CORNER_FULL_JOIN_CI`と成果物の`joined-source-corner-and-rank-position-model.json`を正本とする。**CIが成功するまで、新たな成立件数や未判定減少量を断定しない。**

これは**元UmaSimの`cornerNumber`の式を、同じコース位置定義を持つ別のGlobalSimモデル位置へ当てはめた条件成立の研究**。元UmaSim実ランタイムの`simulation.position`を直接計測していない。実ゲームのスキル発動率・正式な4脚質適性、P3カード採点とP4製品UIに自動転用していない。

次は今回の実測を踏まえ、事前条件の履歴ラッチ、`corner_random`等の抽選窓、`is_overtake`等のモデル状態のどれが次に追加可能か調べる。未観測の前提条件やスキル効果を既知条件として捏造しない。
