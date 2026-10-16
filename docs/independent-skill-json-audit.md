# 2026年9月版の別スキルJSONによる金白全件クロスチェック

更新：2026-10-17　関連：[Phase 1](roadmap.md) / [金白構造監査](skill-hierarchy-coverage.md) / [旧版マスター照合](historical-master-audit.md)

## 目的と証拠の強さ

2026年10月版UmaSimが構造から推定した金白322組を、**別ルートで9月30日に抽出された加工済みスキルJSON**で全件突き合わせる。旧マスター（2025年）は53組を欠いていたため、近い版で補強する。未収録の組は別の攻略資料で個別検証する。

比較対象：
- A：[UmaSim `skill_data.txt`](https://github.com/mee1080/umasim/blob/cf9366f6a487bd8f197b53d8a11981207beb9f6c/data/skill_data.txt)（固定版 `cf9366f6a487bd8f197b53d8a11981207beb9f6c`、2026-10-13、2,139スキルレコード）。
- B：[Tsuyuchan-jp `data/skills.json`](https://github.com/Tsuyuchan-jp/umamusume-data/blob/0cacbb1aaf9dca10283d5b9ea20b205b9d204535/data/skills.json)（固定版 `0cacbb1aaf9dca10283d5b9ea20b205b9d204535`、[manifest](https://github.com/Tsuyuchan-jp/umamusume-data/blob/0cacbb1aaf9dca10283d5b9ea20b205b9d204535/manifest.json)による抽出日時2026-09-30、2,194スキルレコード）。
- C：[GameWith「規格外」](https://gamewith.jp/uma-musume/article/show/582564)（2026-10-13更新）と[「抜山蓋世」](https://gamewith.jp/uma-musume/article/show/582168)（2026-10-12更新）。別JSONに欠ける1組の**名称による個別裏付け**。

Bは配信向けに加工されたJSONであり、ゲームの生マスターや公式資料ではない。生成用`umamusume-data-src`は非公開なので、出典や抽出コードの完全な独立性は立証していない。AとBの原データをGitHub Pages・Publicリポジトリ・Actionsアーティファクトに保存せず、固定コミットからワークフロー実行時の一時領域に各1回だけ取得した。

## 実測：全325金スキルを分類

比較コード：[`poc/tools/audit_independent_skill_json.py`](../poc/tools/audit_independent_skill_json.py)、[実行 #38944822566](https://github.com/Nimrodx0/Umasupport/actions/runs/38944822566)（成功、2026-10-17）。

| 項目 | 件数 | 証拠の意味 |
|---|---:|---|
| 金→白（2段階）のID・group・rarity・順序・双方向リンク一致 | **290** | 加工済みJSONの独立構造情報との一致 |
| 金→◎→○（3段階）の同一致 | **31** | 2本の昇格辺と順序を確認 |
| **2026-09-30 JSONで完全照合** | **321 / 322** | 290＋31、非nullリンク**704件**すべて一致 |
| 2026-09-30 JSONに構成IDがない | **1 / 322** | グループ`20480`、金`204801`・白`204802` |
| 白下位を持たない金 | **3 / 325** | 比較元でも同じ群に白なし。将来の不在は保証しない |
| 構成IDが揃う群での矛盾 | **0** | 順序逆転・グループ／レアリティ衝突・明示リンク不一致なし |

抽出JSONのレア分類レコードは347、通常分類は870で、UmaSimの分類分母（金325、白478）とは異なる。**双方の「ゲーム全スキル」の母集団が一致するとみなさない**。

SHA-256：UmaSim `b7ba1d6c5dd2af9ed1f4e649f16ec1d319198e2f1ac9db07c54e14d29f0b25ec`、別JSON `11bf7aa86d611047f5052b48059cf77d6aa9b4a7ad8e25ba2f7f901dcd267e62`。

## 残った1組の個別確認

- UmaSim `group=20480`：rare `204801`「抜山蓋世」、normal `204802`「規格外」。
- Bの9月30日JSONでは**双方のIDが未収録**。10月13日のUmaSimとの版差または資料の収録差が考えられるが、理由自体は未確定。
- Cの[GameWith「規格外」](https://gamewith.jp/uma-musume/article/show/582564)には「**上位スキル：抜山蓋世**」と掲載。さらに[Game8の「規格外」](https://game8.jp/umamusume/830015)は2026-10-13更新で同スキルをノーマルとして記載。

したがって、**金白の対応関係そのものは322/322組について別資料の裏付けが揃った**（321組はBの構造／数値ID、1組はCの名称関係）。ただし、残る1組の`204801`/`204802`という**数値IDはAに由来し、CはそのIDを独立に証明していない**。Bの全件機械照合は321/322であり、`--strict` が不合格なのは正しい。

## 工程判定

- **A（機構）：この検証器の範囲でPass**。人工データで不正ID・group・rarity・rank・○◎順序・双方向ポインタ欠損／衝突・余剰・負値非昇格の拒否を検証。実資料を全件走査して正常に判定を出した。
- **B（データ）：限定的な金白の関係は322/322に外部裏付け**。ただし322組の数値IDまで同時点の独立ゲームマスターで全件確認した状態ではない。抽出元の来歴／全カード／ヒント性能／表示順／ゲームでの因子・獲得仕様は未確認であり、**Phase 1全体のBゲートは未通過**。
- **C（実機）：未通過**。この監査はPython・GitHub ActionsのCLI処理。GitHub Pagesの現行実データによるPC・スマートフォン操作、キャッシュ復帰、間接カバーは別途実測する。
- **Phase 1全体：未完了**。対象のカード全体の収録、性能、実機と権利条件などのゲートを満たしていない。

## 再現手順

[限定的ワークフロー](../.github/workflows/skill-json-schema-probe.yml)を手動実行するか、そのワークフローを変更するPR内で実行。普通のCIやPages起動では別の公開元への通信を増やさない。

利用条件を守ってローカルで取得した同じ版を使う場合：

~~~sh
python3 poc/tools/audit_independent_skill_json.py \
  --umasim /local/skill_data.txt \
  --independent /local/skills.json \
  --umasim-revision "<UmaSimのコミット>" \
  --independent-revision "<配信データの版>"
~~~

`--strict`はA/Bの全金対応ID・上下位ポインタを外部JSONのみで照合できない場合に非ゼロ終了する。現状は**1組未収録なので非ゼロが正常**。架空データの回帰は通常CIの`test_independent_skill_json.py`にある。
