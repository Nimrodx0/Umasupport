# 情報保持と文書体系の監査（2026-11-10）

対象は[PR #384](https://github.com/Nimrodx0/Umasupport/pull/384)とその直前のmain（コミット 1e366e2e5513d19171606b77b16a59a06c1f2e3a）。**文書内容の保存性を調べた監査**であり、実ゲームの最新仕様・法的再利用条件を再承認するものではありません。

## 1. 移設した原本の検査

- 対象：docs直下からevidence配下へ移動したMarkdown **214件**。
- Gitの内容ハッシュが一致するもの **101件**、移設に伴うリンク変更があるもの **113件**。
- [比較スクリプト](../../poc/tools/audit_doc_reorg.cjs)は、移設した214件の**全見出し、数値トークン、リンク先を正規化した本文**の一致を確認し、差異を報告します。今回の実行では214件とも一致、構造上の消失は検出されていません。
- マークダウンのローカルリンクは[既存のCIテスト](../../poc/tests/handoff_quality.test.cjs)で全ファイルを検査します。

## 2. 要約した文書の保存

短縮・再構成された次の文書は、改修前の全文を[2026-11-10直前のアーカイブ](../archive/pre-reorganization-20261110/)に保存しました。リンクは移動先に合わせて修正しています。

- [roadmap](../archive/pre-reorganization-20261110/roadmap.md)
- [status](../archive/pre-reorganization-20261110/status.md)
- [documentation-policy](../archive/pre-reorganization-20261110/documentation-policy.md)
- [index](../archive/pre-reorganization-20261110/index.md)

従来の2026-11-05までのアーカイブだけでは、11月9日の研究経過まで保存できるとは限りません。Git履歴に加え、現在のリポジトリから旧版を確認できるようにしました。

## 3. 方法論の適用

- [Diátaxis／WBS／ADR／Docs as Codeの対応表](../documentation-methodology.md)を追加。
- 工程は[WBS Dictionary](../plans/wbs-dictionary.md)で成果物・依存関係・終了条件を定義。
- [ADR](../adr/README.md)は決定記録用の形式とし、未承認の提案を採用済みと断定しません。

## 4. 限界

リンクの構造が通ることや数値トークンが一致することは、**読者にとっての意味の完全一致**、現行ゲームでの事実性、外部素材の利用権まで証明するものではありません。また個別文書の長い段落や時系列追記は、原文を維持した上で今後さらに編集できます。

検証対象の分母、見出し階層、文書種別ごとの残課題は[文書構成レビュー台帳](document-review-inventory-20261110.md)にも整理します。
