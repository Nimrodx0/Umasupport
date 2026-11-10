# 文書設計の方法論と適用範囲

この文書は、ウマサルタントのAIエージェントによる継続開発を支える情報設計の根拠と、各方法論の適用範囲を明確にします。**目的はエージェントが必要な正本・コード・テストを少ない探索で見つけて検証できること**であり、フォルダの整列や人間向けの一覧性ではありません。[構成判断のADR](../adr/0001-documentation-architecture.md)は提案として残します。

## 0. 第一の基準：エージェントにとっての発見性と検証可能性

[OpenAI Harness Engineering](https://openai.com/index/harness-engineering/)では、リポジトリに短い`AGENTS.md`を置き、詳細な設計・計画・証拠をリンク先から**必要に応じて段階的に取得する**方式を採用しています。これは参照事例であって、厳密な共通規格の認証を意味しません。

- 常時読む[AGENTS.md](../../AGENTS.md)は小さく、制約、コード・データの境界、タスク別参照先と検証方法に限定する。
- [索引](../index.md)は現行仕様、計画、判断、実際の研究根拠へのルーティングを担う。
- 計画は実施単位と受入基準、証拠は日時・固定版・反例を追跡し、長大な文書を丸ごと常時ロードしない。
- 保存場所は責任・用途・コードとの関係で決め、意味のある固定ファイル名や既存リンクを不必要に移動しない。
- **計測するべき品質**は正本発見、断絶したリンクの有無、陳腐化・矛盾の検出、再実行できる検証であって、ルートが空かどうかではない。

[CodexのAGENTS.mdガイド](https://learn.chatgpt.com/docs/agent-configuration/agents-md)は、階層ごとの指示と短い入口の扱いを説明しています。共通規則を根に置き、特定コード領域だけに適用する追加指示が必要になった場合に限り、コード近傍にネストしたAGENTS.mdを検討します。

## 1. Diátaxis：読者の目的で文書を分ける

[Diátaxis公式](https://diataxis.fr/)による4種類を、既存文書の読者が行いたい作業に応じて適用します。

| 読者がしたいこと | 文書種別 | 入口 |
| --- | --- | --- |
| 最初の操作を学ぶ | チュートリアル | [初回起動の演習](../tutorials/first-session.md) |
| ある作業を完了する | How-to／手順 | [文書更新手順](../how-to/update-docs.md)、[PoC開発手順](../../poc/README.md) |
| 定義や仕様を調べる | リファレンス | [仕様書・技術契約](../reference/index.md) |
| 採用理由や限界を理解する | 解説 | [設計判断の背景](../explanation/index.md) |

**注意**：Diátaxisの公式ガイドは、ドキュメント改善のためにフォルダ構成を強制することや、空の4分類を作ることを推奨していません（[Diátaxisの使い方](https://diataxis.fr/how-to-use-diataxis/)）。現在の`tutorials/`等は既存文書の役割を示す**便宜的な分類**であり、規格による必須フォルダではありません。skills/events/sources/qualityというevidenceの分け方も、Diátaxisではなく研究資料の主題別分類です。

## 2. WBS：成果物を階層的に分解する

[PMIのWBS定義](https://www.pmi.org/learning/library/developing-elaborating-work-breakdown-structures-7241)に沿い、上位成果物、下位作業パッケージ、成果物の受入基準を区別します。

- [ロードマップ](../project/roadmap.md)：製品W1～W5と研究P0～P5の優先順・依存関係
- [小工程](../plans/index.md)：P2.1などの作業と状態・結果・根拠
- [WBS Dictionary](../plans/wbs-dictionary.md)：成果物、前提条件、受入基準

工程内タスクを番号付けしただけで、PMIの100%ルールや工数・日程管理まで完全実装したとは言えません。**現状はWBS原則を参考にした工程管理**であり、未計画項目がない保証はありません。

## 3. ADR：重要な決定の背景と影響

[Michael NygardのADR形式](https://github.com/architecture-decision-record/architecture-decision-record/blob/main/architecture-decision-record.github.io/src/content/templates/decision-record-template-by-michael-nygard.md)を、主要な設計判断に適用します。必要な項目は状態・背景・決定・結果（正負の影響）・置換関係です。

[従来の意思決定ログ](../decisions/log.md)は利用者判断の履歴として保持し、すべてを自動でADRに変換して採用済みとみなしません。[ADRの書式](../adr/README.md)と[既存判断の索引](../decisions/index.md)は別物です。

## 4. Docs as Code：変更を継続的に検証

[Write the Docs](https://www.writethedocs.org/guide/docs-as-code/)に従い、Markdown・Git・Pull Request・コードレビュー・自動テストを用います。文書のリンクが通ることは、実装の正確性・資料の真偽・第三者の利用許可の確認とは異なります。

## 5. 情報を減らさず読みやすくする規則

- 原本の研究結果・例外・数値・日時・固定版を削除せず、別文書に再構成するときは旧版の参照先を必ず残す。
- 要約の正本をロードマップや索引とし、実験原本をevidence、現行仕様をrequirements、検証の到達点をstatusとして分離する。
- リンク修正を本文の意味の変更から区別し、移設時は[情報保持監査](../quality/documentation-integrity-review-20261110.md)を参照する。
- 未承認の設計判断やP2モデルの未検証推定を確定した製品仕様として扱わない。

本構成は**Diátaxis、WBS、ADR、Docs as Codeを目的別に組み合わせたもの**で、単一の公的規格への完全準拠・認証を主張しません。
