# 171組の先行連続イベントと別系統数値候補の照合（2026-10-19）

## 目的

PR #102で抽出した**第1優先171グループ**について、別の公開数値イベント候補資料に含まれるカード数値ID・9桁story ID・スキル数値ID・ヒントLv・明示的選択肢の順序を機械照合する。GameWithの記事原文やイベント本文はPublicレポジトリに保存しない。

比較元は次の2つであり、**ゲーム上の獲得条件を独立に保証する資料ではない**。

- ウマサルタントの既存DB `poc/data/candidates/checker_event_hints.v1.json`、旧ゲームマスター仮リンク `checker_route_classification.v1.json`、構造監査 `checker_chain_stage_audit.v1.json`。Checker由来、2025年マスターでイベント名による仮のstory IDを付与。
- [Tsuyuchan-jp/umamusume-dataの固定版](https://github.com/Tsuyuchan-jp/umamusume-data/tree/0cacbb1aaf9dca10283d5b9ea20b205b9d204535)。2026-10-04生成、データセット版 `0.1.14`、45枚・126イベント候補。数値は「U-tools+mdb抽出」、非公開の抽出プログラムを利用した可能性があり、起源の独立性と網羅性は未確認。公開データであることは再配布の許諾を意味しない。

## 全件照合の判定

同じ**カードID＋9桁story ID**の候補が後者にも存在する場合のみ、イベントごとの**ヒント数値IDとLvの組**を比較する。最初に順序を除いて多重集合として比較し、次に重複を除いた集合を比較する。

- `same-pairs-same-count`：ID＋Lvの出現回数まで一致。
- `same-pairs-different-multiplicity`：ID＋Lvの種類は一致し、同じ組の出現回数が異なる。**別結果の重複表示を誤差と断定できず、差異として残す**。
- `different-numeric-pairs`：数値ID・Lvの組が異なる。
- `not-in-45-card-snapshot`：固定比較資料にそのIDのレコードがない。**ゲーム内イベント不在や候補の誤りという意味ではない**。

もう一方のソースで `selection:single` かつ選択肢数も一致する場合に限り、各位置のヒント集合も比較する。ただし位置順が一致しても、正式なゲーム選択肢と同一である保証はない。`selection:auto` は資料作成側の自動計上モデルであり、ゲーム内の「必ず発生する」「無条件獲得する」の証明ではない。選択肢同士の照合はしない。

すべてのイベントに `outcomeTiersVerified:false`、`conditionalChainProgressVerified:false`、`gameRewardVerified:false` を明示する。2026年実装、連続の打ち切り、成功／大成功などの結果別獲得、配信条件はまだ未解決。

## 2026-10-19固定版での実測

| 指標 | 件数 |
| --- | ---: |
| 最優先の連続イベントグループ | **171** |
| 別資料にも数値story IDの対応を持つグループ | **11** |
| 数値story IDを相互照合できたイベント | **17** |
| ヒントID＋Lvの多重集合が一致 | **16** |
| ヒントID＋Lvの種類は一致し、回数だけ相違 | **1** |
| ヒントID＋Lvの種類自体が不一致 | **0** |
| 選択肢ごとの数値ID＋Lvを位置別に比較して一致 | **3イベント** |
| 比較先 `selection:auto` のイベント | **14** |
| 比較先 `selection:single` のイベント | **3** |
| 2026年のゲーム内報酬の全結果を独立検証した経路 | **0** |

17件のうち重複差異があったのはカードID `30253`、仮story ID `830253003`。Checkerの候補側には同じヒント組を別の選択肢位置等で複数回記載する可能性があり、その情報を自動削除して無条件扱いしない。

## 保存先と検証

- 出力：`poc/data/candidates/checker_first_pass_numeric_crosscheck.v1.json`
- 比較・整合性コード：`poc/src/candidate_numeric_outcome_crosscheck.cjs`
- ローカル生成・照合：`poc/tools/build_candidate_numeric_outcome_crosscheck.cjs`
- 固定GitHub元資料の限定取得：`.github/workflows/compare-first-pass-numeric-hints.yml`
- 人工／全件回帰：`poc/tests/candidate_numeric_outcome_crosscheck.test.cjs`

比較には固定版の `manifest.json`、`data/supports.json`、`data/events.json` が必要。外部ファイルはGitHub Actionsの一時領域だけに取得し、SHA-256で固定。一括照合結果には**数値story ID、イベント候補キー、ヒント組の一致状態、選択肢位置の比較件数と分類コードのみ**を収録する。本文、元イベント見出し、第三者の全データはレポジトリに追加しない。

実ソースを用意したローカルでの生成：

```bash
node poc/tools/build_candidate_numeric_outcome_crosscheck.cjs \
  /tmp/manifest.json /tmp/supports.json /tmp/events.json
node poc/tools/build_candidate_numeric_outcome_crosscheck.cjs --verify
```

**次工程の優先度：** 3件の位置別ヒント一致について選択肢が現行ゲームで同一かを検証し、残り14件の「auto扱い」を個別選択肢・成功結果に分解する。そもそも固定45枚資料がカバーしない1540件以上については、継続的に別の取得可能な数値情報源を探す。これらを解決しても公開利用条件の判断と承認ゲートは別に必要。

## 統合先の境界

`poc/data/reviewed_events.v1.json` は変更せず、正式公開イベント0件を維持する。現行の候補照合や段階DBも変更しない。今回の成果は、**収集済み候補から結果別獲得を検証するために利用できる数値的な一致・差異リストを作り、次の独立調査を具体化したこと**である。
