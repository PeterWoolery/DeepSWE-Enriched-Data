# Usage estimation accuracy review

Updated 2026-10-08 for the requested source-backed optional estimates. Current coverage and extension formulas below use the pinned approved dataset and freshly retrieved AA efficiency inputs. Historical discrepancy/holdout sections retain the October 4 review and September calibration inputs; they are not validation of the new targets.

## Conclusion

The strongest X placement is **source-scoped reported benchmark usage**, followed by an explicitly different-experiment same-model benchmark reference. Requested OpenAI-relative transfers are now available as optional, very-low-confidence scenarios where actual AA per-task efficiency exists. They do not establish accurate target-run forecasts. Unsupported identities remain unknown; scores, throughput and prices alone never supply missing usage.

Current direct AA output values already supersede seven historical token estimates. Those old estimates had 14.741% mean absolute percentage error (MAPE), 9.097% median absolute percentage error, and a 3.142–52.852% range against the subsequently recovered AA means. That is a retrospective discrepancy against the correct AA target aggregate, not evidence that a Datacurve measurement was inaccurate in its own experiment.

## Current metric coverage

Runtime inspection imported `src/lib/usage-scenarios.ts`, matched scenarios through `usageScenarioForObservation`, and counted non-null approved metric values in `data/approved/dataset.json`.

| Metric | Approved non-null values | Additional scenario values | Either layer, before chart filtering | Still missing |
|---|---:|---:|---:|---:|
| Dollar cost | 75 | 49 | 124 / 136 | 12 |
| Mean output tokens | 70 | 50 | 120 / 136 | 16 |
| Reported time | 70 | 49 | 119 / 136 | 17 |

The 75 cost values are 70 Datacurve means plus five OpenAI figure-axis values whose statistic is `reported`, not mean. Therefore this is availability, not 75 comparable mean costs. The 70 approved token and time means are Datacurve configurations. Their attempt populations are recorded, but duration-specific telemetry counts and timer boundaries are unspecified.

All 50 scenario identities match their current approved observations. Existing non-null values and per-metric methods are preserved; only gaps are extended. The original 17 scenarios had this breakdown:

- Output: **10 exact AA DeepSWE source means**, one separate-experiment Google reference, two Meta/xAI predecessor transfers.
- Cost: five separate Datacurve references (four AA targets and Google), five transfers (three AA targets and Meta/xAI), three AA pooled-suite proxies, four source-scoped Fireworks reported costs.
- Time: four separate Datacurve references and three transfers. Google has no time scenario.

The extension adds 32 dollar values, 37 output values and 42 time values. Of the added output values, 10 carry same-model AA DeepSWE means as separate-experiment references and 27 transfer II per-task output. Counts precede source precedence, percentage-score eligibility, strict mode, statistic selection and visibility controls; they are not chart mark counts. Scenarios are Mean-control-only and excluded in strict mode. Pooled/source-unspecified costs never become measured means.

Eleven rows have no optional usage at all: developer Fable 5.1 (AA uses mixed-model fallback), Tinfield 1 (no AA identity), and nine older paper rows: Gemini 3.5 Flash medium, Opus 4.6 max, Gemini 3 Flash default, Qwen3.6 Plus default, GPT-5.4 xhigh, Opus 4.7 max, Sonnet 4.6 high, Gemini 3.1 Pro default, DeepSeek V4 Pro default. Reasons are recorded by exact observation ID in `coverageAudit.unsupportedGroups`. Additional partial gaps: MiniMax M2.7 dollars (AA task cost absent); Grok 4.7 high time (AA available xhigh is incompatible); GPT-6.1 Sol Settings 1–5 output/time (ordinal-to-effort mapping unknown). Their existing source dollars remain intact.

## Formulas and target relationship

For paired positive aggregate inputs `x_i` and DeepSWE reference means `y_i`, write `r_i = y_i / x_i`.

