# アーキテクチャと開発境界

## この文書の読み方

**文書の種類**：参照：現行構造。**用途**：実際のモジュール・データ経路。

有効仕様は[要件](requirements.md)、現行の到達点は[status](../project/status.md)、作業順は[ロードマップ](../project/roadmap.md)を優先します。日付付きの過去の観測・決定を、現在の値や指示として読まないでください。

### 主な章

- [現行構成](#現行構成)
- [イベント取得の主経路（D-067）](#イベント取得の主経路d-067)
- [出典ピンの継続更新監視（監査層）](#出典ピンの継続更新監視監査層)
- [モジュールの責務](#モジュールの責務)
- [データ故障時の境界](#データ故障時の境界)
- [実装時に守る不変条件](#実装時に守る不変条件)
- [開発品質との接続](#開発品質との接続)
- [UI専用：連続イベント識別とスキル効果表示（2026-11-04）](#ui専用連続イベント識別とスキル効果表示2026-11-04)
- [発動条件の構造化分析基盤（P0／P1、2026-11-04）](#発動条件の構造化分析基盤p0p12026-11-04)


対象は公開中の**静的サイト＋外部データ実行時取得＋承認済みイベントJSON**。旧単一HTML実データ同梱v8.1と区別する。最新の公開・実装到達点は [status.md](../project/status.md) で確認する。

## D-074：イベントDBの配信分離（移行中）

[採用判断](../decisions/log.md#decision-d-074)・[ADR-0002](../adr/0002-event-data-distribution.md)。アプリはmain／Pagesのまま、承認済みDB・台帳を同一repoの `data/events` に分離する。moving manifestは固定スナップショットcommitと生バイトSHA256・内容SHA・件数を指す。初期化・Raw検証は成功。公開Pagesの通常入口はmanifest→固定snapshotの生バイトSHA・件数・現行モデル照合を行い、同一版の検証済みキャッシュは再利用。障害時は新専用キャッシュ、次に固定SHAの旧同一オリジンDB／旧キャッシュへ復旧。ローカル試験は同一オリジンの固定DBを維持。増分書込みは後続。

## 現行構成

~~~text
GitHub Pages: index.html → poc/live.html
  ├─ poc/src/live_loader.js：UmaSim support_card.txt の取得・形式検証・IndexedDB
  ├─ poc/src/skill_hierarchy.js / skill_bridge.js：skill_data.txt の数値ID照合と階層候補
  ├─ poc/src/skill_effects.js：UmaSim skill_data.txt の info[0]/info[1..] をID・名称照合し、全詳細行を表示専用に付与
  ├─ poc/src/skill_condition_profiles.js：明示脚質・距離などの厳格元条件とOR/AND・Invokeをランタイムで保全
  ├─ poc/src/skill_rank_timing.js：順位割合と局面の数値・抽選位置の事実解釈
  ├─ poc/src/skill_style_tendency.js：発動条件の成立しやすさに関する定性的脚質傾向（明示条件とは別）
  ├─ poc/src/event_sequence.js：承認済みイベントの親子依存・打ち切りから連続表示を判定
  ├─ poc/src/public_event_catalog.js：レビュー済みイベントJSONの検証と安全な結合
  ├─ poc/src/core.js：デッキ／イベント状態から集計する純粋ロジック
  ├─ poc/src/skill_catalog.js：全収録スキルの明示条件必要マスク・独立フィルタ・D-052ローカル照合
  ├─ poc/src/live_app.js：操作UI・表示
  └─ poc/src/settings.js：現行設定の入力検証・保存

第三者公開元：通常ヒントとスキル辞書をブラウザが起動時に直接取得
独自公開DB：data/eventsのmanifest→固定commitのpoc/data/reviewed_events.v1.json（公開Pages）。main同一オリジンDBは固定復旧版・ローカル試験用。
保存：IndexedDB（検証済みゲームデータ）／localStorage（利用者の編集設定）
検証：poc/tests/（人工データ）＋ 明示実行のオンライン全件監査・統合検証
~~~

### P1/P2スキル条件と推定の流れ（2026-11-04）

`skill_data.txt`（実行時直接取得＋既存の検証済みキャッシュ）→ `skill_condition_profiles.attach`（元条件・作戦の明示表示とASTを独立保持）→ `skill_rank_timing.analyze`（OR中の個別ANDごとの順位割合・局面解釈）→ `skill_style_tendency.attach`（全OR経路の合意等を確認し、推定と保留を区別）→ `skill.activationTendency`および`model.meta.skillStyleTendencies`。

**厳格な脚質条件と発動状況からの適性推定は別属性。** 上記は2026-11-04の内部分析機構。現行の製品適性はD-059の独自判定データをD-060に基づき起動時照合し、検索・カード候補集約に反映する。明示適用範囲・適性・未判定を区別し、実ゲーム発動率・効果量・総合点にはしない。[当時の固定監査](../evidence/skills/skill-style-tendency-audit-20261104.md)。

**React / TypeScript / Viteは未導入。** 導入する場合は、[Phase 3](../project/roadmap.md)で既存UIとテストの保守性を比較して判断する。

<a id="イベント取得の主経路2026-10-29更新"></a>
## イベント取得の主経路（D-067）

```text
UmaSim固定旧名簿・現行名簿／スキル辞書
    ↓ 新規ID・持越保留（名簿監視は日次）
plan_new_card_event_intake.cjs / new_card_event_incremental.cjs
    ↓ GameTora本体の対象カードだけを限定取得（明示手動）
probe_official_gametora_target_cards.cjs / direct_event_fact_review.cjs
    ↓ 独立辞書と結果・ヒント・内部依存を照合、疑義は個別裁定
stageNewCardEvents → 内容ハッシュ・公開条件・承認台帳の検証
    ↓ appendApprovedNewCards（既存カタログ不変）
poc/data/reviewed_events.v1.json（GitHub Pages）
    ↓
poc/src/public_event_catalog.js → live.html → デッキ／比較／保存
```

D-067の取得器は開発時の限定直接取得であり、アプリ利用時のサイト巡回・定期自動アクセスではない。未確認の構造・報酬・ID・出典差は保留し、GameWithは具体的な疑義の個別裁定に使う。正式公開の条件は独立する。[現行運用](../how-to/upstream-refresh-operations.md)・[取得元契約](data-sources.md)。

旧 `derived_github_new_card_source_plan` 等の派生JSON経路は固定コホートの再現・履歴照合に限定する。[当時の設計と検証](../evidence/sources/derived-github-canonical-single-card-adapter-20261029.md)。全件再生成は行わない。

**既存563カード・2,512イベントの主経路（2026-10-30方針）**：過去に全件検証した `phase2_2512_private_effect_join.cjs` および `public_event_catalog.preflight/attach` で**非公開の使い捨てモデル**へ一括受け入れする既存工程を継続し、新変換経路で作り直さない。SSR30240の連続3段階、Checkerの11未同定元位置、非スキル16保留等は別の例外台帳に区別し、見つからない報酬を0として確定しない。現在の `public_event_catalog` は署名済み公開JSON用のローダーで、開発用の `attach` が成功しても一般利用者のサイトへ提供されたことにはならない。

**本番配信と出典の境界（現行）**：承認済みの独自イベントJSONを同一オリジンで配信し、`public_event_catalog.loadVerified` で検証・キャッシュする。2026-11-02に承認したイベント集合はすでに公開されている。**現行公開件数は [status.md](../project/status.md) が正本**で、非公開技術変換2,512イベントと同一視しない。編集出典が異なる保留分は[出典例外監査](../evidence/events/phase2-source-lineage-exception-map-20261102.md)および[Issue #302](https://github.com/Nimrodx0/Umasupport/issues/302)で継続管理する。公開用の権利・データの承認ゲートを経ずに未承認候補を配信しない。

**配信方式の検討履歴**：2026-10-30の出典別配信比較（[検討記録](../evidence/events/phase2-event-delivery-route-assessment-20261030.md)）では、ランタイム多重取得か独自JSON配信かを検討した。そこでの「公開前」「公開0件」という記述は当時のもので、現在の公開判断として採用しない。旧8件追記リハーサルは補助ツールとして保持し、2,512件を逐一手作業で承認することを主工程としない。

**継続保留の実装（D-067）**：日次 `derived-github-pending-intake.yml` はUmaSim名簿と既存公開DBだけから新ID・持越を管理する。旧派生GitHubの観測行は履歴として保持し、新規行は `awaiting-direct-source-review`。Issueに数値ID・状態だけを保存し、未承認イベントを公開しない。[旧台帳の設計](../evidence/sources/derived-github-daily-pending-ledger-20261029.md)。

## 出典ピンの継続更新監視（監査層）

[日次GitHub Actionsと更新手順](../how-to/upstream-refresh-operations.md)では、通常の監視はUmaSimの固定／最新blobだけを比較し、GameTora派生GitHubを問い合わせない。旧GTツリー・候補Draftの比較は `legacy_event_audit=true` を指定した明示手動監査に限定する。旧元の404は判定不能で、固定ピン・既存DB・利用者設定を変更しない。候補Draftの権限不足は別課題。新カードの直接取得・公開審査は別工程。

### 固定研究と現行製品の入力境界

P2/P3再現用のイベントDBは [固定研究入力ヘルパー](../../poc/tools/fixed_research_event_catalog.cjs) のGitコミット・Git blob・SHA-256で固定する（559枚・2,487件、固定UmaSim 566枚・881スキルとの組合せ）。監査・固定ブラウザだけが参照し、必要時に一時ファイルへ出力する。現行製品の承認済みDBと実ブラウザ受入は現行カタログと現行辞書を検証する。新イベント追加・旧イベント修正・現行台帳変更で固定研究を再定義しない。取得失敗・SHA不一致は停止し、現行版へ代替しない。固定研究の更新は新しい版・根拠・母集団を明示した別工程。

## モジュールの責務

1. **外部ソース境界**：出典、取得時刻、スキーマ、データ版を明示し、形式不明の入力を受け付けない。外部GETは起動・明示監査に限定し、通常の絞り込み・集計で都度取得しない。
2. **正規化・レビュー**：カード・スキル・イベントは明示IDを軸に関連付け、表記揺れはレビュー済み対応表を使う。候補値／独立確認済み／未収録を区別。
3. **集計エンジン**：デッキ＋イベント選択＋スキル台帳から決定的に算出。1枚の同一スキルの複数経路を提供2枚と数えない。条件付き報酬・直接／間接カバーを混同しない。
4. **表示と設定**：本育成・継承育成それぞれ複数の名前付きデッキ（選択中各1件）、独立した目標セットおよび所持カードの3状態・所有凸を管理。設定JSON v3を `poc/src/settings.js` で検証する。現在の実装には旧v1/v2の移行処理も残っているが、**現在のユーザー要件として互換維持は必須ではない**（`requirements.md` §11、`decisions.md` 2026-10-16設定簡素化）。今後の変更時に旧版を維持するかは、必要性・保守負担・既存データへの影響を区別して判断する。所持凸と編成内想定凸は無関係で、所持カードのみ表示はピッカーの絞り込みであって登録制限ではない。欠損を「なし」と断定しない。PC・スマホは同じ集計結果を参照。
5. **公開**：コードと独自レビュー済みイベントDBをGitHub Pagesで配信。外部の実ゲームデータや攻略原文を権利確認なく再配布しない。

## データ故障時の境界

### UIのページ・表示状態（D-077）

`poc/src/workspace_ui.js` は許可したハッシュ経路と12枠の表示投影だけを持つ。`live_app.js` が既存の検索・集計・保存処理を共用し、ページ、詳細パネル、開閉状態を管理する。ページ遷移・フィルター開閉はデッキを変更しない。マトリクスは `UmaCore` の各提供枠・有効経路を表示するだけで、ID重複排除を再実装しない。表示形式 `matrix` を設定v3の許容値へ追加し、既存の `integrated` / `split` を保持する。

`workspace.css` は公開版の既存CSSの後に読み込み、共有トークンとレスポンシブな配置を定義する。新たなフレームワーク・ビルド工程は導入しない。テーマは既存SAVE_KEYに `-theme` を付けた別キーへ保存し、試用モードの接頭辞分離も維持する。主要一覧はハッシュ付きの独立ページ、追加・詳細は同じ背景ページを保持したパネルとする。テスト用の `workspace_controls.cjs` も実際のナビゲーションとsummaryクリックを通し、非表示要素の強制操作をしない。

### データと保存の復旧

- support_card／skill_dataの外部取得失敗・不正更新：検証済みIndexedDBキャッシュを使い、使用状態を表示。初回でキャッシュもなければ明確なエラー。
- イベント独自JSONの失敗：未検証のイベント報酬を採用せず、通常ヒントの利用を維持。専用キャッシュまたは固定SHAの旧公開版を再検証して復旧し、復旧状態と版を区別。
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

[ロードマップ](../project/roadmap.md)に実装順序、[検証計画](../quality/verification-plan.md)に事前の三軸ゲートを定義する。新しいチャットやCodexは`AGENTS.md`とそれらの文書を読んで作業し、成果と未実施の検証はPR／Issueに記録する。旧PoCを再ビルドできないことと現行直接取得版の実装状況は別に扱う。

## UI専用：連続イベント識別とスキル効果表示（2026-11-04）

- `event_sequence.classifiedEvents(card.events)` は公開済みイベントスキーマの `requires`・`terminal`・`availabilityKind` を読み、連続関係が**確認できた**イベントのラベルだけを算出する。名称・イベントの配列順・非公開の元データから連続を推測しない。未収録の関係は表示できない場合がある。編成の到達可否・スキル数値計算は不変。
- UmaSim `skill_data.txt` には既存の `info`（効果説明・補足的な発動条件記述）がある。`skill_bridge.parseSource()` がこれを構造検証後に取得し、`skill_effects.attach()` が現在のスキルモデルへ追加する。`hint:` は同名唯一のときのみ結び、`skill:` は数値ID＋名称で照合する。旧版にしかないスキルは検証済み固定版を優先。未照合の効果を推測で表示しない。
- UmaSim `info[0]` は概要、`info[1..]` は順序つきの詳細記述。`skill_bridge.parseSource` の `technicalDetailLines` → `skill_effects.attach` の `effectTechnicalDetailLines` → スキル詳細UIの折りたたみ番号付きリストで、複数記述を最後まで表示する。従来の `effectTechnicalDetails`（最初の1件）は後方互換の表示補助として保持する。詳細行はHTMLエスケープし、1件しかない場合は従来のコンパクト表示を保つ。元の構造化 `invokes` をイベントの発動条件推定へ流用しない。
- スキル効果は**画面専用の補助属性**であり、イベント報酬・ヒントLv・スキル階層・保存設定を変えない。効果文を本レポジトリの公開JSONへ同梱せず、外部元の実行時取得・IndexedDBキャッシュを再利用する。辞書取得失敗は従来どおり保存済み検証版にフォールバックする。

## 発動条件の構造化分析基盤（P0／P1、2026-11-04）

- **P0**：`skill_condition_inventory.cjs` と `audit_skill_conditions.cjs` が固定UmaSim辞書を読み、`invokes` の条件型・演算子・AND/OR・効果型・＜ ＞語彙を全件分類する。限定Actionsのみ外部データを取得し、通常CIは合成データで試験する。固定監査結果は[全件P0監査](../evidence/skills/skill-condition-inventory-audit-20261104.md)。
- **P1**：`skill_condition_tags.js` は説明の＜ ＞候補から距離・脚質・馬場という限られた語彙のみを抽出し、数値比較の `<` / `>` を誤認しない。抽出文字列はUmaSim出典の表示語彙であり、実ゲーム画面の独立実機確認を意味しない。
- `skill_condition_profiles.js` は現在辞書と固定辞書を**スキル数値ID＋名称**（`hint:` は一意名照合）で結び、各 `Invoke` の `preConditions` と `conditions` を「外側OR／内側AND」の入れ子構造のまま投影する。脚質 `running_style`、距離 `distance_type`、馬場 `ground_type`、馬場状態 `ground_condition` の `type/operator/value` は演算子を保持したまま日本語の値ラベルを添える。その他の条件も**条件式のまま保持**し、未知を無制限扱いしない。
- `live.html` の起動直前に `UmaSkillConditionProfiles.attach(model,{skillText,pinnedSkillText})` を追加。ステージングして全件検証後に `skill.activationProfile` を付加し、`model.meta.skillConditionProfiles` に出典付きの集計を保持。**スキル一覧・イベント報酬・元ゲーム辞書・目標／提供枚数計算・保存設定は変更しない。**
- **P1は構造分類まで**：順位・局面からの「逃げ／先行向き」という推定、全発動確率、カード傾向のUI・フィルターはまだ実装しない。追加条件を一律に基礎効果の制限とみなさず、複数Invoke・AND/ORの意味の裁定は次工程で行う。未収録63スキルは `status:'unavailable'` で残す。

## D-060：公開承認・等価集計（現行方針）

D-060（2026-11-25 22:20 JST、利用者確認）：独自生成した適性データのGitHub公開と起動時自動読込は承認済み。第三者の元辞書・元条件・原文・画像の再配布は対象外。金白は別件数、各ID1件で、重み付け・カード総合点なし。 公開ラベルの取得・ハッシュ・元ID・構造照合は設定保存やイベント到達計算から独立し、不一致は未判定とする。金白内訳は候補ID集合に対する等価集計。
