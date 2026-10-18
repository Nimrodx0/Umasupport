# Phase 2：Wikiのイベント解説ページ索引と旧マスターのstory_id照合

確認日：2026-10-18（日本時間）。**SSR 30241の実ゲーム内イベント数を確定する調査ではない。**

## 問題と公開情報源

2025年固定マスター（`SimpleSandman/UmaMusumeMetaMasterMDB@5a8ec135`、SHA-256 `46363929ab097edf164d78a1e8f8d212dbf8c440a7c44431079198ca167002cb`）には、SSR30241と直結する`single_mode_story_data.story_id`が18件ある。2026年Checker候補が17件と観測されたため、2025年マスター側の一意な未一致数値ID **830241004** が残っていた（[過去の監査](story-residual-metadata-audit.md)）。

Umamusume Wikiの[イベント定義テンプレート](https://umamusu.wiki/Template:Game_Training_Event_Definition)は、イベント解説ページの`story_id`を**Cargoの`Game_Training_Event`テーブル**に登録する構造。これはWikiが作成したページの索引であり、ゲーム内マスターのstory_id全件を表すものではない。実際のサポートカード表示モジュールでは、`Game/Supports/Data/Events` からサポカとイベントを取得し、Wikiのイベント解説ページに追記されたデータをCargoから結合する。[Wikiの公開Luaロジック](https://umamusu.wiki/Module:Game/TrainingEvents)から読み取れる範囲の仕様である。

## 限定API実測

[GitHub Actionsの限定実測 #39088448907](https://github.com/Nimrodx0/Umasupport/actions/runs/39088448907) は成功。

- Wiki `Game_Training_Event` の既知イベントID **830021001** は解説ページの索引に存在。アクセス方法とフィールド名（Cargo API応答`title['story id']`）を確認できた。
- **830241004** は同索引の問い合わせ結果には存在せず、同じ数値prefix `830241000 <= story_id < 830242000` に該当するWikiページは0件。
- 2025年旧マスターの**30241に直結する18件**は、Wiki解説ページ索引で0件一致。旧18件の`story_id`がゲームマスターに存在しなかったわけではない。
- 別に取得した公開Wiki Luaモジュール `Module:Game/Supports/Data/Events`（ソース約2,152 bytes）と `Module:Game/TrainingEvents/Data`（約2,883 bytes）に、文字列 `830241004` の直接埋め込みはない。これはコードがデータを外部アクセサから読み出す実装である可能性を残し、個別IDの不在や現行ゲーム内の欠落を示すものではない。
- 使ったのは公開Wiki APIの読み取り専用リクエスト。プローブは限定したID・1区間・少数のスキーマサンプルに限り、実イベントタイトル・選択肢・報酬・Luaソース本文を標準出力・Publicに保存していない。

| 照合項目 | 数値 |
|---|---:|
| 2025年固定マスターの30241直結story_id | 18 |
| Wikiイベント解説ページの30241対応数値範囲 | 0 |
| 旧マスター18件とWiki解説ページ索引の共通ID | **0** |
| 旧masterに830241004 | あり |
| Wiki解説ページ索引に830241004 | なし |
| Wiki側の既知正例830021001 | あり |

**解釈：** Wiki Cargoのイベントページ索引は、SSR30241に関してゲームマスターやChecker候補の代わりとして使えない。「18件をWikiが認識していない」のではなく「18件に対応する個別**Wiki解説ページの登録が見つからなかった**」という限定的な観測である。この結果だけではCheckerの収録漏れ、2026年版での削除・改題・イベントの発生可能性、選択肢の報酬を判断できない。

## 再現できる監査とゲート

- **A：** `poc/tools/audit_wiki_event_index_focus.py` と `poc/tests/test_wiki_event_index_focus.py`。`single_mode_story_data.id`（DB内部行識別子）ではなく、**`story_id`**を照合する。人工SQLiteによる18件に相当する数値リンク、APIレスポンス`title['story id']`、無記録・部分収録・重複・レスポンス不正・ページ打切り・参照元マスターSHA不一致の条件を確認する。
- **B：** [限定GitHub Actions](../.github/workflows/wiki-event-story-id-probe.yml)が2025年固定マスターのSHAを確認したうえでWikiの掲載story_idを比較。**Wikiの解説ページ索引だけを検証し、2026年現行マスターとの全数比較ではない。**
- **C：** 公開アプリUIやイベントDBへの追加なし。Android/Windows実機は今回の検証対象ではない。

## 次のデータ取得方針

数値`story_id`の広い範囲とサポカIDの紐付けを持つ、適切に入手・出典確認された**2025年版より新しいゲームマスター**を優先する。または、Wikiの内部データアクセサが参照するデータの更新履歴・配布条件を、コードの実装と出典が確認できる範囲で調べる。Wikiの解説ページが作られていないことは、新マスターからのストーリー削除の証拠にはしない。

公開承認済み実イベントは**0件**のまま。過去の推定見出し比較の結論は変更しない。
