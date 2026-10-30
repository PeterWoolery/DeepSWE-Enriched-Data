# Implementation progress

Updated: 2026-09-26

## Completed
- Read the full v2 acceptance prompt and source-research report/capture manifest.
- Re-fetched and reviewed primary Anthropic, DeepSeek, Xiaomi, Qwen, Google, xAI, Tinfield, Artificial Analysis, and Datacurve paper sources; preserved each report's benchmark version, score statistic, harness, and unknowns.
- Recorded implementation plan and architecture/data decisions.
- Built and ran the first isolated numeric XY fixture suite (3/3 passing): effort-ordered/non-monotonic path, null gap, and zero/log/unordered behavior.
- Re-fetched Datacurve v1.1: HTTP 200, response hash matches the capture (`a7c15d…bd030019`), 70 unique configurations/28 model strings. Approved normalized result facts only; raw feed, PDF, task text, and trajectories were not retained.
- Approved snapshot now has 70 official feed configurations and 57 supplemental source reports (127 total); 53 observations were added and the existing Artificial Analysis Opus 5.5 report was refreshed without duplication. Nine candidate claims have linked resolution records; two DataLearner leads remain pending.
- Implemented score/CI/attempt/run schemas; source and pricing provenance; timing fields with null duration-specific sample counts; explicit per-model effort order/evidence; source/measurement revision history; safe candidate refresh/approval and metadata-only unchanged checks.
- Built the React/Vite explorer, accessible numeric SVG chart, comparison controls, evidence/table and score-only views, URL state, SVG/JSON/CSV exports, source/methodology pages, local submission helper, GitHub Pages workflows, and docs/templates.
- Verified rendered client behavior in headless Chromium against the project-subpath static server: 70 points/12 connected official paths, 70 CI marks, all 3 X metrics, effort/filter/score-only/review/theme flows, shareable URL state, keyboard point highlight/evidence, and 375px mobile layout without horizontal overflow. Browser requests stayed same-origin.
- Verified the source-check metadata update: latest approved source check is separate from `lastDataChangeAt`; the site separately displays deployment time only in deployed artifacts.
- Resolved all findings in [`docs/independent-review.md`](independent-review.md): score-specific CI/denominator evidence; temporary-Git changed/unchanged/failure tests for refresh staging; strict compatibility groups with explicit selection; and a checked-in Playwright browser suite.

## Verification results
- `npm ci`: passed; lockfile install reported 0 vulnerabilities.
- `npm run validate`: passed (127 approved observations: 70 official, 57 supplemental; 2 pending candidates and 9 retained resolutions).
- `npm run validate:candidate`: passed (no current pending official candidate after approval).
- `npm run typecheck`: passed.
- `npm test`: 45 tests passed across 12 files, including the raw 74.2 vs explicit 74.2% formatting and score-axis scale guard, source-series separation, candidate audit links, Fireworks cost provenance, and existing strict-compatibility/refresh regressions.
- `CHROMIUM_PATH=/run/current-system/sw/bin/chromium npm run test:browser`: 6 Playwright tests passed against the project subpath, including raw/percentage score presentation, unknown benchmark-version visibility, the refreshed 127-observation exports, review queue, and mobile layout.
- Local browser verification used `CHROMIUM_PATH=/run/current-system/sw/bin/chromium`; CI installs Playwright Chromium with its pinned test package.
- `python3 -m unittest discover -s tests -v`: 4 existing GLM benchmark tests passed.
- `npm run build`: passed; Vite root static build.
- `npm audit --json`: 0 vulnerabilities after pinning Vitest 5.0.2 (Vitest 4.1.11 triggered an npm 10.9.8 Arborist failure; 5.0.2 resolved it and supports the Node 22/Vite 7 range).
- GitHub workflow and issue-template YAML parsing: passed. Deployment/refresh workflows were not run against a repository.

## Handoff state
- Approved snapshot revision: `dsv1.1-c94403d25be7083e`; the Datacurve feed remains the 70-row HTTP 200 retrieval at `2026-09-26T20:28:15.076Z` (SHA-256 `a7c15d66288fd249c020b9931c017b92d1a3b90e480b3ff34974b752bd030019`). Supplemental-source presentation updates changed `lastDataChangeAt` to `2026-09-27T02:12:35.640Z`; the feed's last successful check remains separate.
- GitHub Pages deployment is prepared, not deployed. No repository was created, pushed, or published.
- The GLM benchmark scripts, task cache/results, supplied prompt, and research capture were preserved. Fireworks Cost/Task values are retained only on Fireworks source observations; their unknown aggregation/billing basis keeps mean/median cost null. No pooled costs, rate-card prices, or training spend were used to estimate usage.
- Ready for the primary's independent implementation/data review.

## Build note
- Vite builds pass. Rollup emits two non-fatal Zod `@__PURE__` annotation notices and removes those comments; no build/runtime error results.

## Material source constraints
- Feed-derived timing exists, but timer boundaries and timing-specific samples are unspecified; label it reported time per scored attempt, not verified end-to-end duration.
- Datacurve feed-specific redistribution permission was not found; publish attributed normalized facts only and preserve response hash/retrieval metadata, not raw payloads.
- Anthropic's inspected system-card paragraph reports 74.2% over five trials on PDF index/printed page 175, §8.3, with no effort label, CI, cost, or explicit score metric; keep those unknown.
- OpenAI's 68.8% Sol and 66.6% Luna claims do not identify exact metric, harness, denominator, cost, or CI. Artificial Analysis separately reports 68% for Claude Code / Opus 5.5 max; its cost is a multi-benchmark average and is not imported as DeepSWE cost.
