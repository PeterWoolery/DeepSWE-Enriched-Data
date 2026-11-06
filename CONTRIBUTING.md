# Contributing

DeepSWE Explorer is a results-aggregation project, not a benchmark runner. Keep every observation source-attributed, preserve unknowns, and keep pending claims separate from approved data.

## Local development

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run validate
npm run build
npm run build:subpath
npm run test:subpath
npx playwright install chromium
npm run test:browser
```

The build uses checked-in approved data and does not contact upstream sources. The browser loads same-origin static files only.

## Adding or correcting a result

1. Start with a primary result source where possible. Add the source URL/title, publisher/category, exact evidence locator, retrieval date/hash when fetched, reported model and effort strings, benchmark version/scope, score definition/denominator, protocol, and metric-specific missing reasons.
2. Preserve score precision and confidence method. Keep mean and median separate. Cost, output tokens, and time require their own units, populations, scope, and provenance. Never derive task time from token rate/steps/job duration; do not borrow a score or cost from a similar model name.
3. If evidence is incomplete or secondary-only, add a `pending-review` candidate. Do not insert it into `data/approved/dataset.json` or the approved supplemental reports.
4. For the official source, run `npm run refresh:official`, inspect the normalized candidate/diff, then use the explicit approval command documented in [`docs/deployment.md`](docs/deployment.md). A 304 unchanged check is a metadata-only change; it does not imply new measurements.
5. Run candidate/data validation, tests, and builds. Review generated `data/approved/revisions.json`, `data/approved/retrievals.json`, and source snapshots with the dataset change.

Use `data/sources/approved-reports.json` for reviewed single-report observations and `data/candidates/queue.json` for unverified leads. The browser submission form downloads a local pending JSON draft; it never uploads it or grants credentials.

### Supplemental additions and corrections

After source review, add a new report to `data/sources/approved-reports.json` and run `npm run export:data -- --sync-supplemental`. This adds normalized observations with new IDs and revision events; it does **not** update an existing ID. A regular export does not sync reports. `npm run validate` requires every normalized supplemental report to match its stored row in `data/approved/dataset.json`.

There is no standalone supplemental correction command. For a correction, either:

- Submit a reviewed manual PR updating the report and its corresponding normalized dataset row together. Preserve source attribution and review evidence, record the old and new values in `data/approved/revisions.json` using the event conventions in `src/lib/revisions.ts`, and update the dataset revision and data-change metadata consistently. Review the complete diff and run `npm run validate`, tests, and builds before merging.
- When a genuine official candidate is pending, update and review the supplemental report on that candidate's PR, then follow the [official approval procedure](docs/deployment.md#reviewed-source-refresh). Approval rebuilds the dataset from the official candidate and normalized supplemental reports and records revision events. It requires human review of the official candidate too; do not create a fake candidate to trigger it. An unchanged official check is not a candidate approval.

### Reviewing the shared usage-scenario revision pin

`data/research/usage-proxy-cross-platform-20260927.json` has one shared `scenarioConfig.approvedDatasetRevision` pin for all usage scenarios. Every approved dataset revision change, including an unrelated model addition, requires review of that one pin; do not update each scenario record, silently advance the pin, or remove the check.

1. Compare the previous and new approved datasets for every configured target and calibration input used by `src/lib/usage-scenarios.ts`. Check target observation identities and source, model/snapshot, benchmark version and protocol, effort, harness, and score alignment. Compare calibration input measurements, units, and scopes used to derive coefficients, along with their identities and evidence.
2. If any dependency changed, review and recompute the affected scenario coefficients and evidence and restore exact target alignment with the current implementation before updating the pin. Do not treat changed inputs as an unrelated revision. If the dependencies are unchanged, record that review in the PR.
3. After review, set the single `scenarioConfig.approvedDatasetRevision` to `revisionId` in `data/approved/dataset.json`. Run `npm run validate` and `npm test -- tests/usage-scenarios.test.ts tests/exports.test.ts`. Run `npm run export:data` to regenerate the existing static data exports, and review the generated diff. Scenario JSON/CSV exports are generated separately in the browser; regenerate and inspect those downloads when reviewing scenario output. The static export command does not generate scenario downloads.

### Converting a browser draft to a queue entry

The downloaded draft is nested, not a queue entry. In a reviewed PR, add a **flat** object to the `candidates` array in `data/candidates/queue.json`, keeping its existing `schemaVersion`. Map the draft fields as follows:

| Queue field | Draft field or action |
| --- | --- |
| `id` | `candidateId`; ensure it does not collide with an existing candidate or observation. |
| `modelReported`, `publisher`, `sourceCategory` | `identity.modelReported`, `identity.publisher`, `identity.sourceCategory` |
| `sourceTitle`, `sourceUrl`, `evidenceLocator` | `source.title`, `source.url`, `source.evidenceLocator` |
| `reportedScore`, `rawScoreText`, `scoreUnit` | `result.reportedNumericValue`, `result.rawReportedText`, `result.reportedUnit` |
| `normalizedScore` | Verify `result.normalizedFraction` against the source's unit and score definition before using it; otherwise use `null`. Do not infer a fraction from an unknown unit or definition. |
| `benchmarkVersion` | `benchmark.version` |
| `effortLabel`, `harness` | `result.effortLabel`, `result.harness` |
| `status` | `pending-review` |
| `reason` | Write a nonempty explanation of why the claim remains pending, using `review.notes` where relevant. |
| `missing` | List known missing or unverified evidence and protocol fields, including any score unit or definition not established. |

Use `null` for unknown numeric values and nullable version, effort, or harness fields; `scoreUnit` and `rawScoreText` must be nonempty strings, such as `not specified` for an unknown unit. Keep the raw claim even when its numeric value cannot be parsed. The draft's retrieval date/hash, submission time, benchmark scope/task count, metric label/denominator, harness revision, efficiency measurements and their scopes, timing details, and review notes/status have no separate queue fields. Preserve useful evidence privately or as permitted facts and locators in existing research metadata; do not include credentials or restricted source material. Record relevant gaps in `missing`, not as invented values. Run `npm run validate` after conversion. Downloading or adding a draft never grants source-reviewed approval.

## Tests and exports

Synthetic numeric/timing fixtures belong only under `tests/fixtures/`. They test non-monotonic XY order, null gaps, zero/log behavior, parser edge cases, timing-unit conversion, and revisions. The build exports only approved observations to `public/data/observations.json` and `.csv`; pending candidates are emitted separately.

Before deployment, run `npm run build:subpath` and `npm run test:subpath`. The plain static verifier checks subpath assets/data, query refresh, 404 behavior for unknown paths, and synthetic fixture exclusion.

## Contribution boundaries

- Do not add raw DeepSWE tasks, solutions, trajectories, source PDFs, or source HTML to the repository or static site.
- Do not claim Datacurve affiliation or treat the separate benchmark repository's Apache-2.0 license as a license for the hosted JSON feed.
- Do not enable automatic approval, merge, or publishing of numeric candidates.
- Do not include API keys, tokens, or credentials in source, local submission JSON, exports, or workflows.
- Do not add a cross-source composite score or infer model aliases without evidence.
- Strict comparison groups must match on every known comparison field and the selected metric scope; if multiple groups exist, require an explicit UI selection rather than silently overlaying or choosing one.

For a source suggestion without a code/data PR, use the GitHub **DeepSWE result suggestion** issue form. A PR adding approved observations should use the repository pull-request template.
