# Cross-platform usage estimation research

Research snapshot: 2026-09-27, expanded with a source review on 2026-09-28. This record contains evidence and calibration inputs only. The optional app layer derives separate display scenarios from it; approved observations and the source registry remain unchanged. The incomplete local GLM run was excluded; no local GLM result was used. Exact source inputs, target IDs, and calculations are stored in [`data/research/usage-proxy-cross-platform-20260927.json`](../data/research/usage-proxy-cross-platform-20260927.json).

## Finding

AA publishes **suite-level** cost, time, and total-token references for Coding Agent variants. Its v1.5 efficiency metrics pool DeepSWE v1.1 (113 tasks), Terminal-Bench 4.0 (66), and SWE-Atlas-QnA (124); no per-benchmark efficiency allocation or per-metric telemetry sample count is published. Total-token figures combine input, cache, cache-write, reasoning, and output.

The reviewed baseline contains 128 observations; 58 have no source-reported mean cost, output tokens, or time, across 43 reported model labels. The separate scenario layer covers 14 exact source rows: seven full cost/output/time scenarios and seven cost-only scenarios. Four full scenarios use separate Datacurve DeepSWE rows with exact model/max matches; GPT-6 Luna and GPT-6 Sol use cross-platform calibration; Opus 5.5 uses one adjacent-version Opus 5 max pair. The cost-only cases are three same-row Artificial Analysis suite-cost proxies and four Fireworks source-reported Cost/Task values retained only for those Fireworks rows. None populates approved measurement fields or claims probabilistic uncertainty.

| Exact AA target row | Scenario mean cost / scored attempt | Scenario output tokens / scored attempt | Reported-time scenario / scored attempt | Evidence quality |
|---|---:|---:|---:|---|
| Codex / GPT-6 Astra (max), 68% | $7.50 | 61.1k | 33.0 min | Low; exact model/max Datacurve row, different harness/evaluator. |
| Codex / GPT-6 Sol (max), 69% | $3.43 (sample envelope $3.00–$20.58) | 59.8k (55.5k–64.2k) | 19.1 min (17.8–20.4 min) | Low; two output/time calibration pairs, three cost pairs. Envelopes are not intervals. |
| Codex / GPT-6 Luna (max), 64% | $0.21 ($0.18–$1.24) | 98.4k (91.3k–105.5k) | 18.3 min (17.0–19.5 min) | Low; two output/time calibration pairs, three cost pairs. Envelopes are not intervals. |
| Claude Code / Opus 5 (max), 63% | $11.84 | 117.6k | 31.9 min | Low; exact model/max Datacurve row, different harness/evaluator; source cost basis unspecified. |
| Codex / GPT-5.6 Sol (max), 72% | $8.39 | 60.0k | 18.8 min | Low; exact model/max Datacurve row, different harness/evaluator; cost basis unspecified. |
| Codex / GPT-5.6 Luna (max), 66% | $3.03 | 73.4k | 18.7 min | Low; exact model/max Datacurve row, different harness/evaluator; cost basis unspecified. |
| Claude Code / Opus 5.5 (max), 68% | $14.31 | 191.6k | 50.2 min | Very low; one adjacent-version Opus 5 max pair; no holdout or defensible interval. |

The AA score identifies the target row and is **not a predictor** in any calculation. In the chart, a scenario keeps that target score but is shown as a hollow standalone diamond; its source measurement fields stay null and it never joins an effort path. Forty-four baseline targets have no cost or usage scenario; 32 percentage-scale rows use the no-data gutter before chart-precedence filtering, while 12 raw-unit-unspecified score rows remain outside the percentage plot and in the score-only list. The current combined default suppresses 15 compatible non-Datacurve reports—including three version-unspecified Fireworks rows with official model counterparts—and shows seven scenario marks plus 24 no-data marks. Version-unknown rows are not merged or declared equivalent; an unspecified version alone is not treated as a conflict for display precedence. Seven cost-only scenarios add no output-token or time estimate. Exact target IDs and source-attributed outcomes are in the JSON `coverageAudit`.

Forty-four baseline targets have no cost or usage scenario. Thirty-two percentage-scale rows use the no-data gutter before chart-precedence filtering, while 12 raw-unit-unspecified score rows remain outside the percentage plot; seven cost-only scenarios provide no output-token or time estimate.

