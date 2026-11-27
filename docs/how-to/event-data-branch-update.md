# D-074 専用イベントDBの増分更新

[設計決定](../adr/0002-event-data-distribution.md)／[利用者判断](../decisions/log.md#decision-d-074)。

## 手動承認済み増分

`data/events` の現行manifestと固定snapshotをGit APIで照合し、カタログ・承認台帳・前版との増分証跡を検証する。mainの旧DBは固定復旧版であり、新規増分の基準にしない。既存のD-072/D-073ステージが固定UmaSim辞書・パケット・審査入力・非破壊追加・本番モデルを検証する。

[専用workflow](../../.github/workflows/d074-reviewed-data-append.yml) をmainで手動dispatch。入力は `expected_head`（現在のdata/events headの40桁SHA）、`mode`（既定plan、明示publish）、`bundle`（[従来の審査入力](curated-event-intake.md)の evidence と newApprovals / attestations / publicationDecisions / routinePublicationPolicy のいずれか1種類）。最大2枚。元JSON、記事本文、秘密情報を含めない。

- plan：Gitオブジェクト作成なし。承認済み増分の件数と証跡SHAを返す。
- publish：同じ審査を再実行し、snapshotにDB・台帳の2ファイル、子manifest commitに3ファイルを固定。snapshotのcommit messageに前版headとD-072の内容証跡を保存し、再読込で前版→現版の増分を再構成。main移動・data head移動・非fast-forward競合・承認不足は停止。ref更新はforceなし、main／Pagesを書き換えない。
- ref更新成功後に公開Rawのmanifestと固定snapshot両ファイルを照合。Raw検証失敗を成功扱いせず、refが進んでいれば再試行前に確認する。Raw照合成功時のheadを渡し、読取専用の公開ブラウザ受入を後続jobで実行する。失敗時は公開済みrefを確認し、無条件に再増分しない。

## 移行の境界

現在の公開済み初版は固定snapshot `12618f01a2e317311f28e768d5fca7a0b757386f`、564カード・2521イベント。日次監視は専用DBを固定headとSHAで検証して使用し、手動増分と同一排他群。旧PR生成workflowは退役、旧日次設定はdisabled必須。新日次設定 `poc/config/d074-daily-data.v1.json` はD-075でplan・無期限方針設定済み（外部条件基準は未登録、publishは加えて [独立の公開許可設定](../../poc/config/d074-publication-policy.v1.json) の `automaticPublicationAllowed:true` が必要）。キューのreceiptSha256・eventDigestsSha256を増分前に再照合し、Raw検証まで実施。保留Issueは次の日次runで再照合。公開ブラウザ受入はmoving manifestと公開headの固定manifest、固定snapshotのカタログ・台帳のSHAと承認、実ロードID・件数、キャッシュ復旧を照合する。mainの固定旧版は復旧専用で、manifestの途中変更は失敗とする。実新カード試験、外部条件基準の確認・登録、自動公開有効化、追加版の実ブラウザ実測は残る。D-068/D-072/D-073の公開条件は変えない。GitHubの標準トークンを利用し、追加の秘密鍵・PATは不要。

## 共通公開方針の有効化手順（2026-11-28）

取得ポリシー `direct-event-intake-policy.v1.json` の `automaticPublicationAllowed:false` は、取得器・計画器・試行台帳が公開承認を生成しない不変条件。ここをtrueにしてはならない。D-074の公開許可は別ファイル `d074-publication-policy.v1.json` に移し、既定false。日次の `mode:publish` と有効な共通方針、独立の許可trueが全て必要。D-075の共通方針はschemaVersion:2、validThrough:null。候補0枚の日も審査日・範囲・判断者・根拠・明示確認を検証する。従来v1の期限付き手動判断は互換維持するが、日次自動処理はv2のみ。planは独立の公開許可falseでも承認済み方針で読取専用検証が可能。

1. D-075で `routinePublicationPolicy` の無期限方針を設定し、`mode:plan`、公開許可falseで日次監視を実行。初回文書指紋の採取・内容確認・基準登録を行う。
2. 正常・保留・拒否・条件変更・データ版移動を検証。候補0件は新カード公開成功ではない。実データは次回の新カード検知まで待ち、既存カードを再取得しない。
3. 共通方針の承認と公開準備の確認後、`mode:publish` と専用公開許可trueを同時に設定。取得側falseは維持。増分Rawと公開ブラウザ受入の結果を確認する。
4. 取消・条件変更・拒否・異常が判明した場合は専用許可false、必要なら日次modeをdisabledへ戻す。既存承認済みDBは変更せず、問題のカードは個別審査。

### 共通公開方針（D-075採用）

D-068/D-072/D-073/D-074の既存判断に沿い、新規未試行カードの通常random・機械検証可能な2〜3段の通常arrows（scope: `D073-normal-random-and-ordinary-chain-skill-path-identifying-titles-only`）を対象に、独自構造のカード・イベント識別子、結果位置、スキル数値ID・ヒントLv、明示終了・解放フラグと既定UIに必要な短い識別名だけを採用する。元JSON・説明・選択肢原文・画像・非スキル原文、既存カードの巡回、全件再構築は除外。短い名称の創作性・異常な表現や条件に疑義がある場合、機械的な長さ検査だけで権利判断を済ませない。未知構造・矛盾・再試行・拒否履歴・公開根拠の疑義は個別審査。根拠の種別は許諾・オープンライセンスではなく `original-factual-description` の限定的な独自事実利用。30日案は撤回。無期限、変更時のみ再審査。審査日はUTCの日付を設定（日本時間2026-11-28の決定はUTC 2026-11-27）。

根拠確認（2026-11-28、Web取得資料。GameTora資料には数か月前のキャッシュを含み、現在の条件の完全確認ではない）：

- [GameTora robots.txt](https://gametora.com/robots.txt)：閲覧版ではサポカ公開ページ等の一律禁止は見当たらない。実取得時に現行robotsを再検証し、明示禁止・HTTP401/403/429/451で停止する。robotsは再利用許諾ではない。
- [GameTora Privacy Policy](https://gametora.com/privacy-policy) と [Contributor License Agreement](https://gametora.com/docs/cla)：前者はプライバシー、後者は寄稿者からGameToraへのライセンスであり、当プロジェクトへの包括的なデータ再配布許諾ではない。公開範囲の限定取得以外は承認対象としない。
- [文化庁・他人の著作物を利用したい場合など](https://www.bunka.go.jp/seisaku/chosakuken/seidokaisetsu/chosakukensha_fumei/)：単なる事実・データ等と創作的表現を区別する一般原則。個別名称・編集著作物・データベースの構成や利用条件の評価を代替しない。
- [Cygames・ウマ娘二次創作ガイドライン](https://umamusume.jp/derivativework_guidelines/)：第三者の権利侵害や同人活動の範囲を超える営利利用等を避ける。独自事実DBの個別許諾を意味しない。非公式・非営利での範囲を維持。

D-072の事前問い合わせ不要の判断を維持するが、第三者の包括許諾や合法性の保証は主張しない。実際の新規カードの事実・表現・権利疑義は未観測。方針は利用者採用済み。実際の監視基準は未登録、mode plan、専用公開許可false。

### D-075 外部条件の変更検知と再開

- 固定対象はGameTora robots.txt・Privacy Policy・CLAと、umamusume.jp robots.txt・二次創作ガイドライン。新規取得の直前、または既取得の正常公開候補の処理直前だけ確認し、同一日次run内では一回の確認結果を共有。対象0件なら条件文書も取得しない。初回基準採取は別workflowで明示的に行う。
- [条件監視](../../poc/src/d075_conditions_monitor.cjs) は固定URLへの逐次GETのみ、6秒間隔、robots確認、リダイレクト拒否、認証なし、サイズ・時間上限。生バイトSHA-256のみ保持。文書変更は内容の法的判断ではない。HTMLの装飾や版識別子の変化でも保守的に保留し得る。未監視の新規規約ページや意味変更を完全検知する保証はない。
- [基準採取workflow](../../.github/workflows/d075-condition-baseline.yml) は指紋と状態だけを出力し、採取成功も承認ではない。実文書の確認後に [基準設定](../../poc/config/d075-condition-baseline.v1.json) を方針SHAと固定文書指紋に結び付ける。取得不能・拒否・不一致・未登録時は新規取得・公開を保留。既存DBと既存表示は不変。
- 外部条件の保留Issueは一つに集約し、開いている間は再取得・公開を止める。再審査後の基準更新とIssueの明示closeによって再開する。未説明の変更や拒否を理由なくcloseしない。既存取得拒否台帳も維持する。自動での基準差替え・Issue close・期限延長は行わない。
