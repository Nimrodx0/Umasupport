# 開発支援AI向け引き継ぎ

更新：2026-10-18。**本リポジトリの文書とコードが作業の正本**。チャットの発言や古いPoC記録で上書きしない。

## 最初に読む順序

1. [README.md](README.md)：公開版・現在の状態と各文書の入口。
2. [docs/requirements.md](docs/requirements.md)：要件・対象外・受け入れ条件。
3. [docs/roadmap.md](docs/roadmap.md)：6フェーズ、順序、現在位置、完了ゲート。
4. [docs/verification-plan.md](docs/verification-plan.md)：機構／データ網羅／実ブラウザの独立検証。
5. [docs/architecture.md](docs/architecture.md)、[docs/runtime-data-loading.md](docs/runtime-data-loading.md)、[poc/README.md](poc/README.md)：現行コード・データ取得・テスト手順。
6. 必要なときだけ [docs/decisions.md](docs/decisions.md)、[docs/development-history.md](docs/development-history.md)、関連データ監査文書・Issueへ進む。

**仕様変更**はrequirements＋decisions、**工程・ゲート変更**はroadmap＋verification-plan、**実装・検証の実績**はdevelopment-history・個別監査・Issueへ記録。似た進捗文を複数ファイルへ重複追加しない。

## 現時点の技術と公開境界

