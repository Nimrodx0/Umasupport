# GameTora本体の表示結果別スキルヒントを独立数値ID辞書へ結びつける試験（2026-10-28）

## 目的と出典

[GameTora本体だけを入力とする非公開数値候補](official-gametora-site-only-numeric-draft-20261028.md)に、スキルヒントの**数値スキルID・ヒントLv・観測した結果候補の位置**を追加する。ただし、旧固定GameTora派生JSONのスキルID・経路を元サイトに補填しない。

- 画面：元GameToraのSSR30080カードの、旧固定出典で第8番目と対応する**画面上第6番目**のイベントのみ。
- 数値スキルID：UmaSimの独立固定 `mee1080/umasim@910dd79f046710245e0cc88a09c5c92b1044897e/data/skill_data.txt`。Git blob `0c6ea6d72b037b24ee40860f73b0e86db47aab1d` を使い捨てCIランナー内で検証して読み込む。辞書をPublic成果物に同梱しない。
- 照合関数：既存 `official_gametora_skill_id_crosswalk.cjs` の `matchContextToId` を利用。同じ名称が別IDに対応する場合や、同一結果内の文脈が互いに矛盾する場合は未解決とする。

## 新しい変換器の境界

`poc/src/official_gametora_site_hint_draft.cjs` は、元サイトDOMの同じ結果候補から抽出されたヒントLv文字と、当該文字の短い上位要素文脈だけを入力する。別の選択肢やOR結果にヒントを移さず、スキル名・選択肢文章・HTMLを返さない。候補は `{source:'gametora-visible-hint',numericId,level,choiceGroupOrdinal,resultOrdinal}` のように**数値・位置だけ**保持する。

**重要な注意：** この段階ではスキルヒント候補を `rewards[]` に昇格しない。表示を認識できなかった直接獲得スキル、確率、選択肢の意味、お出かけ進行や連続イベントの後続 `requires` は未解決。現在の `siteOnlyNumericDraft` は報酬なしと断定しないために `skillRewardsStatus:'unresolved'` のまま。新しいヒント候補も `appEventSchemaAdoptable:false`、`publicationApproved:false` とする。

## 元GameToraサイトの実測（SSR30080の一イベント）

[実Chromeの成功ジョブ #122744838353](https://github.com/Nimrodx0/Umasupport/actions/runs/40667275681)で、画面上の対象イベントは第6番目、外側3グループ・4経路・スカラー12件と再確認した。表示されたスキルヒント行は**1件**で、結果別の配置は保持できたが、固定独立UmaSim辞書との一意照合は**0/1件**。未解決理由コードは **`ambiguous-name-or-id` 1件**。スキル名の候補または数値IDの同名多重性を現時点で一つへ解消できないため、数値ID・Lvペアを創作しない。旧派生GTからIDを逆流させず、追加の公開候補は作らない。

## 検証基準

A：同一結果の名称・Lvだけを結び、ORの隣の結果を汚染しない。辞書に存在しない名称・同名別ID・矛盾した2つのスキル候補・不正なLv・分岐位置不一致・長すぎるDOM文脈を不合格／未解決とする。

B：SSR30080の1イベント1件だけが対象。UmaSim固定辞書に対する一意照合は、旧固定GT派生元の値に依存しない。カード全体・全サポカの網羅、元ゲームの結果分岐の保証ではない。

C：限定GameTora実サイトChromeから結果別の数値を取り出し、同一DOMからのヒントレベルをUmaSim固定辞書へ突き合わせる。ログには数値スキルID・レベル・位置と成功／未解決件数以外の文章を記録しない。実スマホ／Windowsでのアプリ動作、公開版イベント収録は今回の範囲外。

次の工程：ヒント以外の直接取得スキルを検出する処理、表示結果の性質・後続到達・GameWithによる必要部分のみの男性トレーナー選択肢補完、正式公開ゲート。正式公開イベントは**0件**のまま。
