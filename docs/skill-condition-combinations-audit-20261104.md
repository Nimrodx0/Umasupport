# P2：発動条件の同時出現・実スキル反例調査（2026-11-04）

**状態：相談用の固定実データ監査。適性の推定規則、分類タグの閾値、カードUIは未決定・未実装。**

## 1. 対象・実行・再現性

- UmaSim固定コミット：`f6e4501ee6c6c2d4ac8698e7796e309d31575bde`（辞書2,162件・125種類の条件コード）。
- `skill_data.txt` SHA-256：`4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5`。
- 実用対象：ウマサルタントのモデル881スキルのうち、同固定辞書にID・名前一致で照合できた818件。未照合63件は従来どおり掲載し、発動条件は不明。
- 監査器：`poc/src/skill_condition_combinations.cjs`、`poc/tools/audit_skill_conditions.cjs`。元辞書は公開リポジトリにコピーしない。検証済み固定出典を取得する監査用ActionsのJSON成果物に集計と代表例を保存する。
- [P0全件構造監査](skill-condition-inventory-audit-20261104.md)から、条件の単純な出現頻度と組合せによる意味の差を区別して検討する。

## 2. 数え方（同じスキルにあればAND、とはしない）

- **同一AND経路内**：同じ`Invoke`の同じ`conditions[orIndex]`または`preConditions[orIndex]`の配列内に両条件コードが現れた場合だけ「同一AND」と計上。
- **同じInvokeだが別経路**：別のOR候補、または`preConditions`と`conditions`に分かれた場合は別集計。直接ANDの実例に加えない。
- **別Invoke**：両者が別`Invoke`に現れただけなら「同じAND」にも「同じInvoke」にも計上しない。複数Invokeの総合評価は保留。
- 集計は「**異なる数値スキルID数**」を第一指標とし、同一スキル内の同種経路が複数ある場合は条件記述回数を別に保持。名寄せ・金白系列・同名別IDを勝手にまとめない。
- `phase_random`と`phase`、`order_rate`と`order`、`is_overtake`と`change_order_onetime`を同義扱いしない。

## 3. 全件結果：組合せの分布

| 同じANDの条件コード | UmaSim全体2,162件内 | アプリ対象818件内 |
| --- | ---: | ---: |
| `distance_type`＋`order_rate` | 350 | 138 |
| `order_rate`＋`running_style` | 255 | 114 |
| `order_rate`＋`phase_random` | 171 | **85** |
| `order_rate`＋`phase` | 163 | **16** |
| `order_rate`＋`phase_firsthalf_random` | 82 | **39** |
| `order_rate`＋`phase_laterhalf_random` | 117 | **48** |
| `order_rate`＋`is_overtake` | 37 | **4** |
| `order_rate`＋`blocked_side_continuetime` | 29 | **4** |

アプリ対象818件の条件式を展開すると、OR/ANDの内側の行（`preConditions`・`conditions`の両者を合算）は993行。順位・順位割合を含むAND行は292行。順位・順位割合を含むが**調査対象とした局面コード群を同じAND行には含まない**ものが44行あった。これは「時期条件がない」と同義ではない：`is_finalcorner_random`、`is_last_straight`、`is_lastspurt`など局面コード以外でタイミングが指定される例がある。

`order_rate`を含むスキルのうちOR経路が複数あるものがアプリ対象で23件、位置条件がある複数Invoke型は4件。個々のコードをタグにしただけでは、発動の必須条件を正確に表せない。

## 4. 実在スキルの比較例

以下はゲームの実装そのものの正当性ではなく、**固定UmaSim辞書の構造化条件として観測した事実**。厳格な使用可否（`running_style/distance_type`）と、順位・局面の成立しやすさ（推定候補）を区別する。

