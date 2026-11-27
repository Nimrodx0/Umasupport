# ADR-0002：イベントDBの配信分離

- **状態**：Accepted
- **提案日**：2026-11-28
- **採用日**：2026-11-28
- **却下日**：該当なし
- **判断主体と根拠**：利用者の方式A採用（[D-074](../decisions/log.md#decision-d-074)）
- **関連するユーザー判断ID**：[D-074](../decisions/index.md#d-074)、D-068、D-072、D-073
- **置換するADR／置換先ADR**：なし

## 背景と制約

UmaSimはブラウザが最新版を取得する一方、イベントDBは独自変換・承認のためmainへ書き込みPagesを再配信していた。標準トークンのpush連鎖制約を回避するためだけに認証・自動merge・配信を増やす必要はない。既存DBは約3MB、公開済みの564カード／2521イベント。公開repoであり、専用refは秘密保管場所ではない。

## 検討した選択肢

A 同一repo専用ブランチ、B 別repo、C Releases、D Actions直接Pages、E GitHub App/PAT、F 外部ストレージ/CDN、G ブラウザからGameTora直接取得。Aは認証追加なし・Git履歴・既存検証再利用・低運用負担。B/Eは権限・資格情報管理、Cはリダイレクト/CORS、Dはアプリ再配信、Fは別サービス、Gは取得負担・検証と固定版の欠如が課題。大規模配信になればFを再評価する。

## 決定

mainはアプリ、data/eventsは承認済みデータ、Actionsは更新。データのみのスナップショットcommitにカタログと承認台帳を置き、子commitに同じ2ファイルとmanifest.jsonを置く。manifestが固定親snapshotCommit、codeCommit、revision、前回manifest commit、内容／生バイトSHA256と件数を指す。moving refのmanifestから固定commitを読み、版混在を拒否。初回は既存承認済みblobを再利用、作成前に全体を検証。以後、非強制fast-forwardで公開する設計とする（増分書込みは後続工程）。

## 根拠とトレードオフ

アプリの変更とデータの更新を分け、通常増分のPR・merge・Pages再配信を不要にする。GitHub Rawの遅延・可用性・CORSとアプリ互換性の検証が必要。旧mainの同一オリジンDBは移行中の固定フォールバックとして保持する。公開根拠を省略せず、未承認候補は配信しない。キャッシュやロールバック時も整合性を検査する。

## 影響と検証

初期段階は固定mainの2blobを確認し、承認ゲート・SHA・件数・treeを検証、専用branchを原子的に初期化しRaw公開検証。初回の厳密なmain親・blob条件以外では欠損branchの再作成をしない。既存branchは読み取り検証のみ。公開Pages入口はmanifest→固定snapshotのSHA・件数・現行モデルを検証、専用キャッシュから復旧し、なければ旧main固定SHA版を使用。ローカルは固定DB。正本移行・日次増分・実ブラウザ回帰は後続。共通公開方針は未設定。

## 状態変更の履歴

- 2026-11-28：Accepted（利用者が方式Aを明示選択）。
