# Phase 1：Wiki JP masterdata→Cargo掲載IDの一方向漏れ検査

監査日：**2026-10-18**。実測：[GitHub Actions #39092779263](https://github.com/Nimrodx0/Umasupport/actions/runs/39092779263)。

## 何を検証したか

Umamusume Wikiの公開Lua [Module:Game/Contribution](https://umamusu.wiki/Module:Game/Contribution) にある `listMissing` は、Wikiで稼働するExternalDataの**JP版ゲームマスター `masterdata`**とWiki記事の**Cargo索引**の数値IDを比較する。

Lua内部の `findMissing` は次の2組について、**マスター側に存在してCargo側に存在しないID**だけを抽出する。

| マスター側のテーブル | Wiki側Cargoテーブル | ID照合 |
|---|---|---|
| `support_card_data` | `Game_Supports` | `id` 対 `support_id` |
| `card_data` | `Game_Cards` | `id` 対 `card_id` |

マスター側は `id < 9000000` に制限し、ダミーカードを除外する。処理は**一方向**であり、Wiki側のみのIDやマスター側の総レコード数を返さない。Luaモジュールは `Game.queryMaster` → ExternalData `db='masterdata'` を呼び出す。Luaモジュールの2025年編集日時は、SQLiteの実データ更新日とは別である。

## 今回の実測

2026年10月18日に、MediaWiki公開API `action=expandtemplates` で既存の `{{#invoke:Game/Contribution|listMissing}}` を**1回だけ**実行した。

- 公開APIはHTTP 200で、期待する `expandtemplates.wikitext` を返した（JSON全体94 bytes）。
- `Cards` と `Supports` の2セクションはともに `Up to date!` と表示された。
- **masterdataのサポートID → WikiのGame_Supports索引で、未掲載として報告されたカード0件。**
- 育成ウマ娘ID → Game_Cardsの未掲載も0件。
- Wikiへのアクセスは1 GET、45秒タイムアウト、256KiB上限、再試行・アクセス制限の迂回なし。取得データ・記事原文のPublicへのコピーなし。

| 検査 | Wikiが報告する未掲載ID |
|---|---:|
| `support_card_data` → `Game_Supports` | **0** |
| `card_data` → `Game_Cards` | **0** |

**前回の照合との関係：** [Wiki Cargoに登録済みのサポカ数値ID563件と固定UmaSim563件は完全一致](wiki-cargo-support-id-audit.md)。今回別経路のWiki自身の検査では、WikiのJP版masterdataからCargo索引へ抜けているサポカIDが0件と報告された。両結果は整合するものの、**Wikiに存在するIDの総数がゲームの最新正規カード全数であるという証明にはならない**。

## 成功でも証明していないこと

1. **masterdata SQLiteの現在のリビジョン、SHA、更新日時。** 外部から取得したのはLua出力であり、バックエンドファイル自体の検証可能な固定版ではない。
2. **WikiのmasterdataとWiki Cargoの完全な集合一致。** このModuleはmasterdata→Cargoの方向だけで、Cargo→masterdataを保証しない。古いソースが両方に収録されていない場合も検出できない。
3. **2026-10-18のゲーム本体の全カード・全数値スキル・イベントの最新性。** 2026年8月SSR30311の[レンダリングされたイベント5件](wiki-masterdata-rendered-event-audit.md)は独立した観測だが、マスター全体の版を特定する値ではない。
4. **カードイベントの選択肢、発生条件、報酬、利用許諾。** この公開Luaのチェックはサポカ・育成カード**IDの在庫漏れ**だけを見る。実イベント公開承認0件は変更なし。

## 自動化と合格ゲート

- **A：人工データ**：`poc/tools/audit_wiki_masterdata_cargo.py` と `poc/tests/test_wiki_masterdata_cargo.py`。APIの期待スキーマ・セクション・一意数値ID・不正なデータの拒否。テンプレート展開に失敗した場合に「0件」を捏造せず非0で停止。正常で明示的な `Up to date!` がある場合のみ0件と認定する。
- **B：外部公開ソース**：[限定ワークフロー](../.github/workflows/wiki-masterdata-cargo-gap.yml)にて**公開テンプレート展開の実測**。Wiki自身の比較ロジックによる「masterdataにあってCargoにないID」の観測0件を報告。バックエンドSQLiteには接続・ダウンロードしない。
- **C：アプリ本体**：公開UI、イベントDB、ユーザー設定、Pagesへの変更なし。Linux Chromium回帰は実行するが、Android・Windows物理端末受け入れは別件。

## 次工程

- Wiki運営・公開ドキュメントまたは追跡可能なスナップショットから`masterdata`の**実データ版（取得時点／固定リビジョン／ハッシュ／正規の再利用条件）**が得られれば、[新旧ゲームマスター数値ID差分監査](master-snapshot-differential-audit.md)を実行できる。
- それまで、公開レンダリング記事の数値IDは**ページを表示した時点の観測**としてのみ扱う。特にSSR30241の旧master18 ID一致と2026年SSR30311新5 IDは、現行ゲームイベント全件性の認証ではない。
