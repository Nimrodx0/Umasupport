# P2.15：判定直前位置と固定抽選窓の反実仮想的な条件交差（2026-11-12）

**研究目的**：前段の[元`phase_random`構造監査](skill-p2-15-phase-random-source-window-20261112.md)で確認した102スキル／315脚質セル／371元経路について、実レースの**スキル判定直前**の走者位置を観測し、特定の仮想窓と位置・静的条件を**同じ時刻**で照合する研究の入口を作る。

**検証の境界**：GlobalSim v77の**スキルを装備しない固定32モデルレース**を使用。抽選窓は元UmaSimの式に研究者が`0.5`を代入した**反実仮想**であり、どちらのエンジンもその区間を実際に抽選していない。**元スキルの発動、独立した確率標本、脚質適性やカードスコアではない**。

## 1. 元モデルと元スキル実装の差異

- 固定`mee1080/umasim@f6e4501ee6c6c2d4ac8698e7796e309d31575bde` の[SkillChecker.kt](https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt) は、ランダム窓の開始地点を`min(U, zoneEnd - 2)`、終点を`min(start + 10, zoneEnd)`で計算し、抽選結果をキャッシュして判定する。
- 一方、固定`daftuyda/GlobalSim@80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1` の[activation_sample_policy.rs](https://github.com/daftuyda/GlobalSim/blob/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/src/activation_sample_policy.rs)では、抽選可能な開始地点の上限に`max(start, zoneEnd-10)`を用い、`f32`で丸める。抽選方法・判定窓を同一視しない。
- GlobalSimの[retail判定順](https://github.com/daftuyda/GlobalSim/blob/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/src/race_field_retail.rs)は、`prepare_retail_tick` → priority=1／0の`process_skill_priority` → 移動 → 後処理。**移動後**のリプレイ位置をそのtickの技能判定位置として使うと時刻がずれる。

従って、抽選窓の「元コードの意味」、実レース「判定時刻の位置」、および「実際に抽選した窓」の3つは区別しなければならない。本研究では前者2つを結ぶ**固定抽選値の仮想実験**までを対象とし、3つ目は未着手として残す。

## 2. 実装方法と検査条件

[判定直前の位置プローブ](../../../poc/tools/globalsim_p2_15_preskill_phase_position.cjs)を追加。実行時に外部固定GlobalSim v77を取得し、**一時ディレクトリ**の`src/race_field.rs`、`src/race_field_retail.rs`、`src/lib.rs`の3ファイルだけへ記録用のコードを追加する。元エンジンと計測版エンジンを**同じ32レース**に適用し、位置・速度・体力・レーンの4物理列が一致しなければ停止する。計測版ではpriority=1とpriority=0の各呼出し**直前位置**が一致し、さらに1つ前のリプレイ位置と一致することを要求する。

- 対象32レース：芝1600/2000m、9/12頭、人工均衡／後方過多、全脚質、equal能力、固定4シード。従来[P2.20の判定直前順位研究](skill-p2-20-signed-rank-static-context-intersection-20261111.md)と同じ選択条件であり、現実の対戦編成を代表しない。
- 元スキルの[371経路](../../../poc/src/skill_phase_random_source_window_audit.cjs)について、元の`running_style`、`distance_type`、`ground_type`の有限AND条件とレース固定文脈を照合する。`ground_condition`未確認・`preConditions`の履歴状態が必要な経路は保留し、独立のOR／Invoke間は結合しない。
- `phase_random == 0..3`の各元数値からGlobalSimのコース距離に合わせた局面区間を作り、元UmaSimの`zoneEnd-2`でクリップした抽選開始と長さ最大10mの終端に、**固定値0.5**を入れる。同じ判定時刻の走者位置が範囲に入ったかを確認する。元の`phase_random`に異なる抽選値を使った結果とは比較していない。
- 元の数値スキルID・Invoke添字・conditions OR行・preconditions OR行と、取得できる有限AND条件の**数値と元の位置**を保持する。公開済みカード・スキル辞書・UIには追加しない。

## 3. 人工テスト／固定データCI

[人工試験](../../../poc/tests/globalsim_p2_15_preskill_phase_position.test.cjs)では、ソースパッチの唯一性、抽選区間の終端2m・最大10m、静的条件・未確認条件の保留、同一位置でのpriority間・移動前後の照合、物理列の差分検出、元ID・OR行の重複排除を確認する。

[固定モデルCI](../../../.github/workflows/p2-phase-preskill-counterfactual.yml)は元プロジェクトのバージョンを固定し、ネットワーク取得後に一時ビルドする。研究成果物は**数値／経路識別子と集計結果のみ**。第三者のスキル・コース原文やモデルのビルド成果物を本リポジトリに保存・再配布しない。

**初回計画**：この研究記録の作成時点では、専用CIを開始するためのソースと人工テストを登録した段階。実レースの一致件数や仮想窓の交差数は、固定CIが成功してから記録する。

## 4. 残るゲートと次工程

1. **元実装の実抽選窓を実際に観測**：固定値0.5ではなく、スキルを装備し、元の抽選乱数・キャッシュ窓・技能判定位置を同じ走者の同じtickで観測する。
2. **元AND／preConditions／OR／Invoke**：モデルとゲームのそれぞれで、局面・順位・追い抜き等、前提条件のラッチとクールダウンを混同せず同時評価する。
3. **評価の受入判断**：実ゲームとの妥当性、条件成立機会Wと脚質特異性Dの独立検証、条件別の閾値、P3への集約・P4表示は未承認のまま保持する。

仮想窓の「成立走者・tick」や経路単位の件数を、**スキル発動数・発動率・カード適性・独立標本数**として表示してはいけない。