| スキル（数値ID） | 固定データ上の条件（ANDを`&`で表示） | 検討すべき点 |
| --- | --- | --- |
| **ギアシフト** `201052` | `distance_type==2 & phase_random==1 & order_rate<=50` | 明示はマイル。**脚質は明示されていない**。中盤のランダム位置で上位50%という条件の成立しやすさを脚質別に考えたい |
| **上昇気流** `200702` | `distance_type==2 & phase_random==2 & order_rate>50` | 明示はマイル。終盤側で上位半分にいないことを要求する条件。順位の時間変化を考慮する必要がある |
| **急ぎ足** `200542` | `running_style==1 & phase_random==1 & order_rate<=50` | **逃げに厳格に限定**される。中盤順位条件から作戦をさらに推定する必要はなく、明示条件と発動機会は別物 |
| **闘争心** `202092` | `distance_type==3 & phase==1 & order_rate>=30 & order_rate<=80 & blocked_side_continuetime>=2` | 中盤・順位帯**だけでは足りず**、一定時間横がふさがる状況が必要。順位条件単体の解釈で脚質を断定しない |
| **電光石火** `202401` | `distance_type==1 & phase>=2 & order_rate>=40 & is_overtake==1` **OR** `distance_type==2 & phase>=2 & order_rate>=40 & is_overtake==1` | 短距離／マイルのORを保持し、終盤以降・順位・追い抜きという条件の**同時成立**を評価対象とする。追い抜きが必要なことと、必ず差し専用であることは別 |
| **猪突猛進** `204161` | `preConditions: (running_style==1) OR (running_style==2)` ／ `conditions: (phase>=2 & remain_distance<=600 & order==1) OR (phase>=2 & remain_distance<=600 & is_overtake==1 & order_rate<=50)` | 逃げ／先行の明示制限がある一方、**追い抜きは必須ではない**（先頭条件の別経路あり）。この形を「追い抜き型」と一括分類すると誤解を招く |

※ `phase`の値については、固定UmaSimの`RaceState.getPhase()`と`RaceSetting.getPhaseStartEnd()`で`0..3`の4区間を定義。これは**シミュレーターの計算上の局面定義**であり、現行ゲーム全体との完全一致を独立検証したわけではない。

## 5. ソースコードから確かめられる解釈の境界

- [固定UmaSim `RaceState.kt`](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/RaceState.kt)：距離割合による`phase 0`（0～1/6）、`phase 1`（1/6～2/3）、`phase 2`（2/3～5/6）、`phase 3`（5/6～ゴール）の区分を確認。`phase==1`は中盤区間の成立判定。
- [固定UmaSim `SkillChecker.kt`](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt)：`phase_random==1`はphase 1内のランダム範囲設定。`phase_firsthalf_random==2`はphase 2**の前半**、`phase_laterhalf_random==0`はphase 0**の後半**を対象とする。`phase==1`と`phase_random==1`は同一条件ではない。
- [固定UmaSim `SkillData.kt`](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/data2/SkillData.kt)：`order`や`order_rate`はシミュレーター内部では無視する旨の`ignoreConditions`記録がある。`is_overtake`等の一部は近似評価。**シミュレーター上の判定可否を、ゲーム側の発動条件が存在しないという意味にしない**。

## 6. 125コードの整理方針（カテゴリーは仮案）

全125種の各演算子・値・アプリ対象の該当数は、監査器が作る`skill-condition-inventory-audit.json`の`fullRegistry.counts.byType`／`app.inventory.counts.byType`に残る。アプリ対象818件では**90種類**が出現し、残る35種類はこの固定時点のアプリ対象に観測されない。これらを次のような**候補軸**に分けてレビューする。相互排他な完成分類ではない。

- **明示的な適用先**：脚質、距離区分、芝・ダート、特定コースなど。
- **自身の順位・位置取り**：順位割合／絶対順位、順位変動、前方・後方馬身差、順位帯の維持。
- **発動する時点・区間**：4局面と局面内ランダム、コーナー・直線・坂、残り距離。
- **相互作用・機会**：追い抜き、横・前方のブロック、併走・競り合い、他のウマ娘の状態。
- **他スキル・育成ステータス・抽選**：既発動スキル、体力、基礎能力、内部判定と乱数。
- **コース・環境**：レース場、季節、天候、馬場状態等。直線・坂などは「局面」と重なるため複数観点で扱う。

条件コードをどれか一種類に押し込むべきとは限らない。意味が未確認のコードを「その他＝汎用」にはしない。

## 7. 次の相談ポイント

**優先案**：「明示脚質指定がない、同じANDの`順位割合 × 局面`」から始め、まず成立条件をそのまま説明し、脚質適性推定の適切さをユーザーと相談する。例えば「ギアシフト」と「上昇気流」は、マイル条件が共通でもレース局面・順位帯の要求が異なる。そこから先行／差しなどへの推定をどこまで表示するかは**まだ決めない**。

次に「闘争心」のような他馬依存、「電光石火」のような追い抜き必須、「猪突猛進」のようなORで追い抜きが必須ではない例を反例として使う。サポカ全体の点数や、発動後の効果の有効性はまだ作らない。後者は別の有用な評価軸として検討余地を残す。

**検証の境界**：A=人工条件のAND/OR・複数Invokeを検査。B=固定辞書と現行アプリ収録範囲の組合せを全件実測。C=監査スクリプトのみでUI変更なし。実ゲームでの発動率・発動成功率の検証は未実施。
