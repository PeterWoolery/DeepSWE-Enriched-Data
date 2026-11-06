# Independent implementation review

Review date: 2026-09-26. Reviewed `deepswe_coding_agent_prompt_v2.md`, the React/Vite application, data and provenance records, source research, documentation, tests, and GitHub workflows. This pass did not fetch upstream sources or run the refresh workflow. The workspace has no `.git` repository, so branch/history/diff state could not be inspected.

## Findings from initial review (retested below)

### High — pass@4 details display the pass@1 interval and denominator

`src/components/EvidencePanel.tsx:34-35,80-84` selects the requested score for the headline, but always reads confidence bounds and denominator from `observation.result` (the primary pass@1 result). Reproduced in headless Chromium using the approved GPT-6 Astra xhigh record with `score=pass_at_4`: the selected score was pass@4, while details showed the pass@1 interval `71.2%–77.0%` and “scored rollout attempts (452)”. That pass@4 record's denominator is unique tasks attempted (113), and no pass@4 CI is reported. Resolve all detail fields from the selected result; show no CI when the selected metric has none. `ResultsTable.tsx:64` correctly avoids showing a CI label for pass@4, so align the evidence panel with that behavior.

### High — unchanged scheduled refresh can fail before opening its PR

`.github/workflows/refresh-data.yml:82-84` runs `git add -A data/candidates/datacurve-v1.1.json` even when the file does not exist. Both HTTP 304 and normalized-unchanged paths remove this file (`scripts/refresh-official.ts:97-112,157-159`). In a clean temporary Git repository, the exact `git add -A data/candidates/datacurve-v1.1.json` command exited 128 with `fatal: pathspec ... did not match any files`. On an unchanged check with no previously tracked candidate, the workflow therefore fails before it can create the required metadata-only review PR. Stage the containing directory or conditionally add the candidate path, then test both absent-candidate and present-candidate flows.

### High — strict mode checks for known fields but does not compare their values

`src/lib/comparison.ts:31-42` returns an exclusion reason only for absent fields; `filterObservations` applies that predicate independently per row (`:108-120`). It does not require selected rows to agree on benchmark version/scope, harness/revision, policy, metric, or selected-score availability. A local reproduction completed those fields on two approved observations, deliberately gave the second a different benchmark version, harness, policy, and pricing basis, and `filterObservations(... strict: true ...)` returned both with no exclusion reason. This can present incompatible records as a strict comparison. Compare selected rows against an explicit compatibility group and include the selected score metric in eligibility. Current approved records mostly fail closed because required protocol fields are unknown; this is a latent acceptance failure rather than a false match observed in the current dataset.

### Moderate — required browser-level regression coverage is not checked in

The committed suite is 30 Vitest tests in `tests/` with `vite.config.ts:15-18` configuring Node, plus four Python tests for the separate GLM workflow. There is a useful plain-static HTTP subpath test, but no browser test for the UI controls, point selection/highlighting, keyboard-accessible evidence, URL reload/interactions, source markers, or mobile layout. `docs/progress.md:14` describes a broader headless-browser run, but that run is not reproducible from a committed test. The prompt's browser/accessibility acceptance tests (especially items 13–15) remain unfulfilled as automated regression coverage.

## Acceptance review

- **Source-backed data:** approved data has 70 official configurations plus four separate developer/independent reports; seven numeric discovery leads remain pending with `normalizedScore: null`. Official mean/median cost, output tokens, and reported seconds are present for all 70 rows. The feed/site GPT-5.6 Sol cost discrepancy remains separately sourced and unresolved.
- **Effort paths and gaps:** the chart is a paired numeric inline-SVG plot, grouping by explicit series ID and using reviewed order values. Fixtures exercise non-monotonic coordinates, null gaps, zero/log handling, and unordered settings. The approved mapping currently orders 11 exact official model series; unmapped settings remain dots.
- **Definitions and provenance:** methodology distinguishes pass@1 attempts from pass@4 unique tasks, keeps unknown values null, separates reported mean/median, and qualifies duration as seconds per scored attempt with unspecified boundaries. Reports for GPT-6 Sol/Luna, Anthropic Opus 5.5, and Artificial Analysis remain distinct. Candidates are separately exported and do not enter approved rankings.
- **Static deployment and workflows:** Vite base-path configuration, base-aware data/download paths, static 404 behavior, workflow permissions, default-branch deploy condition, pinned Pages actions, and manual/scheduled refresh triggers were inspected. No GitHub workflow was executed; the unchanged-refresh defect above blocks one required refresh path. Pages is prepared but not deployed.
- **Anthropic PDF evidence limitation:** `data/research/source-capture.json:143-154` records HTTP 200, SHA-256, page index/printed page 175, §8.3, and `visual_inspection: true`, while also recording `retained_pdf: false`. The approved report includes a page/section locator and an honest prose-only description. Because the source PDF or page image is not in the workspace and this review did not access outside it, I could not independently inspect the actual rendered page; the prior visual-inspection claim is therefore supported by the capture record, not re-performed here.
- **Repository state:** `git rev-parse` and `git status` report “not a git repository”. The GLM benchmark remains separate in the inspected README and tests. No GLM files were edited. Build scripts regenerate ignored `public/data/` and `dist/` outputs.

