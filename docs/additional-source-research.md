# Additional DeepSWE source research

Research snapshot: 2026-09-26. The initial capture was evidence-only; implementation and candidate reconciliation are recorded below. Source URLs, hashes, retrieval metadata, and concise evidence locators are in [`data/research/additional-source-capture.json`](../data/research/additional-source-capture.json). Full PDFs, complete web pages, task bodies, and trajectories are not included in the workspace.

## Findings

- Several primary sources support additional score-only reports: Anthropic Fable 5.1 and Opus 5, DeepSeek V4.1-Flash, Xiaomi MiMo V2.6, Qwen3.8-Flash-Next, Gemini 3.8 Flash, xAI Grok 4.7, and the Tinfield 1 model card. Artificial Analysis also exposes more independent DeepSWE v1.1 scores than the one already approved.
- The original Datacurve benchmark paper reports 16 more model/configuration results, but does not name the benchmark version. These are retained with `benchmark.version = null` as a separate experiment; they are not forced into v1.1.
- Fireworks publishes a DeepSWE-labeled pass@1 and Cost/Task table for four configurations, states it evaluated DeepSWE, and reports run-to-run variation. Version, harness, task count, run identity, and cost accounting remain unknown; retain the four as separate source-reported Fireworks experiments despite rounded overlaps with feed scores.
- The 2026-09-26 source capture alone did not establish DeepSWE-only usage from Artificial Analysis’s pooled efficiency figures. Follow-up research retains seven full scenarios and adds seven cost-only cases: three same-row AA suite-cost proxies and four Fireworks source-reported Cost/Task scenarios restricted to those Fireworks rows. None populates measured observation fields; Fireworks' unknown accounting basis still does not support token/time estimates or transfers. Details and limits are in [cross-platform usage estimation research](usage-estimation-research.md).

## Primary-source score reports

All numbers below retain the source’s stated precision and statistic. “Source-verified” means that the report and transcription were checked; it does not mean that the experiment was independently replicated or that unlike protocols are comparable.

