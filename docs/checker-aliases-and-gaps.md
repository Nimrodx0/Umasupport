# UmaUmaCheckerとUmaSimの表記差対応（2026-10-16）

## 目的

SSR・SR計417枚のカード名表記が異なる場合、**推測による自動対応をせず、既知の一対一対応だけを適用**するための設定。データは [checker-name-aliases.json](../poc/config/checker-name-aliases.json)。

## 検証方法・結果

2026-10-16にUmaSim `support_card.txt` とUmaUmaChecker `Events.json` の実ファイルを照合。

- 厳密なUnicode NFKC・空白正規化＋レアリティ一致：393件。
- 残る24件（SSR21、SR3）：**すべてキャラクター名・レアリティが一致し、固有タイトルは記号を除けば同一か、編集距離1**の候補が一意。各候補を [差分監査ログ](https://github.com/Nimrodx0/Umasupport/actions/runs/38884305899) で検出し、明示的な名称対応として記録。
- 2026-10-16の [417枚全件確認CI](https://github.com/Nimrodx0/Umasupport/actions/runs/38906147236) は **厳密393＋明示対応24＝417/417、未照合0、未使用ソース0**。イベント候補2,099件、選択肢・効果行3,438件、同名イベント重複2レコード。
- これは**UmaUmaChecker上の表示名をUmaSimカードIDと一意に結び付けるための対応表**。イベントの正式IDや全経路の正確さ、ゲームの一次マスターデータによるID確認までは意味しない。

代表的な表記差：`Enchaînement` / `Enchainement`（アクセント）、`KNOCK 'EM DOWN!` / `KNOK'EM DOWN!`（綴り）、`冷凜` / `鈴凜`（漢字）、`王を統べて覇す者` / `王を統べて覆す者`（一文字差）、各種の括弧・句読点・記号。

**注意：** 今後UmaUmaChecker側でカード名称が修正された場合は、この対応表の値とソース名が一致しなくなり、監査はエラーまたは未照合を返す。名称が一致しなくなったからといって、別の近似候補へ勝手に付け替えない。

## 追加カード・イベント0件の扱い

[`gamewith-ssr-review-status.json`](../poc/config/gamewith-ssr-review-status.json) は、UmaUmaCheckerのイベントが0件だったSSR5枚について、GameWithの個別記事と**記事内のイベント詳細の掲載状態**だけを追跡する。

| UmaSim ID | GameWith個別記事 | イベント選択肢欄（2026-10-16） |
|---|---|---|
| `30302` | [SSRサトノダイヤモンド](https://gamewith.jp/uma-musume/article/show/561920) | 連続3件、通常2件を確認 |
| `30320` | [SSRアドマイヤグルーヴ](https://gamewith.jp/uma-musume/article/show/578818) | 取得した資料で詳細の有無を確定できず（未確認） |
| `30295` | [SSRカレンブーケドール](https://gamewith.jp/uma-musume/article/show/551779) | 「検証中」 |
| `30269` | [SSRダンツフレーム](https://gamewith.jp/uma-musume/article/show/516410) | 「検証中」 |
| `30240` | [SSRジャングルポケット](https://gamewith.jp/uma-musume/article/show/490549) | 「検証中」 |

上記は**GameWith上の公開ページの記載状態**であり、実ゲームにイベントが存在しないという意味ではない。特に「検証中」や「未確認」はデータ取得可能とは扱わず、個別記事に情報が追加されるまで対象を欠損として追跡する。ユーザーの方針に従いU-toolsは利用対象にしない。

`checker_gap_tracker.cjs` はカードが元ソースにない場合の `name-unmatched` とイベント配列が空の場合の `source-has-zero-events` を区別。次の新規カードも、一覧には登録されたが詳細イベントが未掲載なら欠損として検出する。

再監査：`node poc/tools/build_checker_catalog.cjs`。厳密一致だけを調べる場合は `--no-aliases`。必要なときだけ `--aliases <独自JSON>` で明示的な対応表を上書き。通常のCIでは外部サーバーへGETしない。
