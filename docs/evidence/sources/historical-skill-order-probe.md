# 旧ゲームマスターの `disp_order` 候補とスキルID `201012` の照合

実施：2026-10-17（JST）　関連：[Phase 1](roadmap.md) / [通常ヒント独立照合](independent-card-hint-audit.md) / [過去マスターによる金白検証](historical-master-audit.md)

## 資料と目的

ゲーム内の標準スキル表示順を目指す仕様[F-05](requirements.md#f-05-スキル一覧比較ui)について、`disp_order`が実際にどの範囲のスキルで取得できるか、同じ値を持つスキルが何件あるかを調べる。さらに、[通常ヒント監査](independent-card-hint-audit.md)で見つかったUmaSim数値スキル辞書の欠損 `201012` の実ゲームマスターにおける存在を確認する。

- 現行寄りの入力：[UmaSim `skill_data.txt` 2026-10-13](https://github.com/mee1080/umasim/blob/cf9366f6a487bd8f197b53d8a11981207beb9f6c/data/skill_data.txt)（固定コミット`cf9366f6...`、2,139スキル）。
- 歴史的な照合資料：[SimpleSandmanの `master.mdb` 2025-10-10](https://github.com/SimpleSandman/UmaMusumeMetaMasterMDB/tree/5a8ec1356859a35e245edef0d40da740e652df68/master)（固定コミット`5a8ec135...`、スキル1,847）。
- [Umamusume Wikiのゲームマスター利用コード](https://umamusu.wiki/Module:Game/Skills/Data)も`skill_data.disp_order`を`displayOrder`として取り込んでいる。ただし、この処理の存在は**ゲーム内スキル取得UIにおけるソート規則の直接証拠ではない**。

SHA-256はUmaSimスキル`b7ba1d6c5dd2af9ed1f4e649f16ec1d319198e2f1ac9db07c54e14d29f0b25ec`、旧マスター`46363929ab097edf164d78a1e8f8d212dbf8c440a7c44431079198ca167002cb`。旧DBを読取専用SQLiteで扱い、原本をレポジトリへ保存しない。

## 固定資料での実測

[限定的Actions #39006385971](https://github.com/Nimrodx0/Umasupport/actions/runs/39006385971)（成功）。

| 判定 | 実測 |
|---|---:|
| 現行寄りのUmaSim辞書のスキル | 2,139 |
| 2025年歴史マスターのスキル | 1,847 |
| 両者に同じ数値IDが存在 | **1,786** |
| UmaSimにあるが旧マスターにはない | **353** |
| 共有IDに`disp_order`正整数が存在 | **1,786 / 1,786** |
| 共有スキルで異なる`disp_order`の値 | **753** |
| 2件以上のスキルが同じ値を共有する順序グループ | **214** |
| 上記重複順序に属する共有スキル | **1,247** |
| 1つの値を共有する最大スキル数 | **253** |
| `disp_order`の共有正値の範囲 | 10〜130001 |

### `201012`の追加確認

旧マスターにも**ID `201012` が存在**、レアリティは通常`1`、グループ`20101`、`disp_order = 20120`。

2026-09-30の別系統[スキル辞書](https://github.com/Tsuyuchan-jp/umamusume-data/blob/0cacbb1aaf9dca10283d5b9ea20b205b9d204535/data/skills.json)でもID `201012` は「後方釘付」・同グループのノーマルスキルである。2026-10-13版UmaSimの[当該サポートカード `30296`](https://github.com/mee1080/umasim/blob/cf9366f6a487bd8f197b53d8a11981207beb9f6c/data/support_card.txt)のヒントにも「後方釘付」が記載される。したがって**UmaSimの独立したスキル辞書に数値IDがない**という事象を、元資料と別々のマスターで確認できた。Webアプリは名前を用いて通常ヒントを維持できるが、この例外を無断で自動補完せず今後のスキルID監査に保持する。

## 結論と未解決

- **`disp_order`は実在するメタデータ**で、2025年マスターと2026年UmaSimで共通する1,786件について読める。
- **多くの同値がある**。単純な昇順は全スキルの一意な並べ替えではなく、別の分類／グループ／同順位時の規則が必要。
- **資料の版差が約1年**あり、UmaSimの353件には歴史的メタデータがない。旧値を2026年全スキルへ流用しない。
- **ゲーム内のUI順序を実機で照合していない**。同時期2026年の`disp_order`、同順位時の順番、○◎/金下位の階層固定との兼ね合いを個別に調べるまでは、アプリの五十音順＋金白階層を変えない。
- 以前作成した[カード母集団](card-population-independent-audit.md)／[45枚ヒント監査](independent-card-hint-audit.md)の**人工データの回帰ファイルは、追加当初の通常CIの明示的テスト一覧に含まれていなかった**。今回[ci.yml](../.github/workflows/ci.yml)に追加し、監査器の異常系テストが実際にCIで走るようにした。以前の単発取得監査成功と人工テスト実施を混同しない。

A：読取専用の旧マスター解析と人工SQLite回帰はPass。B：旧版の歴史的重複1,786件のみメタデータの存在を確認。2026年の完全な表示順／実ゲームのUI順序は未通過。C：ユーザーのPC／Android実機上の順番は未確認であり、テスト依頼は他の実機未確認項目とまとめる。

再現方法：[一時取得ワークフロー](../.github/workflows/historical-skill-display-order.yml) ／ [マスター監査コード](../poc/tools/probe_historical_disp_order.py) ／ [人工DBテスト](../poc/tests/test_historical_disp_order.py)。