## Verification performed during initial review

Environment: Node `v22.23.2`, npm `10.9.8`.

| Command | Result |
|---|---|
| `npm test` | Passed: 9 files, 30 tests. |
| `npm run typecheck` | Passed (`tsc -b`, exit 0). |
| `npm run validate` | Passed: revision `dsv1.1-e45faecf9e77ce02`, 74 approved observations (70 official, 4 supplemental), 7 pending candidates. |
| `npm run validate:candidate` | Passed: no pending official candidate; latest status is `checked-unchanged-recorded`. |
| `npm run build` | Passed: Vite root build, 136 modules. Rollup emitted two non-fatal Zod `@__PURE__` annotation warnings. |
| `npm run build:subpath` | Passed: Vite project-subpath build, 136 modules; same non-fatal Zod warnings. |
| `npm run test:subpath` | Passed on a plain static server: query URL root, same-origin assets/data/exports, unknown-route 404, 74 approved observations, 1,290,135 sampled bytes. |
| `python3 -m unittest discover -s tests -v` | Passed: 4 existing GLM tests. |
| `chromium --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --virtual-time-budget=6000 --dump-dom 'http://127.0.0.1:4173/deepswe-explorer/?view=official&x=outputTokens&scale=log&model=gpt-6-astra'` | Rendered the production page and `svg#effort-curve` with five selected points, all-levels/log/output-token controls selected, and no load-error text. |

Not run: `npm ci`, `npm run dev`, upstream refresh, YAML/action execution, or public deployment. The browser smoke covered a rendered deep link, not the full interaction/mobile matrix. The build-time Zod warnings did not prevent either artifact from building.

## README commands

Local start, as documented in `README.md:7-23`:

```sh
npm ci
npm run dev
```

Validation and production build:

```sh
npm test
npm run typecheck
npm run validate
npm run build
```

Project-subpath verification/preview:

```sh
npm run build:subpath
npm run test:subpath
STATIC_BASE_PATH=/deepswe-explorer/ STATIC_PORT=4173 npm run serve:static
```

Refresh and explicit approval:

```sh
npm run refresh:official
npm run validate:candidate
npm run approve:candidate -- --reviewer "maintainer name" --confirm-source-review
```

For a successful unchanged check, the documented metadata-only step is:

```sh
npm run record:unchanged-check -- --reviewer "maintainer name" --confirm-unchanged
```

GitHub Pages setup is documented rather than a local deploy command: push the prepared code to a public repository's default branch, select **Settings → Pages → Source: GitHub Actions**, and permit the `github-pages` environment/workflow permissions. The deploy workflow then builds and publishes on default-branch pushes or manual dispatch; no deployment was performed in this review.

## Implementation worker's reported resolution

Review findings are retained above without alteration. Corrections and reproducible checks:

1. **Pass@4 evidence details — fixed.** `EvidencePanel` now gets the score value, denominator, reported wording, and confidence interval from the selected score result. Alternate scores have an explicit null CI with a source-specific missing reason. `tests/evidence-panel.test.tsx` verifies pass@4 uses “unique tasks attempted (113)” and does not display pass@1's 452-attempt denominator or run-to-run CI; it separately verifies pass@1 still shows its own denominator and interval.
2. **Unchanged refresh staging — fixed.** The workflow delegates Git staging to `scripts/stage-refresh-pr.sh`, which stages the always-present candidate directory instead of a possibly absent candidate file, stages approved metadata for unchanged checks, and exits before commit/push on failure. `tests/refresh-workflow.test.ts` runs the same script in temporary local/bare Git repositories for candidate-present, candidate-absent metadata-only, and failed-refresh branches; no production or workspace repository is created.
3. **Strict protocol compatibility — fixed.** `strictProtocolGroups` forms exact fingerprints over known evaluator/source category, benchmark revision/scope/task set/population/exclusion policy, selected score definition/denominator, harness/revision, provider/deployment/endpoint/evaluation policy, and the selected X metric's scope (including cost basis, reasoning-token inclusion, or time boundaries/sample count). Strict mode requires an explicit protocol-group selection in the UI/URL and never chooses a dominant group. `tests/comparison.test.ts` uses completed synthetic protocol records to verify that version, scope, harness, policy, population, and cost-basis mismatches form separate groups; a selected group returns only its compatible rows, and an absent selected score metric fails closed.
4. **Checked-in browser regression suite — fixed.** `browser-tests/explorer.spec.ts` uses Playwright against the built plain-static `/deepswe-explorer/` server. The six browser tests cover point/series highlighting, keyboard evidence selection, pass@4 details, all X metrics, statistic/scale/connection URL round trips, publisher/version/harness/source/model/strict filters, incompatible protocol-group selection, score-only results, SVG/JSON/CSV downloads, local submission drafts, methodology/source navigation, review queue, and mobile layout. CI installs Chromium and runs this suite; a local executable can be supplied through `CHROMIUM_PATH`.

