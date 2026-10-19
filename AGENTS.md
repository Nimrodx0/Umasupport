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

## 2026-10-18：数値メタデータのPublicコードと配信用実データを区別

[SSR30311プレビュー](docs/efforia30311-preview.md)は開発用in-memoryデータを組み立てるため、**そのビルダーのソースコード内の5 story IDと8スキルの数値ID/名称/ヒントLvはPublic GitHub上で読める**。これは公開アプリの `reviewed_events.v1.json` に掲載し、獲得可能性を保証することと区別する。GameWithの原文・選択肢文面・ゲーム画面・画像を含めていないが、数値等の事実情報をPublicに限定掲載したことを第三者コンテンツの包括利用許諾と呼んではならない。利用者に提供する正式なイベントDBは、別途6観点の出典・条件・公開判断をレビューしてから採用する。

## 2026-10-18：5イベントのWiki見出し↔9桁story_id監査（PR #76）

[poc/tools/audit_efforia30311_wiki_title_links.py](poc/tools/audit_efforia30311_wiki_title_links.py) はWikiのSSR30311レンダリング記事について、GameWith記事と一致する5イベント見出しに隣接する9桁リンクが、`830311001/002/003`・`801146001/002` の仮対応に一致するか検査する。人工HTMLは通常CI、実Wiki 1ページは外部監査専用ワークフロー（既存GET再利用）。このチェックだけで現在ゲームのイベント分岐や取得条件が承認されたわけではない。ゲーム実装確認・権利・連続条件の未解決はIssue #72へ。

## 2026-10-18：SSR30311 数値スキル辞書直接検査（PR #77）

`poc/src/efforia30311_skill_registry_audit.cjs` とCLIは、プレビューの8スキル番号／名称と18報酬行を実際の固定UmaSim `skill_data.txt` 全件に対して直接照合する。人工テストは通常CI、実ソース検査は外部取得済みファイルを再利用する専用Actionsで行う。**IDと名称が一致しても実ゲームでの選択肢効果を独立に証明したわけではない**。Wiki名↔IDのrev74431リンク検証はPR #76 / [Actions #39142566896](https://github.com/Nimrodx0/Umasupport/actions/runs/39142566896)で成功。