| Current/historical method | Formula | Evidence relationship |
|---|---|---|
| Current AA tokens | exact variant `evals[datasetIndexName="deep-swe-v1.1"].mean.outputTokens` | Same AA benchmark/model/effort/harness row; output telemetry count/reasoning scope unspecified. |
| Historical OpenAI token transfer | `target_II_output * mean(r_i)` | Two max-model AA Intelligence Index output/task → Datacurve mini-swe-agent DeepSWE means. Applied to AA Codex targets; two workload/harness transfers. |
| Current OpenAI cost transfer | `target_suite_cost * sum(x_i*y_i)/sum(x_i*x_i)` | Three max-model AA pooled Coding Agent suite → Datacurve DeepSWE pairs; two cost bases unknown. Cost slope 1.1482398468916322. |
| Current OpenAI time transfer | `target_suite_seconds * mean(r_i)` | Two max-model AA pooled wall-time → Datacurve duration pairs. Factor 0.8547716397337312. Timer scopes are not verified equal. |
| Opus 5.5 dollar/time transfer | `target_suite_value * predecessor_ratio` | One Opus 5 max reference, different model version; no holdout. |
| Separate benchmark reference | carry the matching Datacurve mean unchanged | Same reported model/effort, separate evaluator/harness or run; not target-run ground truth. |
| Meta/xAI output transfer | `mean(reference_DeepSWE_output * target_II_total/reference_II_total)` | Entire II evaluation totals, not per-task tokens. Different workloads/populations; Meta additionally xhigh → max. |
| Meta/xAI cost transfer | `mean(reference_DeepSWE_cost * target_II_cost/reference_II_cost)` | II cost/task, not Coding Agent suite cost or target bill; reference price bases unknown. |
| Added coding output reference | carry exact AA `deep-swe-v1.1.mean.outputTokens` unchanged | Same model/compatible effort, separate target experiment/harness; output-specific telemetry count and reasoning scope unspecified. |
| Added II output transfer | `target_II_output_per_task * mean(y_i/x_i)` | Two OpenAI max Sol/Luna pairs; reasoning plus answer output/task, not II evaluation-total tokens. Factor 1.9138219929068399. |
| Added II cost transfer | `target_II_USD_per_task * sum(x_i*y_i)/sum(x_i*x_i)` | Three OpenAI max Astra/Sol/Luna pairs; factor 2.8526399433447494. Anchor ratios ~2.30–16.98 show severe workload/accounting uncertainty. |
| Added II time transfer | `target_II_seconds_per_task * mean(y_i/x_i)` | Same three OpenAI max pairs; factor 3.1737702255611353. II evaluation weighting/time differs from coding wall time. |

`efficiencyExtension.references` stores full-precision source inputs; `iiAnchors` binds exact approved configuration IDs and per-metric membership. Runtime derives coefficients from approved full-precision metrics, not rounded display numbers. Added coding cost/time transfers explicitly reuse the original September rounded-input OpenAI cost/time coefficients above with October target inputs, preserving baseline scenarios rather than silently refreshing calibration snapshots. Sources record URL/date/SHA-256 and serialized variant ID or exact model slug; model-page extraction selects `initialModels[slug=...]`, never an unrelated model elsewhere in the HTML.

Coding cost/time use `variant.mean.costUsd` and `variant.mean.agentWallTimeSec`, pooled over DeepSWE v1.1, TerminalBench 4 and SWE Atlas QnA; they are not DeepSWE-only measurements. II uses `intelligenceIndexOutputTokensPerTask.output`, `intelligenceIndexCostPerTask.cost.total` and `intelligenceIndexTimePerTask`, each with its own II workload/weighting. No mixed coding token total is substituted for output.

Unknown target effort can use the exact model's AA default/max only as an explicit sensitivity assumption: Gemini 4's unnamed highest setting is not established as AA high; Mistral's default and Opus 5.5's max are not developer effort identity. Paper provider-default to AA Reasoning references explicitly state a variant assumption, not mode alignment. Explicitly conflicting efforts are excluded. MiMo average@3 references remain per-attempt estimates with an unknown task-bill denominator, without a threefold multiplier. Fable WITH FALLBACK duration remains scoped to that mixed-model AA variant and is not transferred to the developer's pure Fable row. No new confidence intervals or target accuracy claims are supported.

