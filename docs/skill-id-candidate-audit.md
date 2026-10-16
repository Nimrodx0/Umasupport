# SSR欠損5枚のスキル名と数値IDの照合（2026-10-16）

## 目標と現状

[PR #20の未承認イベント候補](game8-missing-ssr-review.md)（SSR30320、30302、30295、30269のスキルヒント14行）と、今回別記事で調べたジャングルポケットSSR30240のイベント取得スキル2種類を、**数値IDとレアリティを失わずに**内部スキルへ対応付ける準備をした。U-toolsは使用しない。

- 既存4枚のスキルヒント：14行、重複のある「一所懸命」を含む。
- ジャングルポケット30240：GameWithの[該当SSR個別ページ](https://gamewith.jp/uma-musume/article/show/490549)にイベントスキル「迅速果断」「がむしゃら」の2つが列挙されている。[ｽｯﾍﾟﾝﾍﾟﾝ Wiki](https://wikiwiki.jp/sppenpen/怪文書まとめ5)の該当サポカ節でもイベント獲得スキルとして両方を掲載。ただし、**イベント進行の何段階目・どの選択肢で得られるかは未確認**。JSONの `cardLevelSkillCandidates` にのみ記録し、`chain[].hints` や `random[].hints` には入れない。
- 合計**14種類の異なるスキル名**を照合対象とした。2026-10-16の [GitHub Actions実測](https://github.com/Nimrodx0/Umasupport/actions/runs/38919001300)でUmaSim `data/skill_data.txt` は2,139レコード、14種のうち**13種が名前厳密一致の一意なID**、**1種は未収録**、0種が曖昧。
- 未収録の「逃げためらい」は、別系統の[BWikiスキル対照表](https://wiki.biligame.com/umamusume/中日文对比表)と[2周年スキル変更資料](https://pages.snep.pw/uma/anni2-skill-changes/)でともに **200851** と確認。**外部資料のみの暫定ID**に留め、UmaSimの正規スキルレコードで照合できた13件とは明示的に区別する。
- IDは**元ソース由来の数値ID候補**。ゲームの正式マスターデータへの由来の確認、白金の上下関係、イベントごとの発生条件・成功失敗、公開上の表現利用条件は引き続き未承認。

## ID対応表

唯一の管理ファイル：[`poc/config/missing-ssr-skill-id-candidates.v1.json`](../poc/config/missing-ssr-skill-id-candidates.v1.json)

| スキル名 | 数値ID | UmaSim区分 | 証拠 |
|---|---:|---|---|
| がむしゃら | 202422 | normal | UmaSim |
| さらなる高みへ | 203122 | normal | UmaSim |
| スリップストリーム | 201651 | normal | UmaSim |
| ワンチャンス | 202082 | normal | UmaSim |
| 一往直前 | 204721 | rare | UmaSim |
| 一所懸命 | 203561 | rare | UmaSim |
| 解き放つ情念 | 203801 | rare | UmaSim |
| 決死の覚悟 | 201701 | rare | UmaSim |
| 光輝燦然 | 204381 | rare | UmaSim |
| 食らいつき | 202472 | normal | UmaSim |
| 迅速果断 | 200591 | rare | UmaSim |
| **逃げためらい** | **200851** | normal（外部） | **BWiki・2周年資料のみ** |
| 勇迅円刃 | 201323 | rare | UmaSim |
| 連鎖反応 | 203241 | rare | UmaSim |

`normal` と `rare` はUmaSimの生データにある分類名をそのまま使用している。レコードの `group` も同ファイルから保持するが、**同グループ番号から金白スキルの親子関係が成立することまではこのPRで検証していない**。

## 実装と安全性

- [`poc/src/skill_candidate_id_audit.cjs`](../poc/src/skill_candidate_id_audit.cjs)：UmaSimの構造化JSONを読み、カードから抽出済みの**事実としてのスキル名**だけをUnicode NFKC＋空白正規化で厳密照合。候補名が1レコードのみで `normal`／`rare` のときだけUmaSim一意候補を返す。複数同名・通常／レア以外・不存在は自動確定しない。
- `verifyCandidateTable`：14種すべてがマッピング表にあるか、UmaSim一意13種のID・分類・グループが元データと完全一致するか、外部暫定1種が依然UmaSim未収録かを確認。将来UmaSimに逃げためらいが追加された場合、暫定のまま進まず**再レビューを要求**する。
- [`poc/tools/audit_skill_candidate_ids.cjs`](../poc/tools/audit_skill_candidate_ids.cjs)：開発者が明示的に実行するときのみUmaSim `skill_data.txt` をGETし検証、または `--local path/to/skill_data.txt` でローカルファイルを利用。ゲーム文章の転載・第三者サイト巡回はしない。
- [`poc/src/missing_ssr_fact_review.cjs`](../poc/src/missing_ssr_fact_review.cjs)：カード単位の獲得スキル名を、**イベント位置が分からない状態の候補**として保持することを認めた一方、イベント毎の報酬への変換を防止。
- [`poc/tests/skill_candidate_id_audit.test.cjs`](../poc/tests/skill_candidate_id_audit.test.cjs)：ID誤変更、二重候補、抜け、未確定情報からの勝手な登録を回帰テスト。

### 開発者向けの監査方法

~~~sh
node poc/tools/audit_skill_candidate_ids.cjs
# ネットワークを使用しない方法：
node poc/tools/audit_skill_candidate_ids.cjs --local local-data/skill_data.txt
~~~

通常CIでは外部ファイル取得を行わない。手動で更新差を追跡し、変わった13種のレコードはマッピングを再承認する。

## 次に必要な工程

1. **イベント専用スキルIDのランタイム辞書を整備する。** 現在のライブアプリはUmaSimサポカ通常ヒント名で作った `hint:名前` のキーしか持たない。金スキル等のイベント報酬はその辞書に存在しない場合が多いため、今回の数値IDをそのまま公開イベントDBへ入れても参照できない。イベントスキルは一次的な数値IDを正として、通常ヒント名との統合・表示を別途実装しテストする。
2. **金白の系統を確認する。** UmaSimの `group` を候補に使えるが、金の上位・白の下位の関係はゲームデータとの独立照合が必要。
3. **分岐・成功失敗・連続の打ち切り**を4枚の攻略記事で確認し、獲得できる確率や条件を不明のまま無条件扱いしない。
4. **30240の2スキルのイベント配置を確認**する。スキル名だけ確認してもイベント獲得経路として公開DBに登録しない。
5. 利用範囲と各イベントの内容を独立にレビューしてから[公開イベントDB](../poc/data/reviewed_events.v1.json)を段階的に拡充する。**現時点で公開イベントDBは実イベント0件**。

## 2026-10-17：公開イベント向けのランタイムID変換層（PR #22予定）

- `poc/src/skill_bridge.js` はUmaSim `skill_data.txt` をブラウザから必要なときだけ直接取得し、構造検証後にIndexedDBへ保存する。取得に失敗した場合は、前回の検証済み辞書へ戻す。**ゲームデータはリポジトリに同梱しない**。
- 公開イベントJSONで数値IDを使うときは、`skillId: "skill:200591"` のように記し、レビュー済みの `verifiedSkillName` を**必須**とする。実行時の辞書とID・名称が一致しない場合、イベントJSON全体を拒否する。
- UmaSim辞書内で名称が一意であり、かつ通常ヒントの `hint:名称` が存在すれば、集計時は既存ヒントIDへ変換する。同じカードが通常ヒントとイベントで提供しても提供枚数は1のまま。**名称が重複する場合、推測で統合しない**。
- 通常ヒントに現れないイベント専用スキルは `skill:数値ID` を内部辞書へ追加する。UmaSimの `rare` は表示分類 `gold` に対応させるが、`group` だけから上下関係を推論せず、`lowerId` は `null` とする。
- 公開イベントデータの検証・集計が全部通るまで、モデルを変更しない。スキル辞書の取得ができなくても通常ヒントの取得・画面起動には影響させない。イベントレコードが0件なら追加の辞書GETを行わない。
- **ID辞書の照合は、イベント報酬の発生条件・獲得位置・第三者データの公開許諾を承認するものではない。** 今回も公開済み実イベントは0件のまま。

今後の確認：数値IDを含む**承認済み実イベント**が揃った段階でPages実ブラウザ上の辞書取得・キャッシュ復旧・ヒント重複を検証する。上位／下位スキルの独立確認と、30240の獲得位置確認は未完了。
