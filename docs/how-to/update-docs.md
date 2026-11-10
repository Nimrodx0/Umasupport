# 手順：仕様・工程・判断・研究結果を更新する

このHow-toは、AIエージェントとレビュー担当者が**同じ正本を更新し、更新漏れをCIで検出する**ための実行手順です。[文書運用規約](../governance/documentation-policy.md)を参照します。

## 更新対象を確定する

1. **有効要件・技術契約**：[要件](../reference/requirements.md)・[アーキテクチャ](../reference/architecture.md)・[イベントスキーマ](../reference/event-schema.md)。実装とテストが一致するか確認する。
2. **実施順・未完**：[ロードマップ](../project/roadmap.md)と[小工程](../plans/index.md)、現在の確認済み[status](../project/status.md)。日時付きのデータ根拠は[evidence](../evidence/README.md)へ。
3. **利用者の新しい確定判断**：[原文ログ](../decisions/log.md)へ見出しを追加するか独立した判断文書を作り、[状態台帳](../decisions/registry.json)へ一意ID・出典・判定状態・後続ID・根拠・判定日を登録する。判断ログの見出しにも同じIDの安定アンカー（既存の`decision-d-001`と対応するHTMLアンカー形式）を付ける。既存判断を消さず、置換関係を付ける。
4. **設計上の重要な選択**：代替案と長期的影響がある場合だけ[ADRテンプレート](../adr/template.md)を使う。提案→採用→置換の条件と証拠は[ADR運用](../adr/README.md)。利用者判断をADRへ重複コピーしない。
5. **現行手順の変更**：[How-toの入口](README.md)に現行指示を置き、撤回した作業や固定結果の全文は[evidence](../evidence/README.md)へ保存する。歴史的「現在」「公開0件」を実行指示にしない。

## 更新後に実行する検査

```sh
node poc/tools/build_decision_index.cjs --write
node poc/tools/build_decision_index.cjs --check
node --test poc/tests/docs_integrity.test.cjs poc/tests/handoff_quality.test.cjs poc/tests/documentation_policy.test.cjs
node poc/tools/check_markdown_anchors.cjs --strict
node poc/tools/check_project_tracking.cjs
```

新規・編集した判断文書は状態台帳に対応づけ、非公開の出典や記事表現を無断で公開しない。固定コミットと資料パスが同時に正しいか確認する。アプリの機構A・データB・実ブラウザCは別の受入ゲートであり、CI合格で未実施のCをPassにしない。

## PRレビュー時のチェック

- 変更した正本の理由と、その変更を要求した利用者判断またはADRの参照
- 旧資料を保持したこと、利用者承認の範囲、固定版とハッシュの整合
- 実コード・JSON・CI・現行ドキュメントの変更が対応していること
- 自動テストの実施結果と、未実施の確認事項の明記
