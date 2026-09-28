# Methodology and caveats

DeepSWE Explorer aggregates published result observations. It does not rerun the benchmark or compute a synthetic overall model index. A source record can be transcription-reviewed without being independently reproduced.

## Observation, configuration, and series

One observation is one source-attributed evaluation configuration. The official Datacurve v1.1 feed identifies each configuration and says the dataset covers imported Pier jobs grouped by harness, model, and reasoning effort. The explorer imports all validated feed rows, retains exact model and effort strings, and uses a reviewed per-model order map from [`data/sources/effort-order.json`](../data/sources/effort-order.json). That order controls path sequence only; it does not claim equal compute across models or vendors. Unknown and unmapped effort settings remain isolated dots when a measured X value is available.

Series IDs include the source feed, exact model string, harness, reported provider when present, score metric, and scored-attempt population. Developer and independent reports have separate IDs even when an alias map supports a shared display identity. Missing protocol values do not join unrelated series. Lines connect actual ordered observations only; they are straight, unsmoothed segments and do not imply measurements or significance between configurations.

## Score metrics and denominators

- **pass@1:** the Datacurve feed defines this as pass rate over scored rollout attempts. The original Datacurve paper instead defines pass@1 as an equal-task-weighted mean of per-task first-rollout pass fractions; Artificial Analysis averages pass@1 across three attempts per task. These are separate source experiments and denominator descriptions.
- **pass@4:** the feed defines this as tasks with at least one passing rollout divided by tasks attempted. The original paper similarly reports the fraction solved by at least one of up to four attempts. Both use a task denominator, but paper and feed observations remain separate.
- **Reported score, metric unspecified:** developer and independent reports are retained separately when their source does not establish the exact statistic. They remain selectable as source-attributed scores and are not silently converted to pass@1 or pass@4.

The original paper does not state its DeepSWE benchmark version. Its 16 full-113-task observations therefore use a null version and are excluded from strict version matching; they are not relabeled as v1.1.

The source's exact numeric precision is preserved. Explicit percentages are normalized to a fraction for percentage-scale display. Unmarked raw table values keep their source text and an unspecified unit; their internal normalized numeric value is not displayed as a percentage or plotted on the percentage-score axis. Source wording and reported values remain available. Display rounding occurs only after Best projection selection.

The official source's 95% run-to-run interval uses its stated standard-error formula across repeated whole-benchmark passes. The interval method and bounds stay on each measured point. No interval is inferred for source reports that omit one, and no continuous confidence band is drawn. Small differences should not be called decisive from this interval alone.

## Cost, tokens, and time

The three X metrics are independent source measurements:

| Metric | Stored field(s) | Population and scope | Important limit |
|---|---|---|---|
| Cost | `mean_cost_usd`, `median_cost_usd` | USD per scored rollout attempt | Preserve `cost_basis` where present; unknown basis is not filled from another evaluation or today's rates. |
| Output tokens | `mean_output_tokens`, `median_output_tokens` | Output tokens per scored rollout attempt | Do not substitute input tokens or agent steps. Reasoning-token inclusion is not consistently established. |
| Time | `mean_duration_seconds`, `median_duration_seconds` | Reported seconds over scored rollout attempts | The feed does not provide duration-specific sample counts or timer start/end, tool/retry/setup/queue/verification inclusion, timeout handling, serving endpoint, or environment. This is not labeled verified end-to-end wall-clock time. |

For official Datacurve observations, the cost axis is the source-reported mean or median USD per scored rollout attempt. Score-only reports keep cost, tokens, and time null unless the cited source provides a measurement for that same experiment and scope. Mean and median remain separate values. Switching the statistic never falls back to the other. A null stays missing; a reported zero remains zero on a linear axis and is omitted with a reason on a log axis. Negative efficiency values fail schema validation. Missing X values break a connected path and do not erase the score observation. When the source score explicitly uses percent or fraction units, it also appears as a dashed horizontal score-only reference; its span carries no X value or efficiency comparison. Raw scores with unspecified units remain off the percentage axis.

