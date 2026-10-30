# Missing cost and output-token coverage: research handoff

Snapshot: `data/approved/dataset.json` at audit time. Eligibility here means the **default combined** source categories (`organizer`, `developer`, `independent`, `local`), all versions, all effort levels, non-strict mode, after `datacurveChartPrecedence` over the **full** dataset. It does not imply that a defensible estimate exists. The default selected Y metric is `pass_at_1`; a percentage score of another metric can still appear on the chart through the source-score fallback, with its own definition. `secondary` is disabled by default and has no unsuppressed missing rows.

Of 128 approved observations (70 live Datacurve), 15 supplemental rows are suppressed from the chart by Datacurve precedence. All 15 are missing both metrics; they remain in evidence/exports but **are not research targets for new chart marks**. Among the remaining 113 chart candidates, **43 lack both mean cost and mean output tokens** (zero cost-only-missing or token-only-missing measured rows): **26 v1.1**, **17 version unknown**. There are no approved v1.0 or other known-version observations in this snapshot (108 v1.1, 20 version unknown before precedence). Of the 43, **31 have an explicit `%` score unit**; **12 have raw-table scores of unspecified unit** and cannot be plotted on a percentage Y axis. Seven of the 43 already have an applicable scenario (three cost+output+time cross-platform transfers, three cost-only AA suite proxies, one cost-only Fireworks source-report). Thus **36 have no scenario**, including all 12 raw-unit rows. The default `pass_at_1` metric is explicitly reported for 23 missing rows; the chart's fallback displays other explicit-percentage scores with the source metric stated.

## Target rows

The `missing` column is `C+O` throughout: normalized mean cost and mean output tokens are both null. `Scenario` describes **existing** estimates, not source measurements; `none` is an open research target. Source means publisher/source family, not interchangeable experimental protocol. Effort `—` means unreported, while `default` is the paper's provider-default effort label. Percent (`%`) is the source score unit, not proof that `reported_score_unspecified` is pass@1. Canonical IDs below fall back to the reported model name when `canonicalId` is null.

