# P2.37：4脚質評価を変え得る動的状態条件の元仕様と研究要否（2026-11-18）

**問い**：P2.36で順位・時期の部分W／Dを既存モデルから利用できた。次のG4では、`is_overtake`、`change_order_onetime`、`is_lastspurt` を **順位／局面のWだけで代替してよいか**、追加研究が脚質評価に必要かを判定する。あらゆるスキルを新規シミュレーションするのではなく、まず **固定元UmaSim実装と、既存の818スキル・970元経路のAND／OR**を確認する。

## 元仕様の直接証拠

固定元は `mee1080/umasim@f6e4501ee6c6c2d4ac8698e7796e309d31575bde`。原典の[SkillChecker.kt（条件評価）](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L204-L211)および[同ファイルの特殊状態評価](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L243-L249)・[checkSpecialState](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L358-L361)、[SkillData.kt（近似状態の定義・型変換）](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/data2/SkillData.kt#L151-L168)および[写像](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/data2/SkillData.kt#L294-L313)を直接照合する。

| 元条件型 | 元UmaSimで確認した意味 | 評価への扱い／追加研究判断 |
| --- | --- | --- |
| `is_overtake` | `specialState["overtake"]` を条件演算子・値で判定。固定モデルには**脚質別の近似状態生成**（逃げ開始0.05・継続0.50、先行0.15・0.55、その他0.20・0.60）がある | **元条件の意味は採用、順位Wだけによる省略・代替は不採用**。近似確率は実ゲームの追い抜き率の測定値ではない。脚質ごとに異なる可能性があるので、比較に必要な同一時刻の状態観測が得られるまでW／D判定を保留 |
| `change_order_onetime` | `specialState["change_order_onetime"]` を読む。固定モデルの生成は**+1／−1を各0.20の確率で近似**する | **元条件の意味は採用、固定順位系列から「順位が変わったから条件成立」とする推定は不採用**。元特殊状態と順位変化の対応が確認できるまで動的条件の影響を保留 |
| `is_lastspurt` | `isInSpurt()` を**判定時刻で直接Boolean評価**。近似の追い抜き状態とは別機構 | **元スパート状態を参照する機構として条件付き採用**。単に終盤／最終直線にいることと同一視しない。元モデルでスパート状態と他ANDを同一時刻に確認できる場合にだけWへの反映を検討 |

**境界**：上記の近似パラメータは元UmaSimシミュレーターが特殊状態を近似生成するための値であり、実ゲームの真値・脚質ごとの実発動確率・適性の重みではない。元モデルの条件評価を理解することと、実ゲームでの分布を検証したことを区別する。さらに `SkillData.kt` は `order`／`order_rate` の条件を元UmaSim上では無視する設定を明記しており、固定GlobalSimの順位Wとの無条件な結合も実ゲームの元全AND検証ではない。

## 同じAND／OR・元スキルIDへの適用

[読み取り専用の原典型監査](../../../poc/src/skill_p2_37_dynamic_state_decisions.cjs)は、[P2.32で全件監査済みの経路構造](../../../poc/src/skill_p2_32_research_queue.cjs)と[厳密な元Invoke・元OR・事前条件の照合方法](../../../poc/src/skill_p2_32_mechanism_reuse.cjs)を再利用する。固定出典のCheckerとSkillData双方の元文言を検証し、3条件型を含む元経路を抽出する。各元経路の4脚質適用可能範囲、同じ現在ANDに順位・時期があるか、履歴preConditionsと別OR／Invokeがあるかを分けて保存する。**別ORや別Invokeの部分条件を寄せ集めて単一スキルの発動を証明しない**。

- **研究の着手条件**：比較可能な脚質が2つ以上あり、元AND上の状態・順位・時期によって脚質差が変わり得る具体的な経路を優先する。候補の量だけで追加レースを増やさない。
- **状態の直接観測が必要な条件**：追い抜きと順位変化は、固定モデルが「近似特殊状態」を参照する事実だけでは脚質適性に採用できない。順位Wからの代替を禁じたまま、次はモデル内の状態生成と判定時刻の対応を代表的な1機構で調べるべきか判断する。
- **機構の解釈までで足りる条件**：スパートは元checkerの `isInSpurt()` の意味を確認できたので、別の確率モデルを新設する必要はない。ただしスパート真偽の時刻別記録がない限り、成立機会Wの採用は保留する。
- **終了判断**：今の段階では、この3条件を「脚質に影響しないため適性から省略」とする根拠はない。3条件の**判定機構だけを理解し、全件の動的成立機会と正式P3配点は保留**する。再開は、元ANDに一致する同一時刻の状態資料・観測が得られ、脚質の評価結果を実際に変える見込みがある代表機構に限る。

固定CIは元SkillCheckerと元SkillDataを同一コミットから読み、[元条件監査ワークフロー](../../../.github/workflows/skill-condition-inventory.yml)で、元818／970の対象と元ID・経路を確認する。研究の出力は元辞書本文でなく型・演算子・経路メタデータだけとし、**各条件のモデル上の実状態観測数、適性スコア、評価時の条件省略は0**に固定する。

**本工程でG4全体が終わるわけではない。** 元状態の再現性、実戦の追い抜き、他スキル発動依存条件、複合AND、そして他条件型の研究は別途判断する。P2.36で得られたW／Dの部分情報は捨てないが、元動的条件の証拠がない部分を高／低適性へ変換しない。
