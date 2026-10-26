# Phase 2：2026-10-26 UmaSimのサポカ母集団 563→566 の固定元独立監査

## 発見と背景

2026年10月26日 11:34 JST に [UmaSimサポートカード元 `data/support_card.txt`](https://github.com/mee1080/umasim/blob/910dd79f046710245e0cc88a09c5c92b1044897e/data/support_card.txt) が更新された。2026年9月30日19:23 JSTの[直前固定版](https://github.com/mee1080/umasim/blob/91952973eb334ae530b8cd76541bce8a01a141cd/data/support_card.txt) と比較したところ、**563→566カード**（各性能解放0～4の5行：2815→2830行）。元563カードの属性・通常ヒント・各5段階数値は1行も変わっておらず、3カード各5行だけが追加された。

| 数値カードID | 新規サポカ名（カード固有表記） | レア度 | タイプ |
|---|---|---|---|
| `10149` | [巫女]吾妻 | R | 友人 |
| `30322` | [Time of Departure]マヤノトップガン | SSR | パワー |
| `30323` | [いとどめでたき、まつりかな]吾妻 | SSR | 友人 |

[株式会社Cygames当日の新シナリオ発表](https://prtimes.jp/main/html/rd/p/000001319.000005593.html) と、[当日新サポカSSR告知](https://www.gamer.ne.jp/news/202610260003/) はこの追加と整合する。Cygamesの公式発表はゲーム内実装を裏付けるが、**現行ゲームの「全カード565/566枚を保証する」ための独立全数証明ではない**。ここで厳密に確認したのはUmaSimの同日固定元2版の差分のみ。

## 再現可能な技術監査と公開範囲

- [`poc/src/current_umasim_roster_delta.cjs`](../poc/src/current_umasim_roster_delta.cjs) はGitのblob SHA-1を検算した上で、旧版563枚と新版566枚を**既存の公開Webアプリ用 `UmaLiveLoader.parseSupportCards` と `UmaLiveLoader.buildModel`** に直接通す。
- 比較前ピン：コミット `91952973eb334ae530b8cd76541bce8a01a141cd`、Git blob `215b1922fd385895acc48af583db41e32b69ff58`。
- 比較後ピン：コミット `910dd79f046710245e0cc88a09c5c92b1044897e`、Git blob `3a9204291615ce0c3573bf91e388e6ba48854848`。
- 旧563全カードの全5段階データをJSONベースで完全比較し、削除・変更を拒否。新カードは新ID・日本語名・タイプ・レア度を独立確認。**live loaderが566モデルを生成できる**ことをNodeで検証。
- 公開サイトは従来から `https://raw.githubusercontent.com/mee1080/umasim/main/data/support_card.txt` を起動時に直読みし、構造が有効なら採用する。**GitHub Pages形式のサブパスで実Chromiumを起動し、566枚の受信・収録状況と新3カードすべての検索／本育成・継承デッキ登録を確認済み**。これは実際の配信ドメインではなくローカルサーバー上の画面、スキル辞書は合成テスト用である。Windows/Android実機は未実施。
- 新カードの`events:[]`と通常ヒントの存在は区別する。**新3カードのイベントが正式に公開承認済みであるわけではない**。既存固定GTのイベント全体2,488とそのイベント候補2,512は旧母集団に付く別スナップショットであり、今回の新カード3件を元GTイベントへ自動的に結び付けない。
- 元ファイルはCIの `$RUNNER_TEMP` へ**2ファイルだけ**ダウンロードし、ワークフロー終了後破棄。外部のマスターデータ全文やゲーム画像をレポジトリ／Pages／添付に含めない。出力は新カードのID・名前・カード数・チェック結果のみ。
- A：[合成差分Nodeテスト](../poc/tests/current_umasim_roster_delta.test.cjs) で500→501カードの共通ロード、カード・段階・通常ヒント変造の拒否とblobピンを検証。
- B：[固定UmaSim差分GitHub Action](../.github/workflows/current-roster-audit.yml) で563→566の実データ2本を検算。固定GT2,488イベントや全563スキル経路の試験は別の [固定GT監査](../.github/workflows/whole-event-inventory.yml) として維持。
- C：[実Chromiumテスト](../poc/tests/browser_current_umasim_566.cjs)で、固定新TSVと合成スキル辞書を起動時の外部取得URLにだけ注入し、GitHub Pages同形式のサブパス `/Umasupport/` から実際の `poc/live.html` を起動。データ収録状況566/566枚、新3カードの検索と本育成2枠・継承育成1枠への登録、ローカル保存、未承認イベントが0件のままであることを確認。**実GitHub Pagesドメインへのアクセス・Windows/Android物理端末は未試験**。公開イベント0件は不変。

## 工程上の意味

これまでの「全GT2,488イベント中2,472が構造化可能」という高い比率は、**固定時点のGT元2,488イベントの変換率**であり、現在のUmaSim566カードや最新ゲームへのイベント網羅率を意味しない。サポカの通常ヒントはlive-loaderで最新元を受け取れるが、新カードに対応するイベント、選択肢、スキルIDとの独立照合・承認イベントの実運用は未対応。

**次の実作業**：新3カードの個別GT/GameWithイベント情報と技能辞書IDの採用・母集団監査を独立に実施する。既存の563/559/2488ピンを説明なく566へ読み替えたり、全件テストの母数を単純に書き換えるだけで「完了」扱いにしない。以前の[全件お出かけ統合](phase2-outing-unlock-terminal-batch-20261026.md)と同じくA/B/Cを区別する。
