# Wiki Cargo によるサポートカードID全件のクロスチェック（Phase 1）

確認日：**2026-10-18（日本時間）**。対象はカードの**数値ID集合のみ**。公開イベント候補やゲーム内アセット、選択肢、画像は取得・配布していない。

## 異なる2ソースと収集手順

- **採用ソース：** [UmaSim `support_card.txt` 固定版](https://github.com/mee1080/umasim/blob/cf9366f6a487bd8f197b53d8a11981207beb9f6c/data/support_card.txt)。コミット `cf9366f6a487bd8f197b53d8a11981207beb9f6c`、SHA-256 `153213019b5232df6c211427b862978218b60df6baee03c2a5fee75e0966d424`。5段階2,815行から、ID、レアリティ、段階、カード識別子の一貫性を確認し、563種類を抽出。
- **照合ソース：** [Umamusume Wiki](https://umamusu.wiki/Game:List_of_Support_Cards) の公開MediaWiki Cargoテーブル `Game_Supports`、数値列 `support_id` のみ。[Wiki側Luaモジュール](https://umamusu.wiki/Module:Game/Supports)もこのテーブルから `support_id` を取得している。読み取り専用API：`https://umamusu.wiki/w/api.php` の `action=cargoquery`、`tables=Game_Supports`、`fields=support_id`、`order_by=support_id`。返却JSONのキーはSQL列名の `support_id` ではなく **`title['support id']`**（MediaWiki表示形式）だった。
- **実行：** [GitHub Actions #39086610054](https://github.com/Nimrodx0/Umasupport/actions/runs/39086610054)。Wikiへ200件ずつ**3 GETのみ**（200 + 200 + 163）、クエリ結果はランナーの一時ディレクトリ内で処理し、ログ・Public repoへはIDと件数のみ出力。再試行・アクセス制限の迂回・大量取得・テキストの保存はしない。
- 公開Wikiは**ライブで変更されるコミュニティ索引**で、固定リビジョンのゲームマスターデータではない。確認時刻はGitHub Actions実行時刻を根拠とし、ゲーム本体の更新時刻とは呼ばない。

## 集合差分の実測

| レアリティ | 固定UmaSimカードID | Wiki Cargo記載ID | 重複するID | UmaSimのみ | Wikiのみ |
|---|---:|---:|---:|---:|---:|
| SSR | 316 | 316 | 316 | 0 | 0 |
| SR | 101 | 101 | 101 | 0 | 0 |
| R | 146 | 146 | 146 | 0 | 0 |
| **合計** | **563** | **563** | **563** | **0** | **0** |

Wiki側に規則外の数値IDは0件。200・200・163件とページの末尾が短いことを確認し、APIページングを途中で打ち切った結果ではないことも検査した。入力が不正、ページ不足・切詰め、重複ID、5段階の欠落、SHA不一致、想定外のAPI形式なら非0で終了。

### 結果の読み方

- 2026-10-18時点のWikiコミュニティ索引にある**数値サポートカードID**を、採用UmaSimの563枚が全てカバーしていることは、独立した取得元による**ID集合の一致**として検証できた。名称で似ているものを推定対応する方式ではない。
- **ただしこれはゲーム内の最新全サポカ枚数の証明ではない。** Wiki索引とUmaSimがどちらも新規ゲームカードを未収録の場合、集合が一致していても分からない。両者の上流データが一部同一の可能性もある。
- ID照合はスキル、段階別ヒントの値、サポカ画像、イベント数・ゲーム正式story_idと報酬の全件正確性を証明しない。特にPhase 2の公開承認イベント0件に変更なし。
- Wikiへ対応する一覧ページが存在することと、ゲーム現行マスターに正式レコードが存在すること、配布に必要な許諾があることは別々の条件。

## 再現と受け入れ

- **A 機構**：`poc/tools/audit_wiki_cargo_supports.py` と `poc/tests/test_wiki_cargo_supports.py`。数字以外のID、正規化後の同一ID、重複・不足ページング、異常なsource行、同カードの凸重複、レアリティ不整合を拒否する人工テスト。
- **B 実データ**：[限定監査ワークフロー](../.github/workflows/wiki-cargo-support-audit.yml)で通常HTTPの公開数値IDだけを収集し、固定UmaSimの全IDと比較。**563/563数値IDの一致**が今回の通過ゲートで、ゲーム全件性・2026年全スキル/イベントとは別。
- **C 実機**：ブラウザアプリ自体の挙動・画像を変更していないため、Android/Windows物理実機の受け入れは今回の対象外。通常のChromium回帰テストは維持。

新しい情報源を増やす場合は、無制限にWiki APIを再取得せず、出典、更新日、フィールド構造、件数差・再利用条件を別ゲートで検証する。
