# Usage mechanism architecture review

Review date: 2026-10-04. Scope: structural workflow for cost, output-token and reported-time X coordinates; no implementation changes, live fetching, or empirical accuracy backtest. Existing unrelated work was preserved.

## Recommendation

Yes: make placement easier by consolidating source facts and selecting evidence **per metric**, using the existing exact observation matcher, metric selector, calibration functions and refresh safety utilities. The highest-value first step is a small resolver in `src/lib/usage-scenarios.ts` plus a normalized fact/config section in the existing research artifact. It should preserve today's numerical results, source labels and chart precedence. A subsequent bounded source-refresh adapter can update that section without hand-editing model-specific TypeScript.

This improves ingestion speed, reproducibility and maintenance. It does not establish prediction accuracy for currently weak transfer scenarios. Sparse sources must still produce missing X values. The independent accuracy review should determine whether any transfer methods should change.

## Implemented hierarchy and boundaries

There are two different decisions: **which observation gets a chart mark** and **which usage value that observation carries**. They must remain separate.

### Chart observation precedence

- `src/App.tsx:99-102` computes Datacurve precedence from the full approved dataset and removes suppressed observations before chart filters. Suppressed source reports remain in the evidence table and exports.
- `src/lib/comparison.ts:158-219` normalizes model labels for this display decision, checks known canonical-ID/snapshot conflicts, benchmark version/scope/task-count/revision conflicts, and recognized score-metric compatibility. Missing version alone is not a conflict. Effort and harness intentionally are not precedence keys.
- This is **not** an identity map for borrowing usage. The exact scenario matcher must never reuse the looser precedence normalization.
- Precedence does not depend on the active X metric, mean/median control or availability of Datacurve usage. A suppressed external report should not reappear merely because an external source has a useful metric.

### Approved measured coordinates

- `src/lib/comparison.ts:21-25` selects precisely cost/output/time and mean/median observation fields. There is no mean-to-median or median-to-mean fallback.
- `src/lib/normalize.ts:231-264` directly maps Datacurve's six mean/median source fields. Duration-specific sample counts remain null, timer boundaries remain unspecified, and output reasoning inclusion remains unknown.
- `src/lib/normalize.ts:531-553` accepts supplied approved-report metric objects; otherwise usage is missing. An approved screenshot-derived source-chart cost is a specific exception: it lives in `metrics.cost` with statistic `reported`, approximate reading bounds and unknown aggregation. It is displayed under the Mean control without being declared a reported mean.
- `src/lib/normalize.ts:555-568` keeps raw source Cost/Task in `pricing.asReportedCost`; it is not automatically promoted to mean or median usage. `src/components/ResultsTable.tsx:61-65,108` shows it as a non-mean/median source fact.

### Optional scenario/reference coordinates

`src/lib/usage-scenarios.ts:435-439` assembles 17 explicit targets. The current mechanism is author-selected configuration, **not a general runtime source-priority resolver**:

| Target/source family | Output | Cost | Time |
|---|---|---|---|
| Seven original AA variants | Exact AA DeepSWE `mean.outputTokens`, from TypeScript table | Four separate Datacurve same-model/max experiment references; Sol/Luna use OpenAI through-origin fit; Opus 5.5 uses one Opus predecessor ratio | Four separate Datacurve references; Sol/Luna use mean of two time ratios; Opus 5.5 uses one predecessor ratio |
| AA Fable plus two exact DeepSeek snapshots | Exact AA DeepSWE output means | Same-AA-row three-benchmark suite proxy, unchanged | Missing |
| Four Fireworks reports | Missing | Exact source Cost/Task, aggregation and denominator unspecified | Missing |
| Google developer high-thinking row | Separate Datacurve experiment reference | Same separate experiment reference | Missing |
| Meta and xAI developer rows | Explicit two-predecessor Intelligence Index aggregate-output transfer | Explicit two-predecessor Intelligence Index cost/task transfer | Missing |

Implementation references:

- `usage-scenarios.ts:13-32`: eight AA direct-output literals and source records.
- `usage-scenarios.ts:195-244`: exact AA suite checks; direct reference checks; direct AA output; cost/time method selection and calculation.
- `usage-scenarios.ts:325-389`: AA suite proxies, Fireworks costs, and Fable/DeepSeek direct output attachment.
- `usage-scenarios.ts:393-432`: Google/Meta/xAI branches and their references/transfers; the separate Muse Code same-model/max output is context, not substituted for Meta's mini-swe-agent run. Grok Build xhigh cannot become the xAI high target.
- `usage-scenarios.ts:442-455`: exact observation ID, reported name, publisher, source category, harness, both effort fields, benchmark version and primary score metric/text checks. Fireworks additionally checks its raw reported cost. Snapshot/source-ID/hash are not checked here.
- `usage-scenarios.ts:459-472`: every scenario/reference is disabled in strict and median views. `_metric` is currently ignored by eligibility; missing selected-metric values are resolved downstream.

