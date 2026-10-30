# DeepSWE Explorer

An unofficial, source-attributed explorer for DeepSWE results. Its primary view connects each compatible model evaluation series across measured reasoning-effort settings on numeric XY axes: **Cost per task**, **Output tokens per task**, or **Time per task**. The local static application includes Official, Combined reports, Review queue, Methodology, and Sources views.

> Unofficial community explorer; not affiliated with Datacurve. Source review verifies transcription, not independent reproduction.

## Run the explorer

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

The app reads checked-in approved observations and pending candidates from same-origin static files. It does not scrape upstream pages in a visitor's browser. Run the offline checks and build with:

```sh
npm test
npm run typecheck
npm run validate
npm run build
npx playwright install chromium
npm run test:browser
```

`test:browser` rebuilds the project subpath and runs Playwright against the plain static server. If Chromium is already installed, set `CHROMIUM_PATH=/path/to/chromium` instead of installing Playwright's browser.

The approved dataset stores all configurations at source precision. The upstream feed currently reports mean and median duration, but timer boundaries are unspecified; the UI labels this reported time per scored attempt and strict timing comparisons exclude it. See [methodology](docs/methodology.md), [data dictionary](docs/data-dictionary.md), [sources](docs/source-registry.md), [reconciliation](docs/reconciliation.md), and [data-use notice](docs/licensing.md).

## Refresh and approve official data

Refresh contacts only the allowlisted public Datacurve v1.1 JSON endpoint and writes normalized facts to a review candidate. It never edits approved observations:

```sh
npm run refresh:official
npm run validate:candidate
```

Review the candidate diff, then explicitly approve it:

```sh
npm run approve:candidate -- --reviewer "maintainer name" --confirm-source-review
```

If a successful refresh reports `checked-unchanged`, record that verified unchanged response as a metadata-only update with `npm run record:unchanged-check -- --reviewer "maintainer name" --confirm-unchanged`. This changes the source-check timestamp/retrieval history, not the numeric observations or last-data-change timestamp.

If an upstream refresh removes configurations, review the removals and add `--allow-source-removals` deliberately. Failed refreshes retain the approved snapshot. The refresh workflow creates/updates a review PR; it never auto-approves or merges results.

## Verify a GitHub Pages project subpath

```sh
npm run build:subpath
npm run test:subpath
```

For a local plain-static preview (unknown paths return 404; no development-server fallback):

```sh
STATIC_BASE_PATH=/deepswe-explorer/ STATIC_PORT=4173 npm run serve:static
```

Open `http://127.0.0.1:4173/deepswe-explorer/`. The Pages base is derived from `GITHUB_REPOSITORY` in Actions or can be set with `VITE_BASE_PATH`.

## Live site

