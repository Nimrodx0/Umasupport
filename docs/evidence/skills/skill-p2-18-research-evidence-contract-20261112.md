# P2.18：元条件の部分研究をスキル・サポカ適性へ誤昇格させないデータ契約（2026-11-12）

**状態：研究成果を安全に受け渡すための研究専用コード・JSON形式を実装。P3/P4の製品表示やスキル適性への採用は未決定。**

## 目的と承認済みの設計方針

[D-045](../../decisions/log.md#decision-d-045)では、`distance_type`、`track_id`、`ground_type`等はまず対象レースの**適用範囲**を示し、対象外を低適性・0点にしないと決めた。ただし他の順位・位置・追い抜き等の動的条件との組み合わせで、脚質間の成立機会が距離・コース文脈に依存する可能性は残る。

[P2.17b](skill-p2-17b-distance-split15-20261112.md)では、元スキル全AND/ORを実測したのではなく、固定モデルの**同一元順位・時期部分条件×脚質ペア**のW相対差を比較した。距離区分間の厳密な優劣逆転5組は同じ条件の前半15・後半15シードで**0組しか追認されなかった**一方、仮5pt超の脚質差変化は56組中46組（東京芝23中20組）で少なくとも1つの同一比較設定が追認された。

この差の一部を、そのまま「スキルが発動した」「サポカを装備すると強い」「逃げ適性：高」などへ誤変換する危険がある。P2.18では、**研究の出典・対象・結果・未検証・製品採用可否を明確に区別する**機械検査可能なデータ契約を作る。

## 契約の構成

[検証器](../../../poc/src/p2_skill_evidence_contract.cjs)・[生成プログラム](../../../poc/tools/build_p2_18_evidence_contract.cjs)が、[固定GlobalSim v77](https://github.com/daftuyda/GlobalSim/tree/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1)・元UmaSimスキル辞書SHA-256 `4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5` の研究成果から、研究用 `schemaVersion:1` のJSONを作る。

| 契約上の項目 | 現時点の値と、値を分ける理由 |
| --- | --- |
| `provenance` | 元のスキル辞書SHA、GlobalSimモデルコミット、4つの固定30seed研究成果物のSHA、シード分割 `0..14`／`15..29`、モデル研究段階。実ゲーム実測と区別 |
| `subject.originalSourceNumericId` | **元スキルの部分条件を識別するID**。これだけではアプリ登録やカード取得を証明しない |
| `subject.appCatalogMatch` | `not-evaluated`。元データにスキルIDがあることと、現行アプリ収録スキルに対応することを区別 |
| `subject.supportCardAcquisition` | `not-evaluated`。アプリ収録と、カードからのヒント・イベント取得経路の存在を区別 |
| `applicableRaceScope` | 芝／ダートと元の距離条件を別保持。対象外は `not-applicable-never-score-zero` |
| `styleComparison` | 元の逃げ／先行／差し／追込6ペアの**相対比較**であり、4脚質の数値評価ではない。比較相手が不在なら `not-observed-never-zero` |
| `styleComparison.W` | **モデルで観測した順位・時期部分条件Wのペア差の文脈変化**。全コースの結果と東京芝同一競馬場の補助解析を区別。30seed・両15seedの追認セル数を別集計 |
| `styleComparison.D` | `status:not-measured-in-this-study`、`value:null`。D=O−Uは**Wとは別軸**であり、この距離差研究から捏造しない |
| `styleComparison.fullSkillActivationRate` | `not-measured`、`value:null`。研究対象は元スキル全条件ではない |
| `styleComparison.skillEffectUtility` | `not-measured`、`value:null`。発動後の効果・有用性も別研究 |
| `contextInteraction` | **距離・コース形状が交絡した観察**であること、仮5pt差は正式評価閾値でないことを明示 |
| `promotionGate` | 元全AND／OR／Invoke／preConditions／実スキル装備・発動／アプリID紐付け／カード取得経路をすべて `not-verified`。`eligibleForP3CardScoring:false`、`suitabilityLabel:null`、`cardScore:null` |

**特に重要な区別**：`not-measured`（未測定）や `not-evaluated`（未評価）を数値の0に変換しない。また `not-applicable`（対象外）はその脚質が弱いことを意味しない。元データの条件IDだけからカードの取得可否を推定しない。

## 研究用データの対象と検証

- P2.17bの元32部分条件のうち、**距離無制限の10条件**を対象とする。4脚質6ペアで**60レコード**。距離制限付き22条件は、実際の対象外距離で架空の比較をしないため除外。
- 全対象コースでは60レコード×既存の編成・頭数・能力・距離区分ペアの比較を合計**5,040セル**、東京芝の補助比較は**24レコード・2,016セル**。
- 逃げ不在編成で比較しなかった全対象120設定／東京48設定は別に保持し、0％に置換しない。
- 元レースの全30seed Wを15＋15seedから再構築できるかは[P2.13](skill-p2-13-source32-split15-w-20261111.md)の検証をそのまま再実行。P2.17bと同じ元比較・方向の追認結果に完全一致する場合のみJSONを生成する。
- 構造・数値の[人工反例テスト](../../../poc/tests/p2_skill_evidence_contract.test.cjs)では、元データSHA改変、別比較セルの混入、脚質不在の0化、Dの0化、発動確率の0化、スキルID・カード取得可否の独断補完、サポカスコアと適性ラベルへの昇格を**失敗させる**。
- P2.18のJSONは元スキル本文やコースファイルを再配布しない**研究由来のメタデータのみ**とし、既存P2.13の研究用GitHub Actions成果物で14日保持する。

**元データと結合したCIの最終実測・成果物リンクは、CI成功後に追記する。**

## P3への接続に必要な追加条件

ここで実装したのは研究を失わず、安全に次工程へ渡すための**契約の原型**。正式なサポカ適性を得るには、少なくともスキルの元AND/OR/Invoke・時間的preConditionsが適切な判定時刻で評価できること、元スキルとアプリのID対応、カードごとのスキル入手経路、実測の外挿限界、WとDの区別、正式評価基準を**別途**確認・承認する必要がある。

今後の研究は「元条件の適用範囲はどこか」「どの脚質の成立機会が、距離・コース・編成によってどう変化するか」「データ不足で保留するか」を明示し、条件付きで傾向が変わることを確認できても**スキル全体の発動率と混同しない**。