Verification after corrections: `npm test` passes 37 tests across 11 files (including isolated Git branch tests); `CHROMIUM_PATH=/run/current-system/sw/bin/chromium npm run test:browser` passes 6 browser tests; `npm run build:subpath && npm run test:subpath` and both static production builds pass. The existing Python GLM suite passes 4 tests. `npm audit` reports 0 vulnerabilities. GitHub Actions YAML parses successfully. Public Pages deployment remains unperformed.

## Independent re-verification — 2026-09-26

**Verdict: all four reported fixes independently verified.** I inspected the implementation, the new tests, the refresh staging script/workflow integration, the browser configuration, and the built app. I did not make implementation changes.

1. **Pass@4 detail provenance — resolved.** `EvidencePanel` now uses `scoreResult(observation, scoreMetric)` for reported wording, denominator/count, and confidence interval. Its Vitest test checks pass@4's unique-task denominator (113), excludes the pass@1 denominator (452) and CI, and verifies pass@1 still presents its own denominator/interval. Browser test 1 also exercises the approved GPT-6 Astra xhigh point.
2. **Refresh staging — resolved.** `scripts/stage-refresh-pr.sh` stages the candidate directory and approved metadata without requiring the optional candidate JSON to exist. `tests/refresh-workflow.test.ts` creates isolated work/bare repositories and covers changed-candidate commit/push, unchanged metadata-only commit with no candidate file, and failure with no commit/push. All three passed under `npm test`.
3. **Strict comparison groups and URL state — resolved for reviewed cases.** `strictProtocolGroups` groups only matching known protocol and selected metric-scope fingerprints; strict mode requires an explicitly selected `protocol` key and fails closed without one. `tests/comparison.test.ts` separates version, task-scope, harness, policy, population, and cost-basis mismatches. Browser test 4 verifies group selection and reload persistence; the browser suite also checks unknown fields fail closed and metric selection changes clear stale group selection.
4. **Browser regression coverage — resolved.** Six checked-in Playwright tests run against the built project-subpath static server. They cover the pass@4 detail, chart/accessibility interaction, X-metric/statistic/scale URL reload, filters and strict groups, exports, submission draft, navigation, and mobile overflow.

### Exact verification commands and outcomes

Environment: Node `v22.23.2`, npm `10.9.8`; Chromium supplied via `CHROMIUM_PATH=/run/current-system/sw/bin/chromium`.

| Command | Independently observed result |
|---|---|
| `npm test` | Passed: 11 files, 37 tests, including the pass@4 panel, three temporary-Git staging branches, and strict-group mismatches. |
| `npm run typecheck` | Passed: `tsc -b`, exit 0. |
| `npm run validate` | Passed: revision `dsv1.1-1a6e4a2a0071549e`, 74 approved observations (70 official, 4 supplemental), 7 pending candidates. |
| `npm run validate:candidate` | Passed: no pending official candidate; latest status `checked-unchanged-recorded`. |
| `npm run build` | Passed: root static artifact, 136 modules. Two non-fatal Zod `@__PURE__` annotation warnings remain. |
| `npm run build:subpath && npm run test:subpath` | Passed: project-base assets, query root, same-origin data/exports, unknown-route 404, 74 approved observations, 1,316,620 sampled bytes. |
| `CHROMIUM_PATH=/run/current-system/sw/bin/chromium npm run test:browser` | Passed: production subpath rebuild and all 6 Playwright browser tests (`6 passed`, 13.0s). |
| `python3 -m unittest discover -s tests -v` | Passed: 4 existing GLM tests. |

The last build command leaves `dist/` as the project-subpath production artifact. Root and subpath builds both completed; the only build notices were the non-fatal Zod annotation warnings. Build/export scripts regenerated ignored `dist/` and `public/data/` outputs.

### Remaining material limits

- No `.git` repository is present, so I could not compare the implementer's changes against a baseline or audit unrelated worktree modifications. Current revision is `dsv1.1-1a6e4a2a0071549e`; validation reports 74 approved observations and 7 pending leads.
- The refresh staging tests verify the invoked staging script in isolated local repositories, not a hosted GitHub Actions run. No upstream refresh or public Pages deployment was performed.
- The earlier Anthropic PDF caveat remains: the local source capture records visual inspection, but the PDF/page image is not retained in the workspace, so I did not independently re-render it during this pass.
