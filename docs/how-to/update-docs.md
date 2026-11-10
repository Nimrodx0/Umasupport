# 手順：仕様・工程・研究結果の文書を更新する

このページは具体的な文書変更を実行するためのHow-toです。[保存先の規則](../governance/documentation-policy.md)と[方法論](../governance/documentation-methodology.md)が前提です。

1. **変更の種類を決める**：有効要件は[requirements](../reference/requirements.md)、確定した判断理由は[decisions](../decisions/log.md)、現行技術契約は[architecture](../reference/architecture.md)へ。
2. **作業単位を登録**：[roadmap](../project/roadmap.md)で優先順位、[plans](../plans/index.md)で小工程ID、成果物、未完と根拠を管理する。
3. **実測と研究を分ける**：現行配信データは[status](../project/status.md)、固定出典を使った調査と反例は[evidence](../evidence/README.md)へ。
4. **重要な決定を記録**：新しい設計判断は[ADR](../adr/README.md)形式で背景・選択肢・影響を明示する。旧判断を削除しない。
5. **リンクと受入を検証**：文書を移した場合は旧パスを参照するコード・JSON・CIにも注意する。

~~~sh
node --test poc/tests/handoff_quality.test.cjs poc/tests/documentation_policy.test.cjs
node poc/tools/check_project_tracking.cjs
~~~

実ブラウザ／物理端末の確認は別のCゲートです。行っていない検証をPassと書かず、PRと未解決事項を示します。
