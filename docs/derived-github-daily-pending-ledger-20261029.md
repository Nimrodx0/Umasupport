# 2026-10-29：GameTora派生GitHub JSONの新カード継続取り込みと保留Issue

## 要件と既存DBとの関係

**元データはGameTora由来の `systemless10/UmamusumePS` JSON**。既に作成済みの独自DBはその元情報を基準に、疑義・欠損がある箇所だけGameWithで補完しているため、**既存DBとのバイト単位の完全一致は目的ではない**。既存サポカは変換器の検証に使えるが、収録済みカードを再生成・上書きしない。

本実装は、旧GameTora変換器へ戻した[1カード単位の変換処理](derived-github-canonical-single-card-adapter-20261029.md)の**継続実行・保留IDの保存**に専念する。正式データ公開、個別GameWith裁定や権利・承認は別のゲートである。

## 継続更新の流れ

1. GitHub Actions `.github/workflows/derived-github-pending-intake.yml` がJSTおおむね毎日12:40（GitHub側の遅延あり）・手動dispatch・新機構のmain反映時に動作する。既存の更新監視 `upstream-refresh-monitor.yml` とは役割が異なる。
2. 過去の全カード基準 `mee1080/umasim@91952973eb334ae530b8cd76541bce8a01a141cd` の `support_card.txt` **563枚をGit blobで検証**し、実行時に取得した最新のUmaSimコミットの全名簿と差分を取る。昨日「新規」だったカードも、まだ取り込まれていなければIssueの保留IDから再処理する。名簿が空／前回カード消滅なら失敗して既存Issueを変更しない。
3. 現行 `systemless10/UmamusumePS` mainの固定commitと**完全なGit tree**を取得。対象が実際に存在するかをIDで判断し、存在する新サポカのJSONだけ固定commit URLから取得する。最大40カードで制限し、毎回全559枚を再取得しない。
4. 取得JSONのGit blob SHAを照合し、**以前から存在する** `gametora_whole_event_normalize`、`gametora_event_skill_crosswalk`、`gametora_app_schema_dry_run` の独自形式変換を1枚に対して実行。詳細な結果はランナーの一時メモリのみ。未変換イベントや疑義は元イベント番号・選択肢番号・結果番号・理由コードで記録。正常に変換できた部分は、同一カードの別イベントに疑義があっても非公開の部分候補として保持する。
5. `derived_github_pending_ledger.cjs` が、未取込の新カードIDと状態・元Git blob・技術変換／保留件数・数値位置の要確認コードだけを継続Issueに保存可能な形式へ正規化。Issueの機械管理欄以外は更新しない（手動メモはIssueコメントへ）。状況に変更がなければIssueを更新しない。**実際に既存公開DBへ登録された新カードのみ**保留から除外する。

## 保留状態の区別

| コード | 意味と次回処理 |
| --- | --- |
| `awaiting-source-json` | Git treeにまだ当該IDのJSONがない。次回も確認 |
| `awaiting-source-download` | Git treeにはJSONがあるが実体の取得に失敗。次回再取得 |
| `awaiting-source-validation` | JSON／元ファイル検証が失敗。ソース更新を監視・再検査 |
| `awaiting-source-resolution` | 一部結果・スキルID等が未解決。**確定できる部分は非公開の部分候補に保持**してGameWithによる個別裁定へ |
| `awaiting-review` | 技術的に全件変換。疑義が残る場合も個別確認を待つ。**収録済みを意味しない** |

## 保存・安全境界

- GitHub Issueに置く台帳は `schemaVersion:1`、`dataKind:derived-github-new-card-pending-ledger`、数値カードID、版のGit SHA、出典イベント数・変換数・除外数、理由コードと数値イベント／選択肢／結果位置のみ。GameTora／GameWithのイベントタイトル・選択肢文章・報酬原文、独自の未承認イベントJSON、著作物画像、利用者設定は**永続保存しない**。
- 元ソースはランナー一時領域のみで取得・変換し、外部に再配布しない。元Git blobの改竄、未収録スキル、同名・異IDを無理に統合する処理は従来ゲートで禁止。保留台帳の異常なフィールドや本文混入も拒否する。
- Issue更新は他の監査済みデータを変更しない。既存 `poc/data/reviewed_events.v1.json` は読み取り専用、承認台帳と利用者設定は触らない。現時点では候補確認・継続監視までで、公開イベントを自動的に追記しない。
- 既存 `upstream-refresh-monitor.yml` はGit tree全体の差分レビューIssue／Draft PRを管理し、こちらは**新カードIDごとの未取込と疑義追跡**を管理する。

## A/B/C検証と未完

- **A 機構**：人工カードで初回検知、翌日新ID差分0の再実行、未掲載→取得可能、取得失敗、部分モデル化、異常な出典、収録済みIDの脱落、本文混入拒否を検証。
- **B 出典**：実行時の固定ベースライン563枚と最新UmaSim名簿／第三者Git tree・個別blobを独立確認してから処理。ユーザーが望まない既存DBとの完全一致を強制しない。実行記録はGitHub Actionsを参照。
- **C 環境**：Node/Chromium既存回帰はCIに含む。今回の更新機構はGitHub Actionsで起動するもので、Windows／Android物理端末のイベント編集・取り込み受け入れは未実施。

残る工程は疑義のGameWith裁定と独自DBへの**審査済み新カード増分追記の運用**、それがアプリのイベント設定に反映されたことを実ブラウザ・物理端末で確認すること。元GameTora HTML汎用抽出器の再開は前提ではない。
