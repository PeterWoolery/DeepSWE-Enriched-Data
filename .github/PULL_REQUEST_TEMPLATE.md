## Change summary

- [ ] Application / tests / documentation
- [ ] Approved observation data
- [ ] Pending source candidate only
- [ ] Workflow / deployment

## Evidence and data review (complete for result changes)

- [ ] Primary source URL, publisher/category, retrieval date/hash, and exact page/section/figure/table locator are recorded.
- [ ] Model and effort strings are retained as reported; any alias/effort order is explicit and evidence-backed.
- [ ] Benchmark version/scope, score metric, denominator, harness, evaluation policy, and known unknowns are documented.
- [ ] Cost, output tokens, and time each retain their own unit, statistic, population, definition, and source locator.
- [ ] Mean and median are separate; timing boundaries/sample count and timeout/retry scope are not inferred.
- [ ] Source review is not described as independent replication.
- [ ] Pending candidates remain outside approved observations and exports.
- [ ] No raw task text, solution, trajectory, full feed, PDF, private data, or secret is included.

## Verification

- [ ] `npm run validate`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run build:subpath && npm run test:subpath`

If this is a source refresh, state whether it is a numeric candidate PR or metadata-only unchanged-check PR. Do not auto-approve or auto-merge.
