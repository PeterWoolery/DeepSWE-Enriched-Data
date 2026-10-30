# Usage Estimation Implementation

## Goal

Finish per-metric usage selection and reviewed research-data refresh without changing the frozen 17-target baseline or overstating accuracy.

## Tasks

- [x] Freeze the Stage 0 baseline: 17 target identities, metric values/methods, and approved revision `dsv1.1-33e411127c1a9343`.
- [x] Consolidate Stage 1 usage facts and target/metric configuration in research data; retain historical malformed hash evidence without guessing a replacement.
- [x] Implement the core measured-first, per-metric resolver with optional mean/non-strict gating and null/zero handling.
- [x] Integrate the resolver into chart, table, evidence, and export UI while preserving one point per observation/metric.
- [x] Integrate the fixture-backed AA parser and reviewed refresh flow with exact identity checks, bounded retrieval, and last-known-good retention.
- [x] Add UI/parser integration coverage for identity, provenance, precedence, missing values, and parser failures.
- [x] Perform final independent review and scoped verification; local browser execution is blocked by a missing system library (details below).

## Final verification (2026-10-04)

| Command | Exit | Evidence |
|---|---:|---|
| `npm run validate` | 0 | 133 approved observations (70 official, 63 supplemental), 17 exact usage scenarios and facts, 2 pending candidates, 9 retained resolutions. |
| `npm run validate:candidate` | 0 | No pending official candidate; latest refresh status is checked-unchanged-recorded. |
| `npm run typecheck` | 0 | `tsc -b` completed without diagnostics. |
| `npm test` | 0 | 15 test files and 102 tests passed. Includes `keeps the exact 17-target runtime values and per-metric methods at the frozen baseline`, asserting all 17 full-precision metric values/methods and the approved revision/counts. |
| `npm run build` | 0 | Production build and data export completed for revision `dsv1.1-33e411127c1a9343`; 133 approved observations, no candidates or fixtures in the leaderboard export. Vite emitted dependency-comment and >500 kB chunk warnings. |
| `npm run test:browser` | 1 | Subpath build completed and Playwright attempted 19 tests, but Chromium could not start: `libglib-2.0.so.0: cannot open shared object file`. No browser assertions ran. System packages were not installed and no external browser path was accessed. |
| `git diff --check` | 0 | No whitespace errors. |

## Review and limitations

- The frozen baseline remains 17 targets with exact values and per-metric methods; approved data remains 133 observations at revision `dsv1.1-33e411127c1a9343`. Final status/diff showed no changes in `data/approved`, `data/candidates`, `public`, or `dist`; build-generated files left no incidental worktree changes.
- Reviewed the previously identified fixes: Opus 5.5 cost/time descriptions now explain the predecessor-to-target ratios and pooled AA denominators; validators bind each fact, source ID, metric, exact target identity, URL, and source configuration; evidence UI distinguishes validated, unavailable, and malformed-historical hashes; AA source-load failures write separate failure status while preserving existing proposal artifacts; refresh retrieval uses a 15-second abort timeout, at most three attempts, and a streamed 1 MB response limit. Focused tests cover these cases and candidate retention.
- The browser suite remains unverified locally solely because the Playwright Chromium binary cannot load `libglib-2.0.so.0`. The 102 unit/component/parser tests, validation, typecheck, production build, and subpath build passed. Installing system dependencies or using a browser outside the workspace was not authorized.
- No live refresh, candidate approval, publication, commit, push, merge, or deploy command was run. Pre-existing README/LICENSE edits and unrelated untracked documentation, research inputs, and screenshots were preserved.

## Done When

All 17 targets retain baseline values and methods, approved measurements take precedence per metric, optional evidence remains traceable and non-median, and parser failures preserve valid published facts. Final review and all locally executable checks passed; browser coverage remains environment-blocked as documented above. No stronger accuracy claims were made.