## Output-token method

The AA Coding Agent comparison tables show only total token use per task; AA methodology says its token accounting includes input, cache, cache-write, reasoning, and output tokens. Those totals cannot be converted to output tokens. Instead, the token scenario uses AA’s separately reported **output tokens per Artificial Analysis Intelligence Index task** and calibrates against the same reported model/effort in Datacurve’s direct DeepSWE feed:

| Exact calibration label, max | AA Intelligence Index output/task | Datacurve DeepSWE mean output/scored attempt | Ratio |
|---|---:|---:|---:|
| GPT-5.6 Sol | ~29k | 60,013.644 (450 attempts) | 2.0694 |
| GPT-5.6 Luna | ~41k | 73,399.708 (448 attempts) | 1.7902 |
| GPT-6 Sol | ~31k | No matching Datacurve DeepSWE row | Target-only input; ratio is transferred from the two prior OpenAI max pairs. |
| GPT-6 Astra | ~27k | 61,148.507 (452 attempts) | Direct exact-model/max reference is used; no ratio transfer. |

These are two distinct model configurations, not aliases. The mean factor is 1.9298; transferring it to GPT-6 Luna’s AA Intelligence Index value (~51k) gives 98,422 output tokens per DeepSWE scored attempt. The two observed factors give 91,302–105,541; this is a small-sample sensitivity envelope, **not** a statistical interval. Leave-one-out absolute percentage error is 14.5% (−13.5%, +15.6%). AA’s source values are rounded to thousands, and the AA Intelligence Index workload differs from mini-swe-agent DeepSWE.

For Opus 5.5, AA reports ~119k output tokens per Intelligence Index task. The only same-family direct DeepSWE calibration found is Opus 5 (max): AA ~73k versus Datacurve 117,565.694 output tokens/attempt (444 attempts), a 1.6105 ratio. Applying that single predecessor ratio gives ~191,648 for Opus 5.5. It has no holdout, and the model version differs; therefore the number is a very-low-confidence family scenario, not a target measurement. No interval is justified.

GPT-6 Sol's AA Intelligence Index output figure is ~31k; transferring the two-pair OpenAI mean ratio gives ~59,825 output tokens/attempt with a two-point sensitivity envelope of 55,497–64,153. The leave-one-out MAPE is 14.5%; this is not a prediction interval. GPT-6 Astra, GPT-5.6 Sol/Luna, and Opus 5 instead use the separate Datacurve DeepSWE mean output count from the exact same reported model and max setting as an explicitly cross-harness scenario. The approved observation is not modified.

## Dollar-cost calibration

The cost method compares Datacurve’s `mean_cost_usd` per scored rollout attempt with AA’s displayed pooled Coding Agent `Cost / Task`; it does not reprice tokens or infer cost from score. Same-effort max comparisons are:

| Reported model (AA harness) | AA pooled USD/task | Datacurve mini-swe-agent USD/scored attempt | Ratio |
|---|---:|---:|---:|
| GPT-6 Astra (Codex) | $7.47 | $7.497828 | 1.0037 |
| GPT-5.6 Sol (Codex) | $6.35 | $8.386436 | 1.3207 |
| GPT-5.6 Luna (Codex) | $0.44 | $3.028117 | 6.8821 |
| Opus 5 (Claude Code) | $10.79 | $11.837583 | 1.0971 |

For GPT-6 Luna, an OpenAI-only through-origin proportional fit on the first three pairs is 1.14824. Applying it to AA’s $0.18 gives $0.2067/scored attempt; the observed three-ratio envelope gives $0.1807–$1.2388. Leave-one-out MAPE is 46.7%, and two of the three Datacurve cost bases are absent. This supports a cost **sensitivity scenario**, not a point forecast.

For Opus 5.5, the same-provider adjacent Opus 5 ratio (1.0971) applied to its $13.04 AA suite mean gives $14.306/scored attempt. This one-pair calculation has no holdout or target-specific uncertainty range. The larger all-model observed cost-factor envelope is 1.0037–6.8821 (which would map $13.04 to $13.09–$89.74); it is only a sample envelope, not a prediction interval.

