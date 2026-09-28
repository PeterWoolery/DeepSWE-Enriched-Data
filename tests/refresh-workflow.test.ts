import { execFileSync } from 'node:child_process'
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
