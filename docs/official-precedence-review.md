# Independent review: official precedence and usage scenarios

**Verdict:** The chart now applies the requested Datacurve display precedence when a supplemental report's benchmark version is unspecified. This is not a claim that the source experiments are identical and does not merge, delete, or rewrite source observations.

## Findings

### RESOLVED — Version-unknown rows no longer bypass chart precedence

The matcher now treats benchmark-version metadata as follows: two known, different versions remain separate; if either version is unspecified, the unknown value is not evidence of a version conflict. Suppression still requires matching canonical/reported model identity; any two reported snapshots must agree, and no known task-scope, task-count, task-set, or recognized-score-metric conflict may exist. Effort and harness do not restore a second chart mark. Historical Datacurve paper rows remain source-distinct from the live feed.

The current unknown-version matches are:

- Fireworks GPT-6-Astra xhigh: version/scope/tasks unknown; its 74.12% score matches the rounded Datacurve v1.1 xhigh score (74.115%); the Fireworks $6.524/task basis is not commensurate by evidence with Datacurve's $4.429/scored attempt.
- Fireworks Gemini 3.8 Flash high: 73.83% and $2.362/task versus Datacurve's 73.826% and $2.362/scored attempt.
- Fireworks Claude Opus 5 max: 73.65% and $11.838/task versus Datacurve's 73.649% and $11.838/scored attempt.
- Datacurve's paper GPT-5.5 xhigh row has unknown version and 70.0%, while the live v1.1 row is 67.04%; it is retained as a separate no-X score record.

These rows are suppressed from the combined chart because Datacurve has a same-model result and no known benchmark-version, task-scope, or score-metric conflict is established. The table labels the Fireworks version as unspecified and names the available Datacurve result. Their source-reported costs remain attached to their own rows and scenario exports; they are neither converted to scored-attempt costs nor treated as equivalent measurements. Version-unknown Datacurve paper rows are still retained because Datacurve's own source reports are not suppressed against the live feed.

### RESOLVED — Source and harness filters cannot restore suppressed chart rows

Precedence is computed from the full approved snapshot before chart filters. A targeted browser regression filters to Fireworks source rows and the unreported harness, then verifies the version-unspecified GPT-6 Astra row remains in the table but does not reappear in the chart. The analogous unit test covers both source and harness filtering after suppression.

## Verified behavior

- Current snapshot: 128 observations (70 official); 15 compatible non-Datacurve rows are suppressed from the combined chart, including the three Fireworks unknown-version matches. Unknown-version suppression is display precedence only. Source rows remain in matching table views and all observation exports (filtered exports follow active filters), with a version-aware suppression note and no selected chart guide. The default combined chart shows seven scenario marks and 24 no-data marks; the scenario layer and exports still retain all 14 scenario records.
- Seven cost-only scenarios are exact-row additions: three AA suite proxies ($12.39, $0.24, $0.09/task) and four Fireworks source-reported costs ($0.430, $6.524, $2.362, $11.838/task). AA values are labeled pooled three-benchmark suite proxies, not DeepSWE-only allocations; Fireworks rows retain `source-statistic-unspecified`. All seven leave normalized cost, output-token, and time metrics null and invent no token/time values (`src/lib/usage-scenarios.ts:334-347`; `tests/usage-scenarios.test.ts:156-191`).
- Scenario X values follow the selected metric; cost-only rows have no token/time point, and scenarios are excluded from median and strict views. Chart labels/details and separate JSON/CSV scenario exports retain scenario type, unit, method, and source scope (`src/components/ExplorerChart.tsx:181-207, 505-518`; `src/lib/exports.ts`).

## Checks

- `npm test` — passed: 13 files, 60 tests.
- `npm run typecheck` — passed.
- `npm run validate` — passed: 128 approved observations, 2 pending candidates, 9 retained resolutions.
- `npm run build` — passed.
- `CHROMIUM_PATH=/run/current-system/sw/bin/chromium npm run test:browser -- --output /tmp/opencode/deepswe-playwright` — passed: 14 browser tests, including the unknown-version and source+harness no-bypass cases.