### Rendering and export

- `src/App.tsx:172-183` selects eligible scenarios; `ExplorerChart.tsx:159-192` constructs measured points and scenario points independently. There is no explicit measured-first fallback preventing duplicate same-observation marks if an approved metric is populated in a future refresh. All current attached targets have no approved corresponding usage values, so this is a latent integration issue, not an observed duplicate today.
- `ExplorerChart.tsx:189-192,237-243` accepts finite nonnegative scenarios on linear axes; zero is omitted on log axes, not moved to an arbitrary positive epsilon. `src/lib/xy.ts:48-85` handles measured missing/negative/log-zero coordinates and breaks effort paths at gaps.
- `ExplorerChart.tsx:206-235` uses the no-data gutter when the approved value is null and no eligible plotted scenario replaces it; scenario-off, strict, median and missing-metric reasons are explicit. Unknown score scales are outside the percentage plot. Scenarios remain standalone marks, outside measured effort connections.
- Direct AA output already receives `AA MEAN` in point and guide labels (`ExplorerChart.tsx:568,588`). The older review's claim that these are all labeled EST is superseded by the current code.
- Normal exports remain observations-only (`src/lib/exports.ts:28-40,193-279`). Separate scenario exports preserve measurement versus scenario values, per-output evidence/statistic, cost type, methods, rows and source context (`exports.ts:56-125,128-190`). Scenario exports intentionally collect associated scenarios even when the chart is strict/median or a source row is precedence-suppressed; they are an evidence export, not a dump of plotted points.

## Maintenance counts and freshness

Derived from the checked-in artifacts and runtime import, not external data:

- Current approved dataset: **133 observations**, including **70 Datacurve configurations**. Runtime: **17 scenarios**, all 17 still match approved targets.
- Runtime scenario availability: **17 cost**, **13 output**, **7 time**. After Datacurve precedence alone, before user filters: **9 cost**, **8 output**, **3 time** unsuppressed references/scenarios. These counts are not extra approved measurements.
- Output evidence: **10 same-source AA DeepSWE means**, **1 separate-experiment reference**, **2 cross-benchmark transfers**, **4 missing**.
- Maintained target configuration: **7 full scenario records + 7 cost-only records + 3 Meta/Google/xAI targets**. The AA research artifact also repeats **10 AA variant aggregate records**, and TypeScript separately hardcodes **8 AA output entries**; the other **2 AA output entries** are in the Chinese research artifact.
- Original artifact retains **7 superseded output method/value hypotheses** in its full-scenario records. Runtime replaces those outputs with AA direct means, so these are stale as current central estimates, not active runtime output errors. `docs/usage-estimation-research.md:9-40,89-90` describes that earlier snapshot/method; historical context must be distinguished from current instructions.
- The **4 frozen Datacurve direct-reference records**, covering **12 cost/output/time scalar values**, currently exactly equal their approved-feed counterparts. No numeric staleness was found in those 12 comparisons. They nevertheless have no refresh linkage. Calibration pair copies and Google reference copies also live in research artifacts rather than resolving from a revisioned approved input.
- Source captures are dated 2026-09-26 through 2026-09-29. Date age alone does not establish incorrect values. `refresh-official.ts:88-159` stages only official observations; it never regenerates research references or AA facts.
- `data/sources/effort-order.json` has **12 model keys and 54 reviewed effort-label entries**. This is independent ordering metadata for connecting measured efforts, not an estimator. Preserve it: unknown order is an isolated point, not an inferred ranking.

## Findings by severity

### Important — duplicated facts and coupled builders impede reliable refresh

`usage-scenarios.ts:195-227` requires all original AA suite aggregates, cost/time methods and direct output to agree before constructing any metric. `usageScenarios` is initialized eagerly at module import (`435-439`). One malformed cost/time configuration can therefore prevent unrelated valid output evidence and the entire importing UI from loading. Source-specific records are useful, but a missing metric should not suppress a valid other metric; malformed reviewed artifacts should be caught at validation, with rejected refreshes retaining the last valid artifact.

The frozen references and repeated aggregate values require manual synchronization across data and TypeScript. `scripts/validate-data.ts:6-53` validates approved observations and queues but does not parse/validate scenario research. Its existing boundary is the natural place to add narrowly scoped scenario validation.