AA suite mixed-category token totals cannot supply output-only tokens. Cost alone cannot identify output tokens without measured input/cache/output mix and accounting. Tokens/second cannot supply task runtime without measured task context, tool/retry/setup/queue and timer boundaries. Scores are not predictors here.

## Historical tokens versus recovered AA DeepSWE means

Signed error is `100 * (old / AA_mean - 1)`; absolute percentage error (APE) is its absolute value. Calculations use full stored precision; table display is rounded.

| AA target, max effort | Historical output | Recovered AA output | Signed error | APE |
|---|---:|---:|---:|---:|
| GPT-6 Sol | 59,824.928180 | 70,300.330383 | −14.900929% | 14.900929% |
| GPT-6 Luna | 98,421.656038 | 108,271.563422 | −9.097409% | 9.097409% |
| Opus 5.5 | 191,648.185610 | 406,479.005900 | −52.851640% | 52.851640% |
| Opus 5 | 117,565.693694 | 129,793.946903 | −9.421282% | 9.421282% |
| GPT-6 Astra | 61,148.506637 | 56,420.182891 | +8.380554% | 8.380554% |
| GPT-5.6 Sol | 60,013.644444 | 56,943.890855 | +5.390839% | 5.390839% |
| GPT-5.6 Luna | 73,399.707589 | 75,781.002950 | −3.142338% | 3.142338% |

- All seven: **MAPE 14.740713%, median APE 9.097409%, range 3.142338–52.851640%**.
- Three transferred targets (Sol/Luna/Opus 5.5): n=3, MAPE **25.616659%**, median **14.900929%**, range **9.097409–52.851640%**.
- Four carried Datacurve references: n=4, discrepancy MAPE **6.583753%**, median **6.885696%**, range **3.142338–9.421282%**. These are different-harness experiments, not repeated measurements of an identical run.
- Both historical two-factor OpenAI sensitivity envelopes missed the recovered targets: Sol 55,497–64,153 versus 70,300; Luna 91,302–105,541 versus 108,272. Thus even two apparently close calibration ratios do not justify interval coverage.

No historical central estimate exists for AA Fable 5.1 or the two AA DeepSeek snapshots in the seven-row baseline. They are excluded, not assigned an invented baseline. The Fable research-only tool-disabled hypothesis (153,877.461) and II hypothesis (201,607.714) are not an established estimator or interval. Meta's 101,882.997 transfer and AA Muse Code's 122,491.690 mean are different-harness target contexts; their proximity cannot validate Meta-run estimation. AA Grok Build xhigh cannot validate xAI's high-effort target.

## Leave-one-model-out diagnostics

Each fold removes the entire model identity; the evaluated sets contain one effort/configuration per model, so no sibling-effort row leaks into training. Independent sample sizes below are **models**, not the hundreds of scored attempts behind each mean. Holdout targets are existing paired aggregates, not actual usage for the missing target experiment. LOMO is diagnostic cross-validation, not a prospective target holdout.

Comparison methods: arithmetic mean of ratios; ordinary median of ratios; `exp(median(log(r_i)))`; current through-origin slope for cost. With two training ratios the ordinary median equals their arithmetic mean, while log-median is their geometric mean. With one training row all methods are identical.

| Paired set | Models | Method | MAPE | Median APE | APE range |
|---|---:|---|---:|---:|---:|
| OpenAI AA suite cost → Datacurve cost | 3 | Current slope | 46.724032% | 34.227250% | 22.461522–83.483324% |
| Same cost set | 3 | Mean / ordinary median ratio | 196.758755% | 198.546873% | 83.112499–308.616894% |
| Same cost set | 3 | Log-median ratio | 127.546161% | 99.004859% | 83.270254–200.363369% |
| Existing OpenAI suite time → Datacurve time | 2 | All ratio methods | 13.717948% | 13.717948% | 12.781423–14.654474% |
| Existing historical II output → Datacurve output | 2 | All ratio methods | 14.543611% | 14.543611% | 13.491562–15.595660% |
| Expanded OpenAI suite time → Datacurve time | 3 | Mean / ordinary median | 19.008773% | 23.961553% | 5.163207–27.901559% |
| Same expanded time set | 3 | Log-median | 18.324516% | 24.138960% | 3.620898–27.213692% |

