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
