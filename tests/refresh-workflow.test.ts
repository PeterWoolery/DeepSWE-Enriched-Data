import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const temporaryRoots: string[] = []
const stageScript = resolve('scripts/stage-refresh-pr.sh')

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function writeRepoFile(root: string, relativePath: string, value: string) {
  const path = join(root, relativePath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value)
}

function makeIsolatedRepos() {
  const root = mkdtempSync(join(tmpdir(), 'deepswe-refresh-branch-test-'))
  temporaryRoots.push(root)
  const remote = join(root, 'origin.git')
  const work = join(root, 'work')
  git(root, ['init', '--bare', '--initial-branch=main', remote])
  git(root, ['init', '--initial-branch=main', work])
  git(work, ['config', 'user.name', 'Refresh Workflow Test'])
  git(work, ['config', 'user.email', 'refresh-workflow-test@example.invalid'])
  git(work, ['remote', 'add', 'origin', remote])
  writeRepoFile(work, 'data/candidates/queue.json', '{"schemaVersion":1,"candidates":[]}\n')
  writeRepoFile(work, 'data/candidates/refresh-status.json', '{"status":"approved"}\n')
  writeRepoFile(work, 'data/approved/dataset.json', '{"revisionId":"baseline","lastSuccessfulCheckAt":"old"}\n')
  writeRepoFile(work, 'data/approved/retrievals.json', '{"schemaVersion":1,"events":[]}\n')
  writeRepoFile(work, 'data/approved/source-health.json', '{"sourceStatus":"current"}\n')
  git(work, ['add', '-A'])
  git(work, ['commit', '-m', 'isolated baseline'])
  git(work, ['push', '--set-upstream', 'origin', 'main'])
  return { root, remote, work }
}