| Publisher / model configuration | Exact result | Benchmark / metric | Protocol and denominator evidence | Evidence locator and disposition |
|---|---|---|---|---|
| Anthropic — Claude Opus 5, low / medium / high / xhigh / max | 57.7%, 66.9%, 68.0%, 69.7%, 68.8% | DeepSWE v1.1; figure labels the y-axis “Score (%)”; not explicitly labeled pass@1 | Effort labels are explicit. The card-wide methodology says Opus 5 results default to five trials, but Figure 8.3.A does not state per-point N, task denominator, or harness. | [Claude Opus 5 System Card](https://www.anthropic.com/claude-opus-5-system-card), PDF index/printed p.154, Fig. 8.3.A. Visually inspected. Score-only developer series; the chart’s cost axis has no point-level numeric labels, so no cost was extracted. |
| Anthropic — Claude Fable 5.1 | 67.4% average over five trials | DeepSWE v1.1; “average” is the source’s wording, not a defined pass@k statistic | 113 tasks. Effort, harness, per-trial results, CI, and efficiency metrics are not stated in this section. The card notes that hidden tests can reject some equally valid or more thorough implementations. | [Fable 5.1 / Mythos 5.1 System Card](https://www.anthropic.com/claude-fable-5-1-mythos-5-1-system-card), PDF index/printed p.168, §8.3. Visually inspected. Score-only developer report. |
| DeepSeek — V4.1-Flash, mini-SWE | 74.2 (raw table value) | DeepSWE v1.1; exact table label is “Resolved,” not pass@1 | Max reasoning effort (`reasoning_effort=100`); mini-SWE-agent. The report gives N=8 samples per task for its cross-scaffold table, temperature 1.0, top_p 0.95, 1M context, and max_steps=500. It does not give a scored-attempt denominator or define “Resolved” further. | [DeepSeek V4.1-Flash model card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash), Instruct results, row “DeepSWE v1.1 (Resolved)”; [technical report](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/DeepSeek_V41_Tech_Report.pdf), PDF index/printed p.35, Table 4. Store the reported label and raw value; do not normalize to pass@1. |
| DeepSeek — V4.1-Flash, alternate scaffolds at max effort | Claude Code 69.8; Codex 65.6; OpenCode 65.5; Pi 66.2; DeepSeek Harness Minimal 72.6; Standard 70.5; PTC 67.6 | DeepSWE v1.1; “Resolved” | Same report says N=8 samples/task and the shared Linux-container, sampling, context, and step-limit settings above. The table does not establish a common pass@1 denominator for these values. | Same technical-report Table 4, PDF index/printed p.35. Distinct harness observations; retain each separately. |
| Xiaomi — MiMo-V2.6-Pro-RL / MiMo-V2.6-Flash-RL | 71.9 / 67.9 (raw table values) | DeepSWE v1.1; table gives no more specific metric | Model card and Table 3 do not state harness, effort, trial count, or denominator for these cells. | [Pro model card](https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Pro-RL), §3, Code Agent / DeepSWE row; same values in technical-report Table 3, PDF index/printed p.26. Score-only reports; preserve the raw values. |
| Xiaomi — MiMo-V2.6-Pro / Flash RL-training endpoints | Pro 72.57; Flash 65.68 | DeepSWE v1.1; explicitly “average@3” in Figure 3 | These are endpoints of an RL training curve, not the Table 3 values above. The plotted cumulative dollar axis is **RL post-training cost**, not inference cost per task. Exact evaluation harness and task denominator are not given at this locator. | [MiMo technical report](https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Pro-RL/blob/main/MiMo_V2_6_technical_report.pdf), PDF index/printed p.8, Fig. 3. Visually inspected. Keep as a separate average@3 observation; do not reconcile by overwriting 71.9/67.9. |
| Qwen — Qwen3.8-Flash-Next | 58.7 (raw table value) | DeepSWE 1.1; exact statistic/unit is not stated in the table | Evaluated with Claude Code and mini-SWE-agent; the card reports the best of the two and says the best result was on mini-SWE-agent. Temperature 1.0, top_p 0.95, 256K context. Effort, N, and task denominator are not stated. | [Qwen model card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next), Benchmark Results / Agentic coding / DeepSWE 1.1 and footnote 1. Replaces the secondary Alibaba community article as the primary evidence for the same 58.7 claim. |
| Google — Gemini 3.8 Flash, high thinking | 73.7% | DeepSWE v1.1; pass@1 under the report’s general “all Gemini scores are pass@1” rule | Google says this is self-computed with Gemini API model `gemini-3.8-flash`, mini-SWE-agent, high thinking. The table has no row-specific run count or confidence interval. | [Gemini 3.8 evaluation methodology](https://storage.googleapis.com/deepmind-media/gemini/gemini_3-8_flash_model_evaluation.pdf), PDF index/printed p.4, results table; method on p.2. Visually inspected. The current Datacurve feed separately reports 0.7382550336 (73.8255%) for its high config; keep this self-computed report distinct. |
| xAI — Grok 4.7, high effort | 71.0% | DeepSWE v1.1; table only says “DeepSWE v1.1,” not pass@1 | High effort is marked by the table footnote. Harness, evaluator, task count, N, CI, and cost/task are not stated. The page’s $2/$6 per-million-token rates are rate-card prices, not task usage. | [Introducing Grok 4.7](https://x.ai/news/grok-4-7), model-comparison table, DeepSWE v1.1 row. Primary developer score; add only as a score-only report with missing protocol fields explicit. |
| badtheorylabs — Tinfield 1 | 62 (raw table value) | DeepSWE v1.1; exact score statistic/unit is not stated | The card says full task sets (113 DeepSWE tasks), mini-swe-agent, k=5. It does not define whether the reported score is pass@1, pass@5, or another aggregation; effort and run details are absent. | [Tinfield 1 model card](https://huggingface.co/badtheorylabs/Tinfield-1), Evaluation / DeepSWE v1.1 and evaluation note. Its competitor rows are explicitly sourced elsewhere; only the Tinfield result is this publisher’s own measurement. Pending metric definition; no efficiency data. |

### Artificial Analysis independent score rows

The current Coding Agent Index v1.5 methodology defines DeepSWE v1.1 as 113 tasks and says each benchmark score averages pass@1 across three attempts per task. The following additional configurations are listed in the current **Model Variants** tables; the already-approved Claude Code / Opus 5.5 (max) 68% row is intentionally omitted here because it was reverified live.

| Agent / exact model label | DeepSWE v1.1 |
|---|---:|
| Claude Code — Fable 5.1 (max, with fallback) | 64% |
| Claude Code — Opus 5 (max) | 63% |
| Claude Code — Qwen3.8 Max (effort not stated) | 51% |
| Codex — GPT-6 Astra (max) | 68% |
| Codex — GPT-6 Sol (max) | 69% |
| Codex — GPT-5.6 Sol (max) | 72% |
| Codex — GPT-5.6 Luna (max) | 66% |
| Codex — DeepSeek V4 Pro 0813 (max) | 57% |
| Codex — GPT-6 Luna (max) | 64% |
| Codex — DeepSeek V4 Flash 0731 (max) | 54% |
| Kimi Code CLI — Kimi K3 (effort not stated) | 68% |

Evidence: [Claude Code vs Codex](https://artificialanalysis.ai/agents/coding-agents/comparisons/claude-code-vs-codex), Model Variants; [Codex vs Kimi Code CLI](https://artificialanalysis.ai/agents/coding-agents/comparisons/codex-vs-kimi-code-cli), Model Variants. These are separate AA harness/configuration results, not aliases for similarly named Datacurve or vendor rows. AA’s per-task cost, token-use, and time values are not benchmark-specific and are excluded below.

### Original DeepSWE paper: version-unknown experiment

The Datacurve authors’ paper was submitted 2026-07-08, after the Datacurve v1.1 revision post of 2026-06-14, but the paper calls its evaluation only “DeepSWE”; it does not assign a benchmark version. These are retained as a separate version-unknown experiment, with version null and no link to v1.1. The paper uses mini-swe-agent for every model, the full 113-task set, approximately four rollouts/task (428–452 scored rollouts/configuration; 7,174 total), and reports pass@1 as an equal-task-weighted average of per-task pass fractions, pass@4 as tasks solved by at least one of up to four rollouts, and 95% run-to-run CIs.

| Model / effort as printed | pass@1 | pass@4 | Exact 95% run-to-run CI stated in text |
|---|---:|---:|---:|
| GPT-5.5 [xhigh] | 70.0% | 88% | [67.2, 72.9] |
| GPT-5.4 [xhigh] | 55.5% | 77% | [53.4, 57.7] |
| Claude Opus 4.7 [max] | 54.2% | 86% | [49.5, 58.9] |
| Claude Sonnet 4.6 [high] | 31.6% | 62% | Not numerically stated in text |
| Gemini 3.5 Flash [medium] | 28.3% | 57% | Not numerically stated in text |
| Claude Opus 4.6 [max] | 27.1% | 50% | Not numerically stated in text |
| GPT-5.4-mini [xhigh] | 24.3% | 46% | Not numerically stated in text |
| Kimi K2.6 [effort not stated] | 23.9% | 49% | Not numerically stated in text |
| MiMo-V2.5-Pro [effort not stated] | 19.5% | 45% | Not numerically stated in text |
| GLM-5.1 [effort not stated] | 17.5% | 39% | Not numerically stated in text |
| Gemini 3.1 Pro [provider default] | 9.9% | 25% | Not numerically stated in text |
| DeepSeek V4 Pro [provider default] | 7.5% | 19% | Not numerically stated in text |
| Gemini 3 Flash [provider default] | 5.2% | 15% | Not numerically stated in text |
| Qwen3.6-Plus [provider default] | 2.7% | 10% | Not numerically stated in text |
| Claude Haiku 4.5 [provider default] | 0.2% | Not reported in text | Not numerically stated in text |
| MiniMax M2.7 [provider default] | 0.2% | Not reported in text | Not numerically stated in text |

Evidence: [arXiv HTML](https://arxiv.org/html/2607.07946v1), §§5.1–5.6 and 6.1–6.2; PDF index/printed p.2, Fig. 1 and p.12, metric/sampling/CI definitions. Visually inspected. Figure 8 on PDF p.14 shows medians for output tokens, wall-clock minutes, and dollars per trial, but does not print exact per-model values; no values were digitized or guessed. Its metric is median per trial, not interchangeable with the v1.1 feed’s means per scored attempt.

## Reconciliation, exclusions, and remaining candidates

| Finding | Treatment |
|---|---|
| xAI Grok 4.5 v1.1 card: 53.0% high; current Datacurve row: 53.761% high. Both identify mini-swe-agent/Datacurve. | The card is dated July 2026 and the feed is a later snapshot. Preserve as a possible historical measurement/revision; do not create a second experiment until run identity is resolved. The distinct v1.0 provider-harness/AA results above are separable. |
| xAI Grok 4.6 card: 65.9% high and 67.0% xhigh; current feed: 65.188% and 66.741%. The later Grok 4.7 release gives 65.2% for Grok 4.6 high, matching the feed rounded to one decimal. | Treat card/release/feed as versioned source observations requiring reconciliation, not extra rows based on rounded-score similarity. The card identifies mini-swe-agent and Datacurve. |
| Z.ai GLM-5.3-Flash card/evaluation YAML: 63.4, dated 2026-08-26, with mini-swe-agent, temperature 0.95, top_p 1.0, 6h timeout, 400K context. Current Datacurve max row is 0.6339285714 (63.3929%). | Strong apparent overlap. Use the card as protocol/provenance evidence for the existing feed row; do not duplicate until a distinct-run ID or evaluation date is documented. The card’s own score label does not define a separate pass@k statistic. |
| Xiaomi model-card/Table 3 values 71.9/67.9 differ from the report’s Figure 3 average@3 endpoints 72.57/65.68. | Preserve both source-statistic reports separately. Do not average or overwrite. Figure 3 cumulative dollars are RL training costs, not inference cost/task. |
| Fireworks reports pass@1 and $0.430, $6.524, $2.362, and $11.838 per task for four DeepSWE-labeled configurations. | The post's first-person evaluation statement and reported run-to-run variation support separate Fireworks source observations, despite three scores rounding to Datacurve results. Version, harness, task count, run identity, and cost accounting remain unknown. Preserve each direct Cost/Task in its Fireworks `pricing.asReportedCost`; do not normalize it as a mean/median metric or transfer it to another source. |
| DataLearner’s DeepSWE table remains live, but row-level primary links were not exposed in the current capture. | Five claims were resolved against primary rows (DeepSeek 74.2, MiMo Pro 71.9, Grok 4.7 71.0, MiMo Flash 67.9, and Qwen3.8-Flash-Next 58.7); their secondary candidate records remain archived in `data/candidates/resolved.json`, and unsupported effort labels were not carried forward. Leave Qwen3.8-Max-0902 (69.3) and Step 5 Preview (67.7) pending. The feed’s `qwen3-8-max` xhigh value (57.461%) and AA’s “Qwen3.8 Max” are not aliases for the pending 0902 snapshot. |
| Secondary reporting claims Muse Spark 1.3 scores 75.4%. | No primary Meta model card/report or independent evaluation for that result was located; do not add it. |
| Agentica/Together DeepSWE-Preview pages report 59% and 42.2% results. | Excluded: these are SWE-Bench Verified results for the separately named RL-trained DeepSWE-Preview model, not scores on Datacurve’s DeepSWE benchmark. |

## Cost and usage estimate decision

The 2026-09-26 review found no direct DeepSWE-only usage measurement in the inspected cross-platform references. Artificial Analysis’s “Cost per Task” and total-token values are pooled across DeepSWE v1.1, Terminal-Bench 4.0, and SWE-Atlas-QnA; its token categories include input, cached input, cache-write, reasoning, and output, without a per-benchmark split. A pooled cost cannot identify the DeepSWE component's token mix, and a model rate card adds prices but not missing counts. Follow-up research keeps official observation fields untouched, retains seven full calibrated scenarios, and adds three exact-row AA suite-cost proxies and four Fireworks source-reported Cost/Task scenarios. Fireworks' table still lacks token counts and accounting details, and Xiaomi's dollar figures are training costs.

Recommendation for approved observation ingestion: keep cost, output tokens, time, and per-metric missing reasons null unless the same report supplies them for the same model snapshot, harness, effort, task population, and attempt aggregation. Keep calibrated usage, same-row suite-cost proxies, and source-reported Fireworks costs in the separate scenario layer with their source units. Do not directly substitute suite averages as measurements, transfer Fireworks costs, apply rate-card prices, or use RL-training spend as inference usage.

## Implementation disposition

- This research pass grew the approved snapshot from 74 observations (70 official feed rows and 4 supplemental reports) to 127 (70 official and 57 supplemental). The current workspace includes 128 observations (70 official and 58 supplemental) after the later Muse Spark 1.3 result was added; the scenario-layer additions do not alter approved source observations.
- Added observations cover Anthropic Opus 5's five ordered effort scores (57.7/66.9/68.0/69.7/68.8%) and Fable 5.1 (67.4%); DeepSeek V4.1-Flash's eight Table 4 scaffolds (74.2/69.8/65.6/65.5/66.2/72.6/70.5/67.6, all “Resolved,” max); Xiaomi MiMo-V2.6 Table 3 (Pro 71.9, Flash 67.9) and separate average@3 RL endpoints (Pro 72.57%, Flash 65.68%); Qwen3.8-Flash-Next 58.7; Google Gemini 3.8 Flash high pass@1 73.7%; Grok 4.7 high 71.0%; Tinfield 1 raw table score 62; eleven Artificial Analysis Model Variants rows (64/63/51/68/69/72/66/57/64/54/68%); sixteen version-unknown paper configurations with pass@1/pass@4 where reported; and four Fireworks pass@1 reports with direct per-task costs ($0.430/$6.524/$2.362/$11.838).
- Exact model labels, source URLs, harnesses, locators, hashes, CIs, and unknown fields remain on the approved observations and in `data/sources/registry.json`. Every new observation is `source-reviewed` and `not-independently-reproduced`.
- Nine prior candidate IDs are resolved with linked primary observation IDs (five secondary claims and four Fireworks rows). Two candidates remain pending: Qwen3.8-Max-0902 and Step 5 Preview.
- Output-token and time fields remain null on the new source reports. Mean/median cost metrics remain null unless directly measured; Fireworks' four direct task-cost facts remain in `pricing.asReportedCost` and are echoed only as source-scoped scenarios. Three AA suite cost amounts appear only as same-row proxies. Raw mixed-token suite totals, AA suite time, xAI rate-card prices, and Xiaomi RL-training spend are not substituted into observations or transferred to other experiments.

## Retrieval and inspection notes

- Targeted web searches covered the existing DataLearner/Alibaba leads, provider/model system cards and announcements, the DeepSWE arXiv paper, Artificial Analysis’s current index/methodology/comparison pages, and Fireworks’ independent comparison. The DataLearner page returned HTTP 200, but its source row lacks primary citations. The OpenAI page returned 403 to direct sandbox fetch; the current page was retrievable through Grounded Docs and reports the already-approved 68.8%/66.6% claims. The official Anthropic cards were retrieved directly as PDFs and parsed locally in memory.
- Visually inspected relevant one-page extracts: Anthropic Opus 5 Figure 8.3.A (PDF p.154), Anthropic Fable 5.1 §8.3 (p.168), xAI Grok 4.5 v1.0/v1.1 (pp.5–6), xAI Grok 4.6 (p.11), Google Gemini 3.8 results table (p.4), MiMo Figure 3/Table 3 (pp.8/26), DeepSeek Table 4 (p.35), and the original paper’s Figure 1/Figure 8 (pp.2/14). Temporary page crops were deleted after inspection.
- The stored metadata file contains response hashes and locators only. HTML response hashes can vary between requests; notably, the Fireworks page returned three same-size, different-hash HTML bodies during this pass. The latest capture is recorded, and the table facts above were checked from the rendered content rather than inferred from the hash.
