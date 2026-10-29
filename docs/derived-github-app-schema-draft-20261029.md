# 2026-10-29：GitHub派生GameTora JSONからウマサルタントの非公開イベント形式へ

## 目的

[2026-10-29に確定した派生GitHub主経路](derived-github-primary-restart-20261029.md)の実装を続け、元サイトHTML解析を再開せずに、バージョンを固定した第三者GitHubサポートカードJSONから**アプリのイベントv1形式**へ、選択肢・排他的結果・スキルID・ヒントLv・明示打ち切り・単純な連続後続関係を投影する。公開前の事実・再利用の承認は依然必要である。

## 追加した処理

`poc/src/derived_github_runtime_draft.cjs` は `projectDerivedCardDraft({plan,cardId,sourceText,skillText})` を提供する。

1. `validateDerivedCardSource` で、対象IDが**完全なGit tree**上のバージョン固定 `support_<ID>.json` として候補にあること、Git blobのSHAが実ファイルのバイト列と一致することを確認する。
2. 既存 `gametora_whole_event_normalize.transformDocument` で元ソースのイベント・選択肢・排他的結果・数値ID・スキルヒントLv／直接習得・特殊マーカーを正規化する。
3. UmaSimの `skill_data.txt` 数値ID辞書で、通常／金スキルを明示ID・名称で照合。結果ごとに `skill:<数値ID>` のヒント報酬はLv付き、直接習得は `kind:obtained` でLvなしとする。攻略サイトのスキル名から数値IDを逆推測しない。
4. `random` と `arrows` の一般的な選択／結果について、結果順序・明示打ち切りを保持。前の連続段階が保留なら次段も `CHAIN_PREDECESSOR_NOT_PROJECTED` で保留する。変換候補の形式は実アプリの `event_schema.validateEvents` で検査する。
5. `skill_hint_or`、独立辞書にないID、未知の効果種別、事前の結果依存、特殊セクション `dates`／`special` などを、**不明な報酬なし／自動獲得へ変換せず**、イベント単位で隔離する。スキル以外の普通の能力増減は、アプリのスキル経路投影から省略した個数を記録する。したがって、数値効果すべてを再現したとの主張はしない。
6. アプリ形のイベントに**`sourceKind:derived-github-unreviewed`** を付けるため、`event_release_gate.verifyRelease` はこの草稿を正式カタログに採用できない。仮のイベント名・結果番号を使い、元の選択肢やイベント名・文章を公開しない。

**既存DBの書込、利用者設定の変更、第三者データのPublicへの再配布は実施していない。** 一部のイベントをアプリ形にできても、そのカードを「全件変換・完成」と見なさない。

## A/B/Cの実証

- **A（機構）**：人工JSONと101件以上の人工スキル辞書で、選択肢・結果別ヒントLv・直接習得・結果別打ち切り・前段からの到達と遮断、未知スキル、古いsource blob、未知セクションの厳格保留をNodeテスト。出力はスキーマ検証を通るが、公開ゲートは明示的に拒否する。
- **B（実データ）**：[第三者GitHubの固定版JSONを取得する限定CI](https://github.com/Nimrodx0/Umasupport/actions/runs/40824748552) にて `systemless10/UmamusumePS@62ec54e754f903e347da807d30aad40e53d794d2` のR10016・SR20075・SSR30030と、固定版UmaSimスキル辞書を利用。各JSONはGit tree上のblobに一致させる。直接GameTora本体は取得しない。

| カード | 派生JSONのイベント | 非公開アプリ形へ変換 | 保留 | アプリ形のスキル言及 |
| --- | ---: | ---: | ---: | ---: |
| R10016 | 2 | 2 | 0 | 1 |
| SR20075 | 3 | 3 | 0 | 2 |
| SSR30030 | 5 | 4 | 1 | 2 |
| 合計 | **10** | **9** | **1** | **5** |

SSR30030の1件は `MISSING_OR_UNSUITABLE_SKILL_ID`（固定UmaSim辞書に適合しない数値ID）で保留。単純な名前類似による補完は実施しない。

**重要な分母の違い**：以前の元GameToraサイトHTML試験でSR20075の表示パネルは**5**であったが、今回用いた派生GitHub固定版ではイベントは**3件**である。今回の3/3は**派生GitHub JSONに実際に収録されたイベントに対する構造変換率**であって、GameTora現行サイト・ゲーム内イベントの全件性を意味しない。元サイトHTML取得器の開発は保留のままとし、差分は元DBの独立監査・必要なら個別出典確認で扱う。

- **C（環境）**：GitHub Actions Ubuntuで実ファイルを一時領域だけに読み、実Node実行で独自スキーマを検証。既存のChromeブラウザ回帰は別途CIで実施。ユーザー向けPagesへ実際の公開イベントを入れた実機検証は**未実施**。

## 次工程

1. この非公開投影の保留原因を既存の全件GTコホート監査へ適用し、普通のサポカに頻出する `skill_hint_or` や連続内部の結果依存を**汎用ルール**で処理する。カード別の固定値を追加せず、元データで証明できない部分は個別保留する。
2. `derived_github_card_event_preflight` と `derived_github_runtime_draft` の実データ全件・対象カード別ロールアップを行い、派生JSONの現行収録範囲を正確に測る。本文・元イベントJSONをPublicへコピーしない。
3. 公開用の実データを準備する段階では、元の仮名／隔離印を無審査で削除せず、元カード／イベント／スキルと公開・権利条件の個別レビュー証跡を得た場合だけ `appendApprovedNewCards` および `verifyRelease` を通して初めて収録する。
4. UI側のイベント切替、報酬の再計算、金白重複・目標カバー、所持・保存・Pagesモバイル操作は、実イベントの審査と並行して進める。

**正式公開済みイベントは今回も0件**。直接GameTora HTML取得の未完成状態を、上記の工程の必須ゲートには戻さない。