| Observation ID | Canonical model / reported identity | Source | Effort | Version | Score metric · unit | Missing | Scenario |
|---|---|---|---|---|---|---|---|
| `openai-gpt-6-sol-v1.1-max` | `openai:gpt-6-sol` | OpenAI | max | 1.1 | reported_score_unspecified · % | C+O | none |
| `openai-gpt-6-luna-v1.1-max` | `openai:gpt-6-luna` | OpenAI | max | 1.1 | reported_score_unspecified · % | C+O | none |
| `anthropic-claude-opus-5.5-v1.1` | `anthropic:claude-opus-5.5` | Anthropic | — | 1.1 | reported_score_unspecified · % | C+O | none |
| `artificial-analysis-claude-code-opus-5.5-max-v1.1` | `anthropic:claude-opus-5.5` | Artificial Analysis | max | 1.1 | pass_at_1 · % | C+O | cross-platform transfer: C+O+time |
| `anthropic-claude-fable-5.1-v1.1` | `Claude Fable 5.1` | Anthropic | — | 1.1 | reported_score_unspecified · % | C+O | none |
| `deepseek-v4.1-flash-mini-swe-v1.1` | `DeepSeek-V4.1-Flash` | DeepSeek | max | 1.1 | reported_score_unspecified · raw, unit unknown | C+O | none |
| `deepseek-v4.1-flash-claude-code-v1.1` | `DeepSeek-V4.1-Flash` | DeepSeek | max | 1.1 | reported_score_unspecified · raw, unit unknown | C+O | none |
| `deepseek-v4.1-flash-codex-v1.1` | `DeepSeek-V4.1-Flash` | DeepSeek | max | 1.1 | reported_score_unspecified · raw, unit unknown | C+O | none |
| `deepseek-v4.1-flash-opencode-v1.1` | `DeepSeek-V4.1-Flash` | DeepSeek | max | 1.1 | reported_score_unspecified · raw, unit unknown | C+O | none |
| `deepseek-v4.1-flash-pi-v1.1` | `DeepSeek-V4.1-Flash` | DeepSeek | max | 1.1 | reported_score_unspecified · raw, unit unknown | C+O | none |
| `deepseek-v4.1-flash-dsh-minimal-v1.1` | `DeepSeek-V4.1-Flash` | DeepSeek | max | 1.1 | reported_score_unspecified · raw, unit unknown | C+O | none |
| `deepseek-v4.1-flash-dsh-standard-v1.1` | `DeepSeek-V4.1-Flash` | DeepSeek | max | 1.1 | reported_score_unspecified · raw, unit unknown | C+O | none |
| `deepseek-v4.1-flash-dsh-ptc-v1.1` | `DeepSeek-V4.1-Flash` | DeepSeek | max | 1.1 | reported_score_unspecified · raw, unit unknown | C+O | none |
| `xiaomi-mimo-v2.6-pro-table3-v1.1` | `MiMo-V2.6 Pro` | Xiaomi MiMo | — | 1.1 | reported_score_unspecified · raw, unit unknown | C+O | none |
| `xiaomi-mimo-v2.6-flash-table3-v1.1` | `MiMo-V2.6 Flash` | Xiaomi MiMo | — | 1.1 | reported_score_unspecified · raw, unit unknown | C+O | none |
| `xiaomi-mimo-v2.6-pro-average-at-3-endpoint-v1.1` | `MiMo-V2.6 Pro` | Xiaomi MiMo | — | 1.1 | reported_score_unspecified · % | C+O | none |
| `xiaomi-mimo-v2.6-flash-average-at-3-endpoint-v1.1` | `MiMo-V2.6 Flash` | Xiaomi MiMo | — | 1.1 | reported_score_unspecified · % | C+O | none |
| `qwen-qwen3.8-flash-next-v1.1` | `Qwen3.8-Flash-Next` | Qwen / Alibaba | — | 1.1 | reported_score_unspecified · raw, unit unknown | C+O | none |
| `xai-grok-4.7-high-v1.1` | `Grok 4.7` | xAI / SpaceXAI | high | 1.1 | reported_score_unspecified · % | C+O | none |
| `badtheorylabs-tinfield-1-v1.1` | `Tinfield 1` | badtheorylabs | — | 1.1 | reported_score_unspecified · raw, unit unknown | C+O | none |
| `aa-claude-code-fable-5.1-max-v1.1` | `Fable 5.1 (max) (with fallback)` | Artificial Analysis | max | 1.1 | pass_at_1 · % | C+O | AA pooled-suite cost only |
| `aa-codex-gpt-6-sol-max-v1.1` | `GPT-6 Sol (max)` | Artificial Analysis | max | 1.1 | pass_at_1 · % | C+O | cross-platform transfer: C+O+time |
| `aa-codex-deepseek-v4-pro-0813-max-v1.1` | `DeepSeek V4 Pro 0813` | Artificial Analysis | max | 1.1 | pass_at_1 · % | C+O | AA pooled-suite cost only |
| `aa-codex-gpt-6-luna-max-v1.1` | `GPT-6 Luna (max)` | Artificial Analysis | max | 1.1 | pass_at_1 · % | C+O | cross-platform transfer: C+O+time |
| `aa-codex-deepseek-v4-flash-0731-max-v1.1` | `DeepSeek V4 Flash 0731` | Artificial Analysis | max | 1.1 | pass_at_1 · % | C+O | AA pooled-suite cost only |
| `meta-muse-spark-1.3-v1.1-max` | `Muse Spark 1.3` | Meta | max | 1.1 | task_pass_rate · % | C+O | none |
| `datacurve-paper-gpt-5.5-xhigh-version-unknown` | `GPT-5.5` | Datacurve paper | xhigh | unknown | pass_at_1 · % | C+O | none |
| `datacurve-paper-gemini-3.5-flash-medium-version-unknown` | `Gemini 3.5 Flash` | Datacurve paper | medium | unknown | pass_at_1 · % | C+O | none |
| `datacurve-paper-claude-opus-4.6-max-version-unknown` | `Claude Opus 4.6` | Datacurve paper | max | unknown | pass_at_1 · % | C+O | none |
| `datacurve-paper-gpt-5.4-mini-xhigh-version-unknown` | `GPT-5.4-mini` | Datacurve paper | xhigh | unknown | pass_at_1 · % | C+O | none |
| `datacurve-paper-kimi-k2.6-default-version-unknown` | `Kimi K2.6` | Datacurve paper | default | unknown | pass_at_1 · % | C+O | none |
| `datacurve-paper-gemini-3-flash-default-version-unknown` | `Gemini 3 Flash` | Datacurve paper | default | unknown | pass_at_1 · % | C+O | none |
| `datacurve-paper-qwen3.6-plus-default-version-unknown` | `Qwen3.6-Plus` | Datacurve paper | default | unknown | pass_at_1 · % | C+O | none |
| `datacurve-paper-claude-haiku-4.5-default-version-unknown` | `Claude Haiku 4.5` | Datacurve paper | default | unknown | pass_at_1 · % | C+O | none |
| `datacurve-paper-minimax-m2.7-default-version-unknown` | `MiniMax M2.7` | Datacurve paper | default | unknown | pass_at_1 · % | C+O | none |
| `datacurve-paper-gpt-5.4-xhigh-version-unknown` | `GPT-5.4` | Datacurve paper | xhigh | unknown | pass_at_1 · % | C+O | none |
| `datacurve-paper-claude-opus-4.7-max-version-unknown` | `Claude Opus 4.7` | Datacurve paper | max | unknown | pass_at_1 · % | C+O | none |
| `datacurve-paper-claude-sonnet-4.6-high-version-unknown` | `Claude Sonnet 4.6` | Datacurve paper | high | unknown | pass_at_1 · % | C+O | none |
| `datacurve-paper-mimo-v2.5-pro-default-version-unknown` | `MiMo-V2.5-Pro` | Datacurve paper | default | unknown | pass_at_1 · % | C+O | none |
| `datacurve-paper-glm-5.1-default-version-unknown` | `GLM-5.1` | Datacurve paper | default | unknown | pass_at_1 · % | C+O | none |
| `datacurve-paper-gemini-3.1-pro-default-version-unknown` | `Gemini 3.1 Pro` | Datacurve paper | default | unknown | pass_at_1 · % | C+O | none |
| `datacurve-paper-deepseek-v4-pro-default-version-unknown` | `DeepSeek V4 Pro` | Datacurve paper | default | unknown | pass_at_1 · % | C+O | none |
| `fireworks-deepswe-deepseek-v4.1-flash-max` | `DeepSeek V4.1-Flash` | Fireworks AI | max | unknown | pass_at_1 · % | C+O | source-report cost only |