function stage(work: string, root: string, branch: string, status: string) {
  const output = join(root, 'github-output')
  const summary = join(root, 'github-summary')
  execFileSync('bash', [stageScript], {
    cwd: work,
    encoding: 'utf8',
    env: {
      ...process.env,
      REFRESH_STATUS: status,
      REFRESH_BRANCH: branch,
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: summary,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return readFileSync(output, 'utf8')
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('refresh workflow PR creation failure handling', () => {
  function openReviewPr(error: string, exitCode: number, existing = '') {
    const root = mkdtempSync(join(tmpdir(), 'deepswe-refresh-pr-test-'))
    temporaryRoots.push(root)
    const summary = join(root, 'summary')
    writeFileSync(summary, '')
    const workflow = readFileSync(resolve('.github/workflows/refresh-data.yml'), 'utf8')
    const step = workflow.split('      - name: Open or update review PR\n')[1]
    const run = step.split('        run: |\n')[1].split('\n').map((line) => line.slice(10)).join('\n')
    const result = spawnSync('bash', ['-c', `
      node() { if [[ "$*" == *httpStatus* ]]; then printf '304\\n'; else printf 'checked-unchanged-recorded\\n'; fi; }
      gh() {
        printf '%s\\n' "$1 $2" >> "$CALLS"
        if [[ "$2" == list ]]; then printf '%s' "$EXISTING"; return 0; fi
        if [[ "$2" == edit ]]; then return 0; fi
        if [[ "$EXIT_CODE" != 0 ]]; then printf '%s\\n' "$PR_ERROR" >&2; return "$EXIT_CODE"; fi
        printf 'https://github.com/example/repo/pull/1\\n'
      }
      ${run}
    `], {
      encoding: 'utf8',
      env: {
        ...process.env, GITHUB_STEP_SUMMARY: summary, DEFAULT_BRANCH: 'main',
        REFRESH_BRANCH: 'automation/test-unchanged', PR_ERROR: error,
        EXIT_CODE: String(exitCode), EXISTING: existing, CALLS: join(root, 'calls'),
      },
    })
    return { result, summary: readFileSync(summary, 'utf8'), calls: readFileSync(join(root, 'calls'), 'utf8') }
  }

  it('preserves the policy denial exit code and explains the owner setting and retained branch', () => {
    const error = 'pull request create failed: GraphQL: GitHub Actions is not permitted to create or approve pull requests (createPullRequest)'
    const { result, summary, calls } = openReviewPr(error, 17)
    expect(result.status).toBe(17)
    expect(result.stderr).toContain(error)
    expect(summary).toContain('Allow GitHub Actions to create and approve pull requests')
    expect(summary).toContain('automation/test-unchanged')
    expect(summary).toContain('not published')
    expect(summary).not.toContain('Opened a source-review PR')
    expect(calls.trim().split('\n')).toEqual(['pr list', 'pr create'])
  })

  it('preserves unrelated creation errors without misdiagnosing repository policy', () => {
    const { result, summary } = openReviewPr('network unavailable', 9)
    expect(result.status).toBe(9)
    expect(result.stderr).toContain('network unavailable')
    expect(summary).not.toContain('Allow GitHub Actions')
    expect(summary).not.toContain('Opened a source-review PR')
  })

  it('records successful creation and updates an existing PR without creating another', () => {
    const created = openReviewPr('', 0)
    expect(created.result.status).toBe(0)
    expect(created.summary).toContain('Opened a source-review PR')
    const updated = openReviewPr('', 0, '42')
    expect(updated.result.status).toBe(0)
    expect(updated.summary).toContain('Updated refresh PR #42')
    expect(updated.calls.trim().split('\n')).toEqual(['pr list', 'pr edit'])
  })
})

describe('refresh workflow branch selection in temporary isolated repositories', () => {
  function chooseBranch(work: string, root: string, openBranch = '') {
    const workflow = readFileSync(resolve('.github/workflows/refresh-data.yml'), 'utf8')
    const step = workflow.split('      - name: Choose or create the one open refresh branch\n')[1].split('      - name: Install locked dependencies\n')[0]
    const run = step.split('        run: |\n')[1].trimEnd().split('\n').map((line) => line.slice(10)).join('\n')
    execFileSync('bash', ['-c', `gh() { printf '%s' "$OPEN_BRANCH"; }; ${run}`], {
      cwd: work,
      env: { ...process.env, DEFAULT_BRANCH: 'main', GITHUB_RUN_ID: '123', GITHUB_ENV: join(root, 'github-env'), OPEN_BRANCH: openBranch },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return readFileSync(join(root, 'github-env'), 'utf8')
  }

  it('resumes the retained branch on a rerun without an open PR and pushes a fast-forward', () => {
    const { root, remote, work } = makeIsolatedRepos()
    const branch = 'automation/deepswe-refresh-123'
    expect(chooseBranch(work, root)).toContain(`REFRESH_BRANCH=${branch}`)
    writeRepoFile(work, 'data/candidates/datacurve-v1.1.json', '{"revision":"first-attempt"}\n')
    stage(work, root, branch, 'candidate-ready')
    const retained = git(work, ['rev-parse', 'HEAD'])
    git(work, ['switch', 'main'])
    git(work, ['branch', '-D', branch])

    expect(chooseBranch(work, root)).toContain(`REFRESH_BRANCH=${branch}`)
    expect(git(work, ['rev-parse', 'HEAD'])).toBe(retained)
    writeRepoFile(work, 'data/candidates/datacurve-v1.1.json', '{"revision":"retry"}\n')
    expect(stage(work, root, branch, 'candidate-ready')).toContain('changed=true')
    expect(git(root, ['--git-dir', remote, 'rev-parse', `refs/heads/${branch}^`])).toBe(retained)
  })

  it('still prefers an existing open review branch over the run-specific branch', () => {
    const { root, work } = makeIsolatedRepos()
    const branch = 'automation/deepswe-refresh-previous'
    git(work, ['switch', '--create', branch])
    writeRepoFile(work, 'data/candidates/datacurve-v1.1.json', '{"revision":"review"}\n')
    stage(work, root, branch, 'candidate-ready')
    const retained = git(work, ['rev-parse', 'HEAD'])
    git(work, ['switch', 'main'])
    git(work, ['branch', '-D', branch])
    expect(chooseBranch(work, root, branch)).toContain(`REFRESH_BRANCH=${branch}`)
    expect(git(work, ['rev-parse', 'HEAD'])).toBe(retained)
  })
})

describe('refresh workflow Git staging in temporary isolated repositories', () => {
  it('commits and pushes a changed official candidate', () => {
    const { root, remote, work } = makeIsolatedRepos()
    const branch = 'automation/test-candidate'
    git(work, ['switch', '--create', branch, 'main'])
    writeRepoFile(work, 'data/candidates/datacurve-v1.1.json', '{"status":"pending-review","revision":"changed"}\n')
    writeRepoFile(work, 'data/candidates/refresh-status.json', '{"status":"candidate-ready"}\n')

    expect(stage(work, root, branch, 'candidate-ready')).toContain('changed=true')
    const stagedFiles = git(root, ['--git-dir', remote, 'ls-tree', '-r', '--name-only', `refs/heads/${branch}`])
    expect(stagedFiles).toContain('data/candidates/datacurve-v1.1.json')
    expect(git(root, ['--git-dir', remote, 'show', `refs/heads/${branch}:data/candidates/datacurve-v1.1.json`])).toContain('pending-review')
  })

  it('commits a metadata-only unchanged check when the optional candidate file is absent', () => {
    const { root, remote, work } = makeIsolatedRepos()
    const branch = 'automation/test-unchanged'
    git(work, ['switch', '--create', branch, 'main'])
    writeRepoFile(work, 'data/candidates/refresh-status.json', '{"status":"checked-unchanged-recorded"}\n')
    writeRepoFile(work, 'data/approved/dataset.json', '{"revisionId":"baseline","lastSuccessfulCheckAt":"new-check","lastDataChangeAt":"old-data"}\n')
    writeRepoFile(work, 'data/approved/retrievals.json', '{"schemaVersion":1,"events":[{"outcome":"checked-unchanged"}]}\n')
    writeRepoFile(work, 'data/approved/source-health.json', '{"sourceStatus":"current","checkedAt":"new-check"}\n')

    expect(stage(work, root, branch, 'checked-unchanged-recorded')).toContain('changed=true')
    const stagedFiles = git(root, ['--git-dir', remote, 'ls-tree', '-r', '--name-only', `refs/heads/${branch}`])
    expect(stagedFiles).not.toContain('data/candidates/datacurve-v1.1.json')
    expect(git(root, ['--git-dir', remote, 'show', `refs/heads/${branch}:data/approved/dataset.json`])).toContain('new-check')
  })

  it('fails closed without a commit or push after source refresh failure', () => {
    const { root, remote, work } = makeIsolatedRepos()
    const branch = 'automation/test-failure'
    git(work, ['switch', '--create', branch, 'main'])
    const headBefore = git(work, ['rev-parse', 'HEAD'])
    const output = join(root, 'failure-output')
    const summary = join(root, 'failure-summary')

    expect(() => execFileSync('bash', [stageScript], {
      cwd: work,
      encoding: 'utf8',
      env: { ...process.env, REFRESH_STATUS: 'failed', REFRESH_BRANCH: branch, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
      stdio: ['ignore', 'pipe', 'pipe'],
    })).toThrow('Source refresh failed')
    expect(git(work, ['rev-parse', 'HEAD'])).toBe(headBefore)
    expect(git(root, ['--git-dir', remote, 'branch', '--list', branch])).toBe('')
  })
})