Current cost fold signed errors: Astra **+34.227250%**, GPT-5.6 Sol **−22.461522%**, GPT-5.6 Luna **−83.483324%**. The suite-to-DeepSWE ratios are **1.003725301, 1.320698637, 6.882083660**. The slope weights ratios by squared source cost and therefore mostly ignores the cheap Luna point; robust central calibration does not solve this workload/accounting mismatch.

Existing time fold signed errors: Sol **−12.781423%**, Luna **+14.654474%**. An additional recoverable exact model/max overlap is Astra's AA **1,764s** versus Datacurve **1,982.966814s**, ratio **1.124130847**. Including it materially broadens the diagnostics to the expanded n=3 rows above; the existing two-point result is not a universal 14% time bound. The single Opus ratio supplies no same-family holdout for the Opus 5.5 time or cost target.

### Additional real output overlaps

The five OpenAI/Codex max targets have rounded AA II per-task output inputs and exact AA DeepSWE means. These allow same-harness, cross-benchmark diagnostics without treating Datacurve as AA target ground truth:

| AA II output/task → AA DeepSWE output, n=5 models | MAPE | Median APE | APE range |
|---|---:|---:|---:|
| Arithmetic mean ratio | 7.490331% | 6.039321% | 1.865415–14.211234% |
| Ordinary median ratio | 7.723503% | 7.268433% | 2.218533–13.957939% |
| Log-median ratio | 7.754879% | 7.265074% | 2.292937–13.954371% |

This is a small selected group of models whose target means are already known. It supports a research hypothesis for a narrowly matched OpenAI/Codex/max stratum, not a need to estimate those five existing rows. There is no demonstrated robust-method advantage. Opus 5/5.5 in the corresponding Claude Code stratum (n=2) gives **70.030945% MAPE**, range **47.947640–92.114250%** with all ratio methods. Pooling those providers would conceal the failed transfer.

### Predecessor diagnostics

| Set | Models | Metric | MAPE | APE range |
|---|---:|---|---:|---:|
| Muse 1.1/1.2 xhigh | 2 | Output | 59.146104% | 42.964085–75.328123% |
| Muse 1.1/1.2 xhigh | 2 | Cost | 88.879381% | 55.090202–122.668560% |
| Grok 4.5/4.6 high | 2 | Output | 35.058477% | 29.091045–41.025910% |
| Grok 4.5/4.6 high | 2 | Cost | 1.479644% | 1.468698–1.490590% |

With one training model per fold, median/log/mean cannot differ. Grok's tight historical cost ratio has no independent Grok 4.7 target bill and cannot establish a 1.5% forecast bound. Muse's diagnostics also do not test the xhigh→max change.

## Recommended simpler source hierarchy

Apply independently to each metric and statistic; require explicit source/model snapshot/effort/benchmark/harness identity.

1. **Direct exact benchmark aggregate**: use the reported mean for that source row. Extract AA benchmark output fields rather than transferring Intelligence Index values. Carry its telemetry/accounting gaps. A faithfully extracted source value is not a claim of zero uncertainty in underlying usage.
2. **Same-model benchmark reference**: use its measured mean as a visibly separate experiment reference. Prefer this over predecessor arithmetic; never join its usage to the target score as a measured target-run tuple. In a deliberately approximate chart it may provide a reference mark with clear labeling.
3. **Calibrated suite transfer**: only when matching overlap evidence and grouped holdouts pass the acceptance gate below. Use a single multiplicative factor; choose arithmetic/median/log-median by predeclared metric loss on training folds, not by target hindsight. Existing OpenAI dollar evidence fails. Time evidence is exploratory. Suite mixed tokens do not qualify as output-token inputs.
4. **Predecessor reference**: expose as optional contextual/sensitivity evidence; do not quietly escalate its precision. Existing Meta/xAI and Opus 5.5 cases do not support accurate target-run forecasts.
5. **No data**: retain the no-data placement where actual efficiency inputs or compatible identities are absent. Requested exploratory transfers remain optional even when their accuracy gate has not passed.

