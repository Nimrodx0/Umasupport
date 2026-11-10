# Architecture Decision Records（ADR）

## 役割と状態

**設計上の重要な選択肢とその理由**を記録する場所です。ユーザーが決めた製品要件・優先順位・利用条件は[decisions/registry.json](../decisions/registry.json)を状態索引、[判断の原文](../decisions/log.md)を原典として管理します。ADRに利用者判断をコピーして独立した第二の正本にしません。

新規ADRを作る判断基準：設計・データ構造・外部インターフェース・実行方式の選択に**代替案と長期的な帰結**があり、あとから「なぜその方式か」を説明する必要がある場合。小さなリファクタリング・実装状況・調査報告はADRにしません。

状態は `Proposed`（提案中）、`Accepted`（明示的に採用）、`Rejected`（不採用）、`Superseded`（新しいADRで置換）です。

- 提案時：新規ADRに一意の番号・提案日・対象と決定権限・背景・制約・代替案・判断基準・影響・根拠を記録し、レビューPRに関連づけます。
- 採用時：**採用した判断の主体とその根拠（明示的な利用者指示、レビューでの採用記録など）**、採用日を残して`Accepted`へ変更します。PRを作った・CIが成功した・実装を先に行ったというだけでは自動的に採用とはしません。
- 置換時：旧ADRを削除・改稿せず、新ADRを作成して旧ADRの状態を`Superseded`とし、新番号を明示します。引用しているコードや現行仕様へのリンクも確認します。
- 却下時：却下理由と日付を残して`Rejected`とします。将来同じ案を提案するときも旧記録を再利用・上書きしません。
- 他の資料との接続：判断元のD-/R-IDがあれば必ず参照し、ユーザーの判断と実装選択の境界を明示します。

**重要**：ユーザー判断に含まれる技術的方向性が、必ず独立したADRを必要とするわけではありません。根拠の大きな設計判断を選別して記録します。

## 記録の形式と索引

新規ADRは[テンプレート](template.md)を複製して`NNNN-short-topic.md`として作成します。全ADRはこの索引に追加し、採用・置換を更新します。

- [ADR-0001：文書体系をどう分類するか](0001-documentation-architecture.md)（`Proposed`：レビュー中）
- [利用者の判断状態索引](../decisions/index.md)

参考：[Architecture Decision Records（Michael Nygard）](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) ／ [英国政府GDS ADR運用](https://gds-way.digital.cabinet-office.gov.uk/standards/architecture-decisions.html)。
