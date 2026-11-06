# Handoff: simpler, faster, evidence-led X-axis usage placement

Prepared **2026-10-04** for a fresh agent working in `/home/peter/Projects/DeepSWE`.

## 1. Task boundary and immediate instruction

The user requested a review of a simpler/faster way to obtain fairly accurate **cost, output-token and reported-time X coordinates**, followed by a comprehensive handoff. The latest application work was **review only**. This document records the current implementation, findings, constraints and recommended next work; **it is not approval to implement, approve source data, commit, push, merge, or deploy**.

**First next action:** establish the current worktree and read the two focused reviews below. Confirm whether the user wants implementation of the proposed stages. If implementation is authorized, preserve existing formulas and numerical behavior initially, implement per-metric selection and validated consolidated facts, then add fixture-backed batch public-HTML extraction and reviewed refresh. Change calibration/default-estimator policy only with stronger evidence and an explicit decision.

Recommended result: one selected coordinate per observation/metric, with traceable source facts and explicit optional fallback configuration, rather than more model-specific branches or a universal estimator. Exact source collection improves source fidelity and maintenance; the present evidence does not establish general predictive accuracy.

### Minimal restart reads

1. `git status --short`, `git log -1 --oneline`, `git diff --stat`; inspect relevant diffs before editing.
2. This document and [architecture review](docs/usage-mechanism-review.md), [accuracy review](docs/usage-estimation-accuracy-review.md).
3. `src/lib/usage-scenarios.ts`, `src/lib/comparison.ts`, `scripts/validate-data.ts`.
4. The three runtime research inputs listed in section 4, then the chart/table/export consumers only as needed.
5. For extraction work, [source review](docs/inference-source-review.md), `scripts/refresh-official.ts`, `src/lib/refresh-safety.ts`, `scripts/lib.ts` and relevant existing fixture tests.

Follow applicable `AGENTS.md` instructions. The primary agent's standing instructions require assigning investigation, implementation and verification execution to bounded workers, and independent review before completion. A directly delegated worker executes its assignment without recursive delegation (as for this document). If delegation is unavailable to the primary, disclose that and ask before local execution. Assign independent necessary tasks only; do not allow conflicting edits or concurrent shared-state tests/builds.

## 2. Verified workspace, repository and publication state

Read-only checks performed for this handoff:

