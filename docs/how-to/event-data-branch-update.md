# D-074 専用イベントDBの増分更新

[設計決定](../adr/0002-event-data-distribution.md)／[利用者判断](../decisions/log.md#decision-d-074)。

## 手動承認済み増分

`data/events` の現行manifestと固定snapshotをGit APIで照合し、カタログ・承認台帳・前版との増分証跡を検証する。mainの旧DBは固定復旧版であり、新規増分の基準にしない。既存のD-072/D-073ステージが固定UmaSim辞書・パケット・審査入力・非破壊追加・本番モデルを検証する。

[専用workflow](../../.github/workflows/d074-reviewed-data-append.yml) をmainで手動dispatch。入力は `expected_head`（現在のdata/events headの40桁SHA）、`mode`（既定plan、明示publish）、`bundle`（[従来の審査入力](curated-event-intake.md)の evidence と newApprovals / attestations / publicationDecisions / routinePublicationPolicy のいずれか1種類）。最大2枚。元JSON、記事本文、秘密情報を含めない。

- plan：Gitオブジェクト作成なし。承認済み増分の件数と証跡SHAを返す。
- publish：同じ審査を再実行し、snapshotにDB・台帳の2ファイル、子manifest commitに3ファイルを固定。snapshotのcommit messageに前版headとD-072の内容証跡を保存し、再読込で前版→現版の増分を再構成。main移動・data head移動・非fast-forward競合・承認不足は停止。ref更新はforceなし、main／Pagesを書き換えない。
- ref更新成功後に公開Rawのmanifestと固定snapshot両ファイルを照合。Raw検証失敗を成功扱いせず、refが進んでいれば再試行前に確認する。Raw照合成功時のheadを渡し、読取専用の公開ブラウザ受入を後続jobで実行する。失敗時は公開済みrefを確認し、無条件に再増分しない。

## 移行の境界

現在の公開済み初版は固定snapshot `12618f01a2e317311f28e768d5fca7a0b757386f`、564カード・2521イベント。日次監視は専用DBを固定headとSHAで検証して使用し、手動増分と同一排他群。旧PR生成workflowは退役、旧日次設定はdisabled必須。新日次設定 `poc/config/d074-daily-data.v1.json` はD-076でpublish・無期限方針設定済み、[独立の公開許可設定](../../poc/config/d074-publication-policy.v1.json) の `automaticPublicationAllowed:true` を設定。キューのreceiptSha256・eventDigestsSha256を増分前に再照合し、Raw検証まで実施。保留Issueは次の日次runで再照合。公開ブラウザ受入はmoving manifestと公開headの固定manifest、固定snapshotのカタログ・台帳のSHAと承認、実ロードID・件数、キャッシュ復旧を照合する。mainの固定旧版は復旧専用で、manifestの途中変更は失敗とする。実新カードの増分と追加版の実ブラウザ実測は残る。D-068/D-072/D-073の公開条件は変えない。GitHubの標準トークンを利用し、追加の秘密鍵・PATは不要。

## 共通公開方針の有効化手順（2026-11-28）

取得ポリシー `direct-event-intake-policy.v1.json` の `automaticPublicationAllowed:false` は、取得器・計画器・試行台帳が公開承認を生成しない不変条件。ここをtrueにしてはならない。D-074の公開許可は別ファイル `d074-publication-policy.v1.json` に分離し、D-076でtrue。日次の `mode:publish` と有効な共通方針、独立の許可trueが全て必要。D-075の共通方針はschemaVersion:2、validThrough:null。候補0枚の日も審査日・範囲・判断者・根拠・明示確認を検証する。従来v1の期限付き手動判断は互換維持するが、日次自動処理はv2のみ。planは独立の公開許可falseでも承認済み方針で読取専用検証が可能。

1. 日次は `mode:publish` と専用公開許可true。取得側の公開禁止falseは維持。無期限の共通方針と内容SHAゲートを満たす正常候補に限定。
2. 検証のみなら `mode:plan`、専用公開許可false。対象0件は新カード公開成功ではない。既存カードを再取得しない。
3. 具体的な権利上の問題・公開の取消が判明した場合は専用許可false。取得も止める必要がある場合は `mode:disabled` と `routinePublicationPolicy:null` を設定するか日次workflowを無効化する。明示拒否履歴の自動再試行は行わない。D-077では未掲載・一時障害・429のみ有限再試行。既存DBを一律削除せず該当問題を個別審査。

### 共通公開方針（D-075・D-076採用）

D-068/D-072/D-073/D-074の既存判断に沿い、新規未試行カードの通常random・機械検証可能な2〜3段の通常arrows（scope: `D073-normal-random-and-ordinary-chain-skill-path-identifying-titles-only`）を対象に、独自構造のカード・イベント識別子、結果位置、スキル数値ID・ヒントLv、明示終了・解放フラグと既定UIに必要な短い識別名だけを採用する。元JSON・説明・選択肢原文・画像・非スキル原文、既存カードの巡回、全件再構築は除外。短い名称の創作性・異常な表現や条件に疑義がある場合、機械的な長さ検査だけで権利判断を済ませない。未知構造・矛盾・明示手動再試行・未解消の明示拒否・公開根拠の疑義は個別審査。D-077の正常自動再試行は同じ共通方針の対象。根拠の種別は許諾・オープンライセンスではなく `original-factual-description` の限定的な独自事実利用。30日案は撤回。無期限、変更時のみ再審査。審査日はUTCの日付を設定（日本時間2026-11-28の決定はUTC 2026-11-27）。

根拠確認（2026-11-28、Web取得資料。GameTora資料には数か月前のキャッシュを含み、現在の条件の完全確認ではない）：

- [GameTora robots.txt](https://gametora.com/robots.txt)：閲覧版ではサポカ公開ページ等の一律禁止は見当たらない。実取得時に現行robotsを再検証し、明示禁止・HTTP401/403/429/451で停止する。robotsは再利用許諾ではない。
- [GameTora Privacy Policy](https://gametora.com/privacy-policy) と [Contributor License Agreement](https://gametora.com/docs/cla)：前者はプライバシー、後者は寄稿者からGameToraへのライセンスであり、当プロジェクトへの包括的なデータ再配布許諾ではない。公開範囲の限定取得以外は承認対象としない。
- [文化庁・他人の著作物を利用したい場合など](https://www.bunka.go.jp/seisaku/chosakuken/seidokaisetsu/chosakukensha_fumei/)：単なる事実・データ等と創作的表現を区別する一般原則。個別名称・編集著作物・データベースの構成や利用条件の評価を代替しない。
- [Cygames・ウマ娘二次創作ガイドライン](https://umamusume.jp/derivativework_guidelines/)：第三者の権利侵害や同人活動の範囲を超える営利利用等を避ける。独自事実DBの個別許諾を意味しない。非公式・非営利での範囲を維持。

D-072の事前問い合わせ不要の判断を維持するが、第三者の包括許諾や合法性の保証は主張しない。実際の新規カードの事実・表現・権利疑義は未観測。方針は利用者採用済み。D-076で外部文書の指紋監視・初回基準審査を廃止し、mode publish、専用公開許可true。文書の一律監視を行わないため未通知の規約変更を完全に検出する保証はない。

### D-076 実質的な取得制限と例外保留

新規未試行IDまたはD-077の再試行期限を迎えた未収録IDがあるときだけ取得器を実行する。既存のrobots判定を対象パスに適用し、禁止・HTTP401/403/429/451・取得異常で停止。文書ハッシュの変更そのものは停止条件としない。Privacy Policy、CLA、ウマ娘公式robots・二次創作ガイドラインは日常取得対象ではない。JSON構造・辞書・候補証跡・内容SHA・非破壊増分・公開Raw／実ブラウザの既存検証を維持。未知構造・矛盾・再試行・具体的な権利疑義は保留し、既存のIssueと試行台帳を使用。新規対象0件ではGameTora通信なし。初回5文書採取run 46051690350は履歴のみで、現行ゲートではない。

## D-077 障害復帰と明示訂正

- 未掲載・通信一時障害・429はカードごとに初回＋3回、24/48/96時間以上の待機。429はRetry-Afterがより長ければその時刻まで全取得を停止。明示拒否（401/403/451、適用robots禁止）は停止。過去行を消さず、原因解消の根拠を確認後に `poc/config/d077-source-resume.v1.json` の resolved に rowSha256 と reason を追加して後続取得を再開する。日時付きの拒否行は明示解除後に残り試行回数内で再取得できる。旧日時なし・試行上限到達の拒否行は個別保留。予約中断・未知構造・旧時刻のない試行は個別確認。毎回同じ元JSONを保存しない。
- 取得時は一覧・build IDを同一実行内で再利用し、カード単位で予約・完了CAS。後続失敗で前カードの成果を消さない。実行予算8分で残IDを次回へ。通常候補は最大2枚ずつ公開。公開前planで候補が失敗した場合はカード単位で再検証し、独立して成功したカードを公開、失敗したIDをIssueへ記録する。未解釈イベントのあるカードは全体を保留する（部分収録は明示審査）。
- 対応が必要な問題だけを専用Issueに集約し、同じ内容は再投稿しない。明示拒否は失敗表示。一時待機はnotice。GitHubの通知設定は別。日次は revision>1 の現在headに `umasupport/data-acceptance` 成功statusがなければ先にRaw／ブラウザの読取専用受入を再開し、新規取得／増分はその回では行わない。
- [明示訂正workflow](../../.github/workflows/d077-reviewed-data-correction.yml) は main 手動dispatchのみ。expected_head、mode（plan/publish）、bundle（cardId、expectedCardSha256、reason、evidenceUrls、events：訂正後の全イベント、approvals：変更・追加イベントのみの既存v1承認entry配列）を入力。未変更イベントの証跡を保持し、コホートから外す対象だけを再計算、削除イベントは承認なしでよいが明示理由・根拠を必須とする。全イベント削除でもカードIDを保持して再取得を防止。固定版・最新辞書・全公開ゲートを照合し、新revisionとして非強制更新。旧公開履歴・既に配布されたキャッシュの消去は保証しない。権利上の完全削除は別対応。
- 既存カードの巡回・5文書監視はしない。旧手動JSON取得も専用DBの現行版を基準にする。古い運用例は履歴であり、この節を優先する。