### Important — provenance cannot be validated as exported

The Codex response hash in `usage-scenarios.ts:30` is **57 hex characters**, not a valid 64-character SHA-256. The same literal is repeated in `data/research/inference-chinese-models.json:8` and `docs/inference-source-review.md:43`. This is a concrete malformed fingerprint; the correct response hash cannot be reconstructed from these copies and must not be guessed.

`UsageScenarioSource` (`usage-scenarios.ts:36-42`) has no structured hash field. `sourceReference` (`90-96`) and `inferenceSourceReference` (`99-100`) discard source hashes unless manually embedded in locator text. Meta/xAI/Google raw research source records carry `sha256ResponseBytes`, but the scenario export's `sources` loses that structured evidence. An aggregated source list is also not an explicit metric-to-source mapping. Preserve URL/date/locator/caveats and add validated structured response hashes and metric source IDs; represent unavailable or malformed evidence explicitly pending recapture.

### Important before new approved usage is integrated — no exclusive per-metric choice

Measured points and scenario points are independent inputs (`ExplorerChart.tsx:159-192`); eligibility ignores whether the selected approved field is already populated (`usage-scenarios.ts:459-466`). The table likewise renders scenarios even beside supplied metrics (`ResultsTable.tsx:61-67,110`). A future same-observation approved AA output metric could coexist with its old optional output reference as two chart points. A resolver should choose one plotted coordinate per observation/metric while retaining alternative evidence in details and separate exports.

### Moderate — per-metric metadata and exact target contract are uneven

Output has a dedicated statistic/evidence type, but cost owns the overall scenario type/statistic/confidence; time has no equally explicit evidence/statistic field (`usage-scenarios.ts:44-87`). Fable/DeepSeek are still built by `buildCostOnlyScenario` even though they now include direct output. `_metric` is unused. These make new combinations expensive and encourage classification from the wrong metric. Reuse current fields while adding a small selected-metric descriptor rather than duplicating all builders.

The exact target matcher is strong on reported identity but not source ID, snapshot or source revision (`442-454`). Refresh logic must carry those checks explicitly. A matching human label does not prove an immutable checkpoint or the same experiment. The hardcoded Meta/Google/xAI target identity, score strings and source arrays (`394-412`) are avoidable per-target TypeScript maintenance.

## Smallest proposed input contract and priorities

Use a normalized `usageFacts` section and a small `scenarioConfig` section within the existing research JSON. Keep original research calculations/history clearly historical. Do not create a source registry framework or generic estimator system.

Each fact needs:

1. **Identity:** exact target observation ID and source ID; source variant/configuration key; exact reported model/snapshot, effort/raw setting, harness and benchmark; source score context for review, never as a predictor. Missing immutable checkpoint remains null.
2. **Metric semantics:** cost/output/time, finite nonnegative value or null plus reason; unit; source statistic (`mean`, `median`, pooled suite average, or unspecified); definition, population/attempt denominator, metric-specific count where actually reported; reasoning inclusion, timing boundaries and pricing basis as applicable.
3. **Evidence:** source URL, retrieved-at date, validated response SHA-256 or explicit unavailable status, exact field locator, source/research revision, capture caveats. Do not substitute a page safety counter for the output telemetry sample count.
4. **Relationship:** same-source benchmark measurement/reference, separate-experiment reference, pooled-suite proxy, source-statistic-unspecified cost, or configured transfer. Separate-experiment and transfer relationships require an explicit target-to-reference mapping; no fuzzy family, high/xhigh or snapshot inheritance.

Transfer config retains the existing method name and **reference IDs**, target input fact IDs, qualitative grade, sensitivity semantics and method notes. Compute coefficients and derived values once from these facts using current functions (`throughOriginSlope`, ratio calculations and their existing diagnostics). Do not hand-maintain the coefficient and central output again. Reference facts derived from approved Datacurve rows must record the approved revision/hash; either refresh the derived section after approval or deliberately pin a historical revision. Do not combine a newly refreshed target with silently historical calibration inputs.

Priority should be explicit **per observation, metric and requested statistic**:

1. Approved selected-statistic metric, including its existing approximation classification; never replace an available approved Datacurve value.
2. Exact same-target-source, same-benchmark reported metric reference. In particular, AA DeepSWE mean output outranks older output transfers while staying separate from approved observations.
3. An explicitly configured optional fallback: same-model/effort separate DeepSWE experiment reference, same-row pooled-suite proxy or source-reported unspecified task cost, or existing calibrated transfer. These are distinct relationships, not interchangeable measurements. Preserve today's configured cost choices: automatically preferring an AA pooled suite cost over a Datacurve cross-run cost would change the method, not merely simplify the workflow.
4. No value, with the reason and any excluded reference available in evidence details.

