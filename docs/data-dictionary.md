# Data dictionary

The runtime-validated data model is in [`src/lib/schema.ts`](../src/lib/schema.ts). `schemaVersion: 1` is the dataset contract. `data/approved/dataset.json` is the only numeric observation source used by the leaderboard; `data/candidates/queue.json` is an explicitly unranked review queue, and resolved discovery claims remain archived in `data/candidates/resolved.json`. Network refreshes write a temporary source candidate, never directly into approved data.

## Dataset envelope

| Field | Meaning |
|---|---|
| `schemaVersion` | Data-model version. |
| `revisionId` | Stable identifier for the current normalized observations. It does not change for an unrelated code-only build or an unchanged conditional check. |
| `lastDataChangeAt` | Last approved observation/evidence change. A 304 check does not move it. |
| `lastSuccessfulCheckAt` | Last successful approved source check, including a reviewed metadata-only unchanged check. |
| `sourceStatus`, `sourceNote` | Snapshot freshness/status and scope note. The UI computes stale state after 72 hours without an approved check. |
| `sourceRetrieval` | Allowlisted endpoint, source generation/retrieval timestamps, HTTP 200/304 status, response SHA-256, ETag/Last-Modified, and row count. No response body is embedded. |
| `observations` | Approved source-attributed evaluation configurations. |

The source retrieval history (including HTTP 200/304 where captured) is in `data/approved/retrievals.json`; older entries with no recorded status remain null. Result/pricing corrections, source removals, and evidence revisions are summarized in `data/approved/revisions.json`. Reviewed normalized source snapshots are recorded under `data/snapshots/`; no raw feed is archived.

## Observation identity and benchmark fields

- `id`: stable observation identifier. Official IDs incorporate their upstream `config` ID.
- `upstreamConfigurationId`: exact Datacurve configuration ID, or null if the publisher supplied none.
- `model.reportedName`: source's exact string. `canonicalId` is set only by `data/sources/aliases.json` with evidence; `snapshot` remains null when unknown.
- `publisher`, `evaluator`, `sourceCategory`: publisher and evaluator are not conflated. Categories are organizer, developer, independent evaluator, or secondary.
- `benchmark`: name/version, full/subset/unknown scope, task count, unique tasks attempted/passed, attempt count, passed attempts, scored attempt count, benchmark run/trial count, exclusion policy, and population. Attempts, runs, and unique tasks are separate counts/denominators.
- `result`: selected score metric, exact metric label/value/unit, source numeric text, denominator/count, and nullable confidence interval bounds/confidence/method/counts.
- `additionalResults`: separate other score metrics, currently including pass@4 with its unique-task denominator. They are never silently folded into the primary result.
- `effort`: original label/setting, nullable reviewed order, order evidence, and missing/unmapped reason.
- `series`: explicit series ID, evidence for the grouping, connection eligibility, harness/revision, provider, evaluation policy, deployment/endpoint, timing scope, and pricing basis. Unknown values are explicit nulls.

For score presentation, `reportedValue`, `reportedUnit`, and `reportedText` are authoritative. A percentage scale is used only when the source reports `%` (or the official feed's `fraction` unit). Raw table values with unspecified units stay unscaled in the table/details/score-only view and are omitted from the percentage Y-axis; the normalized numeric field is retained separately.

## Efficiency fields

`metrics.cost`, `metrics.outputTokens`, and `metrics.time` represent means; `medianCost`, `medianOutputTokens`, and `medianTime` are separate median records. A metric record includes:

| Property | Meaning |
|---|---|
| `value` | Normalized numeric observation or explicit null. Zero is valid; negative efficiency values are invalid. |
| `unit`, `statistic` | Unit and mean/median/reported statistic. No mean/median fallback occurs. |
| `sourceField`, `reportedValue`, `reportedUnit` | Field and value/unit as reported by the source. |
| `scope`, `population`, `sampleCount` | Denominator and measured population. Timing sample count is null because the feed supplies no duration-specific count. |
| `sampleCountMissingReason`, `missingReason` | Explicit explanation for absent counts/metrics. |
| `definition`, `sourceLocator` | Metric definition and exact source field/locator. |
| `includesReasoningTokens`, `inclusionNote` | Whether output-token counts include reasoning tokens, or why that is unknown. |

`pricing` preserves directly source-reported costs and bases, plus the separate rendered-site cost when the feed/site discrepancy is known. A direct Cost/Task value can remain in `asReportedCost` while `metrics.cost` is null when the source does not define a mean/median aggregation or comparable denominator. A missing cost is never zero. No pooled multi-benchmark price is assigned to a DeepSWE row.

## Provenance and candidate queue

`provenance` records source ID/title/URL, retrieval date, SHA-256, evidence locator, publication date when known, source-review status/reviewer, independent-replication status, and notes. “Source reviewed” means transcription/provenance review, not replicated evaluation.

`data/candidates/queue.json` contains pending leads with reported claim text, source category/URL/locator, unknowns, and a reason for remaining pending. Candidate facts are not observations and are not included in official/combined numeric views or normal exports. The review page's local submission form downloads a pending JSON draft and does not upload it.

`data/candidates/resolved.json` retains the original candidate claim and its resolution date, rationale, and matched approved observation ID. Resolved candidates are not re-added as observations and are not shown in the pending review queue.