- 現行アプリ：`index.html` → `poc/live.html`、HTML/CSS/JavaScript、`poc/src/`。React/TypeScript/Viteは未導入。`poc/demo.html`は架空データのデモで、実データ版と混同しない。
- 通常ヒント：UmaSim `support_card.txt` を起動時にブラウザ取得・検証し、IndexedDBへ保存。2026-10-16にPages通常起動・サポカキャッシュ復旧・再取得の実ブラウザ確認済み。
- **ヒント性能（2026-10-17追加）**：UmaSimの公開元に対応する列番号23/24/49/50からカードごとの0〜4凸の基本・固有ヒントLv/発生率補正値を抽出。全563枚×5行を[監査](docs/hint-performance-audit.md)。カード詳細の数値はシミュレータ資料由来で、特殊固有/シナリオ効果や実ゲームの発生確率ではない。[2026-10-17 Pages Chromium実データ検証](https://github.com/Nimrodx0/Umasupport/actions/runs/38953159885)では0/4凸の表示が実データと一致。物理端末の新UI・データ独立検証は未完。
- **カード母集団の独立照合（2026-10-17）**：[GameTora公開日本語一覧とUmaSim各563件のカードID集合完全一致](docs/card-population-independent-audit.md)。Tsuyuchan-jpの選択収録45件と英語版カード台帳259件もID・レアリティ一致、合計304個別照合。**RタッカーブラインはUmaSimに存在（ID 10128、SSR版30257）**。以前のイベント候補の未照合と未収録を混同しない。GameToraで全カードの名前・性能・ヒント・公式実装が保証されたわけではない。
- **通常ヒントの別資料照合（2026-10-17）**：[選択45カード×通常ヒント527件の別資料照合](docs/independent-card-hint-audit.md)。カードごとの0凸/4凸ヒント名称集合は45/45一致。UmaSim数値スキル辞書に`201012`「後方釘付」が欠けるが、UmaSimカードの名称は正しい。**別資料のIDを根拠なく実行時ソースに合成しない**。別スキルJSON2,194件には標準表示順の列なし。
- 金白スキル：`skill_data.txt` を起動時に取得し、金325を全件分類。構造対応候補322、白なし3。Node実ソース統合試験成功。**別系統JSONで321/322組の双方向参照・1組の名称対応を外部確認。2026-10-17にPages/Linux Chromiumで実データ取得・辞書・キャッシュ・編成を検証済み**。Android/Windows実機と全数値IDの独立確認は未完。
- イベント：SSR・SR417の候補表記対応は完了。候補イベント2,099件。ソース上イベント記録0件のSSRが5枚。**公開イベントDBの実ゲームイベントは0件**。入力候補はUmaUmaChecker、欠損／新規はGameWith個別資料。U-toolsは当面使用しない。
- 独自イベント公開DB：`poc/data/reviewed_events.v1.json`。元の効果文をそのまま配布せず、イベントID・分岐・報酬スキルID・公開可否を別々に検証して承認したレコードだけを反映。
- **2026-10-18現在の追加実装**：レビュー変換器は `chainVerified`、`rewardSemanticsVerified`、`selectionSemanticsVerified`、`publicationReviewed` をすべて要求。結果分岐の成功／大成功は `outcomes` に別々に記録し、同位置に無条件 `rewards` を同時記録することを禁止。Checker候補で選択肢が2件以上のとき `type:auto` への平坦化を禁止。公開イベントJSONの実イベントは引き続き**0件**。
- **公開前の最終ゲート（PR #70）**：`poc/config/event-release-approvals.v1.json` と実際の公開JSONを `node poc/tools/verify_event_release.cjs` で照合。全イベントのカードID・イベントID・SHA・6種類の根拠リンク・公開判断が一致しなければCIで拒否。**自動CIの合格は根拠そのものの独立性・ゲーム内正確性・転載権利を証明しない**。詳細は [公開手順](docs/checker-public-catalog.md) と [30311監査](docs/unreviewed-event-numeric-candidate-audit.md)。
- 旧v8.1の全実データ同梱HTMLはPublicに存在せず、再ビルド用旧入力は一部未移管。現行PoCと混同しない。

## 守るべきルール

1. **検証計画を作業前に決定する。** 少数サンプル・人工データ成功だけで全件性・実機品質をPassにしない。Issues／PRには対象母集団、A機構／Bデータ／C実機の事前合格基準、検証結果、残件を記載。
2. IDは可能な限りゲーム内IDを使い、類似名の自動統合をしない。カード名エイリアス24件は承認済みの**ソース表記対応**で、イベント正式IDの確認ではない。
3. 未収録・不明と、存在しないことが確認された状態を混同しない。スキル金白・イベント経路・成功率・打ち切りを推測で捏造しない。
4. 同一カードの同一スキルを通常ヒント＋イベントで2枚と数えない。金・白・○・◎は別スキル。間接カバーを直接提供枚数に加算しない。打ち切り・未設定の後続イベントは集計しない。
5. 第三者由来の実ゲームデータ、攻略文章、画像は、権利・利用条件を確認せずPublicへ追加しない。ブラウザGETや元コードのOSSライセンスだけで転載可能とは判断しない。過度な取得や保護回避を行わない。
6. ユーザー用のデータ更新ボタンは作らない。通常ヒント・スキル辞書は起動時直接取得＋IndexedDB検証済みキャッシュ。イベントは独自公開JSON。通常CIに頻繁な外部GETを追加しない。
7. 設定不正は確認付き初期化まで保存値を上書きしない。一般利用者不在の開発段階では旧ユーザー設定の保存ID・スキーマ互換を維持しない。ゲームデータのID照合は厳密に続ける。
8. 構文・人工データ回帰、公開元を使う限定的な実ソース検証、Pages実ブラウザ操作を区別して結果を記録する。実施していないものを「検証済み」と言わない。
9. 公開イベントの承認は `poc/src/event_review_compiler.js`、`poc/src/checker_candidate_pipeline.cjs`、`poc/src/public_event_catalog.js`、[レビュー仕様](docs/checker-public-catalog.md)に従う。最終的に `node poc/tools/verify_event_release.cjs` を必ず実行。依存・打ち切り・結果別報酬・ID・公開権利の未承認レコードを自動実装しない。
10. 変更によってソース版・例外が変わった場合は、旧監査値を現行網羅率として再利用しない。

## ユーザーとの作業連携（2026-10-17）

明示的な仕様判断・認可・端末の物理操作が必要でない限り、作業ごとに停止せず、調査→実装→テスト→PR→CI確認→マージ→Pagesデプロイ確認まで一連で自律的に進める。途中では簡潔な進捗を知らせるが承認待ちにしない。ユーザーにしかできないAndroid/Windows実機テストは、都度確認を求めず未実施一覧に蓄積し、区切りのよいときにまとめて依頼する。権利／ゲーム仕様の不確実な点を自動決定したり、未検証データを公開DBへ採用したりする許可ではない。

## 2026-10-17 スキル表示順の調査状況

[歴史マスターのdisp_order監査](docs/historical-skill-order-probe.md)で、2025年DBの2026年共通1,786 IDにすべて正値がある一方、同値214グループ・2026年に追加の353 IDがあることを確認。**ゲーム内UI順への採用不可、元データの2026年版順序と実ゲーム画面での少数対照が必要**。数値ID201012「後方釘付」は旧マスターに存在（UmaSim数値辞書では欠落）。新規`poc/tests/*audit*.test.cjs`を作るだけで通常CIに入らないため、`.github/workflows/ci.yml`のテスト対象も更新する。

## 2026-10-17 拡大サポカ通常ヒント照合（PR #39）

[最新版のクロスチェック記録](docs/expanded-card-hint-crosscheck.md)が正本。dareuma 2026-10-02の560カードをUmaSim 563へ553厳密+7レビュー済み別名で対応し、4凸通常ヒント3,986中3,965は混合Skills欄にもある。21名称(19枚)は別資料に未掲載だがUmaSimの誤りとは即断しない。2025年資料には21中14を補強する記述、残7は情報なし。対象外R 3枚(10146〜10148)は計29ヒント。資料はGameWithを上流と共有し得るため、ゲームの独立マスター照合とは区別。ワークフローを明示起動したときだけ一時取得し、2026リリースSHAで版を固定。アプリのスキル提示に混合イベント経路を追加しない。

## 2026-10-17 0〜4凸ヒント整合性と独立性能値

[サポカ全563枚×5段階・2,815行の整合性監査](docs/stage-hint-consistency-audit.md)で全5段階が各4,015通常ヒント、カードごとの段階間ヒント追加/削除0、ヒントLv/発生率補正の段階減少0。GameWith SSRエフフォーリアID30311の5段階ヒントLv補正(2,2,3,3,4)と発生率アップ(60,70,80,90,100%)が採用元とすべて一致。**他562枚の独立性能値・ゲーム正式マスター・条件付き固有は未完**。この不変性は2026-10-13固定版の性質であり、将来のゲーム仕様とみなしてアプリに段階別ヒントの扱いを削除しない。新ソースの変化は限定監査で検知し再確認する。

## 開発コマンドと引き継ぎ

- Node.js 22以上、データ独立のCIテストは [`ci.yml`](.github/workflows/ci.yml) を正とする（`poc/tests/`）。
- 直接取得の技術検証は `poc/tests/runtime.test.cjs`、金白の全件監査は `poc/tools/audit_skill_groups.cjs`、イベント候補は `poc/tools/build_checker_catalog.cjs`。オンライン実行は原則手動。
- リポジトリのPRには該当Issue、差分、再現手順と三軸ゲートのPass／Fail／未実施を記載し、未通過であれば残件を引き継ぐ。

**次の優先作業**：[近時点の独立金白照合](docs/independent-skill-json-audit.md)では322候補中321組が双方向ID・昇格順一致、残りの「抜山蓋世→規格外」はGameWithで名称対応確認。残る1組の数値IDの独立検証、Android/Windows実端末、Phase 1のカード・性能・表示順の全件監査は未完。[Pages Chromium実測](docs/pages-browser-acceptance-20261017.md)を参照。並行してPhase 2のイベントの全件性・分岐・報酬・公開条件を照合する。[ロードマップ](docs/roadmap.md)参照。

## 2026-10-17の追加引き継ぎ

[公開Pagesの受け入れ記録](docs/pages-browser-acceptance-20261017.md)に、**通信復帰後の実GET、破損キャッシュ2種類、更新版スキル辞書破損の拒否、初回データなし、IndexedDB拒否時のオンライン利用**のChromium合格結果を追記。実機Android・Windowsやブラウザ横断検証ではない。再現は[限定的Pages受け入れワークフロー](.github/workflows/pages-real-browser-acceptance.yml)で手動実行（通常CIで繰返しPublisher GETしない）。

2026-10-17追加：`poc/tools/audit_stage_hint_integrity.cjs` は6枚×5段階×2指標のGameWith表を固定レビュー値で照合する。ウイニングチケットID30012はGameWith表が基礎値のみ（固有補正+20は別扱い）。対象6枚以外の性能は未独立照合、詳細は[段階別監査](docs/stage-hint-consistency-audit.md)。

## 2026-10-17 Phase 2の歴史的マスター照合（PR #43）

[監査記録](docs/historical-event-story-audit.md)を正本とする。2025年固定master.mdbにはUmaSim現行563枚のうち495枚が存在し、gallery_flag=2のカード直結ストーリーIDが1,028件。Checker候補2,099との件数差はID30240(3対0)、30241(18対17・グループSSR)、30269(3対0)。Rのカード直結0件にはキャラクター共通経路の除外が大きく関係する。**歴史マスターのカード直結ストーリーIDはCheckerイベント見出しと1対1ではなく、正式ゲーム内全イベントIDの確証でもない**。旧データに存在しない現行68枚と共有イベントは別途監査。公開承認済み実イベント0件のまま。再実行は[限定workflow](.github/workflows/historical-event-master-audit.yml)を利用し、ゲーム生データをPublicへ追加しない。

## 2026-10-17 追補：共有キャラクターイベント（PR #44）

[歴史的ストーリー監査](docs/historical-event-story-audit.md)は2025年マスター内のsupport_chara_idによりキャラクター共通358行を確認。採用中の563枚で旧版にもある495枚は、カード直結か代表キャラ共通のストーリーIDを1件以上持つ。R135/135も共有のストーリーあり。**共有IDのカード別割当合計は独立イベント総数ではない**。グループカード複数構成員、イベント条件/報酬、2026年正式マスター未確認。2025年DBの存在確認を公開イベントの承認と混同しない。

## 2026-10-17 Phase 2：イベントタイトル指紋（PR #45）

[詳細](docs/event-title-fingerprint-audit.md)。旧masterのsingle_mode_story_data.idは内部行IDであり、text_data(category=181,index)の結合対象は**story_id**。この固定DBでカード直結1,028行のタイトルを100%取得。Checker 2026-10-17固定版とはSSR/SR旧1,017名のうち956件の同名一致（残61）。SSR30241は旧18／Checker17で同名一致15・旧のみ3・Checkerのみ2。生成したイベント名のSHAは監査の一時領域にのみ置く。タイトル一致を公式ゲームID照合済みとせず、旧版と異なる新カード、グループ複数構成員、イベント報酬・分岐・権利の未検証を保持。公開イベント0件。

## 2026-10-17：記号差の補助タイトル診断（PR #46）

[イベント名監査](docs/event-title-fingerprint-audit.md)。SSR/SR旧1,017名のうち厳密一致956、記号や空白・大小文字差を落とした補助一致985。SSR30241は厳密15対補助17、旧版だけの補助残り1、Checkerだけの補助残り0。**副指紋は正式ゲームIDの自動マッピングには禁止**。ゲーム内ID・分岐・報酬の独立検証が引き続き必要。外部サイトからの生データ・イベント文章・指紋を公開しない。

## 2026-10-17 Phase 2の未一致ストーリーID（PR #47）

[監査の正本](docs/story-residual-metadata-audit.md)。旧master 2025年のSSR/SR直結1,017イベント名とChecker 2026-10-17の候補2,099を比較すると、記号差無視の暫定名称一致985、旧側未一致32行（25枚、2残数は旧ID曖昧）。SSR30241の未一致は数値story_id=830241004、元DB内 event_category=4、show_progress_1/2/3=0。全旧側残差のevent_category=4だが**この生数値から発生条件・掲載要否・現行ゲーム内存続を推測しない**。2025年の一時取得DBと指紋をPublicへ保存せず、2026年マスターと独立照合するまで未承認。実イベント公開0件を維持。

## 2026-10-17：U-tools SSR30241の第三ソース照合制約（PR #48）

[調査記録](docs/utools-third-source-event-audit.md)。外部サイトのSSR30241個別ページでは見出し連続5＋ランダム13＝18件が可視であり、Checker17、旧master18と件数は比較可能。ただしGithub Actionsの単発GETでHTTP 403。アクセス制限を回避せずジョブからGETを外したため、**story_id 830241004の第三サイトでの見出し掲載は未照合**。人工HTMLのパーサ回帰は追加。取得が許されたローカルHTMLを直接渡せるツールはあるが、テキスト・ハッシュをPublicに追加しない。U-toolsをデータの運用・公開ソースに採用したわけではない。

## 2026-10-17：将来の新マスター差分ゲート（PR #49）

[poc/tools/compare_event_master_snapshots.py](poc/tools/compare_event_master_snapshots.py) は、2025年固定masterと、利用許可・出典・時点が確認できた別のSQLiteをローカルでID監査する入力ツール。旧SHAを確認し、不正テーブル・重複・孤児カード参照を拒否。現在、**2026年版の検証可能なSQLiteを持っていないので実データBは未実施**。ゲームデータファイルやタイトルをPublicへ同梱しない。[計画](docs/master-snapshot-differential-audit.md)。

## 2026-10-17 Phase 3：名前付き複数デッキ（PR #50）

[仕様・受け入れ基準](docs/named-deck-library-acceptance.md)。設定JSONは**v2**（decks.main/inheritの配列、activeDecksの選択ID、nextDeckId）。`poc/src/settings.js`がv1の単一デッキ構造を保持して変換し、未知カードや保存済み非選択デッキの不正も拒否。`UmaSettings.activeDeck(state,k)`から集計とカード編集を行い、`state.decks[k].slots`を再び用いない。各側50件以内、最後1件は削除不可、複製はdeep copy。通常CIのNode検証とChromium人工563枚を整備、実機Android/Windowsはまとめて受入れ。Phase 2の実イベント公開JSONは0件のまま。

## 2026-10-18 Phase 3 F-02：所持台帳と一括登録（PR #51）

[所持台帳の受け入れ正本](docs/owned-card-registry-acceptance.md)。設定はversion=3。ownedCardsは疎辞書で、未登録はキーなし、未所持は{status:'unowned'}、所持は{status:'owned',stage:0..4}。`poc/src/settings.js` がv1/v2を変換、未知カードID・余計なフィールド・範囲外の凸を拒否。所持凸は編成想定凸を自動変更しない。`live_app.js`の管理モーダルは36枚/ページ、絞り込み一致**全件**への一括適用には確認を必須。ピッカーの所持のみ絞り込みは表示限定で、未所持カードの編成を禁止しない。画像は権利未確認のため既存の略字表示、実画像グリッド・イベント経路検索は未実装。通常CIは人工563枚のNodeとChromium、物理端末未検証。公開イベント0件を維持。

## 2026-10-18：経路別のサポカ検索（PR #52）

[受け入れ正本](docs/card-route-search-acceptance.md)。`poc/src/card_search.js`は純粋検索関数で、`sourceStatus=verified_hints*` のカードの0～4凸の照合済みヒントIDと、公開イベント台帳で承認された`card.events`のスキルIDのみを検索に使う。`referenceSkills`やChecker候補・未承認イベントは混ぜない。所持一覧・編成ピッカーの複合絞り込みを共有し、ピッカー120枚固定から120枚/ページ方式へ。検索は到達や獲得確率の証明ではない。実イベント公開0件、画像は略字表示のまま、Android/Windows実機未受入れ。

[公式ゲーム画像の扱い](docs/card-image-rights-decision.md)：Cygamesのゲームプレイ静止画「共有サイト投稿」条件をサポカ画像の複製・GitHub再配布・外部CDN大量参照の包括許諾とみなさない。カードの略字アイコンを維持し、実画像グリッドは別ゲート未完として残す。

## 2026-10-18：スキル一覧の表示と全カード逆引き（PR #53）

[検証の正本](docs/skill-table-search-acceptance.md)。`poc/src/skill_table.js`で`core.combinedRows`の集計結果を**変更せず**表示フィルター・並べ替えを行い、`core.hierarchyRows`で親子を連続表示する。目標未カバーはrow.mainCover/row.inheritCoverにある`core.coverage`結果から指定scope別に判定（直接提供枚数の水増し禁止）。スキル逆引きは`UmaCardSearch.normalHintIds()`で検証済み0..4段階の和集合、`approvedEventSkillIds()`で公開承認済みイベントのスキルIDに限定。現行ステージでの取得保証ではなく、元のカード直接提供数の算定とも区別する。

## 2026-10-18 F-06/F-09: JSON import merge

See [settings merge acceptance](docs/settings-import-merge-acceptance.md). Merge performs schema validation on copies, adds imported decks and goal sets with unique IDs, preserves current selections and display settings, and keeps existing ownership records on conflicts. Only previously unregistered cards receive imported ownership records. Deck capacity: 50 per kind; goal set capacity: 100. Reject any invalid or over-capacity import atomically. Keep the original data unchanged until the user chooses merge or replacement in the preview.

## 2026-10-18：runtime source health（PR #55）

[仕様](docs/runtime-source-health-acceptance.md)。`poc/live.html` は起動時のカード・スキル・イベントを `UmaDemoData.meta.runtimeSources` に別々に記録。イベントJSON失敗時に空カタログをモデルへ代替適用しても `runtimeSources.events.mode='failed'` を維持し、`eventStatus='unavailable'` を付与する。`source_health.js` はブラウザの取得経路と現行採用モデルの構造を**表示**するだけで、マスターデータ網羅性の保証ではない。取得/再検証ボタンやソース配布は増やさない。

## 2026-10-18：六枠イベント管理（PR #56）

[受け入れ正本](docs/deck-event-overview-acceptance.md)。`poc/src/deck_events.js` は選択デッキ6枠の既存 `card.events` のみ読み、選択式未設定とイベント原文**未収録**を別状態として数える。イベント表示フィルターでも到達判定に使う先行イベントの全グラフは落とさない。`clearSlot`/`clearDeck` は選択済みイベントだけ消しカードID、凸、他デッキを変更しない。人工イベントのChromium注入を実ゲーム公開DBの裏付けとみなさない。実イベントDB0件・Android/Windows未受け入れ。

## 2026-10-18：distinct-card aggregate and stage-specific hint Lv（PR #57）

[正本](docs/phase3-gap-matrix-20261018.md)。集計の`count`はスキルIDごとに重複排除した**カードIDの数**。`providers`は物理スロットごとに保持するため、その数が`count`を上回り得る。カードの重複スロットがあっても重複スキル枚数を水増ししない。`directRoutes`で通常ヒントのLvが存在する場合は選択中stageに対応した検証可能なlevelBase+levelUnique+1に限り表示。未収録・不正数値の推測を禁止。F-01〜F-09の未受け入れ境界は上記マトリクスを参照。

## 2026-10-18 Stage hint external source audit (PR #58)

[Source review and limits](docs/stage-hint-consistency-audit.md). The pinned `poc/tools/audit_stage_hint_integrity.cjs` checks 12 distinct SSR/SR/R IDs, full normalized card names, rarity, and two values at all five limit-break stages. Respect `basis=base` vs `basis=total`: the six new SR/R entries compare GameWith's support-effect base columns, not unknown unique effects. Only the limited audit workflow fetches source. Never call the 12-card selected sample complete coverage of the other 551 cards or of the current in-game rules.

## 2026-10-18：Wiki Cargo numeric-card inventory cross-check（PR #59）

[記録](docs/wiki-cargo-support-id-audit.md)。限定実データ監査は`poc/tools/audit_wiki_cargo_supports.py`でUmaSim固定SHAとWiki Cargo `Game_Supports.support_id`（返却は `title['support id']`）の数値IDを直接照合。3 API GETで563/563が一致した。Wikiはライブのコミュニティ索引でゲームの最新正式masterやイベント本文そのものではなく、**独立したゲーム全収録保証ではない**。ページング・重複・差分があればFail Closed。コミュニティ索引の文章・画像・ゲーム原文はPublicへ保存しない。

## 2026-10-18：Wiki Game_Training_Eventは解説ページ索引（PR #60）

[受け入れ正本](docs/wiki-event-story-index-audit.md)。Wiki `Game_Training_Event` Cargoは`Template:Game_Training_Event_Definition`で登録された個別解説ページに対応する。**全ゲームマスターのstory_idではない**。2025年旧masterのSSR30241直結18件に対し、Wikiページ登録は0件。ページが無いことをイベント不在・Checker漏れ・削除と解釈しない。旧SQLiteの照合カラムは`single_mode_story_data.story_id`でありDB内部行`id`と混同しない。公開イベントDB0件のまま。

## 2026-10-18：Wiki rendered support-page numeric event links（PR #61）

[Provenance and acceptance](docs/wiki-masterdata-rendered-event-audit.md)。For card 30241, 18 story IDs in rendered Wiki Training Events links equal 18 canonical `single_mode_story_data.story_id` values in the pinned Oct 2025 master (5 chain, 13 other). Focus 830241004 is linked. A separately rendered Aug 2026 card 30311 has five IDs absent from all 2025 stories. **Neither fact proves current Wiki masterdata SQLite revision, live game story availability or event reward accuracy.** Never treat missing Cargo explanation pages as game-event absence, or reuse rendered event titles, dialogue and effects in the public catalog without a separate rights and content audit.

## 2026-10-18：Wiki JP masterdata/Cargo missing-index audit（PR #62）

[Audit evidence](docs/wiki-masterdata-cargo-gap-audit.md). Public `Module:Game/Contribution.listMissing` compares `masterdata.support_card_data` IDs (filtered id<9000000) against Cargo `Game_Supports.support_id`. A single bounded public expandtemplates request returned `Up to date!` for both Supports and Cards, i.e. no master-to-Wiki missing records reported. This is **one-way only**; it does not expose a masterdata SQLite revision/hash, game freshness or the inverse Cargo-to-master relation. Keep the schema-checking Python test fail-closed and never use this to promote unreviewed event content.

## 2026-10-18：Unreviewed numeric event-skill candidates（PR #63）

[Audit and limits](docs/unreviewed-event-numeric-candidate-audit.md). A pinned third-party JSON manifest provides 45 support records and 126 event candidates, including 124 card/story ID pairs and 2 non-story IDs. Cross-check only numeric/metadata against pinned UmaSim skill IDs and one Wiki 30311 public article. Two candidate numeric skill IDs 200831 and 200851 are absent from the pinned UmaSim skill registry. GameWith confirms one highest-success reward triple for event 30311, **not the lower-success outcome, other outcomes, occurrence probabilities or full event graph**. Third-party `selection:auto` means planning-tool automatic counting, NOT guaranteed in-game auto reward. Source extraction is private and redistribution rights not verified. No record from this source may enter `poc/data/reviewed_events.v1.json` without independent event-ID/branch/effect/rights validation.

## 2026-10-18：GameWith優先の追加決定（PR #73）

ユーザーは、攻略サイト間でSSR30311の絆・体力報酬の数字が異なる場合、**GameWith掲載値を暫定正として採用**する方針を選択した。詳細は [意思決定ログ](docs/decisions.md)、[30311監査](docs/unreviewed-event-numeric-candidate-audit.md)、機械可読の `poc/config/event-source-priority.v1.json` を参照。Game8との不一致そのものはリリースブロッカーではない。GameWithに存在しない項目は未解決（他資料を黙って採用しない）。**優先ソースの指定は、正式ゲームのデータID・イベント分岐・成功率・公開再利用権限の独立承認ではない。** 実公開DBのイベント0件を維持。

## 2026-10-18：SSR30311の開発用in-memoryプレビュー（PR #74）

[検証と限界](docs/efforia30311-preview.md)。`poc/src/efforia30311_review_preview.cjs` が **5イベント/11選択肢/連続最終6結果/スキル報酬18参照**のスキル経路を本番schema/core/skill bridgeへ投入して人工的に検証する。出典はGameWith 2026-10-08の記事とコミュニティWiki 30311 IDリンク。**本コードに載せた連続条件とWiki/記事の紐付けは仮**で、既定でデータファイルを生成しない。CLIは件数と残るゲートのみ出力する。**このプレビューを `poc/data/reviewed_events.v1.json` にコピーしないこと**。正式ID/連続/結果条件/公開表現・権利はIssue #72で未承認。
