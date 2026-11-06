# AA usage refresh

`npm run refresh:aa-usage` reads the authoritative `usageFacts` and `scenarioConfig` from `data/research/usage-proxy-cross-platform-20260927.json` plus the source catalogs from the Meta/Google/xAI and Chinese research artifacts. It fetches the allowlisted Artificial Analysis comparison pages and stages a separate review proposal. These research inputs are read-only; the command does not edit facts, official candidates, or approved data. The command was not run as part of this implementation.

The adapter derives targets from facts with `metric: "outputTokens"`, `identity.datasetIndexName: "deep-swe-v1.1"`, and an exact allowlisted comparison URL. Before fetching, it applies the current research-validator provenance contract: source IDs must be known, nonempty, unique, include the fact's identity source, match the scenario/cost-only source mapping, and exactly match `scenarioConfig.targets[].metrics.outputTokens.sourceIds`; each fact ID must also be uniquely referenced there with the same-source relationship. There is no second hand-maintained target list.

## Outputs and review boundary

- Candidate: `data/candidates/aa-usage-v1.1.json` (`kind: "aa-usage-refresh-proposal"`, `status: "pending-review"`).
- Retrieval/failure status: `data/candidates/aa-usage-refresh-status.json`.
- Both files use the existing atomic JSON writer. Parsing and validation complete for every configured page before the proposal is written. Source-file read/JSON-parse, fetch, parse, and validation failures write only the separate failure status and retain any existing candidate; the status names all three read-only research inputs. Successful unchanged checks update status only and preserve the numeric revision.
- This adapter has no approved-facts writer, does not use the official Datacurve candidate, and does not approve, merge, push, or publish.

The candidate retains the source fact schema and semantics, with refreshed `value` and evidence. Its diff reports added, changed, removed, provenance-changed, and unchanged fact IDs. Hashes cover the actual fetched response bytes; historical malformed hashes are retained only as historical evidence and are not treated as validated hashes. `sampleCount` and `includesReasoningTokens` remain null when the authoritative fact leaves them unspecified.

## Parsing and source-layout evidence

The parser supports strict `application/json`/`__NEXT_DATA__` script data and the observed Next.js Flight format. For Flight, it extracts only `self.__next_f.push([1, "…"])` string literals, decodes those literals with `JSON.parse`, concatenates chunks in document order, and scans serialized JSON objects. It never evaluates scripts or invokes `eval`, `Function`, a VM, or a browser. It rejects unsupported script encodings, missing/duplicate labels or DeepSWE evals, identity mismatches, malformed JSON, and invalid `mean.outputTokens` values.

A bounded, read-only retrieval on 2026-10-04 confirmed the live public layout:

| URL | HTTP/content type | Response bytes | Full response SHA-256 |
|---|---|---:|---|
| `https://artificialanalysis.ai/agents/coding-agents/comparisons/codex-vs-kimi-code-cli` | 200, `text/html; charset=utf-8` | 859,582 | `e523a33585400efba090c96015253a62618b1448559d952fa4cbffafea174fff` |
| `https://artificialanalysis.ai/agents/coding-agents/comparisons/claude-code-vs-codex` | 200, `text/html; charset=utf-8` | 886,886 | `9a37f7e82bc16c177cf7be5c4ab88ce99d2f2ee086e89afeec4091005018a2b0` |

The Codex response contained 117 script tags and 45 Next Flight text pushes. A decoded public variant record included `id`, `agentName`, `display.agent`, `display.model`, `displayLabel`, `modelRelease`, and `evals`; the exact `deep-swe-v1.1` entry contained `mean.outputTokens`. AA's serialized `id` was a response-side ID (for example, GPT-6 Sol's was `7a0dfd2a7a9d93056f860d4675586d66`), not the normalized `usageFacts.identity.variantKey`. The adapter therefore maps by the reviewed exact display label and checks the serialized harness and rendered model; the response-side ID is retained in the evidence locator. The reviewed facts report `snapshot: null`; the page supplies no immutable checkpoint field, so the adapter refuses non-null snapshot targets. Effort and fallback are checked against the exact reviewed labels/rendered model, not inferred across variants.

The implementation's bounded fetch and parser were also invoked read-only against the Codex response for authoritative fact `aa-output-gpt-6-sol-max`; they extracted exactly one `deep-swe-v1.1.mean.outputTokens` value (`70300.33038348083`) from that actual response. No candidate writer was supplied or invoked.

`tests/fixtures/aa-usage/codex-next-flight-extract.html` is a minimized offline excerpt of the GPT-6 Sol public variant, not the full response. Its fixture bytes are 549 bytes with SHA-256 `2aac8fd0ecfa1d0b467a29b8230cfdded0bd2b962ff5036f87621b686f12060b`; this is distinct from the full-response hash above. Other fixture pages are explicitly synthetic and exercise parser rejection/failure cases.

The live response also showed label drift for at least one reviewed target: the current Luna label includes an additional `({'reasoning_effort': 'max'})` suffix absent from its authoritative fact label. Matching is deliberately exact, so the complete refresh will fail closed and preserve the prior proposal until that mapping is reconciled through the normal fact review. This is evidence that the page is dynamic, not a stable public API; synthetic fixture success alone is not a live-fidelity claim.

## Limits

- Retrieval is HTTPS/path allowlisted, rejects redirects, uses a 15-second timeout, retries at most three times, and enforces a 1,000,000-byte streaming cap. The parser also bounds script, Flight segment, nesting, and item counts.
- Only the exact `.evals[datasetIndexName="deep-swe-v1.1"].mean.outputTokens` value is read. Suite parent totals, safety attempt counts, cost, time, and other benchmark evals are not substitutes.
- AA's public serialized layout is undocumented and may change. Unsupported layouts or reviewed-label drift produce a failed status rather than an approximate match.
- No live refresh candidate was generated, no fact was approved, and no AA or core research artifact was modified.
