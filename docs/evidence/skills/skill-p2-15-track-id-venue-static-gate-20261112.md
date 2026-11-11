# P2.15：`track_id` はコースIDではなく競馬場ID（2026-11-12）

**研究対象**：元スキルの `track_id` を含む分岐について、競馬場IDとコースIDの取り違えを防止し、固定12モデルコースで静的AND条件が両立する範囲を確認する。元スキル全体の発動条件・実ゲーム発動率・正式適性を検証したものではない。

## 出典から確かめた条件の意味

固定 `mee1080/umasim@f6e4501ee6c6c2d4ac8698e7796e309d31575bde` の[元SkillChecker](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt)には、`track_id` を **`baseSetting.trackDetail.raceTrackId`** に対して `preChecked` する分岐がある。同じ版の[元コースデータ](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/data/rawData.kt)では、個別コースの識別子（例：10502）と、そこに属する競馬場の `raceTrackId`（例：10005）が別の数値として収録されている。

[GlobalSim固定版](https://github.com/daftuyda/GlobalSim/blob/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/data/course_data.json) にもコースごとの `raceTrackId` があり、次のように**元の2ソースから数値一致を確認**した。

| 固定モデルのコースID | `track_id` の比較に使う競馬場ID | 区別すべき点 |
| ---: | ---: | --- |
| `10501`（芝1200m） | `10005` | 同じ競馬場 |
| `10502`（芝1600m） | `10005` | 個別コースIDではない |
| `10504`（芝2000m） | `10005` | 距離が違っても競馬場は同じ |
| `10508`（ダート1200m） | `10005` | 芝・ダートが違っても競馬場は同じ |
| `11302`（ダート1600m） | `10103` | 競馬場IDは必ずしも `100xx` に限られない |

**重要**：`track_id == 10005` を「コースIDが10005」と読み替えたり、`10502` とそのまま比較して偽にしたりしてはいけない。モデルの実際の各コースデータに記録されている `raceTrackId` を使う。

## 実装した照合の範囲

- [検証器](../../../poc/src/skill_track_id_venue_audit.cjs)は固定UmaSimの元コースデータとSkillChecker、固定GlobalSimのコースデータを読み、対象12コースについて **コースID・競馬場ID・距離・距離種別・芝ダート・左右回りが一致すること**を確認する。不一致なら評価を停止する。
- 元条件を照合したアプリ内818スキルを対象に `Invoke × conditions OR行 × preConditions OR行` を分け、**元分岐のどこかに `track_id` が含まれる経路だけ**を監査する。別のOR行にある条件を誤ってANDへ足さない。
- 各経路について `track_id`、`running_style`、`distance_type`、`ground_type` を、**同一コース・同一脚質の静的値**に元の数値演算子ごと照合する。比較可能なモデルコースIDと、合わない固定コースを区別する。
- `ground_condition` は当該モデルの馬場状態が固定されていないため、元の有限ドメイン内の矛盾確認に限り、**実レースで成立したとは判断しない**。`phase_random`、順位、位置、追い抜き、時間的なpreConditions、その他のAND条件も未評価のまま明記する。
- `track_id` を持たない別のInvoke/OR経路がある可能性を保持する。固定12コースのいずれにも一致しない経路を、**実ゲーム全コースで発動できないスキル**とは判定しない。

この結果は単に「この固定コース・脚質なら元分岐の**一部の静的AND条件に矛盾しない**」といえるだけである。元スキルを実際に装備した判定、動的条件が同じtickで満たされるか、発動抽選、クールダウン、複数Invokeの全体的な意味、効果の有用性を測定していない。

## 検証と件数

[固定元スキルのCI監査](https://github.com/Nimrodx0/Umasupport/actions/workflows/skill-condition-inventory.yml) は、両ソースの固定コミットから必要な元ファイルを実行時に取得し、成果物 `p2-15-track-id-fixed-source-venue-audit` に元スキルID・競馬場IDとモデルコースID・元分岐の静的照合結果だけを保存する。元のコースデータ・スキル本文はレポジトリへ再配布しない。

[単体テスト](../../../poc/tests/skill_track_id_venue_audit.test.cjs)は、同じ競馬場に複数コースがある場合、preConditionsのOR分岐、芝ダート・距離・脚質のAND、元データの不一致、別ORに `track_id` がない場合の保留を検査する。

**固定ソース全818スキルでの件数は最終CI成功後に追記する。** 一致件数を元スキルの発動成立件数へ置き換えない。

## 次の研究との接続

P2.15の[未検証条件型の監査](skill-p2-15-blocker-impact-20261111.md)では `track_id` が未検証型の1種類だけ残るスキル候補を37件抽出した。ここで元ソースの**競馬場ID条件の取り扱い**を確立しても、候補37件の全レース条件や各発動経路が評価済みになるわけではない。

次の増分では、`phase_random` を含むランダムな発動ウィンドウの**元の演算子・抽選窓・内部判定時刻**を直接検証する。静的な競馬場条件、動的な局面・順位条件、preConditionsの状態管理を同じANDへ接続するときは、走者・コース・判定tickを必ず一致させる。P3へ正式な適性ラベルを渡す判断はまだ行わない。
