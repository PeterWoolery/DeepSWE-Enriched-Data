# DeepSWE source research

Research pass completed 2026-09-26 for `deepswe_coding_agent_prompt_v2.md`. Source status, response hashes, and the point-in-time feed shape are captured in [`data/research/source-capture.json`](../data/research/source-capture.json). Hashes identify fetched response bytes, not stable upstream revisions.

## Findings at a glance

- The official v1.1 JSON endpoint is live and structured. It currently contains 70 configurations across 28 models; unlike the prompt's earlier observation, **all 70 rows have mean and median duration fields**.
- Durations are seconds and the feed says all efficiency aggregates cover scored rollout attempts. The feed does not define timer boundaries, duration-specific sample counts, or timeout/environment rules. Import duration as a directly reported but incompletely scoped metric; do not label it verified end-to-end wall-clock time or treat it as strictly comparable without qualification.
- The official web page's All effort levels table is sorted by score, displays 57/70 configurations, and defaults to Best. Its controls include Cost, Output tokens, and Agent steps, but no Time control. Do not use the rendered list order to construct effort paths.
- The official JSON/site cost discrepancy remains: GPT-5.6 Sol `[max]` is `$8.386436…` in the feed and `$6.46` on the rendered site. The changelog confirms pricing revisions but does not establish a complete row-level reconciliation formula.
- OpenAI's Sol/Luna claims are verified in its own release copy. Anthropic's card reports a different Opus 5.5 result, and Artificial Analysis has a separately attributed Opus 5.5/Claude Code evaluation. Keep all three source series distinct.
- The community candidate is MIT-licensed, but its DeepSWE adapter rounds values and retains only one best row per model. Reuse only small ingestion ideas if useful, preserving the MIT notice; do not adopt its output as the observations model.
- No feed-specific redistribution license was found. Datacurve's benchmark repository has an Apache-2.0 license, but it does not clearly license the separately hosted live JSON. Therefore no full feed snapshot is included here; the captured hash and schema metadata are sufficient for the implementer to re-fetch after resolving data-use policy.

## Retrieval and evidence

All listed sources were successfully retrieved on 2026-09-26 unless stated otherwise. Direct status, response size, validators, and hashes are in the capture manifest.

