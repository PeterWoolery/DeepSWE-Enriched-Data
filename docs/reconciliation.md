# Dated source reconciliation

Reconciliation performed 2026-09-26 against the captured Datacurve v1.1 JSON and rendered leaderboard. These are dated observations, not permanent model-count assertions or a claim that the site uses the feed as its display source.

## Representative row: GPT-5.6 Sol [max]

Upstream configuration: `mini_swe_agent_gpt_5_6_sol_max`.

| Field | JSON feed | Rendered All effort levels table | Reconciliation |
|---|---:|---:|---|
| pass@1 | `0.7266666666666667` | `73% ± 3%` | The displayed point score rounds consistently. |
| Run-to-run 95% interval | `0.6983684441682949` to `0.7549648891650385` | `±3%` | The source interval half-width is about 2.83 percentage points, consistent with display rounding. Its run-to-run method is preserved. |
| Mean output tokens | `60013.64444444444` | `60k` | Consistent with display rounding. |
| Mean cost | `$8.386436346666667` | `$6.46` | **Unresolved discrepancy.** Changelog pricing notes do not establish a complete row-level conversion formula. Both values remain separate; the explorer does not guess a multiplier or reprice. |
| Task/attempt counts | 113 tasks in set; 450 attempts for this configuration | Not shown in the captured row | Keep unique tasks and rollout attempts distinct. |

At capture the rendered table showed 57 of the feed's 70 configurations. The feed's row order and the website's All effort table are not effort-order contracts; the explorer uses explicit reviewed mappings and imports every current feed configuration.

## Publisher-specific reports

OpenAI's GPT-6 Sol/Luna claims, Anthropic's Opus 5.5 system-card paragraph, and Artificial Analysis's Claude Code result are retained as distinct observations, not reconciled to similarly named Datacurve rows. The developer/independent sources omit cost/protocol details; missing fields remain null. Artificial Analysis's `$13.04` multi-benchmark average is not attached to its DeepSWE result.

## Current import record

The live v1.1 endpoint was re-fetched during implementation. The response SHA-256 matched the 2026-09-26 research capture (`a7c15d66288fd249c020b9931c017b92d1a3b90e480b3ff34974b752bd030019`). It contained 70 unique configurations across 28 model strings. Mean/median cost, output-token, and duration fields appeared on all 70 rows. Duration remains reported seconds per scored attempt with unspecified timer boundaries and no duration-specific sample count. The approved JSON contains normalized observations and retrieval provenance, not the raw response.