実ソース実測：[限定Actions #39142875109](https://github.com/Nimrodx0/Umasupport/actions/runs/39142875109) でSSR30311の8スキル番号/名称が固定UmaSim `skill_data.txt` 全2,139件に対して**8/8一致**、全18ヒント候補を形式検証。数値辞書SHA-256 `b7ba1d6c5dd2af9ed1f4e649f16ec1d319198e2f1ac9db07c54e14d29f0b25ec`。**この結果でGameWithイベントの取得条件や出版権利が承認されたとは扱わない。**

## 2026-10-18：本番UIを使うイベント開発試用モード（PR #78）

プレビューデータ `poc/data/preview/efforia30311.v1.json` は**未承認**で、[専用URL](https://nimrodx0.github.io/Umasupport/poc/live.html?eventPreview=30311)からのみ `poc/src/event_preview_loader.js` を介して読み込む。元記事の選択肢原文や画像は含まず、既存SSR30311の番号ラベルのみ。**通常の `poc/live.html` と `index.html` は候補0件、通常JSON `poc/data/reviewed_events.v1.json` は空のまま。** 試用時のlocalStorageは通常版と別キー。現行UIで編成→選択肢→成功/大成功別スキル経路を操作できる。ビルダーとJSONの構造一致はNode回帰、Chromium人工サポカ全563枚で実ブラウザの導線を検証。ユーザー未承認イベントのゲーム正確性・終端条件・利用権利を承認したものではない。次カード追加時はプレビューレジストリの明示的許可と元記事・辞書・経路根拠を維持。

## 2026-10-19：イベントの未確認事項をUIで細分化しない（利用者判断）

**禁止するUI追加：** GameWith掲載条件／結果依存／進行条件未確認の3分類を、イベント・スキル一覧のバッジ／専用列／絞り込み／説明パネルとして実装しない。調査状況は `docs/decisions.md`、`docs/efforia30311-preview.md`、必要な監査書類だけに記録する。利用者向け表示はスキル、ヒントLv、選択肢、成功・大成功など**経路の理解に直接必要なゲーム上の分岐**に留める。既存の試用版と正式版の区別に必要な最低限の注意書きは可。GameWith優先の内部方針・取得条件の調査残件・公開承認の必須要件は継続し、表示省略を無根拠な事実認定の口実にしない。

## 2026-10-19：45カード候補プレビュー導線（PR #80）

開発用の複数カード試用URL：`poc/live.html?eventPreview=expanded`。 `poc/src/community_candidate_preview.js` は固定CommitのTsuyuchan `events.json` を**実行時直接GET**し、SHA256 `ac3febaad945b4046a137ff6d1d650b6b6def9ae02a891be936e30735956bfd4` を検証。本文・画像を同梱せず、正式story_idのない2件／辞書未登録報酬の2件を除外する。他44枚119候補は `type:choice` の**手動選択**に変換（外部 `selection=auto` はゲーム内自動獲得ではない）。SSR30311は旧版の5候補と置換し、計45枚124イベント候補。通常版0件、獲得正確性・GameWith各カード照合・再利用条件は未承認。ユーザー向けには監査分類を増やさない。

## 2026-10-19：イベント正本をGameWith-firstの独自DBへ移行（PR #81）

最優先は[カード単位の独自収録工程](docs/curated-event-intake.md)。外部Tsuyuchan45枚124候補の試用は参照実験として維持するが、本番イベントデータの網羅率に加算**禁止**。新規のpoc/data/curation/source_index.v1.jsonはカードIDとGameWith記事URL・調査日・JSON草稿の索引。poc/src/curated_event_inventory.cjsとCLIが全カード母集団・数値スキル辞書・個別草稿の整合と未入力数を監査する。SSR30311 5件に加えR10016 2件の原稿を新規入力、正式ゲームイベントIDが未確認ならdraft_ IDを使い本番に自動昇格させない。公開JSONは0件。GameWith.jp利用条件の確認なく大量クローリング・記事や画像の再配布を開始しない。画面への検証ラベル追加も行わない。UmaSim通常ヒント・スキル辞書の直接取得は従来どおり。

## 2026-10-19：R/SRの第一独自イベントデータ収録バッチ（PR #82）

[出典と既知の欠損](docs/curated-event-intake.md)を参照。GameWith個別記事に直接当たり、固定UmaSimサポカIDに照合して、独自JSON草稿9枚24イベント。内訳 R6枚12、SR2枚7、SSR1枚5。GameWith原文は同梱しない。SR20029の通常イベント1件（「直線コース◯」）はID照合未完なので**草稿に入っていない**。ないことがゲームにない証明ではない。Rの取得選択肢位置とLv、SR打ち切り・連続進行は回帰テストで固定し、今後もGameWith・UmaSimと照合する。通常版のイベント公開0件と、外部候補45枚の試用は変更しない。新しい草稿は`poc/data/curation/source_index.v1.json`と各`drafts/*.json`へ入力し、CIの実ソース監査を合格させる。

## 2026-10-19：イベント用スキルの全辞書解決・未照合原稿（PR #83）

**要点**：サポカ通常ヒント名が存在しない≠ゲームにスキルが存在しない。草稿用の `poc/src/curated_skill_resolution.cjs` で固定UmaSim `skill_data.txt` 全normal/rare数値IDを照合。 `hint:名前` も完全辞書にある正確な単一IDへ変換してから `skill_bridge.prepare` へ渡す。「○」「◯」は検索時のみ同一視。欠損や同名ID複数は推定せず原稿の `unresolvedRewards:[{skillName,level}]` を保持し、CLIでpending件数と場所を報告。一般用イベントスキーマと公開SHAゲートは未照合報酬の公開を拒否する。20029通常1選択肢2を復旧して**9枚25候補**、本番イベントDB0件。IDを手作業で創作しない。今後も通常ヒントリストだけで存在判定しない。

**実監査による更新:** SR20029の未照合は固定UmaSim全辞書 `202992` で解決したので、元草稿にも正規数値IDを保存済み。R10073「後方釘付」が固定全辞書で未解決のため、イベントと選択肢を残し `unresolvedRewards` で保持中。実草稿9枚25イベント・未解決報酬1件、公開0件。最新の固定UmaSim 2,139件にないことはゲームに存在しない証明にならない。

## 2026-10-19：イベント専用スキル数値ID補完とR収録バッチ（PR #84）

GameWithはR10073カレンチャンの後方釘付Lv+1を掲載。Wiki公開Game:Skills/201012に数値IDがあり、固定UmaSim全辞書に名称がないため`poc/data/curation/supplemental_skills.v1.json`へ草稿専用補完として収録。 `poc/src/curated_skill_resolution.cjs`が補完台帳を検証、`curated_event_inventory.cjs`が`mergedSkillText`で検査するときのみ利用。実行時スキルDB・承認済みイベントJSONには追加しない。元辞書とのID/名称衝突、補完根拠URLの改竄を拒否。R10001/10050/10061/10087各2件の独自草稿を追加し計13枚33件、未着手550枚。通常ヒント提供スキル名にあるからといって全辞書にあると仮定しない。利用者画面に監査バッジは追加しない。

## 2026-10-19：GameWith-first初回20枚バッチ（PR #85）

新規RカードID10003,10004,10005,10006,10007,10008,10009の通常イベント各2件、計14件を一次記事から選択肢順に記録。合計20枚47イベント、R17/SR2/SSR1、未着手543枚。新規イベントスキルの上/下、ヒントLvを`poc/tests/curated_event_inventory.test.cjs`に固定し、外部全スキル辞書との構造監査を継続。記事文言・画像の転載はしない。承認本番0、補完ID201012は草稿監査のみ。閲覧者向け未確認ラベルの追加は禁止。

**初回20枚バッチでの補完ID追加：** Rグラスワンダー（10009）の通常2上にある「先行駆け引き」は固定UmaSim全数値辞書の名称で未照合だったため、公開Wiki <https://umamusu.wiki/Game:Skills/200801> のID`200801`、GameWith <https://gamewith.jp/uma-musume/article/show/257960> の名称・効果を別資料として確認。草稿専用補完台帳へ数値ID `200801` を追加、R10009の対象枝も `skill:200801` で記録。現在の編集用補完はID`200801`と`201012`の2件。公開本番スキルDBはまだ拡張していない。オフライン監査での未解決スキル数を0へ戻し、補完を外したら数値ID未照合として検査失敗させる。

## 2026-10-19：GameWithオフライン収録器（PR #86）

詳細 [docs/gamewith-offline-ingest.md](docs/gamewith-offline-ingest.md)。 `poc/tools/import_gamewith_article.py` はユーザーが合法的に用意したMarkdown/HTML/可読テキストを**ローカルからのみ**解釈し、通常イベント枝を候補JSONとして提案。 `batch_gamewith_import.py` は固定UmaSim全563枚のカードごとにソース紐付け・欠損・解析状態の一覧を作る。GameWithへのHTTP取得は一切実装していない。記事タイトル／レアリティ／SR,SSR二つ名を照合し、報酬名を全数値スキル辞書・補完台帳と突き合わせ、結果依存や連続分岐は自動獲得にせず要手動へ。CIは架空例によるPythonテスト。生ページのHTMLでの正常率は未検証。 `poc/inputs/` と `local-data/` はGit除外。元JSONを上書きするコードは禁止、元記事原文も同梱禁止。GameWith日本語規約のWeb参照では大規模取得の権利を確認できていないため全件GET未実施。既存草稿20枚47件・承認0件。

## 2026-10-19：オフラインGameWith候補の連続・成功分岐解析（PR #87）

詳細は [docs/gamewith-offline-ingest.md](docs/gamewith-offline-ingest.md)。 `poc/tools/import_gamewith_article.py` の `manualCandidates` に、SR連続各段・SSRの成功／大成功による異なる数値スキル／Lv報酬を保留データとして残す。公開 `proposal` へ昇格させず、到達条件・打ち切り・出典差は人手で確かめる。未処理の通常イベントによる仮IDの再採番を修正し、差分比較でイベントIDとresult treeを照合。テストは人工R/SR/SSRモデルのみ。実サイトの563枚一括HTTP取得やGameWith記事原文の再配布は禁止。

## 2026-10-19：SSR30003／SR20043の条件分岐実例追加（PR #88）

サポカ個別記事から選択肢原文を除いたスキル・ヒントLv情報を草稿へ登録。SSRトウカイテイオー30003は連続3段が自動イベントで、最終段にskill:200371、一方SRスペシャルウィーク20043は連続2段目の成功だけでskill:201902。報酬獲得保証やゲーム内部story IDは推定しない。全カードの編集草稿は22枚56件、未着手541枚、承認公開0件。主要複雑構造の検査をpoc/tests/curated_event_inventory.test.cjsで保証し、出典はpoc/data/curation/source_index.v1.jsonに登録。記事本文・画像の複製は禁止。

## 2026-10-19：選択肢なし・成功/失敗を解析候補に残す（PR #89）

 `poc/tools/import_gamewith_article.py` は、GameWith記事の「選択肢なし | ...」1行イベントを編集専用の `manualCandidates` に `eventKind:'auto', facts:{rewards/outcomes}` として保持する。成功＋失敗と成功＋大成功の結果区別をできるだけ完全に保ち、1種類のみの結果や未解析ヒントは要手動審査。到達条件を推測して `proposal` に移さない。人工テストは `test_gamewith_article_import.py`。カード草稿22枚56件／本番0件、実GameWithの大量GETは未実施。

## 2026-10-19：GameWith HTML結果分岐の部分欠損防止

オフライン記事解析ではHTML表セル内の `<br>`/`<div>` 等を結果境界の改行として保持する。複数のヒント記載があるセルで一部だけ正規表現に一致した場合は**候補を部分採用しない**。成功・失敗の最初のラベルより前に存在するヒントの適用先を推測しない。人工HTMLテストで検証。引き続きGameWithへHTTP取得を追加しない、未確認分岐を公開DBへ自動昇格しない。収録22カード56草稿・本番0件。

## 2026-10-19：GameWithバッチ出力の隔離

`batch_gamewith_import.py` のCLIと公開関数 `plan_and_import` は、提案出力先が記事入力元または `poc/data` に重なるとき（親・子・同一・解決後のパスを含む）実行前に拒否する。通常の `local-data/gamewith-proposals/` は許可。出力先を `poc/data` に変えて未承認のイベント候補を配信用に混入させる運用は禁止。人工のバッチテストで不正な出力先を検証。ユーザー向けUIと公開イベントDB0件は不変。

## 2026-10-19：GameWith実記事型のカード識別に対応

記事見出しに `(SSRサポート)` が無くてもSSRスピード・イベント配布型SR等の個別記事を扱えるよう、`import_gamewith_article.py` が `### キャラクター(SR/SSR)の性能`、レア表、二つ名の一致を要求する。存在するレア欄・二つ名が固定UmaSimカードに矛盾したら即拒否。架空の実形式HTMLによる単体テストを追加。GameWithの生DOM全件受入テストではない。記事取得・コピー・自動公開の従来制限を継続し、UIの監査ラベル等は増やさない。

## 2026-10-19：GameWithソース台帳の衝突・ファイル誤対応を全件拒否

`import_gamewith_article.py` の共有 `validate_source_index()` を単体収録とバッチ収録の両方から必ず呼び、出力前に台帳全件を検査する。カードID・URL・草稿相互の一対一対応を要求する。URLの重複割当、同一草稿の重複割当、草稿パスへの別カードID紐付け、プレビューファイル名がカードIDを識別できない場合、許可外パスは拒否。ローカル記事0件でも拒否。手作業で不整合を隠して網羅率を増やさず、通常公開0・GameWith一括自動取得禁止を維持。

## 2026-10-19：イベントHTMLの欠落行をFail Closed

`ArticleBlocks` はHTMLイベント表の1セル・3セル以上・未閉鎖行・重複した行開始を内部マーカーで検出し、イベント欄に現れた場合は `article_to_facts()` が提案全体を拒否する。カードの能力比較表などイベント欄より前の多列データは無視する。2選択肢だけ抽出できても第3選択肢が落ちている可能性を無視して本番候補へ進ませない。人工HTMLテストで検証。独自草稿数・公開0件は不変。

## 2026-10-19：Rカード6枚の独自イベント草稿追加（PR #95）

GameWith個別R記事と固定UmaSimカードIDを照合し、R10010〜10015に各2通常イベント・合計12草稿を追加。いずれも非スキル効果・選択肢原文・イベント見出しをコピーせず、選択肢順とスキルヒント1件/カード（Lv+1）のみ編集用JSONに記録。正本 `poc/data/curation/source_index.v1.json` に6 URL、草稿 `drafts/10010.v1.json`〜`10015.v1.json` と回帰を追加。総計28枚68イベント、未着手535枚（R23/SR3/SSR2）、公開0件。ヒント名は固定UmaSimの実データ監査で検証し、未確認IDを推定しない。事実の出典・限界は `docs/curated-event-intake.md`。未確認バッジなどUIの分類追加は行わない。

