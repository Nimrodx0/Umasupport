# 旧ゲームマスターと現行UmaSimの限定的クロスチェック

更新：2026-10-17　関連：[検証計画](verification-plan.md) / [スキル監査](skill-hierarchy-coverage.md)

## 目的

2026年のスキル分類と独立に収集されたゲームマスターの対応を、利用可能な過去の実データで実測する。ただし**古いマスターで2026年の322組全件を確認できたとは解釈しない**。

| ソース | 固定版 | 最終データ更新 |
|---|---|---|
| [UmaSimスキルデータ](https://github.com/mee1080/umasim/blob/cf9366f6a487bd8f197b53d8a11981207beb9f6c/data/skill_data.txt) | `cf9366f6a487bd8f197b53d8a11981207beb9f6c` | 2026-10-13 |
| [公開アーカイブのmaster.mdb](https://github.com/SimpleSandman/UmaMusumeMetaMasterMDB/tree/5a8ec1356859a35e245edef0d40da740e652df68/master) | `5a8ec1356859a35e245edef0d40da740e652df68` | 2025-10-10 |

## 実行方法と安全性

[限定的GitHub Actions](../.github/workflows/historical-skill-master-audit.yml) は、ワークフローファイル自身のPR変更時または手動のときだけ実行する。**通常CIとPages起動に外部取得は増やさない**。固定版の公開データを一時的なランナーディレクトリへ1回ずつダウンロードし、終了時に破棄する。第三者生データをこのリポジトリ、公開JSON、Actionsアーティファクトに保存しない。ログには件数、判定分類、SHA-256のみを出す。

`poc/tools/verify_skill_master.py` をあえて `--strict` なしで呼び出す。古いマスターに存在しないIDが大量にあるのは予測可能であり、同時期の完全一致と偽って失敗させない。

## 判定の意味

- `independent_master_order_agrees`：両版に同じIDがあり、グループ・金白レアリティ・昇格順序も一致した。
- `master_missing`：2025年版に2026年のIDがない。2026年データの誤りとはいえない。
- `master_extra_group_members`：同じグループの構成員が2025年版と異なる。版差・解析の問題を追加調査。
- `master_rank_order_conflict`：共有IDの昇格順に不一致。データソースまたはロジックを調査。
- `master_supports_no_lower_in_snapshot`：2025年版にも白下位がない。2026年版の不在を保証しない。

## 実測結果

ワークフロー成功後に、実行URLと件数・未解決分類をここへ追加する。事前段階で結果を推定して記載しない。

**Phase 1のB（現行322組の独立全件確認）とC（Pages/スマホ実機）は引き続き未完了。**
