# P2.56：経過時間・順位変動と元条件の同一モデルtick研究（2026-11-25）

P2.54で経過時間の33比較可能経路が別状態を必要とした。既存[P2.20の32レース順位変動観測](skill-change-order-skill-tick-20261110.md)は順位上昇2,043・下降2,095、元30技能（上昇20／下降10）の必要条件の部分証拠。UmaSimの乱数近似は不採用だが、GlobalSimの実測内部順位差を**限定的なモデル根拠**として活用できる。旧研究を無かったことにしない。

固定GlobalSimのaccumulatetime条件は内部時計のf32 floor、元UmaSimはcurrentTime.toInt（frameElapsed*secondPerFrame-startTime）。同じ時計・ゲーム再現とは認定せず、GlobalSimの元priority 1/0の同一時点で内部時計と現在／前回順位を取得。既存32レース（2コース、9/12頭、均衡／後方過多、能力固定、4seed）で元エンジンと計測版の全物理値一致を要求する。初期の前回順位0、観測されない事前履歴はUNKNOWN。

元818照合からaccumulatetime39技能、change_order_onetime30技能を重複除去し、全Invoke・AND/OR・履歴を保った論理モニターで3段階を比較する。順位・位置・静的条件の既存観測／内部時計追加／符号付き順位差追加。判定不能な他条件はUNKNOWN、既知TRUE/FALSEを反転させない。単独のW/D、実ゲーム発動率、正式適性は未認定。元のゲームデータは再配布せず、派生集計のみCI成果物へ保存。実行結果は未確認。

[計測・解析](../../../poc/src/p2_clock_rank_joint_model.cjs)・[反例](../../../poc/tests/p2_clock_rank_joint_model.test.cjs)・[CI](../../../.github/workflows/p2-clock-rank-joint-model.yml)。