A same-row pooled dollar cost remains a **suite-cost proxy**, not a direct DeepSWE cost at tier 1. Fireworks source-reported Cost/Task remains source-scoped with unspecified normalization. Different metrics can legitimately land at different tiers on the same score row.

### Collection feasibility

`docs/inference-source-review.md` documents public comparison HTML serialization and exact variant/eval locators. October 8 inputs were freshly checked at `https://artificialanalysis.ai/agents/coding-agents` and exact AA model pages; the older `/leaderboards/coding-agents` path is unavailable. This establishes structured HTML extraction, not a documented stable API. Match exact variant IDs/model slugs and benchmark keys, retain URL/date/hash/definitions, and reject ambiguous identities. No DeepSWE-specific AA dollar or duration field is established: those inputs remain pooled or II-workload values even where outputTokens is DeepSWE-specific.

## Testable meaning of “fairly accurately”

Proposed acceptance criteria, **not achieved accuracy claims**:

- For an approximate positive X forecast, require held-out-model **median APE ≤20%**, **MAPE ≤25%**, and **90th-percentile APE ≤50%**, evaluated separately for dollars, tokens and reported duration. A 50% relative-error tolerance is useful for broad placement, not precise ranking or billing.
- Require at least **10 independent matched model identities** in the intended benchmark/harness/effort/accounting stratum before enabling calibrated default placement, with all efforts and source duplicates of a held-out model excluded. Ten is a minimum engineering gate, not enough to establish stable tail coverage; label it preliminary and collect independent prospective target checks. Predecessor forward prediction needs time-ordered holdouts too.
- Reject default transfer when these requirements fail; keep research/sensitivity values optional. With insufficient n, the verdict is “unvalidated,” even if every observed fold is within tolerance. Do not pass a method by measuring agreement with its own copied reference.
- If presenting an uncertainty band, predeclare nominal coverage (for example 80%), then measure out-of-model coverage on additional target observations. Calibration-ratio extrema are sensitivity envelopes, not 80%/95% prediction intervals. Current samples cannot support a calibrated probability interval.
- For logarithmic chart placement also report absolute log10 error: 0.15 dex is a factor of 1.413 and 0.30 dex a factor of 1.995. This symmetric multiplicative measure supplements, rather than silently replaces, the declared APE gates. Zero-valued metrics require a separate absolute-error rule.

Honest present bounds:

| Metric | What evidence supports now | What it does not support |
|---|---|---|
| Output tokens | Exact source-scoped AA means for 10 scenario rows; observed seven historical discrepancies 3.14–52.85%; narrow OpenAI/Codex II diagnostic 1.87–14.21%, n=5. | A universal ±15% or ±20% target-run forecast, reasoning-normalized comparability, telemetry CI, or median inference. |
| Dollar cost | Reported exact-source costs/references; current OpenAI transfer diagnostic 22.46–83.48%, n=3. | A useful general point-forecast bound, a target bill, or benchmark-only pricing from suite totals. |
| Reported time | Source duration means/references; two-model transfer 12.78–14.65%, expanded three-model 5.16–27.90%. | Guaranteed ±15%/±30% target runtime, verified end-to-end boundaries, throughput conversion, or a prediction interval. |

None of the calibrated strata meets the minimum sample-size gate. Direct source collection is the supported accuracy improvement; robust calibration is a candidate to test, not an established replacement.

## Reproducible calculation summary

Inputs and evidence:

