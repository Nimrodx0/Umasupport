# Phase 2: SSR30321のGameWith編集採用を実データへ移す（2026-10-22）

## 対象と出典
- 基準の固定GT: `systemless10/UmamusumePS@6e38b54af4fad397ff4491e63007a90705a4fe67`。この固定版にSSR30321のイベントJSONはなく、イベントがゲームに存在しない意味ではない。
- 対象カードのGT掲載確認: https://gametora.com/ja/umamusume/supports/30321-duramente （2026-10-22、イベント一覧まで確認した過去監査）。
- 欠損項目の採用正本: https://gamewith.jp/uma-musume/article/show/578817 （2026-10-22閲覧、記事の表示更新日2026-10-12）。
- 先行裁定: [PR #164](https://github.com/Nimrodx0/Umasupport/pull/164)、[4SSR個別検証](phase2-four-ssr-cross-site-editorial-review-20261022.md)、[採用契約](event-adjudication-enforcement.md)。

## 今回の編集データ

`poc/data/curation/adjudicated/30321.v1.json` に**イベント5件**を再配布本文なしの数値・選択位置のみで格納した。連続段階3件（2択／選択肢なし／選択肢なし）、通常2件（ともに2択）、ヒントの数値記載は2件（連続3段階目201463 Lv1、通常2件目202602 Lv1）。スピード・体力・やる気・絆等の報酬数値はスキル集計対象外でも出典監査に保持する。従前の30321/2・3に対する共通契約の編集裁定も数値照合して維持。

`poc/src/phase2_editorial_intake.cjs` は全5件を `evaluateException` へ通した後、**連続3件の先行結果・打ち切り条件が未確証**であることを尊重し、公開モデルへ無条件投影しない。通常2件だけを、元の文章を含まない**メモリ内の非公開ドラフト形式**に組み立てる。ステージ3のヒントがステージ2以前の選択なしで確定的に集計される問題を防ぐため、連続ヒントは投影していない。通常イベントの数値報酬も、各選択のスキル候補のみをアプリスキーマへ投影し、能力・絆等は監査情報として残す。

これは**編集上の採用5件、通常イベント草稿2件、正式公開0件**という異なる数値である。GameWithを指定の編集裁定元として用いることに第二サイトや実機の追試は要らない。ただし、旧GTスナップショット全体の穴埋め、ゲーム内の結果確率、連続内部の前段終了条件、公開利用の判断を意味しない。

## 再実行と受け入れ区分
```sh
node --test poc/tests/phase2_editorial_intake.test.cjs
node poc/tools/report_phase2_editorial_intake.cjs
node poc/tools/verify_event_release.cjs
```
A: 採用契約、固定母数、改変拒否と実際の `core.directRoutes` で選択式報酬の混入防止を検査。B: 30321の対象5件に限定したGameWith掲載事実の編集照合。全563枚を新しく監査した意味ではない。C: メモリ内のNodeのみ。公開Pages・物理Windows/Android・実ゲームでは未確認。

正式公開へ移すには連続先行段階の不明点を解決し、独自表示・再利用判断・カード／イベント／選択／結果／依存／公開についての承認証跡を `event-release-approvals.v1.json` に作る必要がある。**本PRでは承認ファイルと `reviewed_events.v1.json` は変更しない。**
