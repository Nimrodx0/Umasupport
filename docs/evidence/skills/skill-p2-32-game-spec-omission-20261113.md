# P2.32：ゲーム仕様を先に使う条件省略候補の読取専用監査（2026-11-13）

**状態：第1段階を実装。固定UmaSimの全収録スキル監査CIは検証中。** この研究は、発動条件を「ゲームから削除する」仕組みではない。脚質・距離・馬場の3軸について、**追加の成立機会研究をしなくてもよい条件付きの比較範囲**を仕様上の根拠から判定するための監査器である。正式なスキル・サポカ適性の採用や発動確率計算は行わない。

## ゲームモデル仕様で確認した最初の条件

固定UmaSim `f6e4501ee6c6c2d4ac8698e7796e309d31575bde` の[SkillChecker.kt 66行](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L66)は、元条件 `motivation` を `condition.preChecked(baseSetting.umaStatus.condition.value)` で評価する。この固定モデル上の「やる気状態を参照する」という機構は、脚質・距離・馬場のどれかを直接選別する述語ではない。

**省略の必要条件**：対象とする3軸の比較において、同じやる気値が全比較ケースに設定され、かつ元の `motivation` 述語をその値が満たしていること。この条件下では、3軸間の差を求める目的に限り、やる気条件の独立したシミュレーションは不要という**候補**にできる。述語を満たさない設定では、その経路の発動条件を満たしたことにならない。やる気の現実の出現分布、元スキル全AND/OR/Invoke、効果、全レースの絶対的な成立機会については別問題であり、独立・無条件という主張をしていない。

`motivation` 以外の型は、この最初の実装では**未評価**。既存の「研究優先度が低い」分類や「静的条件らしい」という印象だけで省略可にしない。明示的な脚質・距離・馬場・競馬場の条件は引き続き適用制限として保持する。

## 実装と確認

- [仕様ベースの監査器](../../../poc/src/skill_condition_spec_omission.cjs)：元スキルID、Invoke番号、`preConditions`/`conditions`、OR番号、AND内の述語位置を保持し、`motivation`だけに**同じやる気で元述語が成立する場合の3軸比較に限る**という候補を付ける。元条件式は一切変更しない。
- [合成テスト](../../../poc/tests/skill_condition_spec_omission.test.cjs)：OR・preConditions・複数Invokeの経路保存、明示条件の保持、未知型の保留、元モデルの非変異、適性や発動確率の非生成、入力不正と重複IDの検出。
- [固定元データの監査](../../../poc/tools/audit_skill_conditions.cjs)：既存の固定UmaSim・サポカ・承認済みイベントモデル881件（元辞書一致818件／未一致63件）と同じ読み込み工程に接続し、元辞書SHAを含む機械可読な **`p2-32-spec-conditional-omission.json`** をActions成果物としてのみ保存。リポジトリに第三者の元スキル原文は掲載しない。
- [.github/workflows/skill-condition-inventory.yml](../../../.github/workflows/skill-condition-inventory.yml)：新しい監査器・テストの変更時にCIを起動し、対象母集団・全件仕分け・研究専用境界を検証する。

**研究専用ゲート**：`actualAppliedOmissions=0`、`confirmedUnconditionalSkillActivation=0`、`officialSkillOrCardRatings=0` を維持する。ここでの対象は型ごとの省略**候補**であり、スキル全体の評価・スコア・発動率・実ゲーム上の無条件発動ではない。

## 残課題・次段階

1. CI結果を確認し、固定アプリ照合済み881件のうち `motivation` の実対象数（スキル数・述語出現数）を出典固定で報告する。実データ未実行の段階で件数を推測しない。
2. 他の状態条件は、[利用者承認の原則](../../decisions/log.md#decision-d-045)どおりゲーム仕様と論理構造を個別に確認してから候補を追加する。例：枠番、人気、天候、能力、馬場状態は脚質や距離に依存し得るため無条件に独立と扱わない。
3. 独立性が仕様から示せない条件に限り、P2.32の省略あり／なしの簡易比較を検討する。相対的な3軸比較と成立機会の絶対的大きさを混同しない。
4. [P2.33](../../plans/skill-conditions/p2.md)の距離・馬場の簡易一般化検証は独立工程として残す。現時点で研究用の候補をP3/P4正式採点へ接続しない。