- `src/lib/usage-scenarios.ts`: existing direct-output/reference builders plus `iiCalibrationRows` and `extendEfficiencyScenario` implement the per-metric formulas above.
- `data/research/usage-proxy-cross-platform-20260927.json`: `scenarios[].deepSWEOutputTokensPerScoredAttemptScenario`, `outputTokenCalibration`, `costCalibration`, `timeCalibration`, `datacurveDirectMatches`, `aaCodingAgentVariants`.
- `data/research/inference-meta-google-xai.json`: `calibration.meta`, `calibration.xai`.
- `data/research/inference-chinese-models.json`: exact AA DeepSeek snapshot source means.
- `data/research/inference-anthropic-openai-other.json`: research-only Fable hypotheses, not additional validation samples.
- `data/approved/dataset.json`: unchanged 136-row availability and source identities.
- `docs/inference-source-review.md:7–21,35–44`: recovered AA target aggregates, metric scope and reproducible public extraction locators.

The core numeric reproduction below reads existing files only. Run from the repository root with Python 3. Each model here has one configuration; `nn != name` is deliberately model-level exclusion, not attempt-level resampling.

```python
import json, math, re, statistics as st
from pathlib import Path

r = json.loads(Path('data/research/usage-proxy-cross-platform-20260927.json').read_text())
direct = {z['targetObservationId']: z['value'] for z in r['usageFacts']
          if z['metric'] == 'outputTokens' and z['value'] is not None}
errors = [abs(z['deepSWEOutputTokensPerScoredAttemptScenario'] /
              direct[z['targetObservation']['observationId']] - 1) * 100
          for z in r['scenarios']]
print('legacy', len(errors), st.mean(errors), st.median(errors), min(errors), max(errors))

def holdout(rows, method):
    errors = []
    for name, x, y in rows:
        train = [(xx, yy) for nn, xx, yy in rows if nn != name]
        ratios = [yy / xx for xx, yy in train]
        factor = {
            'mean': lambda: st.mean(ratios),
            'median': lambda: st.median(ratios),
            'logmedian': lambda: math.exp(st.median(list(map(math.log, ratios)))),
            'slope': lambda: sum(xx * yy for xx, yy in train) /
                             sum(xx * xx for xx, yy in train),
        }[method]()
        errors.append(abs(x * factor / y - 1) * 100)
    return len(rows), st.mean(errors), st.median(errors), min(errors), max(errors)

cost = [(z['model'], z['aaPooledUsdPerTask'], z['deepSWEUsdPerScoredAttempt'])
        for z in r['costCalibration']['openaiMaxPairs']]
time = [(z['model'], z['aaTimePerTask']['seconds'],
         z['deepSWEMeanDurationSecondsPerScoredAttempt'])
        for z in r['timeCalibration']['openaiMaxPairs']]
for label, rows in [('cost', cost), ('time', time)]:
    for method in ['slope', 'mean', 'median', 'logmedian']:
        print(label, method, holdout(rows, method))
ref = next(z for z in r['datacurveDirectMatches'] if z['scenarioModelLabel'] == 'GPT-6 Astra')
aa = next(z for z in r['aaCodingAgentVariants'] if z['model'] == 'GPT-6 Astra')
time.append(('GPT-6 Astra', aa['pooledExecutionTimePerTask']['seconds'],
             ref['meanDurationSecondsPerScoredAttempt']))
for method in ['mean', 'median', 'logmedian']:
    print('expanded time', method, holdout(time, method))
for group in ['GPT', 'Opus']:
    rows = [(z['model'], z['aaIntelligenceIndexOutputTokensPerTaskApprox'],
             direct[z['targetObservation']['observationId']])
            for z in r['scenarios'] if z['model'].startswith(group)]
    for method in ['mean', 'median', 'logmedian']:
        print('II -> AA DeepSWE', group, method, holdout(rows, method))
m = json.loads(Path('data/research/inference-meta-google-xai.json').read_text())
for group, refs in m['calibration'].items():
    for metric, xkey, ykey in [
        ('output', 'aaIITotalOutputMillions', 'meanOutputTokensPerScoredAttempt'),
        ('cost', 'aaIIUsdPerTask', 'meanUsdPerScoredAttempt'),
    ]:
        print(group, metric, holdout([(z['model'], z[xkey], z[ykey]) for z in refs], 'mean'))
```