| Source | Retrieval / evidence |
|---|---|
| [Datacurve leaderboard](https://deepswe.datacurve.ai/) | HTTP 200; rendered in-browser. Page says 113 tasks, updated Sep 22, 2026; 28 models. Current table shows 21/28 models in Best and 57/70 configurations in All effort levels. Visible controls: Cost, Output tokens, Agent steps; no Time. |
| [v1.1 live JSON](https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json) | HTTP 200, `application/json`; 94,758 bytes; ETag `W/"c474b4a789dbf2a61e5f0d637be2dc90"`; Last-Modified `Tue, 22 Sep 2026 06:47:03 GMT`; `generated_at` `2026-09-22T06:27:15.860279+00:00`. |
| [Changelog](https://deepswe.datacurve.ai/changelog), [v1.1 blog](https://deepswe.datacurve.ai/blog/deepswe-v1-1), [benchmark repository](https://github.com/datacurve-ai/deep-swe) | HTTP 200. The blog says v1.1 grades committed code in a clean, isolated environment and reports 113 tasks. Repository `LICENSE` is Apache-2.0. |
| [Datacurve data page](https://deepswe.datacurve.ai/data/v1.1) | HTTP 200. Its public page describes per-(task, model) rollout outcomes and a trajectory-analysis sample. No trial/trajectory bodies were downloaded or retained. |
| `https://deepswe.datacurve.ai/terms` | HTTP 404. This does not establish that no terms exist elsewhere; no feed-specific data license was found in the inspected site/repository sources. |
| [OpenAI GPT-6 Sol and Luna announcement](https://openai.com/index/introducing-gpt-6-sol-and-luna/) | HTTP 200. Evidence locator: **Coding**, paragraph beginning “On DeepSWE v1.1…”. |
| [Anthropic Claude Opus 5.5 System Card PDF](https://www-cdn.anthropic.com/fc1b44717c85dc068bc6ba5024219938094694bd/Claude%20Opus%205.5%20System%20Card.pdf) | HTTP 200, `application/pdf`, 230 PDF pages. Text search located the DeepSWE section on PDF index 175; the page was visually rendered and inspected. No PDF or page image is retained in the workspace. |
| [Artificial Analysis Coding Agent Index](https://artificialanalysis.ai/agents/coding-agents) and [Claude Code vs Codex comparison](https://artificialanalysis.ai/agents/coding-agents/comparisons/claude-code-vs-codex) | Both HTTP 200. Comparison table identifies Claude Code / Opus 5.5 (max) and a DeepSWE v1.1 score. |
| [Community repo](https://github.com/781316853/llm-benchmark), [`LICENSE`](https://raw.githubusercontent.com/781316853/llm-benchmark/main/LICENSE), [`deepswe.js` adapter](https://raw.githubusercontent.com/781316853/llm-benchmark/main/scripts/sources/deepswe.js), [`data/deepswe.js`](https://raw.githubusercontent.com/781316853/llm-benchmark/main/data/deepswe.js) | HTTP 200. GitHub API reports default branch `main`, last pushed `2026-09-26T13:49:23Z`; license metadata is MIT. The source/data files were statically inspected; the fetched JavaScript was not executed, imported, or evaluated. |
| [DataLearner DeepSWE table](https://www.datalearner.com/benchmarks/deepswe) and [methodology](https://www.datalearner.com/about/data-methodology) | HTTP 200. Methodology describes source-priority principles, but the captured benchmark rows did not expose row-level primary-source links. Treat its additional rows as secondary candidates until their cited originating documents are reviewed. |
| [Qwen3.8-Flash article](https://developer.aliyun.com/article/1763215) | HTTP 200. DeepSWE score appears in the section **“四、模型能力与评测” → “编程与智能体任务”**. The page's copyright notice says content is user-contributed; it is not, by itself, proof of an official Qwen-authored report. |
| [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [schedule event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [Vite Pages deployment](https://vite.dev/guide/static-deploy.html#github-pages), [ECharts line handbook](https://echarts.apache.org/handbook/en/how-to/chart-types/line/basic-line/), [ECharts line-series API](https://echarts.apache.org/en/llms-documents/option-parts/option.series-line.md), [ECharts x-axis API](https://echarts.apache.org/en/llms-documents/option-parts/option.xAxis.md) | Official documentation URLs retrieved successfully. Current deployment facts and chart behavior evidence are summarized below. |

## Official v1.1 feed: shape and field mapping

The root fields are `scope`, `unit`, `generated_at`, `n_tasks_in_set`, `latest_job`, and `rows`. `scope` describes every DeepSWE rollout across imported Pier jobs, grouped by harness, model, and reasoning effort. At capture, `n_tasks_in_set` is 113, `rows` has 70 objects, and there are 28 distinct `model` strings and 70 distinct `config` IDs. The only observed `harness` is `mini-swe-agent`. The latest-job metadata points to a job finished Sep 1; it is not a per-row evaluation date.

Field mapping for an import:

| Purpose | Feed fields | Notes |
|---|---|---|
| Configuration identity | `config`, `model`, `harness`, optional `provider`, `reasoning_effort`, `source` | `config` is the upstream configuration ID. There is no explicit model snapshot, evaluation-series ID, or row-level evaluator ID. One row has null `reasoning_effort`; retain it as unknown, not a guessed mode. |
| Benchmark / population | `n_tasks_in_set`, `n_tasks_attempted`, `n_attempted`, `n_passed`, `n_tasks_passed_any`, `n_runs`, `completed_by_attempt` | Attempts and unique tasks are separate denominators. The root `unit` says efficiency aggregates cover every scored attempt. Preserve the original denominator and counts. |
| Scores | `pass_at_1`, `pass_at_4`, `pass_rate`, `pass_rate_by_attempt` | The feed defines pass@1 as attempt pass rate over scored rollout attempts; pass@4 is tasks with at least one passing rollout divided by tasks attempted. Preserve pass@1 as its original fraction and retain the exact metric label. |
| Uncertainty | `ci_lo`, `ci_hi`, `ci_half`, `ci_method`, `ci_passed`, `ci_attempted` | `ci_method` is “95% run-to-run: SE across repeated whole-benchmark passes (1.96 * std(runs)/sqrt(R))”. Preserve this method; do not reinterpret as a binomial interval. |
| Cost | `mean_cost_usd`, `median_cost_usd`, optional `cost_basis` | Both means/medians exist for all 70 rows; `cost_basis` appears on 5/70. Missing basis must not be filled from another source or treated as current repricing proof. |
| Tokens | `mean_output_tokens`, `median_output_tokens`, input/cache/reasoning-token fields | Mean output tokens exist for all 70 rows. `mean_reasoning_tokens` appears on only 5/70, so the feed does not establish reasoning-token inclusion/exclusion across all rows. |
| Time | `mean_duration_seconds`, `median_duration_seconds` | Both appear on 70/70 rows. Seconds are explicit in field names. There is no distinct timing-sample count or stated start/end boundary. |
| Other efficiency | `mean_agent_steps`, `median_agent_steps`, `mean_compute_units`, `median_compute_units`, `median_peak_context_tokens`, `median_output_tokens_to_pass` | Preserve as optional source values; do not substitute these for duration. |

The row object also includes `mean_input_tokens`, `median_input_tokens`, `mean_cache_tokens`, `mean_cache_read_tokens`, `mean_cache_write_tokens`, `mean_uncached_input_tokens`, `median_cache_read_tokens`, `median_cache_write_tokens`, `median_uncached_input_tokens`, `median_reasoning_tokens`, `median_compute_units`, `median_peak_context_tokens`, `median_output_tokens_to_pass`, and the count/score fields listed above. The complete sorted key list and per-field coverage are in the capture manifest.

### Time semantics

The live feed supersedes the prompt's older statement that no duration field was identified. A valid official **reported-time** view can use `mean_duration_seconds` directly; at retrieval it had 70/70 coverage. Because the feed's unit statement places efficiency aggregates over scored attempts, the denominator is a scored rollout attempt, not one unique task. It does not define whether timing includes model calls, tools, retries, queueing, setup, verification, or timeout treatment, and it provides no separate timing sample count, environment, serving endpoint, or concurrency. Keep it explicitly scoped as “reported mean seconds per scored attempt; timer boundaries not specified.” Do not call it verified end-to-end time or pass strict timing-scope matching until Datacurve documents those details. Median is also present; do not silently substitute it for mean.

## Series identity and effort order

- The feed's `scope` and `config` establish useful provenance for points, but there is no explicit series ID, effort-order array, model snapshot, or complete row-level protocol fingerprint. Candidate official series should be isolated by v1.1, exact model identity, evaluator/source, harness, provider when known, metric, and population; do not group null protocol values together.
- The official page's **All effort levels** table is ordered by score, not effort. For example, the GPT-6 Astra labels are displayed `xhigh`, `high`, `max`, `medium`, `low`; this is not a usable path order. The feed's array order is likewise not an order contract.
- Use a reviewed, vendor/model-specific effort-order map only where evidence supports it. The familiar `low → medium → high → xhigh → max` sequence is a candidate for labels that support it, not a source-provided global ordering. Preserve original labels and budget values; leave null/adaptive/unmapped labels as standalone points. Do not alphabetize or sort by X, score, or cost.
- The upstream `config` identifies individual points, not a cross-configuration experiment. The website's displayed 57/70 is a filtered presentation, not the feed size. Import all 70 feed rows, preserving source precision.
- The captured official controls are Cost, Output tokens, and Agent steps; time is absent from the rendered product despite being in the feed. The new app can expose time while qualifying its scope.

## Official rendered cost vs feed cost

The same current official GPT-5.6 Sol `[max]` configuration provides a verified discrepancy:

| Observation | Score | Cost | Output tokens | Steps | Duration |
|---|---:|---:|---:|---:|---:|
| JSON row `mini_swe_agent_gpt_5_6_sol_max` | `0.7266666666666667` pass@1 | `$8.386436346666667` mean USD | `60013.64444444444` mean | `61.25333333333333` mean | `1128.624910331111` mean seconds |
| Rendered leaderboard, All effort levels | `73% ± 3%` | `$6.46` | `60k` | `61` | Not displayed |

The score/token/step display is consistent with rounding. The cost is not. The Aug 21 changelog says GPT-5.6 Sol costs were updated after an Aug 20 OpenAI price cut (20% input and 33% output, promotional through at least Nov 21, 2026); it does not give a row-level conversion/reconciliation rule. Preserve feed-reported and website-rendered costs separately, with their source/retrieval provenance. Do not choose one as canonical or infer a multiplier from release prose.

## Developer and independent reports

| Source series | Rechecked observation | Keep unknown / distinction |
|---|---|---|
| OpenAI developer report — [GPT-6 Sol and Luna](https://openai.com/index/introducing-gpt-6-sol-and-luna/) | DeepSWE v1.1: GPT-6 Sol, max effort, 68.8%; GPT-6 Luna, max effort, 66.6%. The evidence is the Coding paragraph cited above. | The page says “scores” but does not establish the exact metric, denominator, harness, CI, or exact cost. OpenAI's approximate relative-cost language is not a dollar amount. Keep costs and unreported protocol fields null. The current Datacurve feed has neither GPT-6 Sol nor GPT-6 Luna; do not alias them to GPT-5.6 Sol/Luna or GPT-6 Astra. |
| Anthropic developer report — [Claude Opus 5.5 System Card](https://www-cdn.anthropic.com/fc1b44717c85dc068bc6ba5024219938094694bd/Claude%20Opus%205.5%20System%20Card.pdf) | PDF page index **175**, printed page **175**, §**8.3 DeepSWE v1.1**: Claude Opus 5.5 scored an average of **74.2% over five trials** on the described 113-task benchmark. Visual inspection confirms this is one prose paragraph; it contains no DeepSWE figure/table, effort setting, or DeepSWE footnote. | No max-effort label, harness, exact score metric, per-trial values, confidence interval, or cost is provided in this section. Preserve as a distinct developer report; do not map it to Artificial Analysis or Datacurve rows. PDF was inspected but not retained. |
| Artificial Analysis independent evaluation — [comparison page](https://artificialanalysis.ai/agents/coding-agents/comparisons/claude-code-vs-codex) | Table identifies **Claude Code**, representative model **Opus 5.5 (max)**, and **68%** for DeepSWE v1.1. | The retrieved table does not define the score metric/denominator or a task-specific cost. Its `$13.04` Cost per Task is an index-level value: Artificial Analysis describes cost as an average across DeepSWE v1.1, Terminal-Bench 4.0, and SWE-Atlas-QnA. Do not attach it to DeepSWE. Keep this independent series separate from Anthropic's 74.2% system-card report. |

## Community reuse candidate and supplemental discovery

The `781316853/llm-benchmark` repo reports MIT, copyright `781316853` 2025–2026; if any source code is reused, preserve its full license/copyright notice. That license does not grant rights to the third-party claims or assets assembled in the repo.

The DeepSWE adapter separates fetch and parse and calls a shared retry transport. Those are possible ingestion ideas. The adapter also maps every row to rounded score/CI/cost/token/step values, rounds pass@1 before comparison, groups only by model name, selects one best rounded row per model, and writes the reduced list. That discards effort curves and can select incorrectly around rounding boundaries. Do not reuse that normalization/selection behavior or its cross-benchmark composite ranking. Static inspection only; no remote JS was executed.

Static extraction of its current `data/deepswe.js` literal found 36 rows, including 8 supplemental candidates. The following values are **discovery leads, not source-reviewed approvals**:

| Candidate in community snapshot | Reported effort | Snapshot value | Trace result |
|---|---|---:|---|
| DeepSeek-V4.1-Flash | 最高（工具; max/tool) | 74.2 | The primary DeepSeek technical report confirms the raw “Resolved” score; the unverified secondary effort label was not carried forward. |
| MiMo-V2.6-Pro | 思考模式（工具; thinking/tool) | 71.9 | Xiaomi Table 3 confirms the model/value; its statistic and effort are unspecified, so the candidate effort was not carried forward. |
| Grok 4.7 | 思考模式 High（工具; high/tool) | 71.0 | xAI's release confirms 71.0% and high effort; only its primary source observation is retained. |
| Qwen3.8-Max-0902 | 极高强度思考（工具; high-intensity/tool) | 69.3 | DataLearner only; primary evidence not verified. |
| GPT-6 Sol | 最高（工具; max/tool) | 68.8 | Exact model/effort/value match OpenAI's direct report. Prefer the OpenAI source record; treat the community/DataLearner row as a possible duplicate, not another experiment. |
| MiMo-V2.6-Flash | 思考模式（工具; thinking/tool) | 67.9 | Xiaomi Table 3 confirms the model/value; its statistic and effort are unspecified, so the candidate effort was not carried forward. |
| Step 5 Preview | 思考模式 High（工具; high/tool) | 67.7 | DataLearner only; primary evidence not verified. |
| Qwen3.8-Flash | — | 58.7 | The official Qwen model card reports raw 58.7 for **Qwen3.8-Flash-Next** in its DeepSWE 1.1 table and says the best of Claude Code/mini-SWE-agent was on mini-SWE-agent. Statistic, unit symbol, effort, and trial count are not stated; no alias to Qwen3.8-Flash is asserted. |

DataLearner's method page says it prioritizes official GitHub, model cards, and papers, but the rows inspected did not expose their underlying citations. Five claims were subsequently matched to primary result documents and resolved without adding duplicate secondary observations. Qwen3.8-Max-0902 and Step 5 Preview remain pending. Do not let a community `src` tag upgrade a claim to source-reviewed.

## Current official deployment references

- GitHub Pages is available for public repositories on GitHub Free; standard GitHub-hosted runners are free for public repositories and Pages. Larger runners are charged. Current Pages limits documented are a 1 GB published site, 100 GB/month soft bandwidth limit, and 10-minute deployment timeout.
- The custom Pages workflow docs require at least `pages: write` and `id-token: write` for deployment and use the `github-pages` environment. Their current sample uses `configure-pages@v5`, `upload-pages-artifact@v4`, and `deploy-pages@v4`; verify supported action revisions before implementation.
- The schedule event runs from the default branch in UTC by default, may be delayed or dropped under load (especially near the top of an hour), and public-repository scheduled workflows are disabled after 60 days without repository activity. Use a non-round schedule, manual dispatch, and visible freshness state.
- Vite's official GitHub Pages guide says project sites need `base: '/<REPO>/'`; user/organization root sites and custom domains use `/`. Keep the Pages base path deployment-configured.
- ECharts' official handbook also includes **Line Chart in Cartesian Coordinate System** with paired points `[[20, 120], [50, 200], [40, 50]]`; this demonstrates a line using paired X/Y data with a non-monotonic X sequence (50 → 40). Its line-series API documents `smooth: false` and `connectNulls: false` as defaults, and describes `dataIndex` as an index in the input data array. The axis API distinguishes category from numerical `value`/`time`/`log` axes. This is useful evidence for the XY design, but the docs do not state an explicit guarantee that the rendered path always follows input order. If ECharts is chosen, use two numeric/value axes and still lock the selected version's behavior with a deterministic test for ordered non-monotonic points, null gaps, and unsmoothed segments.

## Import recommendations and blockers

1. Treat the JSON endpoint as an observed source, not a supported API. At refresh, validate non-empty feed, version, row/config uniqueness, types, and unexpected field changes; retain unknown optional fields and last-known-good approved data.
2. Import all 70 configurations, preserving full-precision `pass_at_1`, interval endpoints/method, original model/effort/provider/harness strings, counts, and all available mean/median metrics. Keep null effort distinct from zero/known effort.
3. Map `mean_cost_usd`, `mean_output_tokens`, and `mean_duration_seconds` as separate source-reported means per scored rollout attempt. For time, expose the measured field but label timer scope unspecified and exclude it from strict scope matching. Do not derive time from tokens or steps.
4. Keep feed cost and the visible site cost as separate observations until a documented reconciliation basis exists. Do not merge a vendor score with an official feed cost based only on a similar model name.
5. Create distinct source-series records for Datacurve, OpenAI, Anthropic, and Artificial Analysis. Store source evidence and per-source compatibility; use per-model reviewed effort-order mappings. Source confidence is about transcription/provenance, not independent reproduction.
6. Keep untraced DataLearner additions in the pending queue. Fireworks' table is retained as a separate source-reported experiment because its post states it evaluated DeepSWE and reports run-to-run variation; version, harness, task population, and cost basis remain unknown, so its direct Cost/Task values are not standardized or transferred. The Qwen3.8-Flash-Next secondary claim was resolved to its model card. Use exact source model strings; do not merge GPT-6 Sol with GPT-5.6 Sol, Qwen3.8-Flash-Next with Qwen3.8-Flash, or AA's Qwen3.8 Max with the pending Qwen3.8-Max-0902 without direct alias evidence.
7. **Redistribution blocker:** do not check in the full 94,758-byte feed unless a feed/data license or explicit permission is established. The benchmark repository's Apache-2.0 license is not enough to conclude that separately served JSON is licensed. The capture manifest keeps the exact retrieval hash and schema for a fresh, policy-reviewed import.

The workspace contained only the supplied prompt file and is not currently a Git repository (`git status` reports no repository). No application, task bodies, full PDF, or feed snapshot was added by this research pass.
