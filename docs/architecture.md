# アーキテクチャと開発境界

更新：2026-10-17。対象は公開中の**実行時直接取得版PoC**。過去の単一HTML実データ同梱v8.1と区別する。

## 現行構成

~~~text
GitHub Pages: index.html → poc/live.html
  ├─ poc/src/live_loader.js：UmaSim support_card.txt の取得・形式検証・IndexedDB
  ├─ poc/src/skill_hierarchy.js / skill_bridge.js：skill_data.txt の数値ID照合と階層候補
  ├─ poc/src/public_event_catalog.js：レビュー済みイベントJSONの検証と安全な結合
  ├─ poc/src/core.js：デッキ／イベント状態から集計する純粋ロジック
  ├─ poc/src/live_app.js：操作UI・表示
  └─ poc/src/settings.js：現行設定の入力検証・保存

第三者公開元：通常ヒントとスキル辞書をブラウザが起動時に直接取得
独自公開DB：poc/data/reviewed_events.v1.json（同一オリジン・現在実イベント0件）
保存：IndexedDB（検証済みゲームデータ）／localStorage（利用者の編集設定）
検証：poc/tests/（人工データ）＋ 明示実行のオンライン全件監査・統合検証
~~~

**React / TypeScript / Viteは未導入。** 導入する場合は、[Phase 3](roadmap.md)で既存UIとテストの保守性を比較して判断する。

## イベント取得の主経路（2026-10-29更新）

```text
UmaSim全カード名簿（旧版／現行版）
    ↓ 新規IDと前回未取込の保留IDを抽出
第三者GitHub：systemless10/UmamusumePS（GameTora由来の構造化JSON）
    ↓ 固定コミットの完全なGit treeとsupport_<ID>.jsonのGit blobを確認
poc/src/derived_github_new_card_source_plan.cjs
    ↓ JSON存在／未入手／既存DBに収録済みを分類（未入手は次回保留）
既存のGameTora派生イベント全件変換器・編集監査（今後の接続）
    ↓ スキルID・結果位置・連続内部条件を独立スキーマへ照合
出典・内容・権利・個別公開承認ゲート
    ↓ 追加対象の新カードだけ検証し、既存カードを無変更
poc/data/reviewed_events.v1.json（GitHub Pages）
    ↓
poc/src/public_event_catalog.js → live.html → デッキ／比較／保存
```

**GameTora本体HTMLの共通直接取得器は未完成のまま開発保留**。従来のPlaywright DOM抽出試作とその監査は削除せず、主経路のランタイム、収録機能の先行条件、CI必須のオンライン取得には組み込まない。GameWithは特定の欠損／疑義を個別編集裁定する補助資料として維持する。第三者GitHub派生JSON自体の存在は公開可能性の保証ではなく、本文の再配布や権利問題も別途審査する。

**増分取り込みの実装状況（2026-10-29）**：`derived_github_new_card_source_plan` → `derived_github_card_event_preflight` → `derived_github_existing_converter_adapter` → `derived_github_staging_bridge` → `new_card_event_incremental.stageNewCardEvents`。**既存の** `gametora_whole_event_normalize`・`gametora_event_skill_crosswalk`・`gametora_app_schema_dry_run` を、新カード1枚の固定GitHub JSONへ再利用する。以前の `derived_github_runtime_draft` は実績記録として保持するが、現在の新カード主経路では使用しない。元JSONの不明点や未変換事項は要確認記録に区別して残し、既存DBは書き換えない。[設計と検証](derived-github-canonical-single-card-adapter-20261029.md)。

この接続は**非公開の技術候補とレビュー待ち**を扱う。日次実運用、永続保留台帳、GameWithの疑義裁定、レビュー後の正式追記、実機による収録検証はまだ完成していない。公開のイベントDBに新サポカを自動追加する処理ではない。

## 出典ピンの継続更新監視（監査層）