Only steps 2-3 are optional-layer choices; keep them Mean-control-only and excluded from strict comparisons. Unknown source-statistic costs must remain labeled unspecified, not renamed mean. A true median can only come from an explicitly reported median fact with an approved ingestion decision; no derived median or mean substitution. Keep the current all-scenario median exclusion in the initial refactor.

No conversion of mixed tokens to output, cost to tokens, throughput to whole-agent runtime, score to usage, or rate-card-only prices to task bills. No AA Muse Code or Grok Build identity guessing for developer experiments. Do not auto-integrate unsupported Chinese research comparators.

## Minimal implementation stages (proposal only)

1. **Consolidate and validate:** move the eight AA literals and source metadata into the existing JSON normalized fact section alongside the two DeepSeek facts; replace hardcoded target metadata/source arrays with explicit config. Validate fact identity, units, statistic, hashes, duplicate IDs, reference existence and finite values in the existing `validate-data.ts` path. Keep existing formulas and 17 configured targets.
2. **Resolve once per metric:** add a small `resolveXUsage(observation, metric, statistic, options)` beside existing usage functions. Return selected value, evidence kind, unit/statistic, source IDs, relationship/calibration ID and missing/excluded reason. Reuse `metricObservation`, strengthen `usageScenarioForObservation` exact matching, and use this for chart/table selection. Preserve normal export fields; scenario exports continue to contain alternatives separately. Apply full-dataset Datacurve chart precedence first and scale validation after resolving. Zero must not trigger a weaker fallback merely because log cannot plot it.
3. **Bounded refresh:** reuse `refresh-official.ts`'s allowlisted retrieval, size/time limits, checksums, `stageRefreshCandidate` and atomic-write helpers for a small AA serialized-variant extractor. Extract exact displayLabel/variant identity and the `deep-swe-v1.1` eval, separately from suite metrics; multiple targets on a page are refreshed together. No runtime crawling. Resolve Datacurve configuration references from the newly approved normalized snapshot, not unapproved candidates. Stage changed facts for existing review; malformed/ambiguous extraction retains the last valid artifact. A new unsupported target needs one explicit mapping/config entry, not a new model branch or guessed identity.

First two stages deliver reduced manual editing without changing estimator behavior. Stage three delivers refresh speed. A new page parser must be supported by captured fixtures; public source layout stability was not tested in this review.

## Verification and acceptance criteria

Executed read-only verification:

- `npm test -- tests/usage-scenarios.test.ts tests/comparison.test.ts tests/exports.test.ts tests/xy.test.ts tests/normalize.test.ts`: **5 files, 33 tests passed**.
- Local runtime import: all **17** scenarios match approved observations; availability and precedence counts above derived from real functions.
- Four frozen Datacurve direct references: all **12** checked cost/output/time scalars match approved rows.
- Existing tests cover AA direct-output precedence, exact target/effort isolation, strict/median exclusion, separate cost scope, DeepSeek snapshots, Meta/xAI/Google reference separation, CSV/JSON measurement separation, Datacurve chart precedence and linear/log zero behavior.

Acceptance checks for the proposal:

- Golden parity on all current 17 scenario targets and numerical fields; no change to approved observations, chart suppression or currently available metric counts in stage 1.
- One selected plotted X per observation/metric; adding approved usage replaces only that metric's optional reference and retains its alternatives in evidence exports.
- Exact source/variant/benchmark/snapshot/effort/harness checks reject mismatches; no inheritance across high/xhigh, DeepSeek snapshots, different AA/developer harnesses or loosely normalized chart labels.
- Direct AA mean output does not depend on cost/time presence; unavailable optional cost/time stays null with a reason. Invalid refresh candidates cannot replace valid published facts.
- Median/strict never receive today's scenario values. Linear retains zero; log omits zero with an explicit reason, without epsilon or substitution. Missing usage keeps score-only/gutter behavior and breaks measured effort lines.
- Per-metric provenance survives UI details and JSON/CSV; structured hashes validate to 64 hex digits, access-gate captures retain caveats, counts are not invented, sensitivity ranges are never presented as prediction intervals.
- Fixture-backed refresh finds exactly one reviewed variant/eval, rejects missing/duplicate/renamed fields, records source hashes/revisions, and preserves last valid data on failure. Updates to approved Datacurve references are visible as a derived-fact diff.

No live source revalidation, browser test or accuracy claim was made. No build/export command was run because it writes generated data. Only this architecture note was added; application code and source data were not changed.
