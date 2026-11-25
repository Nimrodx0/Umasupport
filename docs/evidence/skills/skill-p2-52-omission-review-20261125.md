# P2.52：34研究省略候補の精査（2026-11-25）

P2.51の[固定CI #45528705885](https://github.com/Nimrodx0/Umasupport/actions/runs/45528705885)で90型・2,421出現を再照合し、反例テストも成功。以下は34候補の実測共起数（技能数、型間・列間重複あり）に基づく**利用者確認前の判断案**。

## 推奨する判断

- 仕様候補22型：発動位置・区間・抽選窓・正しいalwaysの**単独の脚質別研究を省略**する案。共通コースの存在・到達、元値、元抽選分布を保持し、順位等との組合せの成立機会研究は対象に残す。固定UmaSim実装はゲーム全体の証明ではない。区間が空、走破前に終了、抽選窓を取りこぼす場合などは別。
- 費用対効果候補12型：専用の追加研究・入力・標準補正を省略する案。D-049の考え方を拡張するが、この時点で承認済みとはしない。random_lotは固定Checkerで100乱数、random_lot_sharedは共有抽選値を使用。共有と独立抽選の相関を同一視せず、元条件を保持する。season/timeの固定Checker明示処理未確認も保持。post_numberの他動的ANDを除去しない。
- 元述語をTRUEにすること、正式な汎用ラベル、元AND/ORの削除、実ゲーム発動率の認定は一切行わない。

## 34型の固定実測

| 元条件型 | 技能数 | 同じANDに順位 | 同じANDに他動的条件 | 技能内の他動的条件 | 技能内の事前条件 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `phase_random` | 200 | 95 | 18 | 18 | 2 |
| `phase_firsthalf_random` | 98 | 41 | 41 | 43 | 6 |
| `phase` | 69 | 24 | 53 | 53 | 9 |
| `phase_laterhalf_random` | 61 | 48 | 2 | 4 | 1 |
| `all_corner_random` | 35 | 2 | 0 | 0 | 0 |
| `corner` | 33 | 8 | 20 | 20 | 0 |
| `straight_random` | 31 | 0 | 0 | 0 | 0 |
| `distance_rate` | 24 | 7 | 21 | 21 | 5 |
| `is_last_straight` | 20 | 9 | 10 | 10 | 1 |
| `distance_rate_after_random` | 18 | 4 | 0 | 0 | 0 |
| `is_finalcorner` | 15 | 6 | 9 | 9 | 0 |
| `phase_firstquarter_random` | 14 | 14 | 0 | 0 | 0 |
| `corner_random` | 13 | 13 | 0 | 0 | 0 |
| `season` | 12 | 0 | 0 | 0 | 0 |
| `is_finalcorner_random` | 10 | 9 | 0 | 0 | 0 |
| `always` | 9 | 0 | 0 | 0 | 0 |
| `remain_distance` | 9 | 4 | 2 | 6 | 6 |
| `phase_corner_random` | 8 | 4 | 0 | 0 | 0 |
| `up_slope_random` | 8 | 0 | 0 | 0 | 0 |
| `down_slope_random` | 7 | 0 | 0 | 0 | 0 |
| `post_number` | 6 | 0 | 2 | 2 | 0 |
| `rotation` | 6 | 0 | 0 | 0 | 0 |
| `is_basis_distance` | 4 | 0 | 0 | 0 | 0 |
| `phase_straight_random` | 4 | 4 | 0 | 0 | 0 |
| `slope` | 4 | 0 | 4 | 4 | 0 |
| `is_dirtgrade` | 3 | 0 | 0 | 0 | 0 |
| `corner_count` | 2 | 0 | 0 | 0 | 0 |
| `course_distance` | 2 | 0 | 0 | 0 | 0 |
| `furlong` | 2 | 0 | 2 | 2 | 0 |
| `is_tight_track` | 2 | 0 | 0 | 0 | 0 |
| `random_lot` | 2 | 0 | 0 | 0 | 0 |
| `random_lot_shared` | 2 | 0 | 0 | 0 | 0 |
| `time` | 2 | 0 | 0 | 0 | 0 |
| `succession_skill_count` | 1 | 0 | 0 | 0 | 0 |

22仕様候補中、同一AND順位・技能内の他動的条件・事前履歴の少なくとも一つが存在する型は18。残る4（straight_random, always, up_slope_random, down_slope_random）も、別OR/Invokeの順位条件、元演算子・値、明示脚質制限、区間の存在を確認するまで全技能の汎用性を断定しない。費用対効果12型ではpost_numberの2技能に他動的ANDがある。各行の和は独立技能数ではない。

## 全スキルの式による追加確認

[実装](../../../poc/src/p2_omission_candidate_review.cjs)で固定元registryのSHAを照合し、818元技能の全Invoke・条件OR・事前条件OR・AND位置を既存台帳と突合する。34候補を含む技能を、他動的条件・順位あり／履歴あり／固定文脈方針依存／位置・時期と静的条件のみの候補へ排他的に分類する。明示脚質制限も別に保持し、未照合63件は候補に含めない。固定CI未確認。実測された技能数と残る研究経路の判断は次の確認で記録する。
