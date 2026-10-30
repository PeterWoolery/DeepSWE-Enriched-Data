# Independent review: usage scenarios and no-data gutter

Reviewed 2026-09-28. No live deployment was checked.

Evidence: [research note](usage-estimation-research.md) and [`coverageAudit`](../data/research/usage-proxy-cross-platform-20260927.json).

## Verdict

Calculations, target matching, coverage, and metric handling meet the scenario-only design. The approved 127-row dataset matches `HEAD`. One export defect needs correction.

## Finding — P2: standalone SVG export paints interactive hit areas

`src/App.tsx` embeds chart CSS but omits `.point-hit-area { fill: transparent; stroke: transparent; }` from `src/styles.css`. `ExplorerChart.tsx` emits these circles before each marker. Without external CSS, exported SVG circles fall back to black fill. Browser export probe: 115 hit circles (38 gutter), no embedded hit-area rule; live-page style is transparent. Embed the rule and assert it in the SVG export test.

## Minor finding — P3: dense gutter markers nearly touch

All 38 centers are unique, but 20 symbol bounding-box pairs intersect: columns are 13 units apart; path symbols span 14. The collapsed key exposes model, score, protocol, and reason; keyboard focus and Enter selection work. Slightly smaller symbols or more spacing would reduce crowding.

## Calculation and coverage audit

All seven mean scenarios were independently recomputed from research inputs; exact model/effort targets and all three outputs matched, while target measurements remain null:

| Exact AA row | Cost / attempt | Output tokens / attempt | Reported time / attempt |
|---|---:|---:|---:|
| GPT-6 Luna (max) | $0.21 | 98,422 | 18.3 min |
| Opus 5.5 (max) | $14.31 | 191,648 | 50.2 min |
| GPT-6 Astra (max) | $7.50 | 61,149 | 33.0 min |
| GPT-6 Sol (max) | $3.43 | 59,825 | 19.1 min |
| Opus 5 (max) | $11.84 | 117,566 | 31.9 min |
| GPT-5.6 Sol (max) | $8.39 | 60,014 | 18.8 min |
| GPT-5.6 Luna (max) | $3.03 | 73,400 | 18.7 min |

Four rows use exact model/max Datacurve data as cross-harness scenarios. GPT-6 Luna/Sol use two-pair output/time ratios and a three-pair cost fit; Opus 5.5 uses one Opus 5 predecessor pair (very-low evidence, no interval). These are scenarios, not target measurements. OpenAI cost fit: 46.7% leave-one-out MAPE; two bases unknown; envelopes are not intervals. Time inputs are Datacurve `mean_duration_seconds` per scored attempt (444–450 attempts); denominators are AA reported times (20.6m, 23.5m, 41.9m). Both endpoints are attempt-scale; AA pools three benchmarks and Datacurve timer boundaries are unspecified. No token-rate, step-count, or parallel-job conversion is used.

57 observations missing all metrics partition into seven exact-target scenarios and 50 no-data records: 38 percentage/fraction rows in the gutter, 12 raw-unit rows unscaled. Exact IDs and effort are required; unknown-effort rows get no estimate. Tests cover scenario/strict/median exclusion, alias matching, log-zero/empty-axis cases, labels, and exports. Unsupported estimates keep metric-specific reasons.

## Verification

- `npm test`: 13 files, 55 tests passed.
- `npm run validate`: 127 approved observations validated.
- `npm run typecheck`: passed.
- `CHROMIUM_PATH=/run/current-system/sw/bin/chromium npm run test:browser`: 10 passed.
- Arithmetic/coverage audit passed; approved dataset matches `HEAD`.
- `git diff --check`: clean.

Build and browser verification were local; no deployment was performed.

## Resolution (2026-09-28)

- **P2 — resolved:** standalone SVG export now embeds `.point-hit-area{fill:transparent;stroke:transparent}` with the chart styles. The SVG browser regression checks for the rule, so exported interaction targets do not render as black circles without the page stylesheet.
- **P3 — resolved:** widened the no-data gutter by reducing the numeric plot width slightly, spaced marker columns 18 viewBox units apart, reduced gutter glyphs modestly, and reserved 17 viewBox units vertically within columns. Markers retain their exact score Y coordinate; only the explicitly non-numeric gutter X position is staggered. A browser assertion checks stroke-expanded symbol bounds for overlap in the initial, median, and scenario-disabled views; all are clear. The keyboard-accessible companion key remains available.

Verification after the fixes: `npm test` (13 files, 55 tests), `npm run typecheck`, `npm run validate` (127 observations), `npm run build`, and `CHROMIUM_PATH=/run/current-system/sw/bin/chromium npm run test:browser` (10 passed) all passed. `git diff --check` is clean. Changes are local; no deployment, commit, or push was performed.
