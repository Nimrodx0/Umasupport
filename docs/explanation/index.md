# 解説：技術設計の背景と判断理由

「なぜこの構成なのか」を理解する入口です。以下は各分野の資料への案内であり、古い判断の再承認ではありません。

- [現行アーキテクチャ](../reference/architecture.md)：静的サイト、起動時の外部取得、承認済みイベントJSONという役割分担
- [データソースと採用契約](../reference/data-sources.md)：出典の違い、GameTora派生JSON、GameWithによる個別裁定
- [公開ゲート](../how-to/checker-public-catalog.md)：技術的に抽出できることと、正確性・公開許可の違い
- [スキル発動条件の研究設計](skill-activation-tendencies-design.md)：ゲーム内の明示条件と、GlobalSimのモデル推定を区別する理由
- [意思決定ログ](../decisions/log.md)：採用・撤回に至る判断の背景
- [文書構成の判断](../governance/documentation-methodology.md)：資料の整理方法と方法論の適用範囲

現在の定義を調べる場合は[リファレンス](../reference/index.md)へ戻ってください。
