# DeepSWE Explorer implementation plan

## Goal
Deliver a reviewed-data, Pages-ready DeepSWE results explorer whose primary view connects compatible effort configurations on true numeric XY axes.

## Tasks
- [x] Prove ordered XY paths, non-monotonic coordinates, and null-gap behavior with isolated synthetic fixtures.
- [x] Implement schema-backed Datacurve normalization, source/provenance records, candidate review, safe refresh, and all approved source observations.
- [x] Build responsive React UI: Official / Combined / Review views, three metrics, comparison controls, evidence table, shareable URL, and exports.
- [x] Add Pages and refresh workflows, submission templates, methodology/data dictionary/source and reconciliation documentation.
- [x] Run parser/unit, production/offline, real subpath static-server, and browser checks; reconcile acceptance criteria and update progress.

## Independent-review corrections
- [x] Bind EvidencePanel confidence/denominator details to the selected score metric and add pass@4 regression coverage.
- [x] Extract Git staging into a tested helper; exercise changed, unchanged-without-candidate, and failed refresh branches in temporary repos.
- [x] Require explicit strict protocol-group selection and test mismatched version, scope, harness, policy, population, metric, and cost/time bases.
- [x] Check in Playwright browser regressions for axes, filters, evidence/keyboard, exports, URL reloads, submission, and mobile subpath behavior.

## Decisions
- Use React + TypeScript + Vite; use a small native SVG renderer rather than a chart dependency so each connected path follows explicit source-backed effort order.
- Import normalized official result facts only, not the full upstream JSON, documents, PDFs, task bodies, or trajectories. Attribute Datacurve; retain its feed/site cost discrepancy.
- Treat official duration as reported mean seconds per scored attempt with unspecified timer boundaries; show the metric, exclude strict timing matches, and test timing paths independently.
- Keep unreviewed discoveries outside published observations; never infer aliases, protocol compatibility, missing values, effort order, or costs.
- Keep all configurations as the default; Best is a per-compatible-series display projection using full precision.

## Done when
- [x] Production data contains every current official config and the separately sourced/reviewed vendor and independent claims, with honest missing fields and provenance.
- [x] The static app, reviewed refresh workflow, documentation, exports, and required tests are implemented and verified without publishing or deploying.
