# GameWithイベント記事のオフライン解析パイプライン（2026-10-19）

## 実施範囲と利用条件

対象は、GameWithの個別サポカ記事から**元文章を転載せず**、スキル・ヒントLv・選択枝順などのゲーム上の事実を独自JSONの**草稿候補**として抽出する処理。現時点でコードにWebアクセス機能はない。自動スクレイピング・一斉ページ取得・GameWithのHTML保存公開・生成した草稿の無審査公開は**実施しない**。

確認したもの：
- [GameWith日本語版利用規約](https://gamewith.jp/terms)（2024-05-16改訂版、第9条14号の過剰なサーバー負荷、第9条17号の提供機能の複製・解析、第10条の知財権帰属）。
- [GameWith robots.txt](https://gamewith.jp/robots.txt) はsitemapを表示。robotsで禁止されていないことはアクセス許可・再配布許可を意味しない。
- [GameWith英語版創作ガイドライン](https://gamewith.net/guidelines) は明示的に**gamewith.jpを適用対象外**としている。このガイドを日本語記事収録の権利根拠に使わない。

大規模・反復収集に先立ち、GameWith側に自動取得の方法、頻度、加工データの公開範囲について照会し、適切な許諾条件または別の適法な取得方法を確定すること。**全件取得に懸案がない状況ではないため、563枚を一括HTTP取得していない。** 解析器は、条件が満たされて合法的に準備された**ローカルの本文テキスト／HTMLファイル**を受け取る。

## 新規実装

- `poc/tools/import_gamewith_article.py`：1記事のローカルMarkdown／可読テキスト／一部HTMLを読み、UmaSimカードID・レアリティと記事見出しを突き合わせる。出典URLを索引から照合し、通常イベントの選択枝と『スキル』ヒントLvを辞書IDに照合して元文章を含まないJSON**提案**を保存する。未知IDはスキル名・Lvを未照合として保持。
- `poc/tools/batch_gamewith_import.py`：全UmaSimカードを並べ、既存索引URL・ローカル資料・提案済み・解析拒否を区別する。将来、権利面と資料準備が解決すれば、適法に保有するカード記事群の入力を1回のコマンドで処理できる。**自動リンク推定はしない**。
- `poc/tests/test_gamewith_article_import.py` と `test_gamewith_batch_import.py`：すべて架空の記事を使用。カード混同、別レアリティ、記事抜け、未知スキル、成功・失敗、連続イベント、HTMLテーブル、差分などを検査。

**安全な一段階目**：単純な通常イベントのみ提案。連続イベント・成功／失敗／大成功・継続／打ち切り・ヒント表記をパースできない分岐は**手動確認リスト**へ。これらを自動的な `type:auto` の確定報酬にしない。出典記事と草稿JSONの原本内容が一致すること、記事が全イベントを列挙していることを機械だけでは証明できない。

## ローカル実行

外部記事本文をリポジトリに入れない。 `poc/inputs/`, `local-data/` は `.gitignore` で無視する。実際のファイル名例：

```text
poc/inputs/gamewith/
  10003.md
  10004.html
```

外部由来の実記事は**権利のある保存方法で用意した場合に限り**配置。誤登録の予防として `--source-index` に登録されていないカードIDを解析しない。取得可能な元記事URLが確定しない残り543枚は、まず出典URLを台帳へ追加する必要がある。

```bash
python3 poc/tools/import_gamewith_article.py \
  --card-id 10003 \
  --article-file poc/inputs/gamewith/10003.md \
  --support-card local-data/umasim-support-card.txt \
  --skill-data local-data/umasim-skill-data.txt \
  --existing-draft poc/data/curation/drafts/10003.v1.json \
  --output local-data/gamewith-proposals/10003.proposal.json

python3 poc/tools/batch_gamewith_import.py \
  --support-card local-data/umasim-support-card.txt \
  --skill-data local-data/umasim-skill-data.txt \
  --input-dir poc/inputs/gamewith \
  --out-dir local-data/gamewith-proposals
```

必要なUmaSimファイルは既存の固定取得元にあるものを利用する。プログラム自体はこれらのファイルやGameWithページをネットワークから取得**しない**。出力ディレクトリと入力ディレクトリは同一にせず、ユーザーが確認できる提案JSONと `batch-report.json` を作成するだけ。本番DBへの反映はしない。

## 収録時の必須確認

1. 出典URLが特定カードを示し、カードの二つ名・レアリティが一致しているか。別カード、特に同キャラ別レアリティなら拒否。
2. `observedEventHeadings` と `proposedEvents` の差がどこで生じたか。連続イベント、未確認の結果依存、読み損ねのイベントが残っている状態で「全件完成」としない。
3. `comparison.status` が `identical` 以外なら手動で元記事と既存草稿の分岐・報酬を再照合。記事更新時の差分で自動上書きは禁止。
4. `unresolvedRewards` のIDを原本辞書＋草稿専用補完台帳で確定する。補完に根拠が不足した場合は未解決として保持し、虚偽の数値IDを作らない。
5. 元記事のテーブル構造の変更、複雑な選択肢や発生条件、ページにない記事IDは**解析不能**として記録。正常終了やJSONファイル数を100%信頼性と解釈しない。
6. 既存の `curated_event_inventory.cjs` と公開承認ゲートによる確認を継続。編集用提案は承認済みDBにも通常アプリにも直接読み込ませない。

## 現在の状態

固定UmaSimのサポカ母数は563枚。GameWithの個別記事URLの索引があるのは20枚、独自草稿も20枚・47イベント。残り543枚は記事紐付けから未収録。今段階の自動解析結果は**架空のユニットテストのみ**であり、GameWith現行HTMLを取得・バッチ変換できると実証したものではない。

次の実装の入口：許諾等が整えば、R/SR/SSR各1ページを安全な方法で取り込み、本番HTMLのDOM表現を使った構造テストを追加し、複雑な分岐も解析する。成功率・差分率・未解決スキル率を確認してから、対象を20、100、563へ段階的に広げる。**数が多いだけの誤データを採用しない。**
