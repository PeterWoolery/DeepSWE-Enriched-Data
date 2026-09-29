# GitHub Pages deployment and source refresh

GitHub Pages is configured for the public [DeepSWE-Enriched-Data repository](https://github.com/PeterWoolery/DeepSWE-Enriched-Data), with the Actions workflow as its source. The site URL is <https://peterwoolery.github.io/DeepSWE-Enriched-Data/>. It is built to static assets and requires no runtime server, database, API key, or custom domain.

## Deployment

Push an approved commit to `main` or use `workflow_dispatch` on that branch. The deploy workflow runs data validation, typecheck, unit tests, and the browser regression suite before building and uploading `dist/` and calling the official Pages actions. The first deployment becomes available after this workflow succeeds.

The required Playwright suite uses Chromium in CI (`npx playwright install --with-deps chromium`) and runs against the plain static project-subpath server. Locally, install Chromium with `npx playwright install chromium`, then run `npm run test:browser`; or set `CHROMIUM_PATH=/path/to/chromium` for an existing compatible executable.

For a project repository the URL is `https://<owner>.github.io/<repository>/`; the workflow derives the base from `GITHUB_REPOSITORY`. A user/organization Pages repository (`<owner>.github.io`) uses `/`. Root builds use `/` outside Actions. Locally verify the project path with:

```sh
npm run build:subpath
npm run test:subpath
STATIC_BASE_PATH=/deepswe-explorer/ STATIC_PORT=4173 npm run serve:static
```

The preview is a plain static-file server: shared query URLs at the project root return `index.html`, assets/data use the subpath, and unknown paths return 404. It is not Vite's development server.

The Pages workflow pins official actions to commit SHAs verified from their GitHub v4/v5 tags during implementation. It uses `ubuntu-latest` standard runners, a one-day Pages artifact retention, and minimal deployment permissions. Configure **Settings → Actions → General** per the repository's Pages policy if deployment permission is denied. The workflow records `github.run_started_at` as last deployment time in that artifact; local builds display deployment as unrecorded. Code-only builds never change source-check or data-change timestamps.

## Reviewed source refresh

`.github/workflows/refresh-data.yml` runs daily at 17:37 UTC and supports manual dispatch on the default branch. It uses the ordinary repository token to update one open refresh PR. It conditionally checks the exact allowlisted Datacurve v1.1 URL, normalizes and validates a candidate, runs the test/build/subpath suite, and never auto-approves or auto-merges numeric observations.

To permit automated PR creation, a repository owner must enable **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests** and save. The workflow's explicit `contents: write` and `pull-requests: write` job permissions do not bypass this separate policy; the repository's default token permissions can remain read-only. If the checkbox is unavailable under an overriding organization/enterprise policy, its administrator must permit it. See [GitHub's repository Actions settings documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#preventing-github-actions-from-creating-or-approving-pull-requests).

The workflow does not approve or merge its PR. If creation returns `GitHub Actions is not permitted to create or approve pull requests`, the job fails visibly with the owner remedy and retained review branch in its summary. The default branch and published approved data remain unchanged. After enabling the setting, manually open a PR from that retained `automation/deepswe-refresh-<run-id>` branch to the default branch and review it normally, or run the refresh again. A rerun of the same run resumes its retained remote branch even without an open PR, preserving its commits and allowing a normal fast-forward push. A new run uses a new branch when no refresh PR is open.

The refresh job pins Ubuntu 24.04 and the official checkout v7.0.1/setup-node v7.0.0 commit SHAs. These actions use the Node.js 24 action runtime; the application/test commands still use Node.js 22 selected by `node-version`.

For a candidate PR, inspect the data diff, evidence hash, additions/changes/removals, score/CI/population, and cost/time scope. On the PR branch, run:

```sh
npm ci
npm run validate:candidate
npm run approve:candidate -- --reviewer "maintainer name" --confirm-source-review
npm run validate
npm test
npm run build
```

The approval command archives the normalized reviewed source snapshot, appends result revision history, combines only approved supplemental reports, and removes the pending source candidate. If configurations disappeared, `--allow-source-removals` is additionally required after reviewing their removal. Commit the generated approval changes to the PR branch and merge normally. Only then does the deploy workflow publish the updated approved snapshot.

When a conditional request returns 304 or a successful 200 fetch has an unchanged hash/normalized dataset, the refresh PR proposes only the last-successful-check metadata and a retrieval-history entry. Review/merge that metadata-only PR to update the site freshness indicator; `lastDataChangeAt` and numeric observations remain unchanged. The site displays stale after 72 hours since the last approved source check.

Public scheduled Actions workflows can be disabled after 60 days without repository activity and can be delayed. Use manual dispatch and merge reviewed metadata/data PRs; the UI does not promise real-time checking. No keepalive commits are generated. Candidate values never enter production rankings or regular exports.

## Limits and cost

The intended deployment uses GitHub's public-repository Pages and standard-runner allowances. The current official documentation states Pages limits of 1 GB published site size, a 100 GB/month soft bandwidth limit, and a 10-minute deployment timeout. Builds contain only compact app assets and normalized facts; they omit PDFs, raw feeds, task bodies, trajectories, and long-lived CI artifacts. No paid runner, paid service, or custom-domain configuration is enabled.

No Docker image or Compose stack is included or needed for this static Pages application; the local `npm run serve:static` command provides the plain-static subpath preview.