GPT-6 Sol uses the same three-pair OpenAI through-origin fit as GPT-6 Luna: $2.99 AA suite cost becomes $3.43/attempt, with a very wide observed ratio envelope ($3.00–$20.58). GPT-6 Astra, GPT-5.6 Sol/Luna, and Opus 5 use their exact model/max Datacurve DeepSWE mean costs as separate scenarios for the corresponding AA rows. Same model and effort do not make the AA and Datacurve experiments identical; GPT-5.6 and Opus cost bases are not reported.

Arithmetic audit: the stored Opus 5 cost ratio is the full-precision quotient 11.837583271396396 / 10.79 = 1.097088347673438. An earlier lower-precision ratio field was corrected; the $14.306032053661632 scenario already used the raw cost pair and did not change.

Datacurve’s source cost basis is explicit for GPT-6 Astra but null for the GPT-5.6 and Opus 5 calibration rows. AA reports pay-per-token API costs but does not publish the per-row price snapshot and token-category mix in the comparison table. Those differences can account for transfer error. No current rate-card conversion was performed; official prices would not resolve the missing benchmark-specific token mix.

## Reported-time method

AA's Coding Agent comparison table reports pooled `Time / Task`; its methodology describes an average wall-clock runtime per task, including full task wall time and the agent wall-time subset where available. Datacurve's `mean_duration_seconds` is a mean over scored rollout attempts, but does not define timer start/end boundaries. Time is therefore presented only as a qualitative **reported-time scenario**, never as a verified end-to-end duration.

For GPT-6 Sol/Luna, the mean transfer factor is the arithmetic mean of two exact-model/max ratios: GPT-5.6 Sol 1,128.625 Datacurve seconds / 1,236 AA seconds = 0.9131; GPT-5.6 Luna 1,122.947 / 1,410 = 0.7964. The mean is 0.8548; leave-one-out MAPE is 13.7%. The observed factor envelope 0.7964–0.9131 is not a confidence interval. Applying it to AA's rounded 22.3m GPT-6 Sol and 21.4m GPT-6 Luna suite references yields 19.1m and 18.3m per scored attempt. GPT-6 Astra, GPT-5.6 Sol/Luna, and Opus 5 use the exact-model/max Datacurve duration as a separate scenario. Opus 5.5 uses one adjacent-version Opus 5 max factor (0.7605) on AA's rounded 1.1h, yielding about 50.2 minutes; no holdout or range is supported.

The AA time input is pooled across three benchmarks and its displayed values are rounded. Datacurve's time boundaries remain unspecified. No output speed, agent steps, score, or whole-job elapsed time is converted into runtime.

## Additional cost-only scenarios

Three more cost values are available for exact Artificial Analysis v1.1 rows, but the Coding Agent Index reports average API cost per task pooled across DeepSWE v1.1, Terminal-Bench 4.0, and SWE-Atlas-QnA. The same-row value is carried unchanged as a **suite-cost proxy**, not allocated to DeepSWE and not transferred to a different model, harness, or effort:

| Exact AA target row | Published pooled suite cost/task | Treatment |
|---|---:|---|
| Claude Code / Fable 5.1 (max, with fallback), 64% | $12.39 | Same-row AA suite-cost proxy; very-low qualitative scope confidence. |
| Codex / DeepSeek V4 Pro 0813 (max), 57% | $0.24 | Same-row AA suite-cost proxy; 0813 snapshot kept distinct from Datacurve's V4 Pro label. |
| Codex / DeepSeek V4 Flash 0731 (max), 54% | $0.09 | Same-row AA suite-cost proxy; 0731 snapshot kept distinct from Datacurve's V4 Flash label. |

Artificial Analysis describes these as pooled average pay-per-token API costs per task across the public three-benchmark suite. Exact row identity makes these proxies more attributable than transferring a family-wide ratio, but they are not DeepSWE-only. The Coding Agent suite's mixed token total is not used to estimate output tokens or reprice costs.

Fireworks reports `$0.430`, `$6.524`, `$2.362`, and `$11.838` per task for DeepSeek V4.1-Flash max, GPT-6-Astra xhigh, Gemini 3.8 Flash high, and Claude Opus 5 max, respectively. These are **source-reported cost scenarios on those exact Fireworks observations only**. The source does not specify benchmark version, harness, task/attempt denominator, run identity, or cost accounting; the amounts are not normalized as mean/median USD per scored attempt, calibrated, or transferred. They carry no confidence range. The source rows remain distinct data; three have a same-model Datacurve result and are suppressed from the combined chart because an unspecified version alone is not a known version conflict.

