# Implementation decisions

| Decision | Rationale |
|---|---|
| Native inline SVG for the plot | A paired numeric XY plot must retain exact source-backed point order even when X doubles back. Explicit SVG path segments make order, null breaks, unsmoothed lines, measured markers, CI bars, keyboard selection, and SVG export deterministic without a chart dependency. |
| Observation-centric JSON | Every configuration/source report remains a separate attributed observation; series identity and effort ordering are explicit and not inferred from missing protocol fields. |
| Metrics use reported means | Cost, output tokens, and reported duration map independently to feed fields over scored rollout attempts. Full precision is retained. The feed/site cost discrepancy is recorded rather than reconciled by guesswork. |
| Source classes remain distinct | Organizer, developer, and independent evaluator are separate views/series. Source review confirms transcription, not independent replication. |
| Approved facts, not raw source payloads | Keep only normalized metrics, metadata, evidence locators, retrieval/hash provenance, and attribution. The upstream feed has no confirmed feed-specific redistribution license; no task/trajectory/document copies are retained. |
| Unmapped effort settings are isolated | Only reviewed model-specific ordered labels are connected. Null/adaptive/unmapped settings remain dots until an ordering is supported. |
| Strict mode is conservative | Known compatible protocol fields are required; unknown evaluation/timing details cannot silently pass. Non-strict curves disclose the evidence basis and unknowns. |
| Strict mode selects one protocol fingerprint explicitly | Known-but-different benchmark scope, harness/policy, population, publisher/evaluator, or metric-specific basis must not be placed in one strict comparison. No “largest” group is silently chosen; the selected group is URL state. |
| GitHub Pages is the only hosted target | Plain static assets and same-origin data work offline after build. Actions validate before deploy; refresh creates review candidates/PRs and never publishes unreviewed numbers. |
| Browser acceptance is reproducible | Playwright runs the production bundle on the plain static project subpath. `CHROMIUM_PATH` can point at a compatible system browser; CI installs its pinned Playwright Chromium. |
