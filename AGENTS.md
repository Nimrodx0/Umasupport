# 開発支援AI向け引き継ぎ

更新：2026-10-17。**本リポジトリの文書とコードが作業の正本**。チャットの発言や古いPoC記録で上書きしない。

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
9. 公開イベントの承認は `poc/src/event_review_compiler.js`、`poc/src/public_event_catalog.js`、[レビュー仕様](docs/checker-public-catalog.md)に従う。依存・打ち切り・報酬・ID・公開権利の未承認レコードを自動実装しない。
10. 変更によってソース版・例外が変わった場合は、旧監査値を現行網羅率として再利用しない。

## ユーザーとの作業連携（2026-10-17）

明示的な仕様判断・認可・端末の物理操作が必要でない限り、作業ごとに停止せず、調査→実装→テスト→PR→CI確認→マージ→Pagesデプロイ確認まで一連で自律的に進める。途中では簡潔な進捗を知らせるが承認待ちにしない。ユーザーにしかできないAndroid/Windows実機テストは、都度確認を求めず未実施一覧に蓄積し、区切りのよいときにまとめて依頼する。権利／ゲーム仕様の不確実な点を自動決定したり、未検証データを公開DBへ採用したりする許可ではない。

## 2026-10-17 スキル表示順の調査状況

[歴史マスターのdisp_order監査](docs/historical-skill-order-probe.md)で、2025年DBの2026年共通1,786 IDにすべて正値がある一方、同値214グループ・2026年に追加の353 IDがあることを確認。**ゲーム内UI順への採用不可、元データの2026年版順序と実ゲーム画面での少数対照が必要**。数値ID201012「後方釘付」は旧マスターに存在（UmaSim数値辞書では欠落）。新規`poc/tests/*audit*.test.cjs`を作るだけで通常CIに入らないため、`.github/workflows/ci.yml`のテスト対象も更新する。

## 開発コマンドと引き継ぎ

- Node.js 22以上、データ独立のCIテストは [`ci.yml`](.github/workflows/ci.yml) を正とする（`poc/tests/`）。
- 直接取得の技術検証は `poc/tests/runtime.test.cjs`、金白の全件監査は `poc/tools/audit_skill_groups.cjs`、イベント候補は `poc/tools/build_checker_catalog.cjs`。オンライン実行は原則手動。
- リポジトリのPRには該当Issue、差分、再現手順と三軸ゲートのPass／Fail／未実施を記載し、未通過であれば残件を引き継ぐ。

**次の優先作業**：[近時点の独立金白照合](docs/independent-skill-json-audit.md)では322候補中321組が双方向ID・昇格順一致、残りの「抜山蓋世→規格外」はGameWithで名称対応確認。残る1組の数値IDの独立検証、Android/Windows実端末、Phase 1のカード・性能・表示順の全件監査は未完。[Pages Chromium実測](docs/pages-browser-acceptance-20261017.md)を参照。並行してPhase 2のイベントの全件性・分岐・報酬・公開条件を照合する。[ロードマップ](docs/roadmap.md)参照。

## 2026-10-17の追加引き継ぎ

[公開Pagesの受け入れ記録](docs/pages-browser-acceptance-20261017.md)に、**通信復帰後の実GET、破損キャッシュ2種類、更新版スキル辞書破損の拒否、初回データなし、IndexedDB拒否時のオンライン利用**のChromium合格結果を追記。実機Android・Windowsやブラウザ横断検証ではない。再現は[限定的Pages受け入れワークフロー](.github/workflows/pages-real-browser-acceptance.yml)で手動実行（通常CIで繰返しPublisher GETしない）。
