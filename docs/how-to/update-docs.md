# 手順：仕様・工程・判断・研究結果を更新する

このHow-toは、AIエージェントとレビュー担当者が**同じ正本を更新し、更新漏れをCIで検出する**ための実行手順です。[文書運用規約](../governance/documentation-policy.md)を参照します。

## 更新対象を確定する

1. **有効要件・技術契約**：[要件](../reference/requirements.md)・[アーキテクチャ](../reference/architecture.md)・[イベントスキーマ](../reference/event-schema.md)。実装とテストが一致するか確認する。
2. **実施順・未完**：[ロードマップ](../project/roadmap.md)と[小工程](../plans/index.md)、現在の確認済み[status](../project/status.md)。日時付きのデータ根拠は[evidence](../evidence/README.md)へ。
3. **利用者の新しい確定判断**：[原文ログ](../decisions/log.md)へ見出しを追加するか独立した判断文書を作り、[状態台帳](../decisions/registry.json)へ一意ID・出典・判定状態・後続ID・根拠・判定日を登録する。判断ログの見出しにも同じIDの安定アンカー（既存の`decision-d-001`と対応するHTMLアンカー形式）を付ける。既存判断を消さず、置換関係を付ける。
4. **設計上の重要な選択**：代替案と長期的影響がある場合だけ[ADRテンプレート](../adr/template.md)を使う。提案→採用→置換の条件と証拠は[ADR運用](../adr/README.md)。利用者判断をADRへ重複コピーしない。
5. **現行手順の変更**：[How-toの入口](README.md)に現行指示を置き、撤回した作業や固定結果の全文は[evidence](../evidence/README.md)へ保存する。歴史的「現在」「公開0件」を実行指示にしない。

## 新しい用語・数量指標を作る、既存名称を変える場合

1. [用語・定義の正本](../reference/terminology.md)と該当領域の現行仕様・研究設計を探し、**既存概念を再命名しただけか、新概念か**を先に確認する。
2. 新概念なら、対象・他概念との差異、初出の定義と、数量指標では**何と何の差か、分母・単位・時間窓・集計範囲・適用限界**を記載する。曖昧な造語・循環定義を避ける。研究用仮称と確定した製品用語を区別する。
3. 複数工程にまたがる場合は**定義を一か所だけ正本化**し、共通用語索引へ優先名称・参照先・旧称を登録する。分野固有の定義をむやみにコピーしない。利用者に単独で提示する説明では定義を省略しない。
4. 変更理由と旧称との対応を示し、影響する現行資料・UI・表見出し・コード内の説明・テストを点検する。**履歴の原文や固定の研究原本を一律置換しない**。横断棚卸しは[文書品質D.3](../plans/documentation-maintenance.md)で管理する。

## 新しい独立工程・トラックを設ける場合

上位計画に位置づける新しいトラック（製品W・研究Pと独立したDなど）を作成するときは、**詳細計画のファイルを追加するだけでは完了しません**。最低限、次の既存入口に導線・責任範囲が必要かを確認し、実際に該当する場合は同じPRで更新します。

1. [`project/roadmap.md`](../project/roadmap.md)：並行トラックの目的、既存工程との境界と優先順位関係を短く記載する。
2. [`project/README.md`](../project/README.md)：上位計画の入口から新トラックを発見できるようにする。
3. [`plans/index.md`](../plans/index.md)：実行可能な詳細計画の正本へリンクする。
4. [`docs/index.md`](../index.md)：その種類の作業を開始する人・エージェント向けの導線を用意する。
5. [`AGENTS.md`](../../AGENTS.md)：常時参照が必要な運用上の約束が生じる場合だけ短い参照を追加する。時点依存の進捗や詳細をコピーしない。

**不要な更新は強制しません**。既存トラック内の個別工程・実験だけなら、該当するplans・evidence・statusを更新し、上位索引には新しい責任範囲が生じた場合にだけ追記します。異なる文書へ同じ進捗本文を複製せず、**一情報・一正本**を守ります。

PRレビューでは、新トラックの計画本文だけでなく、`project` → `plans`の到達経路と`docs/index`からの到達経路を実際に辿り、対象のリンク/アンカー検査を通します。今回のDトラックはこのチェックが初回に漏れたため、[入口確認の回帰テスト](../../poc/tests/documentation_policy.test.cjs)を追加しました。
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
