# P2.53：承認済み研究省略と残存経路の選別（2026-11-25）

[D-051](../../decisions/log.md#decision-d-051)により34型の専用研究省略を確定。[固定リスト](../../../poc/data/p2_approved_research_scope_d051.v1.json)はP2.51の提案と照合する。P2.52の実測678技能の内訳は228位置・静的のみ、42文脈方針依存、388複合条件研究維持、20履歴保留。候補は汎用ラベルではない。

残る42型の各出現を、同じ距離・芝ダート・重なり合う馬場状態で2脚質以上が静的に許容される元経路があるかで選別する。片脚質限定の経路は当該経路内比較の優先度を下げるだけで、別ORや効果の価値まで同一視しない。既存の順位2型の研究は維持。元全AND成立、動的状態の観測、定性方向を証明しない。新たな生の元条件値の配布は行わない。

## 次に見る観測可能性

固定UmaSim Checkerで accumulatetime は currentTime の整数化、hp_per は現在SP/最大SP、is_lastspurt はスパート状態、lastspurt は最大スパート速度との一致も要求する。両スパート型は同一扱い不可。compete_fight_count のモデル判定は真偽値、run_at_full_speed_random は抽選位置の到達を判定する。これらは固定モデルの処理でありゲーム仕様の証明ではない。順位帯継続2型は元定義の確認が先。追い抜き・順位変動・横ブロック等の特殊状態近似を定量根拠にしない。定性判断・追加実験・分布保留は別途検討し、G4再Passは未認定。

[実装](../../../poc/src/p2_remaining_route_review.cjs)・[反例](../../../poc/tests/p2_remaining_route_review.test.cjs)。固定CI待ち。


**固定CI確認**：[ #45530753855](https://github.com/Nimrodx0/Umasupport/actions/runs/45530753855)成功。D-051 863出現と残42型の比較可能性を照合。詳細内訳と後続の判断案は[P2.54](skill-p2-54-remaining-condition-decisions-20261125.md)。
