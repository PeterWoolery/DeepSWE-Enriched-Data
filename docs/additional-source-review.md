# Independent review: additional DeepSWE sources

## Summary

The current snapshot validates at **127 observations: 70 official and 57 supplemental**. The supplemental set has **53 additions** over the prior 74-row snapshot. The candidate queue has **2 pending** records and `data/candidates/resolved.json` has **9 resolved** records. All 57 supplemental observations are marked `source-reviewed` and `not-independently-reproduced`, which matches a transcription review rather than a replication claim.

Independent follow-up confirms both presentation findings are resolved in the current code: raw values retain source wording/unit in display and exports, and the main table shows known or unspecified benchmark version per row.

## Findings

### P2 — RESOLVED: raw table-score reports are normalized and use a percent-oriented chart path

At review time, `data/approved/dataset.json` had 12 observations with raw numeric table values and `result.metric = reported_score_unspecified`: eight DeepSeek scaffold rows, two Xiaomi Table 3 rows, Qwen3.8-Flash-Next, and Tinfield 1. Their sources do not consistently state a unit or define the values as pass@1. The prior `reportedUnit` metadata inferred a 0–100 point scale; the presentation then showed normalized decimals in the table/detail and percent values in the score-only list. The chart also hardcoded percentage axes for every score metric. These 12 observations have null cost, token, and time measurements.

**Impact at review:** the main table obscured source values, and chart labels could imply a percentage scale. Relevant live primary evidence: [DeepSeek V4.1-Flash card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash) labels its row “DeepSWE v1.1 (Resolved)” and prints raw values; [Xiaomi MiMo-V2.6-Pro-RL card](https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Pro-RL) prints 71.9/67.9 without a statistic; [Qwen3.8-Flash-Next card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next) prints 58.7; [Tinfield 1 card](https://huggingface.co/badtheorylabs/Tinfield-1) prints 62 without defining the score statistic.

### P3 — RESOLVED: main results table hides benchmark version

`src/components/ResultsTable.tsx` originally had no benchmark-version column. The 16 rows from the original paper have `benchmark.version = null`; some overlap current feed model/effort labels (including GPT-5.5 xhigh and GPT-5.4 xhigh), while both sources show Datacurve and mini-SWE-agent. The data keeps them separate: the paper reports 70.0% for GPT-5.5 xhigh while the v1.1 feed reports 67.0354%. The evidence panel disclosed “Version not specified” only after selecting a row.

## Resolution

- The 12 raw table observations use `reportedUnit: "raw table value; unit unspecified"`; their retained normalized numbers are labeled `normalized numeric value (raw source unit unspecified)`.
- The shared formatter shows raw `reportedText` for unspecified units and appends `%` only for explicit percentage/fraction sources. The results table, evidence detail, score-only list, and CSV preserve that distinction; raw scores have no percent-length bars.
- `ExplorerChart` only places explicit percent/fraction units on its percentage axis. Unknown-scale scores are emitted with `unknown-score-scale` and omitted from the chart group. `tests/score-format.test.ts` confirms equal numeric values display as raw `74.2` versus explicit `74.2%`, and that only the latter is plotted on the percentage scale.
- `ResultsTable` includes `v1.1` or `unspecified`. The browser assertion checks a version-unknown paper row displays `unspecified`.

## Evidence and data checks

- Live checks confirmed the DeepSeek card's eight “Resolved” values and N=8 samples/task; Qwen's 58.7 row and harness footnote; MiMo's Table 3 values; Tinfield's 62 score and k=5/full-113-task note; Grok 4.7's 71.0 high-effort result; and Fireworks' four pass@1/Cost-per-Task pairs.
- `data/research/additional-source-capture.json` contains 29 source retrieval records with URLs, response hashes, retrieval metadata, and concise locators; it does not retain source-page bodies, PDFs, tasks, or trajectories.
- Artificial Analysis's live v1.5 methodology defines per-benchmark pass@1 across three attempts/task, and explicitly describes cost, token, and time figures as pooled per-task-attempt averages across the suite. The 12 AA rows are version 1.1 pass@1 observations; all their cost, token, and time metrics remain null. No suite-pooled AA usage metric is attached to an individual DeepSWE result.
- Fireworks' four direct costs ($0.430, $6.524, $2.362, $11.838) remain only in `pricing.asReportedCost`; their mean and median cost metrics are null. The live post states the scores and costs and cites run-to-run variation, but does not establish version, harness, task count, run identity, or billing/aggregation basis. These values do not contaminate chart cost metrics.
- The 16 Datacurve-paper rows remain version-unknown; 14 include a separate pass@4 result. Live arXiv text confirms the paper's task-macro pass@1 definition, pass@4 definition, and 428–452 scored rollouts/configuration. No evidence in the paper identifies its run as v1.1, so retaining `version: null` rather than merging it with the official feed is appropriate.
- The Anthropic effort mapping is scoped to each exact model and cites Anthropic's effort documentation. The live docs confirm the five labels and recommend stepping down to medium/low or up to xhigh/max; the policy does not claim equal compute across models/providers. Tinfield's comparison rows are not imported as Tinfield self-evaluations; only its own row is present.
- The stored source statuses are coherent: all supplemental records are marked `source-reviewed` with `not-independently-reproduced`; the UI says “Transcription reviewed.” Candidate counts and linked resolutions validate, and pending candidates remain outside the approved dataset.

## Verification and confidence limits

- Fresh focused run: `npx vitest run tests/score-format.test.ts tests/xy.test.ts tests/approved-data.test.ts tests/evidence-panel.test.tsx tests/exports.test.ts` — passed, 5 files / 20 tests.
- Fresh `npm test` — passed, 12 files / 45 tests.
- Fresh `npm run validate` — passed; 127 approved observations, 70 official, 57 supplemental, 2 pending, 9 resolved.
- Fresh `npm run typecheck` — passed.
- Fresh `CHROMIUM_PATH=/run/current-system/sw/bin/chromium npm run test:browser` — passed, 6 Playwright tests. The added browser assertions cover raw 74.2 versus explicit 74.2%, raw display in table/detail/score-only list, chart warning for omitted raw values, and visible version-unknown rows. Its subpath build also ran `tsc -b` and Vite build successfully. The explicit executable path was needed because the default Playwright Chromium headless-shell executable is absent.

Live retrieval confirmed the cited web sources. Anthropic's Opus/Fable cards, the DeepSeek report, and Gemini's evaluation PDF were fetched as PDFs; the MiMo PDF link was checked, and its model card independently confirms Table 3. This review could not visually inspect the Anthropic/MiMo/Gemini PDF page crops, so the stored printed-page/figure locators for those items remain based on the existing capture and are not independently reverified here. The live Gemini PDF text confirmed its general pass@1 rule and mini-SWE-agent/high-thinking method, but not the 73.7 table cell in the extracted excerpt.

The workspace has no Git metadata, so this review validates current files and cannot establish a baseline diff for the supplied implementation changes.
