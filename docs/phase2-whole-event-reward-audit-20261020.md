# Phase 2② 全件結果・数値スキルヒント照合（2026-10-20）

## 目的

[第1工程の一意タイトル仮照合2,039イベント](phase2-whole-event-intake-plan-20261020.md)について、**全選択肢・全結果のスキルID＋ヒントLv**をGameTora由来構造JSONと既存Checker候補DBで比較する。通常／連続イベントの両方を対象。実ゲームの結果経路を証明するものではない。

- 実装：`poc/tools/audit_whole_event_rewards.cjs`
- 固定JSON入力：GameTora由来 `systemless10/UmamusumePS` SHA `6e38b54af4fad397ff4491e63007a90705a4fe67`
- 比較資料：Checker SHA `8cf9fcb3cc7239041161be75c84daf9f8f22d29f` に基づく `checker_explicit_result_facts.v1.json`、`checker_event_hints.v1.json`
- 全イベントの照合索引：Actions内で再生成する `whole_event_provisional.v1.json`
- 実行：`.github/workflows/whole-event-inventory.yml`。ソースサイト直接取得やGameWith大量GETなし。イベント本文・選択肢名・選択効果の原文・第三者の元JSONを本番Gitへ収録しない。

## 計算する全件の状態

同一タイトルと判定されたイベントでも、**選択肢の序数が一致することは、ゲーム上で同じ選択を意味する証明ではない**。先に選択肢の件数一致を確認し、件数不一致の9イベントは比較不能として抽出する。

選択肢ごとに両ソースの**記載された**数値スキルIDとヒントLvの多重集合を照合し、次の区分に振り分ける。

- `numeric-multiset-agreement`: 両側に数値ヒントの記載があり、その多重集合が一致。あくまで列挙の一致であり、正しい獲得条件・ヒントの保証ではない。
- `numeric-multiset-disagreement`: 両側に記載があり、数値／ヒントLv／重複回数が違う。
- `source-only-numeric-hints` / `checker-only-numeric-hints`: 一方だけに記載。**一方の空白をスキルなしと解釈しない**。
- `no-numeric-hints-observed`: 両側とも数値スキルヒントがない。**スキル報酬なし確定ではない**。
- `unresolved-hint-representation`: 未解決スキルID、可変ヒントLv、`skill_hint_or`／獲得スキル等、通常の単一ID・単一Lvと同じに扱えない。
- `prior-conditional-needs-review`: 前段成功マーカーや先行結果条件等があるため、効果を無条件に平坦化できない。

Checkerの「成功・失敗」等の見出しとGameToraの`outcomes`は必ずしも同じ順序で並ばない。両側に明示結果群があり、各群のスキルID＋Lvを順序**なし**で照合できる場合に限り `unlabeled-outcome-signature-agreement` を計数。これは**成功・失敗との対応が取れた証拠ではない**。結果群数・集合が異なる場合は別件レビュー。

対象全イベント・全選択肢の分類結果を数値と識別子だけで監査artifactに保存。出典の編集文・選択肢文をコピーしない。ユーザーUI、通常の公開DB、金スキル提供計算は変更しない。公開承認済みの実イベントは0件のまま。

## 次工程

今回の結果から「記載スキル一致」「片側不足」「Lv差」「結果枝の並び・前段依存」「そもそも選択肢数が違う」をカード・イベント単位で優先分類する。

次は**全連続イベント**について、打ち切りの有無だけでなく通常継続・前段結果による分岐条件を調べる。同時に、両資料間で一致した数値ヒントも元のゲーム版・資料独立性と公開可能性を別途検証する。

当該報告は `forSkillGrant:false`、`releaseApproved:false`、`routeVerified:false`、`gameVerified:false` の未承認候補である。