The suppressed missing set (outside the target table) is: Anthropic Opus 5 low/medium/high/xhigh/max (5); Google Gemini 3.8 Flash high (1); AA Opus 5 max, Qwen3.8 Max, GPT-6 Astra max, GPT-5.6 Sol max, GPT-5.6 Luna max, Kimi K3 (6); Fireworks GPT-6 Astra xhigh, Gemini 3.8 Flash high, Opus 5 max (3). **Seven existing scenario records belong to these suppressed rows** and remain available in all/filtered scenario exports, but chart precedence prevents duplicate scenario marks.

## Integration constraints from current code

- `src/lib/usage-scenarios.ts` derives scenarios from the research artifact at module import, not from the measured `Observation.metrics` fields. `usageScenarioForObservation` matches exact observation ID **and** reported name, publisher, source category, harness, raw/reported effort, benchmark version, primary score metric and score text; source-reported-cost scenarios additionally require an exact `pricing.asReportedCost` match. Aliases, paper-version guesses, and transfers to a different report do not inherit a scenario. Existing `buildScenario` requires *all three* output/cost/time calibration methods and an AA Coding Agent variant: new cost-only or output-only work needs its own per-metric construction path (existing `buildCostOnlyScenario` supports AA suite proxy/source cost but not generic output-only or cost-null estimates).
- `UsageScenario.costUsd` is required/non-null, while `outputTokensPerScoredAttempt` and `timeSecondsPerScoredAttempt` are nullable. To represent a genuinely **token-only** scenario, cost must become nullable (including `scenarioXValue`, note formatting in `App.tsx`, chart details, evidence panel, JSON/CSV exports), rather than inventing a cost. `scenarioXValue` already returns null for an absent output/time value but always returns cost. Keep separate source identity, units (`USD/task` suite proxy vs USD/scored attempt), basis, calibration assumptions, and uncertainty per metric. A source quote, AA mixed input/cache/output total, or rate-card multiplication is not an output-token count.
- `usageScenarioForComparison` rejects strict comparisons and median; UI honors the URL-persisted `includeUsageScenarios` toggle, mean-only points, independent hollow diamonds, and suppression computed before source filters (`src/App.tsx`). Preserve `hasPercentageScoreScale` when deciding numeric Y placement; 12 raw-unit rows remain unscaled even if their X estimates are found. `reported_score_unspecified` with explicit `%` stays source-defined rather than being relabeled pass@1. `scoreOnly` currently keys off missing *measured* X, so adding scenarios does not remove a row from the evidence/no-X list or increase measured coverage.
- Scenario exports (`src/lib/exports.ts`) are separate opt-in JSON/CSV; measured JSON/CSV stay measured-only, and scenario provenance and assumption/calibration details belong to the scenario records. Export scope is driven by observation filters (not the chart's suppression, selected X, statistic or scenario toggle), so suppressed scenarios legitimately remain available in those exports. Strict chart mode must never promote estimates into protocol groups.

Audit method: counted `data/approved/dataset.json` using the actual `datacurveChartPrecedence` and `usageScenarioForObservation` functions, with default source categories from `src/lib/url-state.ts`. No new values or external source claims were inferred.
