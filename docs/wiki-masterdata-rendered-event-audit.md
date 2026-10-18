# Phase 2：Wiki公開サポカページの数値イベントIDとmasterdata来歴監査

調査・限定実ソース実行：**2026-10-18**。公開承認済み実イベント：**0件（変更なし）**。

## 照合対象と取得経路

[Umamusume WikiのModule:Game](https://umamusu.wiki/Module:Game) は、Luaの \`Game.queryMaster\` が **ExternalData の \`db='masterdata'\`** を指定する設計。サポカイベントモジュール（[Module:Game/Supports/Data/Events](https://umamusu.wiki/Module:Game/Supports/Data/Events)）は \`single_mode_story_data\` を \`support_card_id\` または \`support_chara_id\` で引き、\`gallery_flag=2\` を指定する。結果の内部行 \`id\` と正式ストーリー \`story_id\` は異なる（[TrainingEvents/Data](https://umamusu.wiki/Module:Game/TrainingEvents/Data)）。

公開Module:Gameのページ版番号は **37545、編集日2025-08-01**、Supports/Data/Eventsは37553（2025-08-01）、TrainingEvents/Dataは37627（2025-08-06）。**これらはモジュールコードの編集時点であり、バックエンドSQLiteの版ではない。** Wikiの \`masterdata\` 本体ファイルやハッシュ、更新履歴を手元で入手・確認したわけではない。

別途、公開MediaWiki \`action=parse\` APIから**既存の2つのサポカ記事を通常の読み取りで表示**し、「Training Events」にあるイベントリンクの9桁数値IDだけを抽出した。HTML、文章、選択肢、スキル報酬をPublic repoに保存していない。比較は別途SHA固定された2025年SQLite（SimpleSandman/UmaMusumeMetaMasterMDB@5a8ec135、SHA256 \`46363929ab097edf164d78a1e8f8d212dbf8c440a7c44431079198ca167002cb\`）をランナー内だけで一時取得し、\`story_id\`の集合を比較した。

## 1．SSR30241（2025年2月登場）

参照：[Wiki SSR Speed Symboli（導きの光）](https://umamusu.wiki/Game:SSR_Speed_Symboli_(導きの光))、記事リビジョン**36004**。

| 項目 | 件数 |
|---|---:|
| 2025年固定マスターのSSR30241直結gallery_flag=2のstory_id | 18 |
| Wiki記事「Training Events」内の異なる9桁イベントリンクID | 18 |
| Wiki側「Event Chain」 | 5 |
| Wiki側「Other Events」 | 13 |
| 2025年固定マスターとWiki記事の共通story_id | **18** |
| 2025年旧マスターのみ / Wiki記事のみ | **0 / 0** |
| 旧マスターの未照合story_id=830241004 | **Wikiのイベントリンクにも存在** |

[実ソース監査結果 #39091669688](https://github.com/Nimrodx0/Umasupport/actions/runs/39091669688)、同じ比較を[最近のカードも含めて再検証 #39091985396](https://github.com/Nimrodx0/Umasupport/actions/runs/39091985396)。

**注意：** 以前の[Wiki Cargo \`Game_Training_Event\` 解説ページ索引](wiki-event-story-index-audit.md)には30241が0件だった。これは**Wikiの個別イベント解説ページの登録が0件**という意味。既存のサポカページはLua→ExternalData \`masterdata\` を参照するため、同じWiki内でも**表示経路が異なる**。索引0件とサポカページ18件は矛盾しない。

以前のChecker（候補17件）とWikiのリンクID18件の差は、Checker側の欠落を確定するものではない。Wiki旧記事と2025年SQLiteに一致する18個の数値リンクがあることは確認できたが、**2026年ゲーム内で830241004が発生することや、スキル報酬があることは未立証**。

## 2．2026年8月登場SSRエフフォーリア（ID30311）

参照：[Wiki SSR Efforia (As if Guided)](https://umamusu.wiki/Game:SSR_Efforia_(As_if_Guided))。記事リビジョン**74431**、同ページ記載の日本版登場日**2026-08-24**。

| 項目 | 結果 |
|---|---:|
| Wiki記事の数値イベントリンク | **5件** |
| 連続イベントリンク / その他 | **3 / 2** |
| ID30311が固定2025年マスターsupport_card_dataに存在 | いいえ |
| Wiki記事の5 story_idのうち固定2025年マスター全story_idにあるもの | **0件** |
| 固定2025年マスターにはないstory_id | **5件** |

これはWikiの**公開表示レイヤーに2026年登場カードとその数値イベントリンクを収録できている**ことを裏付ける。古いSSR30241の記事も同サイトから取得している。

ただし、記事に掲載された数値IDがいつサーバーのmasterdata SQLiteに登録されたか、SQLiteのバックエンドが現在ゲームと同じ最新版か、過去記事の表示がどの程度キャッシュされるかは判断できない。したがって**「masterdataは2026-08-24版以上」や「30241の18イベントが現行ゲームに全て残る」という断定はしない**。Wikiの管理する記事内容や外部データ経路が複数ある可能性を残す。

## 3．検証・セキュリティ境界

- **A／機構：** \`poc/tools/audit_wiki_rendered_support_events.py\` と \`poc/tests/test_wiki_rendered_support_events.py\`。HTMLParserで Training Events のh2内のh3「Event Chain」「Other Events」からのみ9桁IDを抽出し、Episode等は対象外。同じIDを異なる群に二重計上しない。リダイレクト/タイトル・改訂番号・必須見出し欠落、曖昧な数値ID、旧マスターの\`id\`/\`story_id\`取り違い、SHA違いを拒否。人工ページ・SQLiteの回帰テストを通常CIへ含む。
- **B／実ソース：** [限定監査Workflow](../.github/workflows/wiki-masterdata-provenance.yml)が公開の3 Luaモジュールと**2サポカ記事だけ**を読み、2025年マスターをSHA固定して比較。30241は18/18一致、連続5＋その他13という旧レンダリングをスナップショットとして固定。更新で数値ID・分類が変われば再調査が必要になる。
- **C／実機：** 公開アプリや承認イベントDBは**未変更**。Node/Pythonのテスト・Chromium回帰は実Android/Windowsの受け入れではない。

ページには未入力イベントの「No data yet!」が30241で18個、30311で5個表示される。**Wikiで正式選択肢・報酬・連続分岐結果を検証できたわけではなく、イベントの本文や配布許可の確認にもならない。** 第三者素材をコピーせず、数値の監査だけを公開する。

次のゲート：Wikiの**サーバー側masterdata SQLiteのリビジョン・入手の正規経路**が判明し、より新しい独立マスターとして証拠採用可能なら、[旧・新SQLite比較](master-snapshot-differential-audit.md)を実施する。公開イベントへの昇格には実IDだけでなく、結果・報酬ID、条件、著作物配布条件の独立レビューが必要。
