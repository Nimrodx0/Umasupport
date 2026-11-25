# P2.57：近傍・ブロック・追い抜きの独立モデル観測（2026-11-25）

P2.54ではUmaSimの特殊状態乱数近似を実ゲームの根拠として不採用とした。[固定GlobalSimのactivation_conditions.rs](https://github.com/daftuyda/GlobalSim/blob/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/src/activation_conditions.rs)を再確認すると、以下の11型は別のモデルで直接観測できる。

| 元型 | 固定818照合内の技能数 | モデル観測 |
| --- | ---: | --- |
| blocked_front_continuetime | 4 | lv_blocked_front_continuetime(s,field) |
| blocked_side_continuetime | 20 | lv_blocked_side_continuetime(s,field) |
| infront_near_lane_time | 10 | lv_infront_near_lane_time(s,field) |
| behind_near_lane_time | 4 | lv_behind_near_lane_time(s,field) |
| is_overtake | 21 | is_overtaking_value(s,field) |
| overtake_target_time | 6 | s.overtake_target_time.floor() |
| is_move_lane | 4 | lv_is_move_lane(s,field) |
| is_surrounded | 2 | lv_is_surrounded(s,field) |
| near_count | 2 | lv_near_count(s,field) |
| near_infront_count | 2 | lv_near_infront_count(s,field) |
| lane_type | 2 | lane_type_value(s,field) |

固定32レースの無スキル・固定能力・2コース・9/12頭・均衡／後方過多を再利用。両priorityの元getter値一致、無改変版との位置・速度・HP・レーン全値一致を要求する。条件11型の元登録技能を重複排除し、全AND/OR/Invokeの論理リプレイを既存順位・位置／native状態追加の2段階で比較。初期履歴・未観測条件はUNKNOWN。型別非ゼロ率は同一モデル内記述値であり、独立試行率でも実ゲーム発動率でもない。

同ソースでは後方馬身差の後続不在時全比較false、2.5m換算、順位帯継続の5秒からの履歴、最高速ランダムの局面3区間指定も確認した。ゲーム仕様の独立証明ではなく、UmaSimとの意味差を無断統一しない。実行結果は未確認、正式適性や新規省略は承認しない。

[計測・解析](../../../poc/src/p2_native_neighbour_model.cjs)・[単体テスト](../../../poc/tests/p2_native_neighbour_model.test.cjs)・[CI](../../../.github/workflows/p2-native-neighbour-model.yml)。

## 実測結果

[専用CI #45536343959](https://github.com/Nimrodx0/Umasupport/actions/runs/45536343959)成功。専用CI #45536343959成功。73技能、24,528技能×走者×レース、成立94→3,054、不成立14,638→16,672、未知9,796→4,802。固定モデル・元論理投影のみ。 435,558判定走者tick、物理値1,751,724一致。未知解消4,994。P2.56とは技能・条件が重なり件数を加算しない。次は[P2.59](skill-p2-59-joint-dynamic-model-20261125.md)で同一tickの観測を結合する。
