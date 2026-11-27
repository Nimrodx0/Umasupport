# D-074 専用イベントDBの増分更新

[設計決定](../adr/0002-event-data-distribution.md)／[利用者判断](../decisions/log.md#decision-d-074)。

## 手動承認済み増分

`data/events` の現行manifestと固定snapshotをGit APIで照合し、カタログ・承認台帳・前版との増分証跡を検証する。mainの旧DBは固定復旧版であり、新規増分の基準にしない。既存のD-072/D-073ステージが固定UmaSim辞書・パケット・審査入力・非破壊追加・本番モデルを検証する。

[専用workflow](../../.github/workflows/d074-reviewed-data-append.yml) をmainで手動dispatch。入力は `expected_head`（現在のdata/events headの40桁SHA）、`mode`（既定plan、明示publish）、`bundle`（[従来の審査入力](curated-event-intake.md)の evidence と newApprovals / attestations / publicationDecisions / routinePublicationPolicy のいずれか1種類）。最大2枚。元JSON、記事本文、秘密情報を含めない。

- plan：Gitオブジェクト作成なし。承認済み増分の件数と証跡SHAを返す。
- publish：同じ審査を再実行し、snapshotにDB・台帳の2ファイル、子manifest commitに3ファイルを固定。snapshotのcommit messageに前版headとD-072の内容証跡を保存し、再読込で前版→現版の増分を再構成。main移動・data head移動・非fast-forward競合・承認不足は停止。ref更新はforceなし、main／Pagesを書き換えない。
- ref更新成功後に公開Rawのmanifestと固定snapshot両ファイルを照合。Raw検証失敗を成功扱いせず、refが進んでいれば再試行前に確認する。公開ブラウザ受入は別工程。

## 移行の境界

現在の公開済み初版は固定snapshot `12618f01a2e317311f28e768d5fca7a0b757386f`、564カード・2521イベント。実新カードの増分試験、日次監視の正本切替、旧PR更新経路の退役、共通公開方針の実設定、公開ブラウザでの追加版受入は残る。旧日次提案はdisabledを維持。旧main更新経路と同時運用しない。新規publishは公開アプリの読取切替がmainに統合されるまで拒否する。D-068/D-072/D-073の公開条件は変えない。GitHubの標準トークンを利用し、追加の秘密鍵・PATは不要。