The optional, default-enabled **Include usage scenarios** layer adds separate hollow-diamond estimates for the exact Artificial Analysis GPT-6 Luna/Codex/max and Opus 5.5/Claude Code/max score rows. Each point reuses that row's reported score and carries inferred mean cost/output tokens only; it never changes the underlying observation or connects to a measured effort path. Scenarios are omitted in strict comparisons, median views, and time views. Their qualitative evidence quality and calculation details appear with the point and in the separate scenario exports.

The feed unit says efficiency aggregates cover scored rollout attempts; its policy says context-window failures and agent timeouts are scored failures while provider/verifier/network errors are excluded. Attempt counts are not unique task counts. The source exposes a CI attempt count, but that is not treated as a duration-specific sample count.

## Strict comparison and Best

Strict mode requires known benchmark version/task-set revision, task scope/count, the selected score metric and denominator, evaluator, measured population/exclusion policy, provider/deployment configuration, harness/revision, and evaluation/timeout policy. It also requires selected-metric scope and a known cost basis, reasoning-token inclusion, or timing boundaries/sample count as applicable. The remaining complete observations are grouped by an exact compatibility fingerprint; the interface requires selecting one group. It never overlays incompatible groups or silently chooses the largest group. Unknown values fail closed and an exclusion reason is shown. Current feed rows do not pass strict timing scope because their boundaries and duration-specific sample counts are unspecified.

All configurations are the default. Best is a non-destructive display projection: choose the maximum full-precision score only inside one explicit source/protocol series. Tied best configurations remain visible. Best does not merge model aliases or publishers.

## Attribution, review, and updates

Source category (`organizer`, `developer`, `independent`, `secondary`), document-review status, and independent-replication status are distinct. Each row links its original source and evidence locator, records a retrieval date/hash, and lists known gaps. Pending community discoveries appear only in the Review queue and are excluded from approved charts, result tables, and all-observation exports.

The scheduled refresh allowlists only the structured Datacurve v1.1 endpoint, retries a bounded number of times, rejects invalid/empty feeds and suspicious mass removals, and stages normalized facts for review. It never updates numeric approved observations. A successful 304 check or 200 fetch with no normalized changes may be proposed as a metadata-only PR; merging it changes freshness metadata but not measurements. Last data change, last approved source check, and last deployment are displayed separately.

## Cost reconciliation and source constraints

For `mini_swe_agent_gpt_5_6_sol_max`, the retrieved JSON reports mean cost `$8.386436346666667`; the rendered All effort levels table showed `$6.46`. The changelog documents pricing updates but not a complete row-level formula. Both values and evidence are retained, the difference remains unresolved, and no multiplier is guessed.

Artificial Analysis's Coding Agent Index cost, total-token, and time fields are pooled across DeepSWE v1.1, Terminal-Bench 4.0, and SWE-Atlas-QnA. Its token categories include input, cached input, cache-write, reasoning, and output, but there is no per-benchmark split. They are suite references, not DeepSWE usage measurements. The two default-enabled, optional chart scenarios use the matching AA DeepSWE source scores and separate calibration inputs: output tokens transfer from AA Intelligence Index output-only tokens/task using exact-effort DeepSWE/AA output ratios; cost uses an independent same-provider cost calibration. The mixed Coding Agent suite token totals are never substituted as output tokens, and cost is never converted into tokens. The scenarios are cross-harness, mean-only, qualitatively low/very-low confidence, and excluded from strict comparisons. Any displayed sensitivity envelope is a small-sample observed range, not a confidence/prediction interval; Opus 5.5 has no defensible range. See [the research record](usage-estimation-research.md) and its checked-in numeric inputs. Fireworks directly reports four Cost/Task values with its own pass@1 table; they are retained in the four Fireworks observations' `pricing.asReportedCost` fields. Version, harness, task count, run identity, and cost accounting are unspecified, so the costs are not normalized as mean/median cost metrics and are not used in these scenarios. No rate-card price is used to infer cost, tokens, or time.

No feed-specific redistribution license was found. The repository publishes only attributed normalized result facts and provenance—not raw upstream JSON, benchmark task text, solutions, trajectories, or source documents. See [licensing and attribution](licensing.md) and the [source register](source-registry.md).