[日次GitHub Actionsと更新手順](upstream-refresh-operations.md)は、GameTora元イベントの559固定JSONとUmaSimサポカ・数値スキル辞書の**固定Git blob／最新main**をメタデータだけで比較する。差分があればGitHubの1件のレビューIssueと、未承認Git tree／Git blobだけの候補マニフェストを含む**Draft PR**を作成／更新する。Bot専用候補ブランチからread-only Core CIと候補GT／UmaSim元ファイルの**全件構造preflight**を明示起動する。出典本文は一時Actionsランナー以外に保存しない。ただしB検証のうち、イベント報酬の内容やGT↔UmaSimスキルIDの意味的照合、再利用許可は未実施。スナップショットが進んでも現在の本番カタログ・ユーザー設定・デッキ表示には自動反映しない。更新済みの固定コミット採用は従来のA/B/C監査と公開承認とは別にレビューする。

## モジュールの責務

1. **外部ソース境界**：出典、取得時刻、スキーマ、データ版を明示し、形式不明の入力を受け付けない。外部GETは起動・明示監査に限定し、通常の絞り込み・集計で都度取得しない。
2. **正規化・レビュー**：カード・スキル・イベントは明示IDを軸に関連付け、表記揺れはレビュー済み対応表を使う。候補値／独立確認済み／未収録を区別。
3. **集計エンジン**：デッキ＋イベント選択＋スキル台帳から決定的に算出。1枚の同一スキルの複数経路を提供2枚と数えない。条件付き報酬・直接／間接カバーを混同しない。
4. **表示と設定**：本育成・継承育成それぞれ複数の名前付きデッキ（選択中各1件）、独立した目標セットおよび所持カードの3状態・所有凸を管理。設定JSON v3を `poc/src/settings.js` で検証する。現在の実装には旧v1/v2の移行処理も残っているが、**現在のユーザー要件として互換維持は必須ではない**（`requirements.md` §11、`decisions.md` 2026-10-16設定簡素化）。今後の変更時に旧版を維持するかは、必要性・保守負担・既存データへの影響を区別して判断する。所持凸と編成内想定凸は無関係で、所持カードのみ表示はピッカーの絞り込みであって登録制限ではない。欠損を「なし」と断定しない。PC・スマホは同じ集計結果を参照。
5. **公開**：コードと独自レビュー済みイベントDBをGitHub Pagesで配信。外部の実ゲームデータや攻略原文を権利確認なく再配布しない。

## データ故障時の境界

- support_card／skill_dataの外部取得失敗・不正更新：検証済みIndexedDBキャッシュを使い、使用状態を表示。初回でキャッシュもなければ明確なエラー。
- イベント独自JSONの失敗：未検証のイベント報酬を採用せず、通常ヒントの利用を維持。イベントDBの永続的な旧版復旧は別途検討。
- 利用者設定の不正：現行スキーマ・存在IDを検証し、エラーを明示。ユーザーの確認なく元の保存値を上書きしない。開発段階の旧保存ID・旧スキーマの後方互換は維持しない。
- **完全オフライン**：IndexedDBデータのフォールバックは実ブラウザ確認済み。ただしHTML/JSまでネットワーク不要で起動する仕組み（Service Worker等）は未実装で、別の公開品質判断事項。

## 実装時に守る不変条件

- ゲームデータの未収録は「獲得不可」を意味しない。
- 実カードID、イベントID、スキルIDの根拠を混ぜず、類似名だけで確定しない。
- 未設定の選択肢、打ち切り後、条件未到達のイベントからの獲得を集計しない。
- 金／白／○／◎は別スキル。見た目の親子と直接提供枚数は独立。
- 外部のデータ内容が変化したら、無条件で既存のID・レビュー結果を流用しない。
- 利用者用の手動データ更新ボタンを置かない。

## 開発品質との接続

[ロードマップ](roadmap.md)に実装順序、[検証計画](verification-plan.md)に事前の三軸ゲートを定義する。新しいチャットやCodexは`AGENTS.md`とそれらの文書を読んで作業し、成果と未実施の検証はPR／Issueに記録する。旧PoCを再ビルドできないことと現行直接取得版の実装状況は別に扱う。
