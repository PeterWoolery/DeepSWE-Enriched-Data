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
