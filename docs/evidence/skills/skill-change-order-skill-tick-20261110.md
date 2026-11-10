# P2.20：順位変動の元条件とスキル判定直前の順位キャッシュ（2026-11-10）

**到達点：固定UmaSimの元条件30スキルを全件照合し、無スキル固定GlobalSimで判定直前の順位状態を測定。元スキルを実際にロードした際の発動条件全体や実ゲーム発動率は未検証。**

## なぜ元の順位計測だけでは足りなかったか

[前段P2.19](skill-change-order-internal-observability-20261110.md)では、固定GlobalSimの**tick終了後のリプレイ**から符号付き順位差を取得した。ただし、それが**同じtickのスキル判定で参照される順位差**だとは証明されていなかった。

固定GlobalSim v77、commit 80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1 の [race_field_retail.rs（221～233行）](https://github.com/daftuyda/GlobalSim/blob/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/src/race_field_retail.rs#L221-L233) では、各走者のprepare処理の後、**priority 1→0でスキルを検査**する。その後に[走行位置と順位を更新（267～344行）](https://github.com/daftuyda/GlobalSim/blob/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/src/race_field_retail.rs#L267-L344)し、[lib.rs（930～941行）](https://github.com/daftuyda/GlobalSim/blob/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/src/lib.rs#L930-L941)でリプレイを保存する。

[activation_conditions.rs（1538行）](https://github.com/daftuyda/GlobalSim/blob/80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/src/activation_conditions.rs#L1538)の change_order_onetime は「現在の内部順位 − 前回の内部順位」。負なら順位上昇、正なら順位下降。**スキル判定の時刻とレース物理更新の時刻を混同しない。**

## 元UmaSimの30スキルを実データで確認

UmaSim固定コミット f6e4501ee6c6c2d4ac8698e7796e309d31575bde の元スキル辞書と、アプリ収録スキルをID・名前で厳密照合した818件が母集団。

| 元の順位差の条件 | 元スキル・AND経路 |
| --- | ---: |
| change_order_onetime ＜ 0（順位上昇） | **20** |
| change_order_onetime ＞ 0（順位下降） | **10** |
| **合計** | **30** |

- **30経路すべてに順位以外の追加AND条件がある**。たとえばphase 18、distance_type 13、running_style 12、accumulatetime 10、corner 6、distance_rate 5経路（重複するため加算不可）。
- 30経路中、**12経路はORの別候補が存在**。当該コードがpreConditionsにあるものは0、複数Invokeのもの0。
- 演算子・値・AND/OR単位の全件監査は[条件監査のCI](https://github.com/Nimrodx0/Umasupport/actions/runs/42805441430)と[検査プログラム](../../../poc/src/skill_change_order_source_paths.cjs)に保存した。
- 元スキル全体が発動できるという判定には、順位以外の必須条件を**同じ走者・同じ時刻**で満たす根拠が必要である。

## 判定直前・更新後を直接計測した結果

対象は**固定32レース**：芝1600m（10502）・芝2000m（10504）、9／12頭、人工の均衡／後方過多編成、equal能力、各4シード。元エンジンと一時的な計測エンジンの64実行をペア比較した。**スキルをロードしない**参照レースであり、実対戦相手の頻度調査ではない。

計測版は各走者について、実際に **priority 1とpriority 0の process_skill_priority を呼ぶ直前の順位キャッシュ**と、同tickで順位が更新された後のキャッシュを別々に記録。元の物理計算や発動条件は変更しない。リプレイのブロッカーID再配置による数値誤変換を避けるため、元の6値リプレイの2列を一時的なradix-32パックに置換。元エンジンの物理出力と全フレーム比較した。

| 測定項目 | 固定モデルでの結果 |
| --- | ---: |
| 比較フレーム | **41,704** |
| 元エンジンと同一の位置・速度・HP・レーン値 | **1,751,724／1,751,724** |
| priority 1・0の呼び出し位置での順位差不一致 | **0** |
| 判定直前のキャッシュ＝前tick更新後のキャッシュ | **435,222／435,222** |
| 同tickの判定直前と順位更新後で、順位差が違う走者・tick | **7,561** |
| 判定直前の順位上昇（差＜0） | **2,043** |
| 判定直前の順位下降（差＞0） | **2,095** |
| 判定直前の順位差が0 | **431,084** |
| 有効に比較できた判定直前の走者・tick | **435,222** |

**別に保留した集計**：retail初期フレーム336走者・tickは未計測。最初の判定で前回順位が0（未初期化）だった336走者・tickは、順位下降イベントとして採用しない。ゴール済み2,037走者・tickも除外。欠測を差0として補完しない。

20スキルが使う「差＜0」はモデル上2,043走者・tickで、10スキルが使う「差＞0」は2,095走者・tickで成立した。**同じ元条件を使用する複数スキルを独立した観測として数えない。** これは順位部分条件の記述的な成立数であり、スキルを所有・発動した回数ではない。

[実モデル研究CI #42805441670](https://github.com/Nimrodx0/Umasupport/actions/runs/42805441670)で基準エンジンと計測版のビルド、物理値の全一致、元条件30件の監査、キャッシュの時刻関係を検証済み。派生JSONのSHA-256は **9b8277bd79d6f16e432952a59530688e0b46f8331484185157d65a4e77b42031**。CIで再生成時の一致を要求。元のゲームデータや一時的な改造エンジンはレポジトリに再配布しない。

## 何が確定し、何が未完か

**固定モデルについて確定**：スキルpriorityの呼出し直前の内部順位状態が、前tickのリプレイに保存された順位キャッシュと一致した。**同じtickで更新後の順位差をそのまま使うと7,561走者・tickで異なる値になる**。判定時刻を正しく分ける必要がある。

**なお未完**：今回は無スキルのレースなので、実際に change_order_onetime を含むスキルをロードし、そのAND/ORを判定した結果ではない。元スキルの各局面・距離・脚質・時間・抽選・クールダウンとの同時成立、技能所持条件、日本版ゲームの実際の発動率やモデル忠実度は未検証。

**次工程**：代表スキルの元AND経路を選び、固定GlobalSimへスキルを実際にロードした状態で判定箇所を計測し、元条件の成立とactivation hookの呼出しを同一tickで照合する。全条件を復元できない場合は保留し、他のANDの確率を勝手に掛け合わせない。

計測器：[globalsim_change_order_skill_tick.cjs](../../../poc/tools/globalsim_change_order_skill_tick.cjs)、[回帰テスト](../../../poc/tests/globalsim_change_order_skill_tick.test.cjs)、[固定CI](../../../.github/workflows/p2-change-order-skill-tick.yml)。

本研究は**P2.20の途中到達点**であり、P3集約・P4公開表示・脚質別高/中/低分類・発動後効果有用性を追加したものではない。
