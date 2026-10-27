# 固定出典候補の全件データpreflight（2026-10-27）

## 役割

[更新運用の正本](upstream-refresh-operations.md)で生じる未採用の`automation/upstream-refresh-candidate`枝に対し、**GTとUmaSimの元データそのものを一時環境で全件再計算**する。[候補出典のメタデータ監視](../poc/src/upstream_refresh_watch.cjs)はGit blobの差分しか見ていなかったため、Git上でファイルが増えたことと、カード・ヒント・イベントの各構造が安全に扱えることは区別する必要がある。

本工程の対象は**構造・網羅性・数値スキルID辞書の形状**であり、イベントの報酬・選択肢の具体的な意味、実ゲーム内分岐の独立裁定、第三者データの再利用許可、公開承認ではない。

## データ取得と検証

[`Preflight full upstream source candidate`](../.github/workflows/upstream-candidate-full-preflight.yml) は以下を区別して運用する。

- `pull_request`・対象コードの`main`更新：**従来の本物の固定GT559カード全件を使った新アダプタの回帰**。結果が559ファイル／2,488イベント／4,129選択肢／4,376結果経路から変わったら失敗。固定元の内部全件イベント正規化と別実装の分岐診断が矛盾しないか検査する。
- `workflow_dispatch`・枝 `automation/upstream-refresh-candidate`：**候補Draftの実行時だけ**完全元データを読み込む。固定GTコミットと候補GTコミットをそれぞれリポジトリへcheckoutし、現在の候補manifestに記録したGit commit／tree SHAを検算する。UmaSimの固定／候補 `support_card.txt`と`skill_data.txt` の合計4ファイルだけを一時`$RUNNER_TEMP`へ取得し、Git blob SHAを検算する。
- `poc/src/upstream_candidate_full_preflight.cjs` がGTの全`support_<ID>.json`を**1件もサンプリングせず**読む。元ファイル名と`id`の完全一致、ファイル全体のGit blob SHAによる追加・変更・削除と候補manifestの完全一致、`transformDocument`での全イベント／選択肢／複数結果・条件付き構造・直接獲得・連続終了を正規化した計数、独立`branchInventory`の各経路計数を確認する。
- UmaSimは実アプリの`parseSupportCards`を両固定版で実行。全カードID・全5性能解放段階のヒントとカード属性を比較し、追加／変更／削除を報告する。数値スキル辞書は実アプリの`parseSource`で重複IDを拒否し、IDごとの名前・レアリティ・所属グループを全件比較する。通常ヒントの5段階分の**各出現**について、辞書中の数値IDが一意の通常スキルか、未収録か、曖昧かを分け、固定元より悪化した場合はレビュー保留とする。
- 候補GTに未知のカードが増えても、現在のUmaSim候補カードIDに存在しなければ候補検証は保留。GTソースの削除、既存UmaSimカード削除・データ変更、数値スキルIDの削除・変更は自動通過させない。候補の`sourceEvents`数が固定2,488より多くても**旧の件数を期待値として当てはめない**。

## 検証の結果と失敗条件

全件GT・UmaSimの元データはGitHub Actionsランナーだけで読み、**公開ファイル・検証レポートのアーティファクト・PR差分に生JSONや本文を保存しない**。Actionsログには、GTの件数・スキル辞書件数、追加・変更・削除カードID、`blockerCodes`、未照合ヒントのカードIDと件数のみが現れる。候補DraftのGitHub Checks画面には人間が読めるJob summaryも記載する。

- 候補JSONや内部結果の構造異常は対象カードIDと`CANDIDATE_GT_STRUCTURE_OR_BRANCH`を記録し、CIは失敗する。元のテキストを例外メッセージに出さない。
- 削除・既存カードデータ変更、数値スキルID差分・ヒント辞書の悪化は、**候補が未確認のまま採用されないようCI失敗**とする（採用理由の裁定後に個別例外を追加する余地はある）。
- 構造が合格でも、`eventResultAdjudication:'not-performed'`／`sourceSkillIdCrosswalkAdjudication:'not-performed'`／`publicationApproved:false`／`mayPromoteRuntimePins:false`を維持する。**自動でコミットの固定ピンを置き換えたり、正式イベントを公開したりしない**。
- 本工程で見ている`numericSkillIds`はUmaSim辞書の**同一ID内の差分**であり、GameTora側の`skill_hint`の対象数値IDがUmaSimと同じであるという独立裏付けはしない。後者の対応にはGameTora／GameWithの例外裁定と既存の非公開スキル経路を別途検証する必要がある。
- ActionsのBotが作ったコミットでは通常のPRワークフローが起動しないため、監視ジョブは候補Draft変更時に従来のCore CIと同時に本preflightを`workflow_dispatch`で明示的に起動する。

## 初回の本物の固定母集団に対する結果

[PRの本物の固定GT全件スモーク](https://github.com/Nimrodx0/Umasupport/actions/runs/40429663611)：**559ファイル、2,488イベント、4,129選択肢、4,376結果、数値ヒント1,681、終了マーカー109、構造未処理元カード0**で成功。内部での未裁定候補は従来のまま存在しており、構造正規化の通過を「イベント採用」と呼ばない。

A：合成GTイベント・カードの追加／削除・既存元の変更、500カード×5段階、数値辞書名変更・同名IDの拒否、構造異常の保留のNode。B：実固定GT559ファイルの全件正規化・分岐診断は成功。**GT新コミットに実際の差分が発生した陽性候補に対するGT／UmaSim4元データの全件比較は未実地**。C：アプリ本体には変更なし、従来のChromium回帰で保護する。物理端末やゲーム内イベント実測は行っていない。

後続の必要工程は**イベント数値／スキル取得経路の内部意味・同結果結合の完全な裁定と、権利条件・正式公開のゲート**。本工程はその前段階となる。
