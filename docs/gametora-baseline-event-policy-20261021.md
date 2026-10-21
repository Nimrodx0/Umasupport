# Event policy: GameTora baseline, GameWith adjudicator (2026-10-21)

## Decision and correction

**GameTora-derived event JSON is the foundation of the Umasupport support-card event database.** GameWith is **not** an upstream source from which we reconstruct every card and event. Its role is the designated *tie-breaker/adjudicator* for **specific doubts** in the GameTora base: missing rows, conflicting reward numbers, ambiguous event identity, conditional termination or results that cannot be interpreted consistently.

This supersedes the mistaken GameWith-first interpretation introduced in PR #121. The clarification was made explicitly by the user. The original source-preference rule “prefer GameWith for disputed values” remains meaningful **only inside an adjudication of a disputed GameTora fact**.

### Sources and their responsibilities

| Role | Source | How used |
| --- | --- | --- |
| **Baseline** | GameTora-derived `systemless10/UmamusumePS` support event JSON | Primary event set, choices, result branches, hints, regular chain continuation and explicit exceptions |
| **Adjudicator** | GameWith card-specific article | Resolve flagged contradictions, absent source cards, unclear branch semantics or suspected inaccurate GT data. An explicit card/route evidence record is required for an override |
| **Gap and anomaly discovery** | Checker, Game8, historical game master, U-tools and independent title/skill audits | Detect suspicious GT rows, missing coverage, changes and inconsistent source content. Do not auto-replace GT with these sources |

The pinned source used for reproducible baseline audits is `systemless10/UmamusumePS@6e38b54af4fad397ff4491e63007a90705a4fe67`. Current-game completeness is not implied by a pinned historical snapshot.

## Ordinary continuation semantics

A non-final GameTora chain-stage outcome **without `chain_end`** is interpreted as an **ordinary continuation by default**. An outcome with `chain_end` is marked as a **terminal exception**. This rule follows the fact that sources conventionally describe special terminations rather than explicitly stating the absence of every exception.

- Stage-order adjacency is used as the *candidate next stage* but is **not independently verified game topology**. Ambiguous chain grouping or stage order is a targeted flag, rather than a reason to require GameWith confirmation on every route.
- Success/failure-specific `chain_end` must remain attached to its individual outcome, not silently generalize to the whole choice.
- `both_previous_chain_good` and other prior-result markers can change **rewards**, not necessarily access to the next event. Keep these semantics separate.
- For the last observed chain stage, do not invent a next event merely because `chain_end` is absent.
- A specific suspicious result remains **pending GameWith adjudication** until its verdict is recorded; unaffected GameTora results continue to work with GT values.
- If the exact card / event / choice / result does not exist in the GT snapshot, record a **coverage gap** and investigate via GameWith; do not fabricate a GT entry.

## Implementation

- `poc/config/event-source-priority.v1.json`: version 2 of the source-policy configuration. GameTora is the baseline; GameWith is the exception resolver.
- `poc/src/gametora_event_resolution.cjs`: derive numeric route decisions from **GT documents**, preserving per-outcome `chain_end` and default non-final continuation. Optional explicit per-route `flaggedRoutes` and `gameWithDecisions`. Adjudication requires exact source position, GameWith article URL, reviewer, review date and article content digest. Decisions cannot rewrite an unflagged route.
- `poc/src/event_source_precedence.cjs`: numeric effects default to the pinned GameTora value. If a disagreement or explicit suspicion is present, adjudicate against GameWith; a Game8-only disagreement does not replace the baseline. No GT claim remains an explicit gap.
- `poc/tools/report_gametora_baseline.cjs`: apply the baseline policy to the complete pinned support JSON snapshot, report numeric-only progress and verify fixed population totals. The dedicated inventory Action runs this alongside existing comparison checks.
- `poc/tests/gametora_event_resolution.test.cjs` and `poc/tests/event_source_precedence.test.cjs`: synthetic regression tests for ordinary, explicitly terminated, dispute-pending and GameWith-adjudicated routes.

The mistaken GameWith-first runtime/CLI and tests added in PR #121 have been withdrawn. The pre-existing offline `import_gamewith_article.py` and its support index are **still useful for exceptional GameWith consultations and missing GameTora rows**; they are **not a mandatory precursor for every event**.

## Whole-population handling

The existing GameTora-derived pinned snapshot covers **559 of the 563 pinned roster cards** and contains **1,069 chain events and 1,713 expanded chain routes**, with **91 explicit terminal outcome routes**. The remaining four cards are coverage exceptions, not proof of no events. The separate whole-event candidate union currently observes 2,558 entries, but that is not proof of all current in-game content.

A practical next release pipeline:

1. **Normalize GT to a local, non-published event database**, preserving source card/event/choice/result identity, numeric facts, and source revision. Treat no `chain_end` as ordinary continuation where stage topology is usable.
2. **Generate only the exception queue**: missing cards/events, choice count or identity mismatch, numeric skill ID/Lv discrepancy, same-title conflicts, special reward dependency that the schema cannot encode, and explicit contradictory termination claims. Flag the *smallest* route or numeric fact possible.
3. **Query GameWith only for those exceptions.** Resolve or mark pending; record the exact source page and the chosen value with its provenance. No blanket GameWith crawl.
4. **Convert the adjudicated GT database to independent public facts**, only after checking skill IDs, branch semantics, provenance, editorial text/republication conditions and `event_release_gate`. Normal GT routes need **no GameWith URL each**.
5. **Independently audit coverage and future changes** using other sources, and rerun the pinned snapshot checks after updating revisions.

## What this does not yet do

The source policy and numeric-only baseline audit are **not an automatic publication license**, proof of current live gameplay, or a complete public event database. The production `poc/data/reviewed_events.v1.json` remains empty until the normal publication gates and skill/route conversion succeed. The new policy removes the unnecessary requirement to inspect **every GameWith article** before adopting regular GameTora routes.
