# ウマサルタント：417枚の一括抽出イベント候補DB v1（2026-10-19）

## 用途と配置

`poc/data/candidates/checker_event_hints.v1.json` は、**ウマサルタントのレポジトリで維持する独自の数値事実データベース**。データはSSR・SR計417カードについてUmaUmaCheckerの候補を固定UmaSimの数値スキル辞書へ結び付け、独自スキーマのカードID、イベント候補キー、イベント順序、選択肢順序、獲得スキル数値ID、ヒントLv、未解決の名称・理由、条件付き表記のマーカーだけに変換したもの。出典記事の元イベント見出し・選択肢文・効果文・画像は配布しない。

**これは正式な獲得イベントDBではない。** 必ず `approvalState:"UNREVIEWED_NOT_FOR_PUBLICATION"`、`forSkillGrant:false` を保持する。ゲームでの獲得計算とユーザー選択経路に一切加えない。既存 `poc/data/reviewed_events.v1.json` と公開ゲートは変更しない。ゲーム内イベントID・連続依存・分岐条件・体力や絆の報酬は未照合。GameWith由来の2つの資料の一致は独立実証ではない。第三者サイトの利用条件・データベースの創作的構成に関する法的評価も継続。

### 正規スキーマ（編集用）

- `sourcePins`：固定した各公開GitHubファイルのコミットSHA-1、ファイル内容SHA-256、正確なURL。外部ソース本体はレポジトリへ同梱しない。
- `cards[].cardId`：固定UmaSimの5桁カード数値ID。名称文字列で同一カードを上書きしない。
- `cards[].events[].sourceKey` と `sourceDigest`：候補抽出元の一意キーと出典変更検知用ハッシュ。正式なゲームのstory_idではない。
- `ordinal`：候補内のイベント・選択肢の出現順。連続イベントのゲーム上の発生順や前提を意味しない。
- `observedHints[]`：数値IDに単一一致した場合の `skillId`＋`level`。一致しない場合は `skillName`＋`resolution:"missing"/"ambiguous"`＋`level`。
- `needsManualResultReview` は成功・失敗等の検出候補。**真偽や条件別報酬は解析しておらず、自動的に獲得スキルへ昇格できない**。
- `reviewQueue[]`：P0（ID不一致・不明な構文）、P1（成功・失敗の候補）、P2（資料間見出し差・出典の空配列）の検証待ち。カードIDとイベントキー・選択肢序数で追跡。全項目を `requiresIndependentReview:true` とする。

### 実データ受け入れ目標（2026-10-19の固定ソース）

| 項目 | 件数 |
| --- | ---: |
| SSR＋SRの候補カード | 417 |
| イベント候補 | 2,109 |
| 選択肢の位置候補 | 3,458 |
| 数値ヒントの記載 | 1,504 |
| 全数値辞書でIDを単一照合できた記載 | 1,406 |
| ID未解決の記載 | 98 |
| 要確認レビューキュー | 344（P0：99／P1：231／P2：14） |

`poc/src/checker_candidate_database.cjs` がDB形式を厳しく検証し、未承認の原文フィールド、重複ID・イベントキー、URL／SHA、スキルLv、レビュー参照不整合、集計の改ざんを拒否する。DBのカードを参照するコマンド：

```bash
node poc/tools/query_checker_candidate_database.cjs
node poc/tools/query_checker_candidate_database.cjs 30003
```

### 再生成

ゲーム記事は直接自動取得しない。`poc/tools/build_checker_candidate_database.cjs` はローカルに合法的に用意された**四つの入力ファイル**だけを処理する：

```bash
node poc/tools/build_checker_candidate_database.cjs \
  /tmp/support_card.txt \
  /tmp/skill_data.txt \
  /tmp/checker-Events.json \
  /tmp/cruise-library.json \
  poc/data/candidates/checker_event_hints.v1.json
```

カードとスキルのUmaSim入力は固定コミット `cf9366f6a487bd8f197b53d8a11981207beb9f6c` と既知SHA-256で検証。Checker固定コミット `8cf9fcb3cc7239041161be75c84daf9f8f22d29f`、Cruise固定コミット `56b679c582ce2138823eb52796d553d33cdd4862` のデータを使い、結果は外部へ再GETせずにGitHub Actionsの一時領域で生成可能。

元記事文・イベントタイトル・選択肢文章・効果文章を含めないことで、データの利用目的を数値事実の比較とレビューに限定している。ただしこの措置だけであらゆる第三者権利・契約上の問題が解消したと断定しない。

## 受け入れと非対象

GitHub Actionsのオーナー限定生成で、事実フィールドだけをGitへ追加し、原記事・元JSONをリポジトリ・アーティファクトへ保存しない。固定版の件数・SHA・CI・ブラウザ試験が成功したもののみ統合する。

現行プレビュー `?eventPreview=30311` および `?eventPreview=expanded`、通常スキル獲得計算、スキル辞書、設定、通常本番公開イベントJSONは変更しない。これは永続的な**候補データ台帳**の第一段階であり、編集レビューを経てイベント経路へ採用する工程は次の独立ゲートとなる。