This app is hosted at [peterwoolery.github.io/DeepSWE-Enriched-Data](https://peterwoolery.github.io/DeepSWE-Enriched-Data/). The public Pages artifact is built from static assets on standard GitHub-hosted runners; it needs no paid service, database, custom domain, runtime server, or API key. See [deployment and refresh setup](docs/deployment.md).

## Existing local benchmark workflow

The repository also contains the GLM-5.3-Flash benchmark runner below. It is a separate experiment and does not contribute observations to the explorer.

This workflow compares Ollama Cloud's `glm-5.3-flash:cloud` at **low** and **high** reasoning effort on the same deterministic subset of DeepSWE. It pins Pier 0.3.1 (tag `v0.3.1`, source commit `df89f994623a0a6a57229103b6fe910766693c30`), mini-swe-agent 2.4.6, and the DeepSWE task corpus at commit [`0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea`](https://github.com/datacurve-ai/deep-swe/tree/0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea/tasks) (113 tasks).

## Prepare and preview

Prerequisites are Python 3.11+, `uv`, and a local Docker daemon for live runs.

```sh
python3 glm_flash_benchmark.py setup
python3 glm_flash_benchmark.py dry-run --effort both --n-tasks 10 --sample-seed 0
```

`setup` installs `datacurve-pier==0.3.1` into `.benchmark-tools/venv`, downloads the pinned DeepSWE archive, and extracts its `tasks/` tree into `.benchmark-cache/`. It does not need an API key or Docker and does not make model requests. The dry run generates the low/high Pier YAML configs and prints the commands without starting Pier or Docker.

To generate just the config files:

```sh
python3 glm_flash_benchmark.py config --effort both --n-tasks 10 --sample-seed 0
```

## Run

Use a local Docker daemon, then provide the Ollama Cloud API key through the environment. The script maps it to `OPENAI_API_KEY` only in the Pier process environment; the generated configs, provenance, and captured logs redact exact key occurrences.

```sh
read -rsp 'Ollama Cloud API key: ' OLLAMA_API_KEY; printf '\n'; export OLLAMA_API_KEY
python3 glm_flash_benchmark.py run --effort both --n-tasks 10 --sample-seed 0
unset OLLAMA_API_KEY
```

`run` fails before starting Pier if `OLLAMA_API_KEY` is absent. The deterministic Pier-selected task subset is run as sequential one-task jobs, preserving the same sample seed/order while allowing the wrapper to stop scheduling on provider quota, temporary rate-limit, authentication, or configuration errors. For the full low-effort corpus:

```sh
python3 glm_flash_benchmark.py run --effort low --n-tasks 113 --sample-seed 0
```

The account-window fallback defaults can also be stated explicitly:

```sh
python3 glm_flash_benchmark.py run --effort low --n-tasks 113 --sample-seed 0 \
  --session-fallback-hours 5 --weekly-fallback-hours 168 --unknown-fallback-hours 168
```

On explicit quota exhaustion, the run pauses with the failed task and native artifacts retained; `run.json` records the quota category and `next_retry_at`. A generic HTTP 429 / `RateLimitError` without quota wording is recorded separately as a temporary rate limit and gets a short 60-second retry unless provider retry/reset timing is captured. Once ready to continue, resume the same run ID:

```sh
python3 glm_flash_benchmark.py resume --effort low --run-id <run-id>
```

Resume waits in the foreground for the persisted provider retry time, sleeping in intervals of up to 60 seconds. Add `--no-wait` to skip sleeping: if the retry time is still in the future, resume exits with code 75 without making a model request; once the retry time has arrived, it proceeds immediately, even with `--no-wait`. Errors explicitly identifying a session window use the default 5-hour fallback; weekly quota errors and explicit quota errors with an unidentified window use a conservative 168-hour (7-day) fallback. Set `--session-fallback-hours`, `--weekly-fallback-hours`, or `--unknown-fallback-hours` to override those delays (each accepts 0–87,600 hours).

Provider evidence is extracted from the terminal LiteLLM exception in `mini-swe-agent.txt` only when Pier's native result contains a `NonZeroAgentExitCodeError`. The parser requires LiteLLM traceback frames and the final typed exception; echoed task prompts, task/tool output, and generic transcript text do not count. A bare 429 or generic `RateLimitError` is a temporary rate limit, not quota. Authentication/configuration classification remains separate. Pier 0.3.1 does not preserve HTTP response headers, so the wrapper uses retry/reset timing only when serialized provider details include it; otherwise it uses the configured quota fallback or short transient retry.

On resume, a quota-marked attempt is reconciled as completed only when its native result is a clean pass with no native or step exception and Pier exited successfully. A later resume retries only pending or interrupted tasks; scored completed tasks and unrelated trial failures are preserved and not rerun.

The request uses the OpenAI-compatible Ollama endpoint `https://ollama.com/v1`, model `openai/glm-5.3-flash:cloud`, and mini-swe-agent's `reasoning_effort` setting. Pier's installed mini-swe-agent adapter supports that setting, its `config_yaml` endpoint override, and the `OPENAI_API_KEY` environment variable. Ollama documents OpenAI-compatible chat completions, thinking control, and `reasoning_effort` in its [API compatibility guide](https://docs.ollama.com/api/openai-compatibility); see also the [GLM-5.3-Flash model page](https://ollama.com/library/glm-5.3-flash) and [LiteLLM OpenAI-compatible endpoint config](https://docs.litellm.ai/docs/providers/openai_compatible).

## Results

For each effort, `.benchmark-results/<effort>/<run-id>/` contains:

- `run.json`: model, effort, pinned source/version, selected tasks, each task attempt/status, provider reason, quota window or transient-retry source, next retry time, and runner exit code.
- `configs/`, `logs/`, and `jobs/`: per-attempt Pier configs, sanitized console logs, and native trial/verifier artifacts. The workflow redacts exact API-key occurrences while retaining artifact directories.

The combined `.benchmark-results/summary.json` and `summary.csv` are derived from Pier's native `result.json` schema and raw mini-swe-agent usage artifacts. They retain each verifier rewards map and raw `reward`, report `quota` and `rate_limited` attempts separately from `pass`, `failure`, `partial`, `unscored`, `missing_verifier`, and `error`, and exclude quota/rate-limited attempts from model scores. Available usage/cost for all attempts—including quota attempts, transient rate limits, and retries—is retained; missing usage keeps aggregate coverage incomplete, and Pier's reported cost stays separate. Rebuild them later with:

```sh
python3 glm_flash_benchmark.py summarize
```

Pier's mini-swe-agent integration ignores unsupported model-cost calculation errors, so a reported zero cost for this model is not evidence that no subscription quota was consumed. The independent estimate uses the official [Ollama GLM-5.3-Flash pricing](https://ollama.com/library/glm-5.3-flash) rates recorded with their source and access date in `summary.json` and `summary.csv`: $0.15/M uncached input, $0.03/M cached input, and $0.50/M output. Reasoning tokens are already included in output usage and are not counted twice. When raw usage does not expose cache counts, the summary leaves cache usage unknown and labels an uncached-input upper estimate; when input or output usage is unavailable, it leaves the cost estimate empty. Any aggregate fallback is labeled as unverified.

## Offline checks

```sh
python3 -m unittest discover -s tests -v
```
