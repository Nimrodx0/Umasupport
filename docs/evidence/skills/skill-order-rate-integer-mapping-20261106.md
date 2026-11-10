# P2：順位割合 order_rate と整数順位の対応監査（2026-11-06）

> **資料の位置づけ**：スキル・発動条件に関する固定調査（時点付きの証拠）。本文の測定対象・出典版・留保を確認してください。
> **現行の参照先**：[正本の入口](../../index.md) ／ [関連する工程・契約](../../plans/skill-conditions/p2.md)。執筆当時の「現在」「次工程」は現行の指示ではありません。

**結論**：元の order_rate 数値を出走頭数に掛けて四捨五入し、**元の比較演算子を保ったまま**整数順位と比較する方法で、9頭・12頭の対象順位を説明できる。ただし、**固定UmaSimのSkillCheckerは order_rate を実装せず未対応としている**。ここで実装したのはGameTora解説と既存GlobalSimの換算法が一致する**根拠明示付きの条件解釈器**であり、現行日本版の内部判定を独立に検証できたわけではない。

## 1. 9頭・12頭の条件と整数順位

出典の記法、演算子、整数のパーセンテージを保存する。例えば9頭・50%は 9×0.5=4.5 を四捨五入し**5位**が境界になる。order_rate>50 は**6～9位**。

| 元の順位条件 | 9頭での該当順位 | 12頭での該当順位 |
| --- | --- | --- |
| order_rate<=40 | 1～4位 | 1～5位 |
| order_rate>=40 | **4～9位** | **5～12位** |
| order_rate<=50 | 1～5位 | 1～6位 |
| order_rate>50 | 6～9位 | 7～12位 |
| order_rate>=50 | 5～9位 | 6～12位 |
| order_rate<=80 | 1～7位 | 1～10位 |
| **order_rate>=40 AND order_rate<=80** | **4～7位** | **5～10位** |
| order_rate>=50 AND order_rate<=75 | 5～7位 | 6～9位 |

実装：[順位割合の人数別投影コード](../../../poc/src/skill_order_rate_bounds.cjs)。正の値を四捨五入して0.5は上方に丸める。

- 境界順位 B(n,p) = floor((n×p+50)/100)
- 元の order_rate OP p に対し、1～n位の整数順位 r を条件 r OP B(n,p) で比較する。
- AND内で複数の順位条件がある場合は**各順位集合の積集合**、ORは経路ごと評価した順位集合の和集合。ただし、これは**順位条件だけの投影**であり、経路内に残る別のAND条件・前提条件は評価していない。
- 比較演算子 ==、!=、<、<=、>、>= を区別。9頭では >=40 と <=50 が**4位・5位で重なる**ため、一律の「前方」「後方」二分法へ書き換えない。
- 今回、文献の人数別の結果を実際に照合したのは9頭／12頭。18頭などへの確定解釈へ自動拡張しない。境界値0になる極端に小さい割合は実ゲームのクランプが未確認なので**保留**し、勝手に1位へ補正しない。

### 裏付けと証明できない範囲

**文献で確認した説明**
- [GameTora条件ビューア](https://gametora.com/umamusume/skill-condition-viewer?skill=100211)：order_rate は出走頭数×割合を最も近い整数へ丸め、元の演算子で整数順位と比較する方式。9頭で >50 → 6位以下の具体例を示す。
- [競技機構Wikiの順位率解説](https://wiki.biligame.com/umamusume/马娘比赛机制)：9頭の50%は5位へ丸められ、>50は6位以下という別資料の説明。
- 固定GlobalSim研究の [globalsim_position_pilot.cjs](../../../poc/tools/globalsim_position_pilot.cjs) も同じ丸め式。今回はこれを9/12頭の境界で照合した。

**固定UmaSim実装だけでは証明できないこと**
- 固定UmaSimの [SkillData.kt](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/data2/SkillData.kt) の未対応条件一覧に order_rate が含まれる。
- 同版 [SkillChecker.kt](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt) には order_rate の条件判定分岐がなく、未対応と表示される条件はスキップされる。**固定UmaSimの発動シミュレーションを実ゲームの順位条件の直接実測として扱わない**。
- GameToraの文献説明とGlobalSimの式の一致は、現行日本版ゲームのあらゆる人数・順位条件での丸め規則を独立検証した意味ではない。

## 2. 固定元データ全件の監査

元辞書：[mee1080/umasimの固定版](https://github.com/mee1080/umasim/tree/f6e4501ee6c6c2d4ac8698e7796e309d31575bde)。コミット f6e4501ee6c6c2d4ac8698e7796e309d31575bde、skill_data.txt SHA-256 **4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5**。原辞書の全文を公開せず、派生集計だけ成果物に残した。

| 指標 | 件数 | 注意点 |
| --- | ---: | --- |
| 固定スキル辞書 | **2,162** | 固定版の総数 |
| order_rateがあるスキル | **858** | 同一スキルに複数条件あり |
| 元のorder_rate述語 | **1,465** | 通常条件とpreConditionsを含む |
| 順位条件を含むAND行 | **1,161** | 1スキルに複数経路あり |
| 複数のorder_rate条件があるAND行 | **304** | 上下限などの積集合 |
| preConditions側のAND行 | **81** | 発動条件と分けて保存 |
| 順位以外のAND条件もある行 | **1,161** | 整数順位だけで発動条件全体は決まらない |
| 9頭と12頭で境界順位が異なる条件の**出現数** | **1,373** | ユニークスキル数ではない |
| 境界が0位となり保留された元条件 | **0** | 固定辞書の観測結果 |
| 順位条件のAND積集合が空になる元行 | **0** | 9頭・12頭の換算内 |

元の式で最も多いものは order_rate<=50（**344スキル**）、order_rate>=40（**273スキル**）、order_rate<=80（**82スキル**）。複数条件を使うスキルが重なるため、これらの件数を足し合わせない。

[元辞書のSHAを照合して集計するコード](../../../poc/tools/order_rate_integer_audit.cjs)、[演算子と境界の人工テスト](../../../poc/tests/skill_order_rate_bounds.test.cjs)、[元AND/OR経路監査テスト](../../../poc/tests/order_rate_integer_audit.test.cjs)、[固定元辞書と未対応元コードを確認するCI](../../../.github/workflows/order-rate-integer-audit.yml)。

専用Actions：[実行 #42126623094](https://github.com/Nimrodx0/Umasupport/actions/runs/42126623094) は成功。派生集計 report.json のartifact名 source-verified-order-rate-integer-audit、ID **13462250433**（保存期限あり）。

## 3. 脚質適合性v1.2への接続

現行の研究用適合性判定器 [skill_activation_fit_v1.cjs](../../../poc/src/skill_activation_fit_v1.cjs) に、従来未対応だった50%以外の順位条件の**人数別の位置投影（sourceRankProjection）**を部分評価として追加した。

ただし、**整数順位に換算できることと、脚質がその順位条件を満たしやすいことは別**。たとえば >=40 は中団から後方まで広く含み、一律に差し・追込へ高適合としない。他のAND条件に追い抜き等があれば、順位条件のみの投影からスキル全体を確定しない。

したがって、今回追加した数値条件について、脚質の高／低を根拠なく確定せず**評価保留を維持**する。既にv1.2で判定できた**53スキルの既存評価は変更しない**。

次は、原スキル条件の正確な人数別の整数順位範囲に、既存の全順位分布のモデル結果を当てはめる。ただし前方群・後方群で逆転する条件があり、全コース・全局面で単一の向きを採用することはできない。

**製品への変更なし**：旧53分類、サポカ集約、公開UI、イベントデータを変更しない。