These additions do not establish costs for Muse Spark 1.3 or Grok 4.7. A current rate card without benchmark-matched input/cache/output mix does not yield task cost; score values, token throughput, and total tokens alone are not cost conversions. The incomplete local GLM run remains excluded.

## Scope and remaining gaps

- Direct DeepSWE usage already exists in the approved feed for its 70 official configurations: all have mean cost, output tokens, and reported time. These remain the measured chart data. The current baseline's other 58 observations have all three normalized usage fields missing.
- Seven exact AA target rows have full standalone mean scenarios; seven additional exact rows have cost-only scenarios. Four full scenarios use matching-model/max Datacurve rows (Astra, Opus 5, GPT-5.6 Sol/Luna); GPT-6 Luna/Sol use cross-platform calibration; Opus 5.5 uses an adjacent-version transfer. Cost-only values and the remaining no-scenario IDs are recorded in the research JSON `coverageAudit`.
- Scenarios do not populate approved measurement fields. They are disabled by strict comparisons and unavailable for median views; when disabled or excluded, the target remains in the no-data gutter. Developer reports do not inherit an AA scenario solely because their model label matches; unknown harness and experiment identity stay explicit.
- Remaining score-only reports have no compatible usage tuple. Do not regress usage on pass rate, map a vendor rate card to total cost without the token mix, turn mixed suite token totals into output tokens, or transfer across unknown effort/harness/model/version. Fireworks Cost/Task remains source-scoped to its own report because its aggregation/billing basis is unreported.
- Fireworks’ separate DeepSWE-labeled Cost/Task values remain source-scoped scenarios only: version, harness, task/attempt denominator, run identity, and billing basis are unspecified, with no token counts. They are not calibration points.
- AA’s scores average pass@1 over three attempts/task; Datacurve’s score and efficiency denominator is scored rollout attempts over four full-benchmark runs. Those score results provide context, not a usage conversion.

## Source records

- [AA Coding Agent Index v1.5 methodology](https://artificialanalysis.ai/methodology/coding-agents-benchmarking) — accessed 2026-09-28; task populations, pooled cost/token/time definitions, wall-time scope.
- [AA Claude Code vs Codex](https://artificialanalysis.ai/agents/coding-agents/comparisons/claude-code-vs-codex) — accessed 2026-09-28; Opus 5/5.5 and GPT-6 Astra variant usage.
- [AA Codex vs Kimi Code CLI](https://artificialanalysis.ai/agents/coding-agents/comparisons/codex-vs-kimi-code-cli) — accessed 2026-09-28; GPT-6 Sol/Luna and GPT-5.6 variant cost, time, and total tokens.
- [AA GPT-6 Sol and Luna article](https://artificialanalysis.ai/articles/gpt-6-sol-and-luna-push-the-cost-efficiency-frontier) — published 2026-09-22, accessed 2026-09-28; Intelligence Index output/task values (~31k Sol, ~51k Luna, ~29k GPT-5.6 Sol, ~41k GPT-5.6 Luna) and separate Coding Agent Index metrics.
- [AA GPT-6 Astra benchmarking article](https://artificialanalysis.ai/articles/benchmarking-gpt-6-astra) — published 2026-09-09, accessed 2026-09-28; Intelligence Index output/task (~27k) and exact max effort.
- [AA Claude Opus 5.5 article](https://artificialanalysis.ai/articles/claude-opus-5-5) — published 2026-09-22, accessed 2026-09-28; Intelligence Index output/task (~73k Opus 5, ~119k Opus 5.5).
- [Fireworks DeepSWE comparison](https://fireworks.ai/blog/DeepSeek-V4.1-Flash-Astra) — published 2026-09-14, rechecked 2026-09-28; four same-row Cost/Task values retained as source-reported scenarios with unknown basis.
- [Datacurve DeepSWE v1.1 feed](https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json) — generated 2026-09-22, accessed 2026-09-26; exact source row IDs, means, attempt counts, and available cost-basis statements are retained in the JSON artifact.