- Local HEAD: **`622f8e1`**, `Fix refresh workflow retries and action runtimes`.
- Origin: [PeterWoolery/DeepSWE-Enriched-Data](https://github.com/PeterWoolery/DeepSWE-Enriched-Data); default branch `main`.
- Documented live site: <https://peterwoolery.github.io/DeepSWE-Enriched-Data/>. Deployment documentation supplies this URL; the live page was not fetched for this handoff.
- Latest main Verify run returned **success** for full SHA `622f8e1eb3de0ed333c3c433320630946c22f67b`: [run 36636481016](https://github.com/PeterWoolery/DeepSWE-Enriched-Data/actions/runs/36636481016). Its retrieved log confirms **69 unit tests in 13 files**, **17 browser tests**, and 133 approved observations. These are prior CI results, not newly rerun suites.
- [Refresh PR #1](https://github.com/PeterWoolery/DeepSWE-Enriched-Data/pull/1) was verified **OPEN**, title `data: record unchanged DeepSWE source check`, head `automation/deepswe-refresh-36636480644`, base `main`. This is a metadata-only proposal, not approval of newly changed measurements. Recheck before acting; do not merge it as part of estimator work.
- Approved dataset revision: **`dsv1.1-33e411127c1a9343`**.

### Preserve pre-existing local work

At the start of this handoff, tracked `README.md` and `LICENSE` were modified. Untracked inputs included both `Screenshot_2026-09-29_10-23-46.png` and `Screenshot_2026-09-29_10-23-58.png`; `implementation-plan.md`; research JSONs `additional-source-capture.json`, `inference-anthropic-openai-other.json`, `source-capture.json`; and these `docs/` files:

`additional-source-research.md`, `additional-source-review.md`, `decisions.md`, `expanded-usage-review.md`, `independent-review.md`, `inference-anthropic-openai-other.md`, `inference-coverage-audit.md`, `official-precedence-review.md`, `progress.md`, `remaining-usage-integration-review.md`, `source-research.md`, `usage-estimation-accuracy-review.md`, `usage-mechanism-review.md`.

Do not clean, reset, overwrite or stage these indiscriminately. Local/ignored `.benchmark-results` and incomplete GLM benchmark artifacts are outside this work: **exclude them from source facts, calibration, approved results and publication**. Do not inspect or publish private files, credentials, secret dotenv values, raw task text, trajectories or unrelated research. This is a public static site; preserve its existing normalized-facts/provenance approach.

**Portability:** some linked review inputs are currently untracked, so a fresh clone may lack them and this handoff. This document embeds the essential instructions/numbers, but an authorized documentation commit must deliberately include any required companion documents after review. A handoff request alone does not authorize that commit or a push.

## 3. Current behavior and numeric baseline

The checked-in dataset was parsed directly, and the runtime scenario module and chart precedence functions were imported read-only for this handoff:

| Quantity | Current value |
|---|---:|
| Approved observations | **133 = 70 official Datacurve + 63 supplemental** |
| Runtime optional scenarios | **17**, all 17 match an approved target |
| Approved non-null cost / output / time fields (Mean selector) | **75 / 70 / 70** |
| Optional non-null cost / output / time | **17 / 13 / 7** |
| Optional availability after Datacurve precedence, before user filters | **9 / 8 / 3** |
| Either layer before chart filtering: cost / output / time | **92 / 83 / 77** of 133 |
| Still missing before chart filtering: cost / output / time | **41 / 50 / 56** |

The 75 approved cost values include **70 Datacurve means plus five approximate screenshot-axis costs**, whose statistic is `reported`, not `mean`. These counts are availability, not comparable measurements or actual chart mark counts. Score scale, precedence, selected statistic, strict mode and visibility filters matter.

Output evidence in the optional layer: **10 same-source AA DeepSWE means**, **one Google separate-experiment reference**, **two Meta/xAI transfers**, **four missing**. Cost: five Datacurve separate-experiment references, five transfers, three AA suite proxies, four Fireworks source-reported costs. Time: four Datacurve references and three transfers; Google has no time scenario.

Maintained inputs currently comprise seven full scenario records, seven cost-only records (three now also have direct output), and three Meta/Google/xAI targets. Eight AA output means are hardcoded in TypeScript; two DeepSeek means are in Chinese research JSON. The original artifact additionally repeats ten AA variant aggregates and seven historical, superseded output hypotheses. Four frozen Datacurve direct references contain 12 cost/output/time scalars that the architecture review found equal to approved values; equality does not provide refresh linkage. Source captures date from 2026-09-26 through 2026-09-29; age alone does not establish inaccuracy.

### All 17 configured targets and current relationship

| Exact target observation ID | Output | Cost | Time |
|---|---|---|---|
| `aa-codex-gpt-6-sol-max-v1.1` | AA direct | OpenAI slope transfer | OpenAI ratio transfer |
| `aa-codex-gpt-6-luna-max-v1.1` | AA direct | OpenAI slope transfer | OpenAI ratio transfer |
| `artificial-analysis-claude-code-opus-5.5-max-v1.1` | AA direct | Opus 5 predecessor ratio | Opus 5 predecessor ratio |
| `aa-claude-code-opus-5-max-v1.1` | AA direct | Separate Datacurve reference | Separate Datacurve reference |
| `aa-codex-gpt-6-astra-max-v1.1` | AA direct | Separate Datacurve reference | Separate Datacurve reference |
| `aa-codex-gpt-5.6-sol-max-v1.1` | AA direct | Separate Datacurve reference | Separate Datacurve reference |
| `aa-codex-gpt-5.6-luna-max-v1.1` | AA direct | Separate Datacurve reference | Separate Datacurve reference |
| `aa-claude-code-fable-5.1-max-v1.1` | AA direct | AA pooled suite $12.39/task | Missing |
| `aa-codex-deepseek-v4-pro-0813-max-v1.1` | AA direct | AA pooled suite $0.24/task | Missing |
| `aa-codex-deepseek-v4-flash-0731-max-v1.1` | AA direct | AA pooled suite $0.09/task | Missing |
| `fireworks-deepswe-deepseek-v4.1-flash-max` | Missing | Fireworks $0.430/task | Missing |
| `fireworks-deepswe-gpt-6-astra-xhigh` | Missing | Fireworks $6.524/task | Missing |
| `fireworks-deepswe-gemini-3.8-flash-high` | Missing | Fireworks $2.362/task | Missing |
| `fireworks-deepswe-claude-opus-5-max` | Missing | Fireworks $11.838/task | Missing |
| `google-gemini-3.8-flash-high-v1.1` | Separate Datacurve reference | Separate Datacurve reference | Missing |
| `meta-muse-spark-1.3-v1.1-max` | Two-predecessor II transfer | Two-predecessor II transfer | Missing |
| `xai-grok-4.7-high-v1.1` | Two-predecessor II transfer | Two-predecessor II transfer | Missing |

The ten AA direct output values (full stored precision, tokens per source-defined AA DeepSWE task attempt):

| Variant (exact IDs above) | Output mean |
|---|---:|
| GPT-6 Sol max | 70300.33038348083 |
| GPT-6 Luna max | 108271.5634218289 |
| Opus 5.5 max | 406479.005899705 |
| Opus 5 max | 129793.94690265486 |
| GPT-6 Astra max | 56420.18289085546 |
| GPT-5.6 Sol max | 56943.890855457226 |
| GPT-5.6 Luna max | 75781.00294985251 |
| Fable 5.1 max with fallback | 155542.35398230088 |
| DeepSeek V4 Pro **0813** max | 116676.62241887905 |
| DeepSeek V4 Flash **0731** max | 97092.21238938053 |

No output-specific telemetry sample count or independently established reasoning inclusion is supplied for these values. `safety.attemptCount` is not a token-telemetry denominator. Missing telemetry must not be treated as zero. These are reported means, not medians, bills or confidence intervals.

## 4. Existing code/data ownership and signatures

Paths below exist in the current workspace. Line numbers are useful landmarks, not permanent interfaces.

| Boundary | Existing files/functions | Recommended responsibility |
|---|---|---|
| Facts/config and scenario calculation | `src/lib/usage-scenarios.ts`: `UsageScenario`, `UsageScenarioSource`, `buildScenario`, `buildCostOnlyScenario`, `buildMetaGoogleXaiScenario`, `throughOriginSlope`, ratio/LOO functions | Reuse arithmetic; consolidate explicit target config and per-metric descriptors; add small resolver |
| Runtime research inputs | `data/research/usage-proxy-cross-platform-20260927.json`, `data/research/inference-meta-google-xai.json`, `data/research/inference-chinese-models.json` | Put normalized facts/config in an existing research structure; keep historical research clearly historical |
| Research-only alternatives | `data/research/inference-anthropic-openai-other.json`, associated docs | Context, not automatic runtime input or independent validation samples |
| Measured selector and chart precedence | `src/lib/comparison.ts`: `metricObservation`, `datacurveChartPrecedence`, `strictExclusionReason`, `strictProtocolGroups` | Preserve measured statistic semantics and full-dataset precedence |
| Chart integration | `src/App.tsx` precedence around 99–102, eligible scenarios around 172–183; `src/components/ExplorerChart.tsx` point construction around 159–243 | Resolve once per observation/selected metric; preserve controls, labels, scale/gutter and keyboard evidence |
| Table/details | `src/components/ResultsTable.tsx`, existing evidence components located from imports | Present selected-metric relationship and alternative evidence accurately |
| Exports | `src/lib/exports.ts` | Normal exports remain observation-only; separate optional exports retain all alternatives and per-metric provenance |
| Approved normalization | `src/lib/normalize.ts`: `normalizeOfficialFeed`, `normalizeApprovedReports`; `src/lib/schema.ts` | Do not promote research to approved measurements implicitly |
| Validation | `scripts/validate-data.ts` `main()` | Add narrow research-fact/config validation before runtime use; currently validates approved data/queues/snapshots only |
| Refresh retrieval/staging | `scripts/refresh-official.ts`: `fetchFeed(etag)`, `main()`; `src/lib/refresh-safety.ts`: `stageRefreshCandidate<T>`; `scripts/lib.ts`: `sha256`, `writeJsonAtomic`, JSON/path helpers | Reuse bounded retrieval/staging/atomic-write patterns; reviewed proposals, no approved writes from fetch/parser |
| Effort connections | `src/lib/xy.ts`, `data/sources/effort-order.json` | Keep gaps/zero/unknown order behavior; ordering metadata is not an estimator |

Actual public usage functions today:

```ts
usageScenarioForObservation(observation: Observation): UsageScenario | null
usageScenarioForComparison(
  observation: Observation, _metric: XMetric,
  statistic: Statistic, strict: boolean,
): UsageScenario | null
scenarioXValue(scenario: UsageScenario, metric: XMetric): number | null
metricObservation(observation: Observation, metric: XMetric, statistic: Statistic)
datacurveChartPrecedence(observations: Observation[], datacurveSourceId: string): Map<string, Observation[]>
```

`XMetric = 'cost' | 'outputTokens' | 'time'`; `Statistic = 'mean' | 'median'`. `usageScenarioForComparison` ignores `_metric`, excludes strict/median and does not check whether an approved selected metric is populated. `usageScenarios` initializes all builders eagerly on import.

### Concrete defects to address in authorized work

1. **Malformed hash:** Codex response hash in `usage-scenarios.ts:30`, `inference-chinese-models.json:8` and `docs/inference-source-review.md:43` is **57 hex characters**, not a SHA-256. Copies cannot reconstruct the missing characters. **Refetch and hash actual response bytes**, or represent historical hash evidence as unavailable/malformed pending recapture. Do not pad, guess, or bless it as valid. A new response hash identifies the new capture, not the old bytes.
2. `UsageScenarioSource` has no structured hash field. `sourceReference`/`inferenceSourceReference` drop structured hashes except where manually embedded in prose. The aggregate `sources` list does not identify which source supports which metric. Preserve URL/date/locator/caveats and introduce validated hash status and metric-to-source IDs.
3. `buildScenario` verifies suite cost/time/mixed totals and methods before direct AA output can be returned. `buildCostOnlyScenario` also couples direct output to cost configuration. An unrelated optional metric failure can throw during eager module initialization and break the importing UI. Validate reviewed artifacts, retain LKG on refresh failures, and resolve metric absence independently.
4. Measured/scenario chart builders are independent. A future approved usage field can coexist with the optional same-observation point. This is a **latent duplicate integration issue**, not a duplicate currently demonstrated in the baseline. Select measured first per metric; preserve alternatives in evidence.
5. Cost owns scenario-wide statistic/type/confidence while output has dedicated metadata and time lacks equivalent metadata. Do not infer output/time status from cost classification. Exact target checks omit source ID, snapshot and revision; strengthen the contract explicitly without fuzzy inheritance.

## 5. Non-negotiable semantic/visual constraints

### Keep observation precedence separate from borrowing usage

- Datacurve organizer results take chart precedence using **the full approved dataset before filters**. Changing X metric, statistics, scenario toggle, source/harness filters or missing official usage must not resurrect a suppressed external mark. Suppressed reports remain in evidence/table and exports.
- Current display matching strips recognized suffixes and normalizes model spelling, but respects **known canonical ID/snapshot conflicts**, known benchmark version/scope/task-count/task-revision conflicts and recognized score-metric compatibility. Effort/harness intentionally are not precedence keys.
- **Unknown benchmark version alone does not defeat suppression** when otherwise applicable official evidence exists; do not loosen this behavior by treating unknown as a distinct known version. Known incompatible versions remain separate. Unknown-version visibility controls and strict exclusions remain independent.
- Looser chart-name normalization is **not a usage identity map**. Usage needs exact observation/source/variant identity, benchmark, snapshot where established, effort including raw setting, harness, and reviewed source revision. Score text checks protect context, never predict usage.
- Do not infer high/xhigh/max equivalence, snapshot equivalence, missing immutable checkpoint, harness equivalence or default named effort. Unknown effort order remains an isolated point. The effort map has 12 model keys and 54 reviewed label entries; do not invent order.

### Per-metric hierarchy (initial refactor)

1. **Available approved selected-statistic metric** via `metricObservation`, retaining its approximation/statistic classification. Never override an available official Datacurve metric.
2. **Exact same-target-source, same-benchmark reported reference**, e.g. AA DeepSWE mean output. It remains optional-layer evidence until separately approved for ingestion.
3. **Explicitly configured fallback**: separate same-model benchmark experiment reference, calibrated transfer, pooled-suite proxy, or source-reported statistic-unspecified cost. Preserve current configured method choices; do not automatically replace a Datacurve cross-run reference with an AA suite proxy because it comes from the target page.
4. **No data**, with missing/excluded reasons and contextual alternatives in evidence.

Steps 2–3 remain Mean-control-only, scenario-toggle-dependent, excluded from strict mode and median in the initial refactor. Do not infer medians from means. A future approved reported median requires an explicit ingestion decision.

Choose **one coordinate per observation/metric**; an approved output field replaces only optional output, not missing cost/time fallbacks. Alternatives belong in details and separate evidence exports, not duplicate chart marks. Scenario exports intentionally include associated evidence even when strict/median or precedence makes it unplotted.

### Units and null/scale behavior

- Separate target-run measurements, same-source reported means, cross-run references, cross-benchmark transfers, suite proxies and unspecified task costs visibly and in exports. Direct AA output is already labeled `AA MEAN` in the chart; do not regress it to blanket `EST` labeling.
- Datacurve values are per **scored rollout attempt** with source exclusion policy, not unique tasks or a provider bill. Duration-specific counts are null and timer boundaries unspecified. Do not claim verified end-to-end latency.
- AA Coding Agent Index suite totals pool DeepSWE v1.1 (113 tasks), Terminal-Bench 4.0 (66) and SWE-Atlas-QnA (124); mixed tokens include categories that cannot determine output-only usage. Preserve token/reasoning definitions and unknown inclusion.
- Intelligence Index entire-evaluation output totals (millions), II output/task, Coding Agent mixed tokens/task and DeepSWE output/attempt are different inputs. Meta/xAI use II aggregate totals, not II per-task output.
- Fireworks Cost/Task aggregation/denominator and billing basis remain unspecified. `pricing.asReportedCost` is source evidence, not an automatic mean/median measurement.
- No cost-to-token guessing, rate-card-only task bill, score-to-usage prediction, mixed-to-output conversion, or throughput-to-whole-agent-runtime conversion. No task bill without input/cache/output accounting and price context.
- `null` means absent; zero is a valid linear value. Negative/nonfinite values are invalid. Log axes omit zero with a reason: no epsilon and **no weaker fallback because a valid selected zero cannot be logged**. Missing X retains gutter/score-only placement and breaks measured effort paths. Unknown score scales stay outside the percentage plot. Optional marks remain outside measured effort connections.

### Screenshot special case: preserve the five-point curve

Approved `openai-gpt-6.1-sol-deepswe-setting1` through `setting5` contain approximate **(USD, score percent)** points in visible source-path order:

`Setting 1 (0.2, 64) → Setting 2 (0.4, 72) → Setting 3 (0.7, 75) → Setting 4 (0.8, 72) → Setting 5 (1.6, 71)`.

These are five points, including the nonmonotonic tail, not one representative point or an inferred low→max effort sequence. Setting labels only indicate source-path order. Costs are `reported` with unknown aggregation/attempt denominator, displayed under Mean by an existing explicit exception; strict excludes approximation, and median/token/time fields remain unavailable.

Provenance: user-supplied `Screenshot_2026-09-29_10-23-46.png`, [article locator](https://openai.com/index/introducing-gpt-6-1-sol/), image SHA-256 `2cac9bafeea62d03972bfc721c1131734616a720c61753f1f0e305c40e94ef29`. The hash identifies the image, **not an article response**; date derives from filename, not verified page retrieval. Reading bounds are roughly ±$0.1–0.2/±1 percentage point, not statistical intervals. GPT-6.1 Sol is not an alias for GPT-6 Sol, GPT-5.6 Sol or Astra. Preserve existing approximation records/connection policy and never infer named reasoning settings from the image.

## 6. Accuracy evidence and what “fairly accurate” can mean

[Accuracy review](docs/usage-estimation-accuracy-review.md) contains full operands, reproduction code and limitations. Headline figures must retain their sample sizes and relationships:

| Diagnostic | n | MAPE | Interpretation |
|---|---:|---:|---|
| Seven historical token estimates vs later recovered AA target means | 7 | **14.740713%** | Retrospective discrepancies, median APE 9.097409%, range 3.142338–52.851640%; not general prediction accuracy |
| Current OpenAI suite→Datacurve cost, model holdout slope | 3 | **46.724032%** | Median APE 34.227250%, range 22.461522–83.483324%; weak workload/accounting transfer |
| Current OpenAI suite→Datacurve time, ratio holdout | 2 | **13.717948%** | Range 12.781423–14.654474%; not a universal 14% bound |
| Expanded time set adding Astra, mean/median ratios | 3 | **19.008773%** | Median APE 23.961553%, range 5.163207–27.901559%; new diagnostic, not current formula |

Ordinary median and log-median do **not** improve the cost set: MAPE 196.758755% and 127.546161% respectively. Expanded time log-median gives 18.324516%, too sparse to establish superiority. Five known OpenAI/Codex/max II-output→AA-DeepSWE overlaps give arithmetic-ratio MAPE 7.490331%, but two Opus/Claude Code overlaps give 70.030945%; do not pool providers to hide transfer failure.

Meta predecessor holdouts: output 59.146104%, cost 88.879381% (n=2). Grok: output 35.058477%, cost 1.479644% (n=2); a tight two-point dollar ratio does not establish a Grok 4.7 bill. One Opus predecessor pair has no holdout. Holdouts are independent **model identities**, not hundreds of attempts; copied reference agreement is not validation, and paired aggregate diagnostics are not prospective target-run holdouts. Historical OpenAI token sensitivity envelopes both missed recovered targets; extrema are sensitivity choices, not prediction intervals.

**Keep current formulas initially:** cost through-origin slope `Σ(x*y)/Σ(x²)` with current OpenAI factor **1.1482398468916322**; time arithmetic mean of two ratios with factor **0.8547716397337312**; Opus 5.5 single predecessor ratio; Meta/xAI unweighted mean of two predecessor projections; direct reference values unchanged. Direct AA output has already replaced the seven historical token hypotheses. Preserve full precision and numerical parity while consolidating facts; do not revive historical hypotheses as current outputs.

Proposed future default-forecast gate (not achieved or user-approved): separate metric/stratum held-out-model median APE ≤20%, MAPE ≤25%, 90th-percentile APE ≤50%, with at least **10 independent matched model identities**, grouped exclusion of all efforts/source duplicates, plus prospective target checks. Predecessor forecasts also need time-ordered holdouts. Supplement log placement with dex error; zero needs an absolute-error rule. Nominal intervals require predeclared coverage tested on independent targets. No current calibrated stratum meets the minimum sample gate. Default policy changes should therefore be a later explicit decision; initial fallback values remain optional and candidly weak.

## 7. Proposed normalized contract — conceptual, not existing schema

Prefer a `usageFacts` section and small `scenarioConfig` section **within an existing research JSON structure**, rather than a registry framework, new generic estimator service or duplicated coefficients. Decide a single authoritative fact home during stage 1; imported existing artifacts may retain historical context/reference IDs, not competing current central values.

Illustrative shape only (field names below are **proposed**, not implemented APIs):

```ts
type ProposedUsageFact = {
  id: string;
  targetObservationId: string;
  identity: {
    sourceId: string; variantKey: string; displayLabel: string;
    reportedModel: string; snapshot: string | null;
    effort: string | null; rawSetting: string | null;
    harness: string | null; benchmarkVersion: string | null;
    datasetIndexName: string | null;
  };
  metric: 'cost' | 'outputTokens' | 'time';
  value: number | null; missingReason: string | null;
  unit: string; statistic: 'mean' | 'median' | 'pooled-suite-average' | 'unspecified';
  definition: string; population: string | null; sampleCount: number | null;
  includesReasoningTokens: boolean | null;
  timingBoundaries: string | null; pricingBasis: string | null;
  relationship: string; // validated finite set of the relationships in section 5
  sourceIds: string[];
  evidence: {
    url: string; retrievedAt: string; locator: string;
    responseSha256: string | null;
    hashStatus: 'validated' | 'unavailable' | 'malformed-historical';
    sourceRevision: string | null; approvedDatasetRevision: string | null;
    caveats: string[];
  };
};
// Config: exact target contract, permitted per-metric fact IDs, method name,
// calibration reference IDs, qualitative grade, sensitivity semantics/notes.
```

Validate source IDs, exact target contracts, duplicate IDs, reference existence, allowed units/statistics/relationships, finite nonnegative values, null reasons, and `/^[a-fA-F0-9]{64}$/` only for validated hashes. Do not hide an invalid hash in a valid field or erase the historical limitation. Metric sources and source revisions must survive export. A reference derived from approved Datacurve rows records revision/hash and resolves only against approved input or explicitly pinned history. Do not silently mix a freshly fetched target with historical calibration inputs.

Suggested resolver signature **to implement only if authorized**:

`resolveXUsage(observation, metric, statistic, options)` → selected value/unit/statistic, evidence kind/relationship, source IDs, calibration/reference IDs, missing/excluded reason and alternative evidence. Apply chart precedence before selection and axis-scale rules afterwards. Avoid repeated calculation across chart/table/export.

## 8. Bounded implementation stages and acceptance

### Stage 0 — authorize and freeze the baseline

- Confirm requested implementation scope. Record status, current 17 target identities/values/methods, counts and approved revision. Inspect only required files; preserve unrelated work.
- Primary assigns bounded fact/resolver, parser, and independent-review tasks as appropriate. Parser design can be reviewed independently, but integration/editing must have clear nonconflicting ownership.
- Acceptance: agreed stage boundary; parity evidence is runtime-derived, not copied from older 127/128-row docs.

### Stage 1 — consolidate and validate existing facts/config

- Owner: research inputs, `usage-scenarios.ts`, narrow validation additions in `validate-data.ts` (reuse schema patterns where appropriate).
- Move eight TypeScript AA literals/source metadata alongside two DeepSeek facts in the authoritative existing structure. Replace hardcoded Meta/Google/xAI identities and source arrays with explicit config, retaining exact checks and all methods.
- Compute coefficients/derived values once from reference facts; eliminate duplicated current central values, preserve historical research distinctly. Resolve/pin approved Datacurve references by configuration and revision.
- Handle malformed historical hashes explicitly without changing unrelated values. Normal validation rejects invalid newly marked validated hashes. Missing optional cost/time cannot block valid output; failed candidate validation must retain published facts rather than swallowing arbitrary invalid configuration.
- Tests: golden parity for all 17 targets; source/hash/config validation; absent cost/time plus intact AA output; mismatched source/snapshot/effort/harness/version rejected; reference revision changes visible.
- Acceptance: 133 approved rows unchanged; 17 matched scenarios; current metric availability/methods/full-precision outputs unchanged. No guessed hashes or guessed identities.

### Stage 2 — per-metric resolver and rendering/export integration

- Owner: `usage-scenarios.ts`, existing chart/App/table/details/export consumers.
- Reuse `metricObservation` and strengthen `usageScenarioForObservation`. Expose per-metric semantics; prefer available selected approved metric, then exact same-source reference, then the explicitly configured fallback, then noData.
- Replace coupled independent measured/scenario placement with exactly one selected point per observation/metric; keep alternatives in evidence and scenario exports. Do not export selected scenario values into normal measurement fields.
- Tests: populate approved output on a scenario target and assert one output mark, unchanged other fallbacks; per-metric labels/sources; strict/median/toggle exclusions; full-dataset precedence including unknown version and source/harness filter no-bypass; null/zero/log/negative/nonfinite and nonmonotonic paths; five screenshot marks; CSV/JSON separation and structured provenance; browser controls/keyboard evidence as relevant.
- Acceptance: only intended de-duplication/per-metric behavior changes. Existing counts remain baseline where no approved optional overlap is added; approved zero never falls through to a positive estimate.

### Stage 3 — offline-fixture-backed AA batch extraction and reviewed refresh

- Owner: a small source-specific adapter in the existing scripts/data-refresh organization and narrowly necessary parser fixtures/tests; reuse `refresh-safety.ts`/`scripts/lib.ts`. A new file is justified only where this cannot cleanly fit the existing structure. Do not turn official-only candidates into AA candidates without defining their explicit separate contract.
- **Source:** public HTML comparison URLs already cited:
  - <https://artificialanalysis.ai/agents/coding-agents/comparisons/codex-vs-kimi-code-cli>
  - <https://artificialanalysis.ai/agents/coding-agents/comparisons/claude-code-vs-codex>
  - <https://artificialanalysis.ai/agents/coding-agents/comparisons/grok-build-vs-muse-code> for context only unless a separately reviewed target is configured.
- Batch each fetched page's reviewed variants in one pass. Match exact reviewed variant key/display label, model snapshot, effort/fallback/harness and exactly one `evals` entry whose `datasetIndexName` is **`deep-swe-v1.1`**; extract **`.mean.outputTokens`**. This is public serialized **HTML data**, **not a documented stable public API**. No inspected evidence establishes DeepSWE-specific AA dollar/time fields: do not assume them from outputTokens. Suite parent fields remain suite proxies if explicitly configured.
- Parse data **without executing page JavaScript**: no `eval`, `Function`, VM execution or running embedded scripts. Handle serialization/escaping with bounded data parsing informed by captured fixtures; reject ambiguous/missing/duplicate/renamed identity/eval/metric fields, nonfinite/negative values, access gates and unexpected content. A schema/layout change is a failed proposal, not a license to scrape approximate matches.
- Retrieval must enforce HTTPS host/path allowlists, redirect rejection or revalidation, HTTP status/content-type checks, bounded attempts/backoff, timeout, and byte limits while reading (do not rely solely on Content-Length or allocate unlimited `arrayBuffer`). Define fixture-supported HTML limits, parser depth/item limits and abort behavior. Official fetch currently uses 15-second timeout, three attempts, 1 MB post-read limit; reuse its pattern while making the HTML read genuinely bounded.
- Hash **actual response bytes** before decoding; record URL, UTC retrieval, full validated SHA-256, exact locator, source/research revision, metric semantics and capture caveats. Store only necessary safe offline fixture snippets/normalized facts; distinguish fixture-snippet hashes from full-response hashes. Respect existing no-raw-public-payload practice; no secrets/task content in fixtures.
- Stage fully validated proposal + changed/removed fact diff; approved observations/facts remain untouched by fetch/parser. Reuse `stageRefreshCandidate<T>(prepare, writeCandidate, writeStatus, clearCandidate?, failureStatus?)` and atomic writes. Failed retrieval/parse/validation preserves **last-known-good published facts and existing valid artifacts**, records failure separately, and cannot overwrite a prior good candidate with invalid output. Successful unchanged checks update check metadata without changing numeric revision timestamps. Approval remains explicit; no auto-approve/merge/push.
- Offline tests: valid escaped serialized HTML, batch variants and exact benchmark selection; wrong snapshot/effort/harness/display label; duplicate/missing variant/eval; missing/null/negative/nonfinite field; suite-vs-benchmark confusion; gate/HTML schema drift; disallowed URLs/redirects, non-200, retries/timeouts/oversize; hashes; atomic failure and LKG retention; unchanged metadata and reviewed changed proposal. CI tests must not require AA live availability.
- Acceptance: all ten existing facts can be refreshed from explicitly reviewed mappings in batch, without new per-model TypeScript branches. Newly unsupported targets need an explicit reviewed config entry, not fuzzy inference. Live source revalidation, if performed, is recorded separately from fixture correctness and cannot retroactively repair the old malformed hash.

### Stage 4 — independent review and completion

After authorized changes and proportionate verification, have an independent reviewer check numerical parity, exact identity/provenance, per-metric precedence/de-duplication, zero/log behavior, screenshot curve, parser failure retention and absence of newly claimed accuracy. Resolve material findings and repeat affected checks only. Report remaining source/telemetry limitations honestly. Stop at the authorized result; stronger estimators, unsupported Chinese comparators, workflow modernization and general security/dependency audits are not implied scope.

## 9. Verification commands and environment notes

Run from repository root. `package.json` requires Node **>=22.12.0**. Use locked dependencies (`npm ci`) if installation is needed; do not change the lockfile to work around unrelated environment issues.

Smallest relevant unit command for resolver/fact work:

```sh
npm test -- tests/usage-scenarios.test.ts tests/comparison.test.ts tests/exports.test.ts tests/xy.test.ts tests/normalize.test.ts
```

The architecture review last ran that exact command: **33 tests in five files passed**. It did not run a browser suite, live refresh, build or empirical backtest. The separate accuracy review calculated diagnostics from files. This handoff rechecked dataset/runtime counts and remote CI metadata/logs, not the suites again.

For authorized integrated implementation, use the exact existing scripts as applicable:

```sh
npm run validate
npm run validate:candidate
npm run typecheck
npm test
npm run build
npm run build:subpath
npm run test:subpath
npm run test:browser
git diff --check
```

Build scripts run validation and `export:data` and write generated `public/data`/`dist` artifacts. `test:browser` itself builds the project subpath; avoid needless duplicate builds. Subpath test configuration uses **`/deepswe-explorer/`**, while deployed Pages derives **`/DeepSWE-Enriched-Data/`**. Do not casually change either. Verify generated/public output excludes local benchmarks, raw/private artifacts and secrets.

`playwright.config.ts` reads `CHROMIUM_PATH`. A known earlier working local command is:

```sh
CHROMIUM_PATH=/run/current-system/sw/bin/chromium npm run test:browser
```

Use that path only if available, or another explicitly configured compatible executable. Local default Playwright launches previously failed due to missing **`libglib-2.0.so.0`**; a completed build with browser launch failures is **not a passed browser suite**. CI's established workaround is `npx playwright install --with-deps chromium` on Ubuntu followed by `npm run test:browser`; latest main CI passed all 17 tests. Do not install system dependencies/change the host without appropriate authorization. Report environment-blocked local browser coverage and cite actual CI only for the revision it tested.

Before any explicitly authorized commit: inspect `git status`, `git diff`, `git log --oneline -10`, stage intended files only and check publication contents. **Push/PR/merge/deploy require explicit user permission for that action**; permission to proceed with implementation is not permission to publish.

### Existing refresh workflow status: preserve, do not expand scope

`.github/workflows/refresh-data.yml` pins checkout **v7.0.1** and setup-node **v7.0.0** by SHA (Node 24 **action runtimes**); its selected application Node remains **22**, not 24. HEAD fixes refresh rerun/retry behavior by reusing an open refresh branch, fetching it and merging the default branch before staging. `scripts/stage-refresh-pr.sh` currently contains a single `git push origin "$REFRESH_BRANCH"`, not an automatic push-retry loop. Preserve this behavior; a past retry/push operation is not authorization to push now. Repository PR permission was previously fixed sufficiently for PR #1 to be created; current open PR was rechecked, but the setting itself was not queried here. If blocked again, the workflow documents Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests; do not change policy unsolicited.

CI/deploy still use older v4 action pins associated with Node 20 action-runtime deprecation warnings. This does not make their selected application Node 20, nor is warning cleanup part of this usage task. Do not run refresh/approval commands merely to verify this document: `refresh:official`, `record:unchanged-check`, `approve:candidate`, `stage:refresh-pr` mutate artifacts or Git state.

## 10. Done criteria and confidence limits

For an authorized initial implementation, done means:

- Consolidated validated facts/config, preserved formulas and all current configured identities/numerical values.
- One selected coordinate per observation/metric; correct measured-first selection and explicit optional alternatives; no precedence/filter bypass.
- Per-metric units/statistics/relationships/source IDs/hash status survive UI and exports; malformed historical evidence is not fabricated.
- Strict/median/mean/toggle, null/zero/log, source cost unknown-denominator behavior and screenshot five-point curve preserved.
- Batch extractor tested offline, exact source identity/benchmark match, bounded nonexecuting parser/fetch, reviewed proposals and LKG retention on failure.
- Proportionate unit/data/type/build/subpath/browser checks and independent review evidenced for the actual changed revision; environment/source gaps disclosed.
- No unapproved data integration, estimator-policy change, publication, unrelated worktree damage or local GLM inclusion.

Unresolved evidence boundaries: no freshly fetched AA schema/live availability in the two reviews or this handoff; old Codex response hash malformed; output reasoning/count scope and Datacurve timing boundaries unknown; cross-run target bills/immutable checkpoint equivalence unestablished; calibrated forecast strata below validation gate. These are constraints to preserve, not blank fields to fill by inference.

**This handoff's own completion:** a single root Markdown document added; relevant paths/signatures/numbers and remote state checked read-only; Markdown whitespace checked. No application, approved data, workflow, commit or push changes were requested or performed.
