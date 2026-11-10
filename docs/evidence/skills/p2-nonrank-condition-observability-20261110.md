# P2：順位以外の発動条件をモデルで観測できるか（2026-11-10）

**位置づけ：実装ソースの確認に基づく予備研究。今回の対象は発動条件の成立しやすさのみ。発動後の効果の有用性は将来拡張候補。**

## 実データ上の研究候補

固定UmaSimの818スキル照合済み集合では、スパート条件55スキル、順位変化30スキル、追い抜き21スキル、横ブロック継続20スキルが存在する。値は重複し得る対象スキル数であり、発動率やサポカ枚数を表さない。[前段の分類監査](p2-condition-research-triage-20261110.md)に基づく。

## 固定モデルソースの照合

基準モデルは [GlobalSim v77固定版](https://github.com/daftuyda/GlobalSim/tree/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1) 。以下は直接確認できた**モデル内の条件判定**であり、日本版実ゲームでの完全一致を保証するものではない。

| 条件 | モデルが実際に参照する情報 | 順位研究リプレイのみでの測定 | 方針 |
| --- | --- | --- | --- |
| change_order_onetime（30件） | [activation_conditions.rs 1538](https://github.com/daftuyda/GlobalSim/blob/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/src/activation_conditions.rs#L1538)：現在順位と前回順位の差 | **判定と同一である保証なし**。順位軌跡補間は前回順位を保存しない | **第一候補**：内部の現在／前回順位を直接記録し、元演算子・モデル更新タイミングに照合 |
| is_overtake（21件） | [activation_conditions.rs 1162–1165](https://github.com/daftuyda/GlobalSim/blob/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/src/activation_conditions.rs#L1162-L1165)：追い抜き対象リストの有無。retailではレーン側ターゲット、それ以外はpassing targets | **不可**。順位が上昇する現象とは別 | **第二候補**：使用モードと追い抜き対象リストを直接計測 |
| blocked_side_continuetime（20件） | [activation_conditions.rs 1293–1294](https://github.com/daftuyda/GlobalSim/blob/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/src/activation_conditions.rs#L1293-L1294)：横ブロックの継続時間タイマー | **不可**。他馬が近くにいる／レーン位置だけでは継続タイマーは判定できない | **第三候補**：実際の内部タイマーを計測。周囲の馬から推定して置き換えない |
| is_lastspurt（55件） | [activation_conditions.rs 818–834](https://github.com/daftuyda/GlobalSim/blob/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/src/activation_conditions.rs#L818-L834)：スパートの内部フラグ・計画状態 | **不可**。終盤・速度だけでは確定しない | 内部フラグと判定tickを直接記録し、体力・条件窓との関係を確認 |

現行の[GlobalSimのReplayFrames](https://github.com/daftuyda/GlobalSim/blob/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/src/replay_frames.rs)と[lib.rs 930–941](https://github.com/daftuyda/GlobalSim/blob/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/src/lib.rs#L930-L941)の数値リプレイは6値（走行位置、速度、HP、レーン、rushing状態、前方ブロッカーID）。**追い抜き対象リスト／横ブロック継続タイマー／前回順位／スパートフラグを直接網羅していない**。現在の1,440レース順位軌跡だけからこれらの元条件が満たされたと主張しない。

[API](https://github.com/daftuyda/GlobalSim/blob/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/src/api.rs#L60-L92)ではexperimentalRetailRuntimeが明示的に有効でない限りretailモードではない。非retailとretailで追い抜きの内部判定元が異なる可能性を保持する。

## UmaSim固定版との照合における重要な注意

[UmaSim固定SkillChecker.kt](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L243-L257) では、**change_order_onetime / is_overtake / blocked_side_continuetime は checkSpecialState による状態判定**。その定義は同ファイルの[358–360行](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L358-L360) にあるように、辞書の条件コードを approximateTypeToState のキーへ変換し、simulation.specialState から値を読む方式。**これを元ゲームの物理的な追い抜き・接触・阻害条件の独立再現実装とみなさない**。

一方、[同固定UmaSimの208行](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L208) は is_lastspurt の判定に isInSpurt を使用する。GlobalSimの内部フラグとはモデルと更新時刻が異なる可能性があるため、両シミュレータで同名条件の結果が一致するとは無検証で主張しない。

**この差はモデル実測の信頼性に直結する**。したがって、GlobalSimの内部状態が忠実に読み取れたとしても、UmaSimの抽選近似と整合したことだけを実ゲームの検証とすることはできない。

## 次の実験の採否ゲート

1. モデルの**内部変数と更新時刻**を直接取得できるか。同じ名称でも状態判定と順位変動の代理値を混同しない。
2. 構造化された元のAND／OR／preConditions／Invoke条件を**同一走者・同一判定時刻**で照合できるか。個別成立割合の独立乗算で補わない。
3. 固定コース・均衡編成・9／12頭・各15＋15seedで方向性の再現性を確認できるか。ひとつの人工モデルから実ゲーム頻度へ無条件転用しない。
4. ゲーム側の仕様説明や独立観測と照合できるか。照合できない場合は「固定モデル内の研究」止まり。研究しにくい条件を「脚質差なし・汎用」とすることは**禁止**。

**到達点：固定モデルにおける判定元とリプレイの不足項目を特定済み。新たな非順位条件の成立率測定は未実施。** 明示的な脚質・距離・馬場制限は別途厳密に適用し、効果有用性・カード評価・公開UIへは接続していない。
